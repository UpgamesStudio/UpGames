require('dotenv').config();
const express = require('express');
const cloudinary = require('cloudinary').v2;
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult, param } = require('express-validator');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// ========== NORMALIZACIÓN DE EMAIL (CONSISTENTE) ==========
// Solo pasa a minúsculas. NO elimina puntos ni subdirecciones (+tag).
// Motivo: por defecto normalizeEmail() borra los puntos de Gmail, así que
// "maria.gonzalez@gmail.com" se guardaba como "mariagonzalez@gmail.com" en el
// registro, pero el login solo hace toLowerCase() y buscaba el email tal cual
// lo escribió la persona → no lo encontraba y no podía entrar. Preservando el
// email evitamos ese desajuste (y pagos de PayPal a una dirección equivocada).
const EMAIL_NORMALIZE_OPTS = {
    gmail_remove_dots: false,
    gmail_remove_subaddress: false,
    outlookdotcom_remove_subaddress: false,
    yahoo_remove_subaddress: false,
    icloud_remove_subaddress: false
};

// Variante "sin puntos" de un email de Gmail, tal como lo guardaba el
// normalizeEmail anterior. Sirve como fallback en el login para que las cuentas
// creadas ANTES de este arreglo (guardadas sin puntos) sigan pudiendo entrar
// escribiendo su email real. Devuelve null si no aplica o si no cambia nada.
function gmailLegacyEmail(email) {
    const m = /^([^@]+)@(gmail\.com|googlemail\.com)$/i.exec(String(email || '').trim());
    if (!m) return null;
    const local = m[1].split('+')[0].replace(/\./g, '');
    const legacy = `${local}@gmail.com`;
    return legacy !== email.toLowerCase() ? legacy : null;
}

// ========== MÓDULOS CENTRALIZADOS ==========
const config       = require('./modulos/config');
const logger       = require('./modulos/logger');
const fraudDetector = require('./modulos/fraudDetector.js');
const { crearIndices } = require('./modulos/crearIndices');
const {
    calcularScoreRecomendacion,
    recalcularScoresUsuario,
    recalcularTodosLosScores,
} = require('./modulos/scoreHelpers');

// ========== ERRORES GLOBALES DEL PROCESO ==========
// Node 22 termina el proceso ante una promesa rechazada sin catch: un solo descuido en
// cualquier módulo reiniciaba el servidor y cortaba todos los lives. Ahora se registra.
process.on('unhandledRejection', err => {
    logger.error(`[proceso] Promesa rechazada sin manejar: ${err?.stack || err}`);
});
// Una excepción síncrona deja el proceso en estado dudoso: registrar y reiniciar ordenadamente
process.on('uncaughtException', err => {
    logger.error(`[proceso] Excepción no capturada, reiniciando: ${err?.stack || err}`);
    setTimeout(() => process.exit(1), 1000).unref();
});

// ========== MÓDULOS DE MEJORAS v2 ==========
const gamification    = require('./modulos/gamification');
const recommendations = require('./modulos/recommendations');
const twoFactor       = require('./modulos/twoFactor');
const nexusLLM        = require('./modulos/nexus/llm');
const nexusMemoria    = require('./modulos/nexus/memoria');
const nexusMentor     = require('./modulos/nexus/mentor');
const gameDetector    = require('./modulos/gameDetector');
const series          = require('./modulos/series');
const push            = require('./modulos/push');
const autoInfo        = require('./modulos/autoInfo');
const memCache        = require('./modulos/cache');
const Limites         = require('./modulos/limites');
const StatsItems      = require('./modulos/statsItems');
const Ranking         = require('./public/upgames-ranking');   // misma fórmula en la web
const Sospecha        = require('./modulos/sospecha');
const Referidos       = require('./modulos/referidos');
const Seo             = require('./modulos/seo');
const ContenidoLegal  = require('./modulos/contenidoLegal');
const Moderacion      = require('./modulos/moderacion');
const CeroTolerancia  = require('./modulos/ceroTolerancia');

/**
 * Moderación de una publicación en segundo plano: texto (IA) + portada (visión).
 * Contenido sexual, odio o acoso con confianza alta → se rechaza sola y se avisa al autor.
 */
async function moderarPublicacion(id) {
    try {
        const j = await Juego.findById(id).select('title description image images category usuario status').lean();
        if (!j || j.status === 'rechazado') return;
        const textoV = await Moderacion.ia(`${j.title}\n${j.description || ''}`, 'publicacion');
        let motivo = null, fuente = 'NEXUS', categoria = textoV?.categoria;
        if (Moderacion.debeQuitar(textoV) && ['sexual', 'odio', 'acoso'].includes(textoV.categoria)) motivo = Moderacion.MENSAJE[textoV.categoria];
        if (!motivo) {
            for (const img of [j.image, ...(j.images || [])].filter(u => /^https:\/\//.test(u || '') && !/\.(mp4|webm|mov|m4v|avi|3gp|3g2|mkv|ogv|mpe?g|wmv|flv)(\?|$)|\/video\/upload\//i.test(u)).slice(0, 2)) {
                const url = img.replace('/upload/', '/upload/w_640,q_auto,f_jpg/');
                const c = await CeroTolerancia.revisarImagen(url).catch(() => null);   // menores, zoofilia, abuso, gore real
                if (c && c.categoria !== 'ok' && c.confianza >= CeroTolerancia.UMBRAL_IMAGEN) {
                    motivo = Moderacion.MENSAJE[c.categoria]; fuente = 'NEXUS visión'; categoria = c.categoria;
                    CeroTolerancia.incidente({ usuario: j.usuario, categoria: c.categoria, motivo: c.motivo, fuente: `NEXUS visión (${c.modelo || 'IA'})`, confianza: c.confianza, donde: 'publicacion', ref: id, texto: j.title, imagen: img, restringir: c.confianza >= CeroTolerancia.UMBRAL_RESTRINGIR });
                    break;
                }
                const v = await Moderacion.imagen(url);
                if (v?.sexual && v.confianza >= 0.75) { motivo = 'su imagen tiene contenido sexual'; fuente = 'NEXUS visión'; categoria = 'sexual'; break; }
            }
        }
        if (!motivo) return;
        await Juego.updateOne({ _id: id }, { $set: { status: 'rechazado', motivoRechazo: `Moderación automática: ${motivo}` } });
        crearNotif({ destinatario: j.usuario, tipo: 'sistema', emisor: 'UpGames', itemId: String(id), itemTitle: 'Revisión', itemImage: '', mensaje: `🚫 Quitamos "${String(j.title).slice(0, 60)}" porque ${motivo}. Revisa las normas de la comunidad.` });
        Moderacion.registrar({ tipo: 'publicacion', usuario: j.usuario, categoria, motivo, fuente, texto: j.title, ref: id, accion: 'rechazada', sinIncidente: fuente === 'NEXUS visión' });
        recommendations.invalidateTrending?.();
        logger.warn(`[moderacion] publicación ${id} de @${j.usuario} rechazada: ${motivo}`);
    } catch (e) { logger.warn(`[moderacion] publicación ${id}: ${e.message}`); }
}
const Extras          = require('./modulos/extras');     // usos extra de los UpCoins y misiones
const UCmod           = require('./modulos/upcoins');
const searchModule    = require('./modulos/search');
// ==========================================

const https = require('https');

// ========================================
// 💳 PAYPAL PAYOUTS API - PAGOS AUTOMÁTICOS
// ========================================

async function getPayPalAccessToken() {
    const clientId     = config.PAYPAL_CLIENT_ID;
    const clientSecret = config.PAYPAL_CLIENT_SECRET;
    const baseUrl      = config.PAYPAL_MODE === 'live'
        ? 'api-m.paypal.com'
        : 'api-m.sandbox.paypal.com';

    if (!clientId || !clientSecret) {
        throw new Error('PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET son requeridos para pagos automáticos');
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const postData = 'grant_type=client_credentials';

    return new Promise((resolve, reject) => {
        const options = {
            hostname: baseUrl,
            path: '/v1/oauth2/token',
            method: 'POST',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.access_token) resolve(parsed.access_token);
                    else reject(new Error(`PayPal token error: ${JSON.stringify(parsed)}`));
                } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

async function enviarPagoPayPal(paypalEmail, monto, pagoId) {
    const baseUrl = config.PAYPAL_MODE === 'live'
        ? 'api-m.paypal.com'
        : 'api-m.sandbox.paypal.com';

    const accessToken = await getPayPalAccessToken();

    const payload = JSON.stringify({
        sender_batch_header: {
            sender_batch_id: `UPGAMES_${pagoId}_${Date.now()}`,
            email_subject: '¡Tu pago de UpGames ha llegado!',
            email_message: 'Has recibido un pago por tus ganancias de creador en UpGames. ¡Gracias por crear!'
        },
        items: [{
            recipient_type: 'EMAIL',
            amount: { value: monto.toFixed(2), currency: 'USD' },
            receiver: paypalEmail,
            note: `Retiro UpGames #${pagoId}`,
            sender_item_id: `item_${pagoId}`
        }]
    });

    return new Promise((resolve, reject) => {
        const options = {
            hostname: baseUrl,
            path: '/v1/payments/payouts',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (res.statusCode === 201) {
                        resolve({
                            batchId:     parsed.batch_header?.payout_batch_id || 'N/A',
                            batchStatus: parsed.batch_header?.batch_status    || 'PENDING'
                        });
                    } else {
                        const msg = parsed.message || parsed.error_description || JSON.stringify(parsed);
                        reject(new Error(`PayPal Payout falló [HTTP ${res.statusCode}]: ${msg}`));
                    }
                } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}


const app = express();
// Railway pone UN proxy delante: confiar solo en ese salto. Así req.ip es la IP real
// del visitante (la que agrega Railway) y no la primera de X-Forwarded-For, que el
// cliente puede inventar. Sin esto los límites de peticiones se compartían entre
// todos los usuarios y el anti-fraude de descargas se podía burlar.
app.set('trust proxy', parseInt(process.env.TRUST_PROXY_HOPS || '1', 10));
// Todas las rutas con :id esperan un ObjectId de Mongo: uno mal formado era un 500 (CastError)
app.param('id', (req, res, next, id) => mongoose.isValidObjectId(id) ? next() : res.status(404).json({ success: false, error: 'No encontrado' }));

// ========== PROXY PLAZMA BURST 2 (TÁCTIL) ==========
// Reservir el juego original H5 same-origin + inyectar controles táctiles.
// Se monta ANTES de helmet/rate-limit: el juego carga ~90 archivos y no debe
// consumir el límite de peticiones ni verse afectado por políticas de la API.
const pb2proxy = require('./modulos/pb2proxy');
pb2proxy.registrar(app);
// ===================================================

// ========== CONFIGURACIÓN DE SEGURIDAD ==========
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

const allowedOrigins = config.ALLOWED_ORIGINS;

app.options('*', cors());

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.some(allowed => origin === allowed || origin.startsWith(allowed + '/'))) {
            callback(null, true);
        } else {
            callback(new Error(`CORS: Origen no permitido → ${origin}`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-token']
}));

app.use(express.json({ limit: '25mb' }));
// Los listados públicos no llevan el enlace de descarga (solo la página puente lo entrega): modulos/sinEnlace.js
// La antigua categoría de copias de consola («ROM») ya no existe: no se puede publicar ni pasar una publicación a ella
const esCategoriaRom = c => /^\s*roms?\s*$/i.test(String(c ?? ''));
app.use((req, res, next) => {
    if ((req.method === 'POST' || req.method === 'PUT') && /^\/(admin\/)?items(\/|$)/.test(req.path) && req.body && esCategoriaRom(req.body.category))
        return res.status(400).json({ success: false, error: 'Esa categoría ya no existe en UpGames. Elige otra categoría.', code: 'SIN_ROMS' });
    next();
});
app.use(require('./modulos/sinEnlace').middleware({ usuarioOpcional: req => usuarioOpcional(req) }));

// ========== ENLACES DE DESCARGA PROTEGIDOS ==========
// El enlace real solo se entrega por POST /economia/validar-descarga (página
// puente: anuncio + contador de descargas = ingresos del creador). Antes /items,
// /items/:id, la búsqueda y el feed lo devolvían en claro y se podía saltar el
// puente. Excepciones: videos (el enlace ES el video) y el propio autor.
// También oculta campos internos (análisis de Nexus, motivo de rechazo).
const CAMPOS_INTERNOS = ['analisisIA', 'nexusMentor', 'motivoRechazo'];
function limpiarPublico(v, yo, prof) {
    if (prof > 6 || !v || typeof v !== 'object' || v instanceof Date) return v;
    if (typeof v.toJSON === 'function' && !Array.isArray(v) && v.constructor?.name !== 'Object') v = v.toJSON();
    if (!v || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(x => limpiarPublico(x, yo, prof + 1));
    const esItem = 'title' in v && 'usuario' in v;
    const out = {};
    for (const [k, val] of Object.entries(v)) {
        if (esItem && v.usuario !== yo) {
            if (k === 'link' && v.category !== 'Video') continue;
            if (CAMPOS_INTERNOS.includes(k)) continue;
        }
        out[k] = limpiarPublico(val, yo, prof + 1);
    }
    return out;
}
app.use((req, res, next) => {
    if (req.method !== 'GET' || /^\/(admin|auth|economia|nexus)\b/.test(req.path)) return next();
    let yo = null;
    const t = req.headers.authorization?.split(' ')[1];
    if (t && t.length > 20) { try { yo = jwt.verify(t, JWT_SECRET).usuario; } catch (_) {} }
    const json = res.json.bind(res);
    res.json = body => json(limpiarPublico(body, yo, 0));
    next();
});
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// ========== RATE LIMITING ==========
// El general queda en memoria a propósito: es grueso y en Mongo sumaría una escritura a CADA petición.
// Antes eran 200 peticiones / 15 min POR IP: una sola persona usando la web con sesión (avisos, chats,
// fichas, ajustes de cuenta…) lo agotaba, y también varias personas tras la misma IP (datos móviles).
// A partir de ahí TODO respondía 429 hasta reiniciar el servidor (el contador vive en memoria): parecía
// que producción se había caído. Ahora el tope es amplio y, con sesión, se cuenta por usuario y no por IP.
const generalLimiter = rateLimit({
    windowMs: config.RATE_LIMIT.GENERAL.windowMs,
    max: config.RATE_LIMIT.GENERAL.max,
    keyGenerator: req => {
        const t = req.headers.authorization?.split(' ')[1];
        if (t && t.length > 20) { try { return 'u:' + jwt.verify(t, JWT_SECRET).usuario; } catch (_) {} }
        return req.ip;
    },
    message: { success: false, error: "Demasiadas peticiones seguidas. Espera un momento e inténtalo de nuevo.", code: 'RATE_LIMIT' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: req => config.NODE_ENV === 'development' || req.path === '/salud'
});

const authLimiter = rateLimit({
    store: new Limites.MongoStore('rl-authLimiter'),
    windowMs: config.RATE_LIMIT.AUTH.windowMs,
    max: config.RATE_LIMIT.AUTH.max,
    message: { error: "Demasiados intentos de login, espera 15 minutos" },
    skipSuccessfulRequests: true,
    skip: () => config.NODE_ENV === 'development'
});

const createLimiter = rateLimit({
    store: new Limites.MongoStore('rl-createLimiter'),
    windowMs: config.RATE_LIMIT.CREATE.windowMs,
    max: config.RATE_LIMIT.CREATE.max,
    message: { error: "Has alcanzado el límite de creación por hora" },
    skip: () => config.NODE_ENV === 'development'
});

const downloadValidationLimiter = rateLimit({
    store: new Limites.MongoStore('rl-downloadValidationLimiter'),
    windowMs: config.RATE_LIMIT.DOWNLOAD_VALIDATION.windowMs,
    max: config.RATE_LIMIT.DOWNLOAD_VALIDATION.max,
    message: { error: "Demasiadas validaciones de descarga. Espera un minuto." },
    skip: () => config.NODE_ENV === 'development'
});

app.use('/auth/login', authLimiter);
app.use('/auth/register', authLimiter);
app.use('/items/add', createLimiter);
app.use('/economia/validar-descarga', downloadValidationLimiter);
app.use(generalLimiter);
// UpGames Blogs con dominio propio: en el dominio de un creador TODAS las rutas son de su blog,
// así que se decide aquí, por el encabezado Host, antes que cualquier otra ruta (rutas/blogs.js)
let blogsPorHost = null;
app.use((req, res, next) => blogsPorHost ? blogsPorHost(req, res, next) : next());

// ========== LOGGING DE REQUESTS ==========
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        const msg = `[${req.method}] ${req.path} - ${res.statusCode} (${duration}ms)`;
        if (res.statusCode >= 400) logger.warn(msg);
        else logger.info(msg);
    });
    next();
});

// ========== CONEXIÓN MONGODB ==========
const MONGODB_URI = config.MONGODB_URI;
const JWT_SECRET  = config.JWT_SECRET;

// Caché corta de lecturas públicas (perfil, ficha, favoritos, comentarios, rankings…):
// cada consulta a Mongo cuesta ~200 ms; las escrituras la vacían al momento (modulos/cacheRespuestas.js)
const cacheRespuestas = require('./modulos/cacheRespuestas').crear({ secreto: JWT_SECRET });
app.use(cacheRespuestas.middleware);

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dd4w2plxn',
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});
// Subidas con o sin credenciales de servidor + copia de portadas externas (modulos/imagenes.js)
const imagenes = require('./modulos/imagenes').crear({ cloudinary, logger });

const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (process.env.NODE_ENV === 'production' && (!JWT_REFRESH_SECRET || JWT_REFRESH_SECRET === JWT_SECRET)) {
    logger.error('❌ JWT_REFRESH_SECRET debe ser un secreto INDEPENDIENTE en producción');
    process.exit(1);
}

const APP_URL = process.env.APP_URL || 'https://upgames.games';
const API_URL_SELF = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : `http://localhost:${process.env.PORT || 10000}`;

// ── EMAIL ──────────────────────────────────────────────────────────
// Railway bloquea el SMTP (Gmail) en el plan Hobby: se envía por la API HTTPS de
// Resend (RESEND_API_KEY + EMAIL_FROM) o Brevo. Detalles en modulos/correo.js.
const correo = require('./modulos/correo').crear({ nodemailer, logger });
correo.verificar().then(e => {
    if (e.ok) logger.info(`📧 Email listo (${e.proveedor})`);
    else logger.error(`📧 EMAIL NO FUNCIONA — ${e.detalle}`);
}).catch(() => {});
const sendEmail = correo.enviar;
// Errores en tiempo real: cada logger.error se agrupa y un error nuevo o un pico avisa por correo (y a Sentry si hay SENTRY_DSN)
const Alertas = require('./modulos/alertas');
Alertas.instalar(logger, { sendEmail });

// ── TEMPLATES DE EMAIL ────────────────────────────────────────────────
function emailVerifTemplate(usuario, link) {
    return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#0a0a0f;color:#f0f0f8;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#1a1a24,#0f0f18);padding:32px 28px;text-align:center;border-bottom:1px solid rgba(94,255,67,.15)">
        <div style="font-size:32px;font-weight:900;letter-spacing:-.5px">
          <span style="color:#5EFF43">UP</span><span>GAMES</span>
        </div>
        <div style="color:#60607a;font-size:12px;margin-top:4px;letter-spacing:.1em">VERIFICACIÓN DE CUENTA</div>
      </div>
      <div style="padding:32px 28px">
        <h2 style="font-size:20px;margin:0 0 12px;font-weight:700">Hola, @${usuario} 👋</h2>
        <p style="color:#a0a0b8;line-height:1.6;margin:0 0 24px">
          Gracias por registrarte en UpGames. Confirma tu email para activar tu cuenta y empezar a publicar, descargar y ganar dinero.
        </p>
        <div style="text-align:center;margin:28px 0">
          <a href="${link}" style="display:inline-block;padding:14px 32px;background:#5EFF43;color:#000;font-weight:800;font-size:15px;border-radius:8px;text-decoration:none;letter-spacing:.02em">
            ✅ Verificar mi email
          </a>
        </div>
        <p style="color:#60607a;font-size:12px;text-align:center;margin:0">
          Este link expira en <strong>24 horas</strong>. Si no creaste esta cuenta, ignora este mensaje.
        </p>
      </div>
    </div>`;
}

function emailAvisoTemplate(usuario, mensajeHtml) {
    return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#0a0a0f;color:#f0f0f8;border-radius:12px;overflow:hidden">
      <div style="padding:24px 28px;text-align:center;border-bottom:1px solid rgba(94,255,67,.15)"><span style="color:#5EFF43;font-size:26px;font-weight:900">UP</span><span style="font-size:26px;font-weight:900">GAMES</span></div>
      <div style="padding:28px">
        <h2 style="font-size:18px;margin:0 0 12px">Hola, @${usuario}</h2>
        <p style="color:#c0c0d0;line-height:1.6;margin:0">${mensajeHtml}</p>
      </div>
    </div>`;
}

function emailResetTemplate(usuario, link, codigo) {
    return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#0a0a0f;color:#f0f0f8;border-radius:12px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#1a1a24,#0f0f18);padding:32px 28px;text-align:center;border-bottom:1px solid rgba(94,255,67,.15)">
        <div style="font-size:32px;font-weight:900;letter-spacing:-.5px">
          <span style="color:#5EFF43">UP</span><span>GAMES</span>
        </div>
        <div style="color:#60607a;font-size:12px;margin-top:4px;letter-spacing:.1em">RECUPERACIÓN DE CONTRASEÑA</div>
      </div>
      <div style="padding:32px 28px">
        <h2 style="font-size:20px;margin:0 0 12px;font-weight:700">Hola, @${usuario} 🔐</h2>
        <p style="color:#a0a0b8;line-height:1.6;margin:0 0 24px">
          Recibimos una solicitud para restablecer tu contraseña. ${codigo ? 'Escribe este código en la página de UpGames:' : 'Haz clic en el botón de abajo para crear una nueva.'}
        </p>
        ${codigo ? `<div style="text-align:center;margin:8px 0 22px"><div style="display:inline-block;padding:16px 26px;background:#12121c;border:1px solid rgba(94,255,67,.35);border-radius:12px;font-size:34px;font-weight:900;letter-spacing:10px;color:#5EFF43;font-family:'Courier New',monospace">${codigo}</div>
          <p style="color:#60607a;font-size:12px;margin:10px 0 0">El código vence en <strong>15 minutos</strong>. Nunca lo compartas: nadie de UpGames te lo pedirá.</p></div>
        <p style="color:#a0a0b8;line-height:1.6;margin:0 0 8px;text-align:center;font-size:13px">¿Prefieres un clic? También puedes usar el botón:</p>` : ''}
        <div style="text-align:center;margin:28px 0">
          <a href="${link}" style="display:inline-block;padding:14px 32px;background:#5EFF43;color:#000;font-weight:800;font-size:15px;border-radius:8px;text-decoration:none;letter-spacing:.02em">
            🔑 Restablecer contraseña
          </a>
        </div>
        <p style="color:#60607a;font-size:12px;text-align:center;margin:0">
          Este link expira en <strong>1 hora</strong>. Si no solicitaste esto, ignora este mensaje.
        </p>
      </div>
    </div>`;
}

mongoose.connect(MONGODB_URI, config.MONGODB_OPTIONS)
// Las publicaciones que quedaban en la antigua categoría de copias de consola se retiran del catálogo (no se borran:
// su dueño puede pasarlas a otra categoría). El motivo que ve el autor no nombra esa palabra (también se corrige en las ya retiradas).
.then(() => {
    const J = mongoose.model('Juego'), MOTIVO = 'Esta categoría se eliminó de UpGames. Si tu publicación no es una copia de un juego de consola, edítala y elige otra categoría.';
    J.updateMany({ category: { $regex: /^roms?$/i }, status: { $ne: 'rechazado' } }, { $set: { status: 'rechazado', motivoRechazo: MOTIVO } })
        .then(r => { if (r.modifiedCount) logger.info(`[copias] ${r.modifiedCount} publicaciones retiradas del catálogo`); })
        .then(() => J.updateMany({ motivoRechazo: { $regex: /\broms?\b/i } }, { $set: { motivoRechazo: MOTIVO } }))
        .catch(e => logger.warn(`[copias] ${e.message}`));
})
.then(() => { logger.info('MONGODB CONECTADO EXITOSAMENTE'); require('./modulos/upcoins').migrar(mongoose.model('Usuario'), logger).catch(e => logger.error(`[upcoins] migración: ${e.message}`)); })
.catch(err => {
    logger.error(`ERROR CONEXIÓN MONGODB: ${err.message}`);
    process.exit(1);
});

mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB desconectado. Intentando reconectar...');
});

// ========== SCHEMAS ==========

const DescargaIPSchema = new mongoose.Schema({
    juegoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Juego', required: true },
    ip:      { type: String, required: true },
    contadorHoy: { type: Number, default: 1 },
    fecha: { type: Date, default: Date.now, expires: 86400 }
});
DescargaIPSchema.index({ juegoId: 1, ip: 1 });
const DescargaIP = mongoose.model('DescargaIP', DescargaIPSchema);

const ReporteSchema = new mongoose.Schema({
    juegoId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Juego', required: true, index: true },
    motivo:           { type: String, enum: ['caido', 'viejo', 'malware'], required: true },
    usuarioReportante:{ type: String, default: 'Anónimo' },
    ip:               { type: String, required: true },
    fecha:            { type: Date, default: Date.now, index: true }
});
ReporteSchema.index({ juegoId: 1, ip: 1, fecha: -1 });
const Reporte = mongoose.model('Reporte', ReporteSchema);

const JuegoSchema = new mongoose.Schema({
    usuario:    { type: String, required: true, trim: true, default: "Cloud User" },
    title:      { type: String, required: true, maxlength: 200, trim: true },
    description:{ type: String, maxlength: 1000, default: '' },
    image:      { type: String, default: '' },
    images:     { type: [String], default: [], validate: { validator: arr => arr.length <= 4, message: 'Máximo 4 medias adicionales' } },
    link:       { type: String, required: true },
    status:     { type: String, enum: ["pendiente", "aprobado", "rechazado", "pending", "privado"], default: "pendiente" },
    linkStatus: { type: String, enum: ["online", "revision", "caido"], default: "online" },
    visibility: { type: String, enum: ["public", "private"], default: "public" },
    reportes:   { type: Number, default: 0, min: 0 },
    reportesDesglose: {
        caido:   { type: Number, default: 0 },
        viejo:   { type: Number, default: 0 },
        malware: { type: Number, default: 0 }
    },
    category:           { type: String, default: "General", trim: true },
    tags:               [String],
    descargasEfectivas: { type: Number, default: 0, min: 0 },   // visualizaciones de publicidad verificadas en la página puente (lo único que se paga)
    vistas:             { type: Number, default: 0, min: 0 },   // reproducciones de videos: no generan ganancia ni cuentan como descarga
    likesCount:         { type: Number, default: 0, min: 0 },
    scoreRecomendacion: { type: Number, default: 0 },
    videoType:          { type: String, default: '' },
    featuredItemId:     { type: String, default: '' },
    extraData:          { type: mongoose.Schema.Types.Mixed, default: {} },
    nexusMentor:        { type: mongoose.Schema.Types.Mixed, default: null },
    // Publicaciones divididas en partes (modulos/series.js)
    serie: { clave: { type: String }, base: String, parte: Number, total: Number }
}, { timestamps: true, strict: false });
JuegoSchema.index({ 'serie.clave': 1, 'serie.parte': 1 });

JuegoSchema.index({ usuario: 1, status: 1 });
JuegoSchema.index({ createdAt: -1 });
JuegoSchema.index({ linkStatus: 1 });
JuegoSchema.index({ descargasEfectivas: -1 });
JuegoSchema.index({ likesCount: -1 });
JuegoSchema.index({ status: 1 });
JuegoSchema.index({ scoreRecomendacion: -1 });
JuegoSchema.index({ usuario: 1, descargasEfectivas: -1 }); // ⭐ Para topUploaders en dashboard

JuegoSchema.pre('save', function(next) {
    if (this.reportes >= 3) this.linkStatus = 'revision';
    next();
});
// Cambios en publicaciones invalidan el catálogo cacheado (ver cacheado()). Los que
// solo suben contadores (cada descarga, like o vista) no: vaciarían la caché a cada
// descarga y el TTL de 30 s ya los refresca.
const CONTADORES_JUEGO = new Set(['descargasEfectivas', 'likesCount', 'meGustaCount', 'vistas', 'scoreRecomendacion', 'reportes', 'resenas', 'enlaceRevisado', 'enlaceMuertoDesde', 'compat']);
const soloContadores = u => !!u && !Array.isArray(u) && Object.keys(u).length > 0 &&
    Object.entries(u).every(([op, campos]) => (op === '$inc' || op === '$set') && campos && Object.keys(campos).every(f => CONTADORES_JUEGO.has(f)));
JuegoSchema.post(['save', 'insertMany', 'updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete', 'findOneAndReplace', 'replaceOne'], function () {
    if (typeof this?.getUpdate === 'function' && soloContadores(this.getUpdate())) return;
    memCache.invalidate('items:*');
});
JuegoSchema.add({ imageOrigen: { type: String, default: '' }, portadaMigrada: { type: Boolean, default: false } });
// Visibilidad: impulsoHasta = el autor tiene Premium (sube en el inicio); destacadoHasta = lo
// destacó pagando UpCoins (aparece arriba marcado como "Promocionado")
JuegoSchema.add({ impulsoHasta: { type: Date, default: null }, destacadoHasta: { type: Date, default: null } });
// Nivel de la promoción pagada (estandar | plus | max): más UpCoins, más peso en el feed (upgames-ranking.js)
JuegoSchema.add({ promoNivel: { type: String, default: null } });
// UpCoins por día de la promoción vigente: cuanto más invierte el creador, más pesa (upgames-ranking.js)
JuegoSchema.add({ promoUCDia: { type: Number, default: 0 } });
// Me gusta (distinto de guardar en favoritos): contador para las tarjetas y el feed de videos
JuegoSchema.add({ meGustaCount: { type: Number, default: 0, min: 0 } });
// Revisión prioritaria pagada con UpCoins (rutas/extrasUC.js): va primero en la cola; si no se revisa en 24 h se devuelve
// Posible juego comercial completo (modulos/sospecha.js): se publica, sigue con anuncios,
// pero no genera pagos al creador mientras el equipo lo verifica
JuegoSchema.add({ pagoPausado: { type: Boolean, default: false }, sospecha: { type: mongoose.Schema.Types.Mixed, default: null },
    declaracion: { type: mongoose.Schema.Types.Mixed, default: null } });
// Revisión diaria de enlaces: cuándo se comprobó y desde cuándo parece caído
JuegoSchema.add({ enlaceRevisado: { type: Date, default: null }, enlaceMuertoDesde: { type: Date, default: null } });
// Guía de instalación opcional escrita por el autor (texto) y/o un video tutorial suyo en UpGames
JuegoSchema.add({ guiaInstalacion: { type: String, default: '', maxlength: 3000 }, tutorialId: { type: String, default: '' } });
JuegoSchema.add({ prioridadDesde: { type: Date, default: null }, prioridadReembolso: { type: Boolean, default: false } });
const Juego = mongoose.model('Juego', JuegoSchema);

// ── Caché de lecturas públicas calientes ──
// TTL corto + invalidación por hooks del modelo. Las peticiones simultáneas con
// la misma clave comparten UNA consulta (sin estampida al expirar). El resultado
// se sirve igual que antes: limpiarPublico() sigue filtrando enlaces por usuario.
const enVuelo = new Map();
function cacheado(clave, ttlSeg, cargar) {
    const hit = memCache.get(clave);
    if (hit !== null) return Promise.resolve(hit);
    if (enVuelo.has(clave)) return enVuelo.get(clave);
    const p = Promise.resolve().then(cargar)
        .then(v => { if (v !== null && v !== undefined) memCache.set(clave, v, ttlSeg); return v; })
        .finally(() => enVuelo.delete(clave));
    enVuelo.set(clave, p);
    return p;
}

const UsuarioSchema = new mongoose.Schema({
    usuario:    { type: String, required: true, unique: true, index: true, minlength: 3, maxlength: 20, trim: true, lowercase: true },
    email:      { type: String, required: true, unique: true, lowercase: true, trim: true, index: true, match: [/^\S+@\S+\.\S+$/, 'Email inválido'] },
    password:   { type: String, required: true, minlength: 6 },
    paypalEmail:{ type: String, default: '', lowercase: true, trim: true, match: [/^(\S+@\S+\.\S+)?$/, 'Email de PayPal inválido'] },
    saldo:      { type: Number, default: 0, min: 0 },
    // Live: monedas compradas (para regalar) y ganancias de regalos aún en retención
    monedas:       { type: Number, default: 0, min: 0 },
    ucv:           { type: Number, default: 2 },   // versión de UpCoins de `monedas` (2 = 1 UC vale US$0,02)
    saldoRetenido: { type: Number, default: 0, min: 0 },
    // Referidos (modulos/referidos.js): quién lo invitó y si ya se pagó la invitación
    referidoPor:     { type: String, default: '', index: true },
    referidoEstado:  { type: String, default: '' },   // pendiente · procesando · pagado · tope · misma_red · bloqueado
    referidoEn:      { type: Date, default: null },
    referidoPagadoEn:{ type: Date, default: null },
    strikesModeracion: { type: Number, default: 0 },   // veces que la moderación automática quitó algo suyo
    ultimoStrike:    { type: Date, default: null },
    liveKey:       { type: String, default: null, select: false },   // clave de transmisión (OBS)
    sesionVer:     { type: Number, default: 0 },
    avisoVerifEnviado: { type: Boolean, default: false },   // notificación "verifica tu email" ya enviada
    // Premium (prepago, sin cobros automáticos). planId: pase7 | pase30 | pase365 | cortesia
    planId:           { type: String, default: '' },
    planHasta:        { type: Date, default: null },
    planRecordatorio: { type: Boolean, default: true },   // avisar 2 días antes de que venza
    paseFondoUsd:     { type: Number, default: 0 },   // fondo para creadores de sus Premium (≤ 25 % de lo pagado)
    // NEXUS IA: mensajes gratis usados hoy y créditos comprados con UpCoins
    iaUso:            { dia: { type: String, default: '' }, usados: { type: Number, default: 0 }, premium: { type: Number, default: 0 } },   // premium: solo estadística
    iaCreditos:       { type: Number, default: 0, min: 0 },
    // Estilo comprado con UpCoins o ganado en misiones (modulos/extras.js)
    cosmeticos:       { type: [String], default: [] },
    estilo:           { marco: { type: String, default: '' }, color: { type: String, default: '' }, fondo: { type: String, default: '' }, tarjeta: { type: String, default: '' }, insignias: { type: [String], default: [] } },
    // Dónde recibe sus retiros (rutas/cobros.js). Los datos van cifrados; resumen = versión enmascarada
    cobro: { tipo: { type: String, default: '' }, cifrado: { type: String, default: '' }, resumen: { type: String, default: '' }, actualizado: Date, esperaHasta: Date },
    planAvisadoHasta: { type: Date, default: null },      // vencimiento ya avisado (un aviso por periodo)
    descargasTotales:      { type: Number, default: 0, min: 0 },
    isVerificado:          { type: Boolean, default: false, index: true },
    solicitudPagoPendiente:{ type: Boolean, default: false },
    reputacion: { type: Number, default: 0 },
    listaSeguidores: [String],
    siguiendo:       [String],
    verificadoNivel: { type: Number, default: 0, min: 0, max: 3, index: true },
    avatar:   { type: String, default: "" },
    banner:   { type: String, default: "" },   // portada del perfil (detrás del avatar)
    bio:      { type: String, maxlength: 200, default: '' },
    fecha:    { type: Date, default: Date.now },
    registrationIP:  { type: String, default: '' },
    // Seguridad (modulos/ceroTolerancia.js): IPs recientes para reportes a las autoridades y restricción preventiva
    ultimaIp:        { type: String, default: '', select: false },
    ipsVistas:       { type: [String], default: [], select: false },
    restriccionSeguridad: { type: Boolean, default: false, index: true },
    restriccionMotivo:    { type: String, default: '' },
    restriccionFecha:     { type: Date, default: null },
    listaNegraAdmin: { type: Boolean, default: false, index: true },
    notasAdmin:      { type: String, default: '', maxlength: 500 },
    fechaListaNegra: { type: Date, default: null },
    ultimoLogin:     { type: Date, default: Date.now, index: true },
    emailVerificado:     { type: Boolean, default: false, index: true },
    emailVerifToken:     { type: String, default: null },
    emailVerifExpires:   { type: Date, default: null },
    resetPasswordToken:  { type: String, default: null },
    resetPasswordExpires:{ type: Date, default: null },
    // Recuperación con código de 6 dígitos (se guarda solo su hash; 15 min y 5 intentos)
    resetCodigoHash:    { type: String, default: null },
    resetCodigoExpires: { type: Date, default: null },
    resetCodigoIntentos:{ type: Number, default: 0 },
    bloqueados:  { type: [String], default: [] },   // usuarios bloqueados en el chat
    // Panel admin: '' = usuario normal. El dueño se reconoce por OWNER_EMAIL (rutas/adminPanel.js)
    adminRol:      { type: String, default: '', index: true },   // clave de ROLES en rutas/adminPanel.js
    adminPermisos: { type: [String], default: [] },
    adminPermisosV:{ type: Number, default: 0 },    // 2 = permisos granulares (roles exclusivos)
    adminDesde:    { type: Date, default: null },
    adminPor:      { type: String, default: '' },
    adminPausado:  { type: Boolean, default: false },
    adminHasta:    { type: Date, default: null },   // acceso temporal
    adminSesionVer:{ type: Number, default: 0 },    // +1 = cierra todas sus sesiones del panel
    // Qué avisos push quiere recibir en el móvil (Revisión/Equipo se envían siempre)
    notifPrefs: {
        publicaciones: { type: Boolean, default: true },   // creadores que sigo publican algo
        mensajes:      { type: Boolean, default: true },
        social:        { type: Boolean, default: true },   // seguidores, likes, comentarios, logros
        anuncios:      { type: Boolean, default: true },
    },
    suspendido:       { type: Boolean, default: false, index: true },   // no puede iniciar sesión ni usar su token
    motivoSuspension: { type: String, default: '', maxlength: 300 },
    fechaSuspension:  { type: Date, default: null },
    socialLinks: { type: [String], default: [], validate: { validator: v => v.length <= 4, message: 'Máximo 4 links sociales' } },
    lastUsernameChange: { type: Date, default: null },
    lastEmailChange:    { type: Date, default: null },
    tarjetas: [{
        alias:         { type: String, maxlength: 40, default: '' },
        titular:       { type: String, required: true, maxlength: 100 },
        ultimos4:      { type: String, required: true, match: /^\d{4}$/ },
        mesExp:        { type: String, required: true },
        anioExp:       { type: String, required: true },
        tipo:          { type: String, enum: ['visa', 'mastercard', 'amex', 'otro'], default: 'otro' },
        proposito:     { type: String, enum: ['cobros', 'pagos', 'ambos'], default: 'ambos' },
        esPrincipal:   { type: Boolean, default: false },
        fechaAgregada: { type: Date, default: Date.now }
    }]
}, { collection: 'usuarios', timestamps: true });

UsuarioSchema.pre('save', function(next) {
    if (this.verificadoNivel >= 1 && !this.isVerificado) this.isVerificado = true;
    next();
});
const Usuario = mongoose.model('Usuario', UsuarioSchema);

const PagoSchema = new mongoose.Schema({
    usuario:    { type: String, required: true, index: true },
    monto:      { type: Number, required: true, min: 0 },
    paypalEmail:{ type: String, default: '' },
    metodo:     { type: String, default: 'paypal' },   // paypal | nequi | daviplata | banco | mercadopago
    resumen:    { type: String, default: '' },         // método enmascarado (lo ve el usuario)
    datosCobro: { type: String, default: '' },         // datos completos cifrados (solo el admin al pagar)
    referencia: { type: String, default: '' },         // comprobante de la transferencia
    estado:     { type: String, enum: ['pendiente', 'procesado', 'completado', 'rechazado'], default: 'pendiente', index: true },
    fecha:      { type: Date, default: Date.now },
    notas:      { type: String, default: '' }
}, { timestamps: true });
const Pago = mongoose.model('Pago', PagoSchema);

const CommentSchema = new mongoose.Schema({
    usuario: String,
    texto:   String,
    itemId:  String,
    fecha:   { type: Date, default: Date.now }
});
const Comentario = mongoose.model('Comentario', CommentSchema);

// ⭐ FavoritosSchema con índices (corrige COLLSCAN en GET /favoritos/:usuario)
const FavoritosSchema = new mongoose.Schema({
    usuario: { type: String, required: true, index: true },
    itemId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Juego' }
});
FavoritosSchema.index({ usuario: 1, itemId: 1 }, { unique: true });
const Favorito = mongoose.model('Favoritos', FavoritosSchema);

const NotificacionSchema = new mongoose.Schema({
    destinatario: { type: String, required: true, index: true },
    tipo:     { type: String, enum: ['nueva_publicacion', 'favorito', 'descarga', 'sistema', 'comentario', 'seguidor', 'logro'], required: true },
    emisor:   { type: String, required: true },
    itemId:   { type: String, default: '' },
    itemTitle:{ type: String, default: '' },
    itemImage:{ type: String, default: '' },
    mensaje:  { type: String, default: '' },
    leida:    { type: Boolean, default: false, index: true },
    fecha:    { type: Date, default: Date.now, index: true, expires: 30 * 24 * 60 * 60 }
}, { collection: 'notificaciones', timestamps: false });
NotificacionSchema.index({ destinatario: 1, leida: 1, fecha: -1 });
// Push real al móvil: cada notificación NUEVA dispara su push (modulos/push.js)
NotificacionSchema.pre('save', function (next) { this.$locals.nueva = this.isNew; next(); });
NotificacionSchema.post('save', function (doc) { if (doc.$locals?.nueva) push.alCrear([doc]); });
NotificacionSchema.post('insertMany', function (docs) { push.alCrear(Array.isArray(docs) ? docs : [docs]); });
const Notificacion = mongoose.model('Notificacion', NotificacionSchema);

/**
 * Helper unificado para crear notificaciones de forma segura (fire-and-forget).
 * Evita auto-notificarse y nunca lanza errores que rompan la petición principal.
 */
function crearNotif({ destinatario, tipo, emisor = '', itemId = '', itemTitle = '', itemImage = '', mensaje = '' }) {
    try {
        if (!destinatario || !tipo) return;
        if (emisor && destinatario.toLowerCase() === emisor.toLowerCase()) return; // no auto-notificar
        new Notificacion({
            destinatario: destinatario.toLowerCase(),
            tipo, emisor, itemId: itemId || '', itemTitle: itemTitle || '',
            itemImage: itemImage || '', mensaje: mensaje || '',
            leida: false, fecha: new Date()
        }).save().catch(err => logger.debug(`[crearNotif] ${err.message}`));
    } catch (err) {
        logger.debug(`[crearNotif] ${err.message}`);
    }
}

const MensajeSchema = new mongoose.Schema({
    de:     { type: String, required: true, index: true },
    para:   { type: String, required: true, index: true },
    texto:  { type: String, default: '', maxlength: 2000 },
    imagen: { type: String, default: '' },
    leido:  { type: Boolean, default: false, index: true },
    fecha:  { type: Date, default: Date.now, index: true, expires: 90 * 24 * 60 * 60 },
    // Chat v2
    actualizado: { type: Date, default: Date.now, index: true },   // cambia al leer/editar/reaccionar/borrar
    editado:     { type: Boolean, default: false },
    borrado:     { type: Boolean, default: false },                 // eliminado para todos
    ocultoPara:  { type: [String], default: [] },                   // eliminado/vaciado solo para esos usuarios
    replyTo:     { id: String, de: String, texto: String, imagen: Boolean },
    reacciones:  { type: [{ u: String, e: String, _id: false }], default: [] }
}, { collection: 'mensajes', timestamps: false });
MensajeSchema.index({ de: 1, para: 1, fecha: 1 });
MensajeSchema.index({ para: 1, leido: 1 });
const Mensaje = mongoose.model('Mensaje', MensajeSchema);

const StorySchema = new mongoose.Schema({
    usuario: { type: String, required: true, index: true },
    imagen:  { type: String, default: '' },
    texto:   { type: String, default: '', maxlength: 200 },
    vistos:  { type: [String], default: [] },
    fecha:   { type: Date, default: Date.now, index: true, expires: 24 * 60 * 60 }
}, { collection: 'stories', timestamps: false });
const Story = mongoose.model('Story', StorySchema);

// ========== SESIONES ==========
// Todo token lleva la versión de sesión del usuario (sv). Al cambiar o restablecer la
// contraseña la versión sube y los tokens anteriores dejan de valer (antes un token
// robado seguía sirviendo 30 días aunque cambiaras la contraseña).
const firmarToken = u => jwt.sign({ usuario: u.usuario, email: u.email, sv: u.sesionVer || 0 }, JWT_SECRET, { expiresIn: '30d' });
const versionSesion = new Map();   // usuario → { v, t } (caché 60 s: no consultar Mongo en cada petición)
async function versionActual(usuario) {
    const c = versionSesion.get(usuario);
    if (c && Date.now() - c.t < 60000) return c.v;
    const u = await Usuario.findOne({ usuario }).select('sesionVer').lean();
    const v = u ? (u.sesionVer || 0) : -1;
    if (versionSesion.size > 50000) versionSesion.clear();
    versionSesion.set(usuario, { v, t: Date.now() });
    return v;
}
async function cerrarOtrasSesiones(usuario) {
    const u = await Usuario.findOneAndUpdate({ usuario }, { $inc: { sesionVer: 1 } }, { new: true }).select('usuario email sesionVer').lean();
    versionSesion.delete(usuario);
    return u;
}

// ========== MIDDLEWARE JWT ==========
const presenciaEscrita = new Map();   // usuario → ms de la última escritura de ultimoLogin
const verificarToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    // Detectar "Bearer null" o "Bearer undefined" que llegan del frontend
    if (!token || token === 'null' || token === 'undefined' || token.length < 20) {
        return res.status(401).json({ success: false, error: "Sesión no iniciada", code: "NO_TOKEN" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (adminPanel.estaSuspendido(decoded.usuario))
            return res.status(403).json({ success: false, error: 'Tu cuenta está suspendida. Contacta a soporte.', code: 'SUSPENDIDO' });
        req.usuario = decoded.usuario;
        req.userTokenData = decoded;

        // Presencia: actualizar ultimoLogin como máximo una vez por minuto
        // (antes era una escritura en la BD en CADA petición autenticada)
        const ahoraMs = Date.now();
        if ((presenciaEscrita.get(decoded.usuario) || 0) < ahoraMs - 60000) {
            presenciaEscrita.set(decoded.usuario, ahoraMs);
            if (presenciaEscrita.size > 50000) presenciaEscrita.clear();
            const ip = CeroTolerancia.ipDe(req);
            Usuario.updateOne({ usuario: decoded.usuario }, ip
                ? [{ $set: { ultimoLogin: '$$NOW', ultimaIp: ip, ipsVistas: { $slice: [{ $setUnion: [[ip], { $ifNull: ['$ipsVistas', []] }] }, 40] } } }]
                : { $set: { ultimoLogin: new Date() } }).catch(() => {});
        }

        // Sesión revocada (cambió la contraseña en otro dispositivo) o cuenta eliminada
        versionActual(decoded.usuario).then(v => {
            if (v === -1) return res.status(401).json({ success: false, error: 'La cuenta ya no existe', code: 'TOKEN_INVALID' });
            if ((decoded.sv || 0) !== v) return res.status(401).json({ success: false, error: 'Tu contraseña cambió. Vuelve a iniciar sesión.', code: 'SESSION_REVOKED' });
            next();
        }, () => next());   // si Mongo falla un instante, no tumbar todas las sesiones
    } catch (error) {
        // Distinguir expirado vs firma inválida
        const code = error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
        const msg  = code === 'TOKEN_EXPIRED'
            ? 'Tu sesión expiró, vuelve a iniciar sesión'
            : 'Sesión inválida, vuelve a iniciar sesión';
        return res.status(401).json({ success: false, error: msg, code });
    }
};

// Sesión opcional: devuelve el usuario si el token es válido, o null (invitado)
function usuarioOpcional(req) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token || token.length < 20) return null;
    try {
        const u = jwt.verify(token, JWT_SECRET).usuario;
        return u && !adminPanel.estaSuspendido(u) ? u : null;
    } catch (_) { return null; }
}

// ========== CONSTANTES DE ECONOMÍA ==========
const CPM_VALUE                = config.CPM_VALUE;
const AUTHOR_PERCENTAGE        = config.AUTHOR_PERCENTAGE;

const MIN_WITHDRAWAL           = config.MIN_WITHDRAWAL;
const MAX_DOWNLOADS_PER_IP_PER_DAY = config.MAX_DOWNLOADS_PER_IP_PER_DAY;

// ══════════════════════════════════════════════════════════════
//  EMAIL VERIFICACIÓN
// ══════════════════════════════════════════════════════════════

app.get('/auth/verify-email/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const usuario = await Usuario.findOne({
            emailVerifToken: token,
            emailVerifExpires: { $gt: new Date() }
        });
        if (!usuario) return res.redirect(`${APP_URL}?verif=error`);
        // updateOne: save() revalida toda la cuenta y una cuenta antigua podía fallar al verificar
        await Usuario.updateOne({ _id: usuario._id }, { $set: { emailVerificado: true, emailVerifToken: null, emailVerifExpires: null } });
        logger.info(`Email verificado: @${usuario.usuario}`);
        Referidos.alVerificar(Usuario, usuario.usuario, { crearNotif, logger }).catch(() => {});
        res.redirect(`${APP_URL}?verif=ok&u=${encodeURIComponent(usuario.usuario)}`);
    } catch (err) {
        logger.error(`Error verificando email: ${err.message}`);
        res.redirect(`${APP_URL}?verif=error`);
    }
});

// Correos que cualquiera puede pedir escribiendo un email: máx. 1 cada 2 min y 5 al día por dirección
// (sin esto se podía bombardear una bandeja ajena y agotar el cupo diario de Resend). Respuesta idéntica.
// Contadores en Mongo (modulos/limites.js): sobreviven despliegues y se comparten entre copias.
const correoPermitido = (tipo, email) => Limites.permitir(`correo:${tipo}:${String(email).toLowerCase()}`, [[2 * Limites.MIN, 1], [Limites.DIA, 5]]);

app.post('/auth/resend-verification', [body('email').isEmail().normalizeEmail(EMAIL_NORMALIZE_OPTS)], async (req, res) => {
    try {
        const { email } = req.body;
        const usuario = await Usuario.findOne({ email: email.toLowerCase() });
        if (!usuario || usuario.emailVerificado || !(await correoPermitido('verif', email)))
            return res.json({ success: true, mensaje: 'Si el email existe y no está verificado, recibirás el link.' });
        const verifToken = crypto.randomBytes(32).toString('hex');
        await Usuario.updateOne({ _id: usuario._id }, { $set: { emailVerifToken: verifToken, emailVerifExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
        const verifLink = `${API_URL_SELF}/auth/verify-email/${verifToken}`;
        await sendEmail({ to: email, subject: '✅ Verifica tu email en UpGames', html: emailVerifTemplate(usuario.usuario, verifLink) });
        res.json({ success: true, mensaje: 'Si el email existe y no está verificado, recibirás el link.' });
    } catch (err) {
        logger.error(`Error reenviando verificación: ${err.message}`);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});

// Estado y reenvío para la sesión iniciada (el aviso de la biblioteca y la notificación)
const enmascarar = e => String(e || '').replace(/^(.{1,2})[^@]*(@.*)$/, (_, a, b) => a + '•••' + b);
app.get('/auth/email-estado', verificarToken, async (req, res) => {
    const u = await Usuario.findOne({ usuario: req.usuario }).select('email emailVerificado').lean().catch(() => null);
    if (!u) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    res.json({ success: true, verificado: !!u.emailVerificado, email: enmascarar(u.email) });
});
app.post('/auth/email-reenviar', verificarToken, async (req, res) => {
    try {
        const ahora = Date.now(), kR = `reenvio:${req.usuario}`;
        if (await Limites.lleno(kR, 2 * Limites.MIN, 1)) return res.status(429).json({ success: false, error: 'Ya te enviamos el correo. Espera 2 minutos para pedir otro.' });
        if (await Limites.lleno(kR, Limites.DIA, 5)) return res.status(429).json({ success: false, error: 'Llegaste al límite de reenvíos de hoy. Revisa tu carpeta de spam.' });
        const usuario = await Usuario.findOne({ usuario: req.usuario });
        if (!usuario) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        if (usuario.emailVerificado) return res.json({ success: true, yaVerificado: true });
        const verifToken = crypto.randomBytes(32).toString('hex');
        await Usuario.updateOne({ _id: usuario._id }, { $set: { emailVerifToken: verifToken, emailVerifExpires: new Date(ahora + 24 * 60 * 60 * 1000) } });
        const enviado = await sendEmail({ to: usuario.email, subject: '✅ Verifica tu email en UpGames', html: emailVerifTemplate(usuario.usuario, `${API_URL_SELF}/auth/verify-email/${verifToken}`) });
        if (!enviado) return res.status(503).json({ success: false, error: 'No pudimos enviar el correo ahora mismo. Inténtalo en unos minutos.' });
        await Promise.all([Limites.sumar(kR, 2 * Limites.MIN), Limites.sumar(kR, Limites.DIA)]);
        res.json({ success: true, email: enmascarar(usuario.email) });
    } catch (err) {
        logger.error(`Error en email-reenviar: ${err.message}`);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});

// ══════════════════════════════════════════════════════════════
//  RECUPERACIÓN DE CONTRASEÑA
// ══════════════════════════════════════════════════════════════

app.post('/auth/forgot-password', [body('email').isEmail().normalizeEmail(EMAIL_NORMALIZE_OPTS)], async (req, res) => {
    try {
        const { email } = req.body;
        const usuario = await Usuario.findOne({ email: email.toLowerCase() });
        if (!usuario || !(await correoPermitido('reset', email)))
            return res.json({ success: true, mensaje: 'Si el email está registrado, recibirás un link para restablecer tu contraseña.' });
        const resetToken = crypto.randomBytes(32).toString('hex');
        const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
        await Usuario.updateOne({ _id: usuario._id }, { $set: { resetPasswordToken: resetToken, resetPasswordExpires: new Date(Date.now() + 60 * 60 * 1000),
            resetCodigoHash: hashCodigo(usuario._id, codigo), resetCodigoExpires: new Date(Date.now() + 15 * 60 * 1000), resetCodigoIntentos: 0 } });
        const resetLink = `${APP_URL}?reset_token=${resetToken}`;
        await sendEmail({ to: email, subject: `🔑 ${codigo} es tu código para restablecer la contraseña de UpGames`, html: emailResetTemplate(usuario.usuario, resetLink, codigo) });
        logger.info(`Reset de contraseña solicitado: @${usuario.usuario}`);
        res.json({ success: true, mensaje: 'Si el email está registrado, recibirás un link para restablecer tu contraseña.' });
    } catch (err) {
        logger.error(`Error en forgot-password: ${err.message}`);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});

// Código de 6 dígitos: se compara su hash (nunca se guarda el código); 5 intentos por código y 20 por IP/hora
const hashCodigo = (id, codigo) => crypto.createHash('sha256').update(`${id}:${codigo}:${JWT_SECRET}`).digest('hex');
app.post('/auth/reset-codigo', [body('email').isEmail().normalizeEmail(EMAIL_NORMALIZE_OPTS), body('codigo').isString()], async (req, res) => {
    try {
        const errors = validationResult(req);
        const codigo = String(req.body.codigo || '').replace(/\D/g, '');
        if (!errors.isEmpty() || codigo.length !== 6) return res.status(400).json({ success: false, error: 'Escribe el código de 6 dígitos que te enviamos' });
        if (!(await Limites.permitir(`reset-codigo:${req.ip || ''}`, [[Limites.HORA, 20]]))) return res.status(429).json({ success: false, error: 'Demasiados intentos. Espera un rato y pide un código nuevo.' });
        const malo = { success: false, error: 'El código no es correcto o ya venció. Revisa tu correo o pide uno nuevo.' };
        const u = await Usuario.findOne({ email: req.body.email.toLowerCase() }).select('_id usuario resetCodigoHash resetCodigoExpires resetCodigoIntentos resetPasswordToken resetPasswordExpires').lean();
        if (!u || !u.resetCodigoHash || !u.resetCodigoExpires || u.resetCodigoExpires < new Date() || !u.resetPasswordToken || u.resetPasswordExpires < new Date()) return res.status(400).json(malo);
        if ((u.resetCodigoIntentos || 0) >= 5) return res.status(400).json({ success: false, error: 'Superaste los intentos para este código. Pide uno nuevo.' });
        const a = Buffer.from(hashCodigo(u._id, codigo)), b = Buffer.from(u.resetCodigoHash);
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
            await Usuario.updateOne({ _id: u._id }, { $inc: { resetCodigoIntentos: 1 } });
            const quedan = Math.max(0, 4 - (u.resetCodigoIntentos || 0));
            return res.status(400).json({ ...malo, quedan, error: quedan ? `El código no es correcto. Te quedan ${quedan} intento${quedan === 1 ? '' : 's'}.` : 'Superaste los intentos para este código. Pide uno nuevo.' });
        }
        // Un solo uso: el código se borra y se entrega el permiso para elegir la contraseña nueva
        await Usuario.updateOne({ _id: u._id }, { $set: { resetCodigoHash: null, resetCodigoExpires: null, resetCodigoIntentos: 0 } });
        res.json({ success: true, token: u.resetPasswordToken, usuario: u.usuario });
    } catch (err) {
        logger.error(`Error en reset-codigo: ${err.message}`);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});

app.post('/auth/reset-password', [body('token').notEmpty(), body('password').isLength({ min: 6 })], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, error: 'Token o contraseña inválidos' });
        const { token, password } = req.body;
        const usuario = await Usuario.findOne({ resetPasswordToken: token, resetPasswordExpires: { $gt: new Date() } });
        if (!usuario) return res.status(400).json({ success: false, error: 'El link es inválido o ya expiró. Solicita uno nuevo.' });
        // updateOne (no save): una cuenta antigua que no cumpla alguna validación actual no debe quedar sin poder recuperar su contraseña
        await Usuario.updateOne({ _id: usuario._id }, { $set: { password: await bcrypt.hash(password, 10), resetPasswordToken: null, resetPasswordExpires: null, resetCodigoHash: null, resetCodigoExpires: null, resetCodigoIntentos: 0 }, $inc: { sesionVer: 1 } });   // cierra todas las sesiones abiertas
        versionSesion.delete(usuario.usuario);
        logger.info(`Contraseña restablecida: @${usuario.usuario}`);
        res.json({ success: true, mensaje: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' });
    } catch (err) {
        logger.error(`Error en reset-password: ${err.message}`);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});

// ========== ADMIN AUTH ==========
// Roles (dueño + sub-admins), login con la cuenta, permisos, auditoría,
// anuncios y diagnóstico → rutas/adminPanel.js
const adminPanel = require('./rutas/adminPanel').registrar(app, {
    Usuario, Juego, Comentario, Notificacion, Pago, JWT_SECRET, logger, twoFactor, authLimiter,
});
const verificarAdmin = adminPanel.verificarAdmin;

// ── Cero tolerancia: aviso inmediato al equipo (app + push + correo) y panel de incidentes ──
const escH = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
CeroTolerancia.configurar({
    logger,
    avisar: async inc => {
        const dueños = (process.env.OWNER_EMAIL || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
        const dest = (await Usuario.find({ $or: [{ email: { $in: dueños } }, { adminRol: { $nin: ['', null] }, adminPausado: { $ne: true } }] }).select('usuario').lean()).map(u => u.usuario);
        const cat = CeroTolerancia.MOTIVO[inc.categoria] || inc.categoria;
        const txt = `🚨 NEXUS · Incidente de seguridad: @${inc.usuario} · ${cat} (${inc.donde}). Revísalo en el panel admin → Moderación → Incidentes.`;
        if (dest.length) {
            await Notificacion.insertMany(dest.map(d => ({ destinatario: d, tipo: 'sistema', emisor: 'NEXUS', itemTitle: 'Seguridad', mensaje: escH(txt), leida: false, fecha: new Date() })));
            push.alCrear(dest.map(d => ({ destinatario: d, emisor: 'NEXUS', tipo: 'sistema', itemTitle: '🚨 Incidente de seguridad', mensaje: `@${inc.usuario} · ${cat}` })));
        }
        const para = (process.env.ALERTAS_EMAIL || process.env.OWNER_EMAIL || '').split(',')[0].trim();
        if (para) Promise.resolve(sendEmail({ to: para, subject: `🚨 UpGames · Incidente de seguridad: ${cat}`,
            html: `<div style="font-family:system-ui,sans-serif;max-width:600px"><h2>🚨 Incidente de seguridad</h2><p><b>Usuario:</b> @${escH(inc.usuario)}<br><b>Categoría:</b> ${escH(cat)}<br><b>Dónde:</b> ${escH(inc.donde)}<br><b>Detectado por:</b> ${escH(inc.fuente)}${inc.confianza != null ? ` (${Math.round(inc.confianza * 100)} %)` : ''}<br><b>Cuenta restringida:</b> ${inc.restringida ? 'sí' : 'no'}</p><p>El contenido ya se bloqueó. La evidencia y el expediente completo (correo, IPs, cobros y pagos) están en el panel admin → Moderación → Incidentes, listos para entregarlos a las autoridades.</p></div>` })).catch(() => {});
    },
});
const incidenteVista = (x, completo) => ({
    id: x._id, fecha: x.fecha, estado: x.estado, usuario: x.usuario, categoria: x.categoria, motivo: x.motivo, fuente: x.fuente, confianza: x.confianza,
    donde: x.donde, ref: x.ref, restringida: !!x.restringida, notas: x.notas || '', reportadoEn: x.reportadoEn || null,
    evidencia: x.evidencia, conexion: x.conexion, ...(completo ? { expediente: x.expediente } : { email: x.expediente?.email || '' }),
});
app.get('/admin/seguridad/incidentes', verificarAdmin, async (req, res) => {
    try {
        const lista = await CeroTolerancia.listar({ limite: parseInt(req.query.limit, 10) || 150, estado: ['abierto', 'reportado', 'descartado'].includes(req.query.estado) ? req.query.estado : undefined });
        const abiertos = await CeroTolerancia.col().countDocuments({ estado: 'abierto' });
        res.json({ success: true, abiertos, lista: lista.map(x => incidenteVista(x, false)) });
    } catch (e) { logger.error(`admin/seguridad: ${e.message}`); res.status(500).json({ success: false, error: 'No se pudo cargar' }); }
});
// Expediente completo para las autoridades (incluye los datos de cobro descifrados y el historial reciente)
app.get('/admin/seguridad/incidentes/:id/expediente', verificarAdmin, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, error: 'ID inválido' });
        const x = await CeroTolerancia.col().findOne({ _id: new mongoose.Types.ObjectId(req.params.id) });
        if (!x) return res.status(404).json({ success: false, error: 'No existe' });
        const u = await Usuario.findOne({ usuario: x.usuario }).select('cobro').lean();
        const cobro = u?.cobro?.cifrado ? require('./rutas/cobros').descifrar(u.cobro.cifrado) : null;
        const [actual, otros, mensajes, publicaciones] = await Promise.all([
            CeroTolerancia.expediente(x.usuario),
            CeroTolerancia.col().find({ usuario: x.usuario }).project({ fecha: 1, categoria: 1, donde: 1, estado: 1 }).sort({ fecha: -1 }).limit(50).toArray(),
            Mensaje.find({ $or: [{ de: x.usuario }, { para: x.usuario }] }).select('de para texto imagen fecha').sort({ fecha: -1 }).limit(200).lean(),
            Juego.find({ usuario: x.usuario }).select('title link category status createdAt').sort({ createdAt: -1 }).limit(100).lean(),
        ]);
        logger.warn(`[cero-tolerancia] expediente de @${x.usuario} generado por @${req.admin?.usuario || '?'}`);
        res.json({ success: true, generado: new Date(), plataforma: 'UPGAMES · upgames.games · upgames.games.up@gmail.com', incidente: incidenteVista(x, true),
            cuentaActual: { ...actual, datosCobroCompletos: cobro }, otrosIncidentes: otros, historial: { mensajesPrivados: mensajes, publicaciones } });
    } catch (e) { logger.error(`admin/seguridad expediente: ${e.message}`); res.status(500).json({ success: false, error: 'No se pudo generar' }); }
});
app.post('/admin/seguridad/incidentes/:id', verificarAdmin, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, error: 'ID inválido' });
        const estado = ['abierto', 'reportado', 'descartado'].includes(req.body.estado) ? req.body.estado : null;
        const set = { ...(estado ? { estado } : {}), ...(typeof req.body.notas === 'string' ? { notas: req.body.notas.slice(0, 1000) } : {}), ...(estado === 'reportado' ? { reportadoEn: new Date() } : {}), revisadoPor: req.admin?.usuario || '' };
        const x = await CeroTolerancia.col().findOneAndUpdate({ _id: new mongoose.Types.ObjectId(req.params.id) }, { $set: set }, { returnDocument: 'after' });
        const doc = x?.value !== undefined ? x.value : x;
        if (!doc) return res.status(404).json({ success: false, error: 'No existe' });
        if (req.body.quitarRestriccion) await Usuario.updateOne({ usuario: doc.usuario }, { $set: { restriccionSeguridad: false, restriccionMotivo: '' } });
        res.json({ success: true, incidente: incidenteVista(doc, false) });
    } catch (e) { res.status(500).json({ success: false, error: 'No se pudo guardar' }); }
});
// Nexus como asistente del panel: briefing priorizado + chat con los datos del admin
require('./rutas/adminNexus').registrar(app, { verificarAdmin, Juego, Usuario, Comentario, Pago, logger });

// ==========================================
// ⭐ RUTAS DE ECONOMÍA
// ==========================================

// Ticket de la página puente (modulos/ticketPuente.js): la espera se comprueba en el servidor
const _economia = require('./rutas/economia')({ AUTHOR_PERCENTAGE, CPM_VALUE, DescargaIP, EMAIL_NORMALIZE_OPTS, JWT_SECRET, Juego, Limites, MAX_DOWNLOADS_PER_IP_PER_DAY, MIN_WITHDRAWAL, Moderacion, Pago, Referidos, StatsItems, Usuario, app, body, calcularScoreRecomendacion, crearNotif, fraudDetector, gamification, logger, mongoose, recommendations, usuarioOpcional, validationResult, verificarAdmin, verificarToken });   // Economía: visualizaciones de publicidad, saldo, referidos y retiros

// ── TARJETAS ──────────────────────────────────────────────────────────────────

// GET /economia/mis-tarjetas — listar tarjetas del usuario
require('./rutas/tarjetas')({ Juego, Pago, Usuario, app, body, config, enviarPagoPayPal, gamification, logger, mongoose, param, validationResult, verificarAdmin, verificarToken });   // Tarjetas de pago guardadas y procesamiento de retiros (finanzas)

// ==========================================
// ⭐ AUTENTICACIÓN
// ==========================================

// ── Identidad única: nombre de usuario y email ─────────────────────────
// El nombre se guarda en minúsculas, así "Pepe" y "pepe" son la MISMA cuenta.
// Solo a-z, 0-9 y _ (evita nombres casi idénticos con espacios, puntos o
// letras de otros alfabetos que se ven iguales, ej. "pеpe" con е cirílica).
const { errorNombreUsuario, mensajeDuplicado } = require('./rutas/auth')({ API_URL_SELF, EMAIL_NORMALIZE_OPTS, Limites, Referidos, Usuario, app, bcrypt, body, crypto, emailVerifTemplate, firmarToken, gamification, gmailLegacyEmail, logger, sendEmail, twoFactor, validationResult });   // Autenticación: registro, login y sesión

// ==========================================
// ⭐ ADMIN DASHBOARD
// ==========================================

const _admin = require('./rutas/admin')({ Comentario, DescargaIP, Juego, Notificacion, Pago, Usuario, app, body, gameDetector, logger, param, series, validationResult, verificarAdmin });   // Panel admin: estadísticas, usuarios, pagos y contenido
const { revisionIA } = _admin;


const _items = require('./rutas/items')({ CeroTolerancia, ContenidoLegal, JWT_SECRET, Juego, Limites, Moderacion, Notificacion, Ranking, Reporte, Sospecha, StatsItems, Usuario, app, autoInfo, body, cacheado, calcularScoreRecomendacion, cloudinary, crearNotif, esCategoriaRom, gameDetector, gamification, jwt, logger, moderarPublicacion, mongoose, nexusLLM, nexusMentor, param, recommendations, revisionIA, series, validationResult, verificarAdmin, verificarToken });   // Publicaciones: catálogo, publicar, editar y reportes
const { LINKS_PERMITIDOS, errorLinkPublicacion } = _items;
_admin.vincularTarde({ errorLinkPublicacion });   // rutas/admin.js usa estas dependencias, creadas después de registrar el módulo

// ==========================================
// ⭐ USUARIOS — con paginación en /auth/users/public
// ==========================================

// ⭐ OPTIMIZADO: paginación para evitar traer todos los usuarios
require('./rutas/usuarios')({ Juego, Usuario, adminPanel, app, body, cacheado, logger, mongoose, recalcularScoresUsuario, verificarAdmin });   // Usuarios: listado público y gestión en el panel admin

// ========== PERFIL ==========

// Endpoint dedicado para Nexus — devuelve solo las stats que necesita, sin bajar lista completa
const { urlImagenSegura } = require('./rutas/perfil')({ API_URL_SELF, EMAIL_NORMALIZE_OPTS, Extras, Juego, UCmod, Usuario, adminPanel, app, bcrypt, body, cacheado, cerrarOtrasSesiones, cloudinary, crearNotif, crypto, emailVerifTemplate, errorNombreUsuario, firmarToken, logger, mensajeDuplicado, mongoose, sendEmail, validationResult, verificarToken, versionActual });   // Perfil: datos, seguidores, ajustes y subida directa a Cloudinary

// ========== COMENTARIOS ==========

require('./rutas/comentarios')({ CeroTolerancia, Comentario, Extras, Juego, Limites, Moderacion, app, body, crearNotif, gamification, logger, validationResult, verificarAdmin, verificarToken });   // Comentarios

// ========== FAVORITOS ==========

// GET /publicar/sospecha?titulo=&categoria= → aviso en vivo al escribir el nombre en Publicar
require('./rutas/interacciones')({ Extras, Favorito, Juego, Limites, Sospecha, app, body, calcularScoreRecomendacion, crearNotif, gamification, logger, mongoose, nexusMemoria, param, recommendations, validationResult, verificarAdmin, verificarToken });   // Favoritos, me gusta y verificación de títulos comerciales

// ========== FRAUDE ==========

require('./rutas/fraude')({ app, body, fraudDetector, logger, param, validationResult, verificarAdmin });   // Anti-fraude (panel admin)

// ========== NOTIFICACIONES ==========

require('./rutas/notificaciones')({ Juego, Notificacion, Usuario, app, logger, mongoose, nexusMemoria, push, verificarToken });   // Notificaciones y push

// ========== CHAT ==========

// ══════════════════════════════════════════════════════════════════
//  CHAT v2 — mensajes privados entre seguidores mutuos
//  · Últimos N mensajes + paginación hacia atrás (antes se devolvían los
//    200 MÁS ANTIGUOS: en chats largos los nuevos nunca aparecían).
//  · Cursor del SERVIDOR (no del reloj del móvil) y cambios incrementales:
//    leído, editado, reacciones y borrados llegan en el polling.
//  · Responder, reaccionar, editar (15 min), borrar para todos (24 h) o
//    solo para mí, "escribiendo…", bloqueo y vaciar chat solo para mí.
// ══════════════════════════════════════════════════════════════════
require('./rutas/chat')({ CeroTolerancia, Limites, Mensaje, Moderacion, Notificacion, Usuario, app, imagenes, logger, push, urlImagenSegura, verificarToken });   // Chat privado

// ========== STORIES ==========

require('./rutas/stories')({ CeroTolerancia, Story, Usuario, app, imagenes, logger, verificarToken });   // Stories

// ========== HEALTHCHECK ==========
// Salud para el monitor de caídas (.github/workflows/uptime.yml): 503 si la base no responde
app.get('/salud', async (req, res) => {
    const db = mongoose.connection.readyState === 1 && await mongoose.connection.db.admin().ping().then(() => true).catch(() => false);
    res.status(db ? 200 : 503).set('Cache-Control', 'no-store').json({ ok: db, db, uptime: Math.round(process.uptime()), hora: new Date().toISOString(),
        // commit desplegado: así se ve desde fuera si Railway está al día con main
        version: (process.env.RAILWAY_GIT_COMMIT_SHA || process.env.UPGAMES_COMMIT || '').slice(0, 7) || null });
});

// Errores de JavaScript de los visitantes (public/upgames-errores.js)
const RUIDO_JS = /ResizeObserver loop|Script error\.?$|chrome-extension:|moz-extension:|safari-extension:|Non-Error promise rejection|Load failed|Failed to fetch|NetworkError|AbortError|cancelad|The operation was aborted/i;
app.post('/errores/cliente', async (req, res) => {
    res.status(204).end();
    try {
        const b = req.body || {}, mensaje = String(b.mensaje || '').slice(0, 500);
        if (!mensaje || RUIDO_JS.test(mensaje) || RUIDO_JS.test(String(b.stack || ''))) return;
        if (!(await Limites.permitir(`err-js:${req.ip || ''}`, [[Limites.HORA, 30]]))) return;
        Alertas.registrar({ origen: 'navegador', mensaje, stack: String(b.stack || '').slice(0, 4000), pagina: String(b.pagina || '').slice(0, 200), navegador: String(req.headers['user-agent'] || '').slice(0, 200) });
    } catch (_) {}
});
app.get('/admin/sistema/errores', verificarAdmin, async (req, res) => {
    try { res.json({ success: true, errores: await Alertas.recientes(parseInt(req.query.limit, 10) || 60), sentry: !!process.env.SENTRY_DSN, correo: (process.env.ALERTAS_EMAIL || process.env.OWNER_EMAIL || '').split(',')[0].replace(/^(.{2})[^@]*/, '$1•••') }); }
    catch (e) { res.status(500).json({ success: false, error: 'No se pudo cargar' }); }
});

app.get('/', (req, res) => {
    res.json({
        status: 'UP',
        version: '4.0 - OPTIMIZADO',
        timestamp: new Date().toISOString(),
        features: [
            'Sistema de economía CPM (US$1.50 por 1.000 visualizaciones de publicidad)',
            'Control de IPs anti-bots (TTL 24h)',
            'Login dual (usuario/email)',
            'Pagos PayPal automatizados',
            'Panel Admin de Finanzas completo',
            'Sistema de links caídos',
            'Verificación de usuarios multi-nivel',
            'Detección automática de fraude',
            'Auto-marcación en lista negra',
            '⚡ Score calculado con 1 aggregation + $lookup',
            '⚡ Chat/conversaciones via aggregate (no carga en RAM)',
            '⚡ Favoritos con índice COLLSCAN eliminado',
            '⚡ JOB 7 usa bulkWrite (2 ops sin importar n° juegos)',
            '⚡ Score es fire & forget en likes/descargas',
        ]
    });
});

// ============================================================
// ⚙️ JOBS AUTOMÁTICOS
// ============================================================

const { iniciarJobsAutomaticos } = require('./modulos/tareas')({ Comentario, Juego, Notificacion, Sospecha, Usuario, crearNotif, imagenes, logger, memCache, recalcularScoresUsuario, recalcularTodosLosScores, revisionIA, series });   // Tareas automáticas del servidor

// ========== 🎮 DETECCIÓN DE JUEGOS ==========

// POST /items/detect-game — detecta juego a partir de título (usado en frontend al escribir)
require('./rutas/deteccionJuegos')({ Juego, Limites, app, body, gameDetector, logger, param, validationResult });   // Detección de juegos e intención de compra

// =============================================

// ─── Búsqueda avanzada ───────────────────────────────────────────────────────

require('./rutas/busqueda')({ app, logger, nexusMemoria, searchModule, usuarioOpcional });   // Búsqueda avanzada

// ─────────────────────────────────────────────────────────────────────────────

// ========== NEXUS: publicación de proyectos (zona de Proyectos → categoría software) ==========
// Debe registrarse ANTES del handler 404 para que sus rutas y el hosting /u sean alcanzables.
const nexusPublish = require('./modulos/nexusPublish');
nexusPublish.registrar(app, { Juego, logger, soloHosting: true });   // la Nexus externa ya no publica: solo se sirven los proyectos existentes

// ========== NEXUS: la IA nativa de UpGames (Groq, misma BD y servidor) ==========
require('./rutas/nexus').registrar(app, {
    verificarToken, usuarioOpcional, logger, config, LINKS_PERMITIDOS,
    Juego, Usuario, Favorito, series, search: searchModule, recommendations,
});
// ================================================================================================

// ========== MEJORAS v2 ==========
// Búsqueda, recomendaciones, gamificación, 2FA, analíticas, social y referidos.
// Antes se registraba DESPUÉS del handler 404 → sus 37 rutas respondían "Endpoint no encontrado".
const rutasMejoras = require('./rutas/rutasMejoras');
rutasMejoras.registrar(app, { verificarToken, verificarAdmin });
// ================================

// ========== LIVE: transmisiones, chat en tiempo real, monedas y regalos ==========
const server = require('http').createServer(app);
const live = require('./rutas/live').registrar(app, server, {
    verificarToken, verificarAdmin, Usuario, Notificacion, logger, config, JWT_SECRET,
    estaSuspendido: u => adminPanel.estaSuspendido(u), getPayPalAccessToken,
});
// UpGames RACING (games/monoplaza): mejoras y cosméticos con UpCoins y salas multijugador (Socket.IO /apexgp)
require('./rutas/apexgp').registrar(app, { verificarToken, Usuario, LiveTx: live.LiveTx, io: live.io, logger, JWT_SECRET, estaSuspendido: u => adminPanel.estaSuspendido(u) });
// UpGames Studio: IA en la nube (fotos → modelo 3D completo con TRELLIS; necesita HF_TOKEN)
require('./rutas/studio').registrar(app, { verificarToken, logger });

// UPSTAR (games/upstar): descubrimientos, bases, partida en la nube y jugadores en el sector (Socket.IO /upstar)
require('./rutas/upstar').registrar(app, { verificarToken, io: live.io, logger, JWT_SECRET, estaSuspendido: u => adminPanel.estaSuspendido(u) });
// Acceso directo: saltarse la página puente solo con Premium (ya no se vende por publicación)
const mercadoPago = require('./modulos/mercadopago').crear();
const accesoDirecto = require('./rutas/accesoDirecto').registrar(app, { verificarToken, Juego, Usuario, LiveTx: live.LiveTx, logger });
// Tienda: pases sin anuncios, "Mi plan", tarjeta con Mercado Pago, PayPal, saldo y monedas
const tienda = require('./rutas/tienda').registrar(app, {
    verificarToken, Usuario, Juego, LiveTx: live.LiveTx, Notificacion, paypal: live.paypal, mp: mercadoPago,
    acceso: accesoDirecto, logger, apiUrlSelf: API_URL_SELF, olvidarPerfil: live.olvidarPerfil,
});
live.alRevertir((captureId, sancionar) => tienda.revertir(captureId, 'PayPal', sancionar));
// Usos extra de los UpCoins: estilo, apoyar, revisión prioritaria, misiones (Super Chat está en live)
require('./rutas/extrasUC').registrar(app, { verificarToken, verificarAdmin, Usuario, Juego, LiveTx: live.LiveTx, Notificacion, logger, olvidarPerfil: live.olvidarPerfil });
// Reseñas con estrellas y colecciones de publicaciones
// Métricas de producto (eventos anónimos + panel admin)
require('./rutas/metricas').registrar(app, { verificarAdmin, Usuario, Juego, Limites, logger });
// Informe mensual de actividad (descarga en CSV/JSON y aviso al dueño al empezar cada mes)
require('./rutas/informes').registrar(app, { verificarAdmin, Usuario, Juego, Comentario, Pago, Reporte, sendEmail, logger, ownerEmails: require('./rutas/adminPanel').ownerEmails });
// Compatibilidad real por dispositivo ("funcionó en mi Snapdragon a 45 FPS")
require('./rutas/compat').registrar(app, { verificarToken, Juego, Moderacion, Limites, logger });
require('./rutas/social').registrar(app, { verificarToken, verificarAdmin, usuarioOpcional, Usuario, Juego, Moderacion, Limites, crearNotif, logger });
// Grupos y comunidades del chat (rutas/grupos.js): cero tolerancia y +18 incluidos
require('./rutas/grupos').registrar(app, { verificarToken, Usuario, Notificacion, push, imagenes, urlImagenSegura, Moderacion, CeroTolerancia, Limites, logger });
// Panel admin → Economía (UpCoins, ventas, Premium, NEXUS, destacadas)
require('./rutas/adminEconomia').registrar(app, { verificarAdmin, Usuario, Juego, LiveTx: live.LiveTx, Pago, Notificacion, logger, olvidarPerfil: live.olvidarPerfil });
// Estado del correo y envío de prueba (panel admin → Sistema)
app.get('/admin/sistema/email', verificarAdmin, async (req, res) => res.json({ success: true, ...(await correo.verificar()), ...correo.estado() }));
app.post('/admin/sistema/email-prueba', verificarAdmin, async (req, res) => {
    const para = String(req.body?.para || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(para)) return res.status(400).json({ success: false, error: 'Escribe un email válido' });
    const ok = await sendEmail({ to: para, subject: '✅ Prueba de correo de UpGames', html: emailAvisoTemplate('equipo', 'Si lees esto, los correos de UpGames (verificación de email, recuperar contraseña y avisos) ya funcionan.') });
    res.status(ok ? 200 : 502).json({ success: ok, ...correo.estado(), error: ok ? undefined : (correo.estado().detalle || 'No se pudo enviar') });
});
// Métodos de cobro de los creadores: PayPal, Nequi, Daviplata, banco o Mercado Pago (cifrados)
const cobros = require('./rutas/cobros').registrar(app, { verificarToken, verificarAdmin, Usuario, logger, sendEmail, plantillaAviso: emailAvisoTemplate });
// contracargos de pases pagados con PayPal
_economia.vincularTarde({ cobros, live });   // rutas/economia.js usa estas dependencias, creadas después de registrar el módulo
// =================================================================================

// ========== SEO: SITEMAP ==========
// Lista pública de todo lo indexable (publicaciones aprobadas y perfiles con aportes).
// Una acción de GitHub la copia a diario a public/sitemap.xml del sitio (mismo dominio
// que las páginas, como exige Google).
const { paginasSeoPronto } = require('./rutas/seo')({ Juego, Seo, Usuario, app, cacheado, gameDetector, logger, memCache });   // SEO: sitemap y datos de páginas estáticas
_items.vincularTarde({ paginasSeoPronto });   // rutas/items.js usa estas dependencias, creadas después de registrar el módulo

// UpGames Blogs: el creador arma su sitio (temas, entradas, páginas) y se sirve en /b/<direccion> o en su dominio
blogsPorHost = require('./rutas/blogs').registrar(app, { verificarToken, verificarAdmin, Usuario, Juego, Limites, Moderacion, CeroTolerancia, fraudDetector, logger, mongoose, APP_URL, API_URL_SELF, JWT_SECRET }).porHost;

// ========== MANEJO DE ERRORES ==========
app.use((req, res) => {
    res.status(404).json({ error: "Endpoint no encontrado" });
});

app.use((err, req, res, next) => {
    logger.error(`Error: ${err?.message || "unknown"}`);
    res.status(500).json({ error: "Error interno del servidor" });
});

// ========== APAGADO ORDENADO (cada deploy de Railway envía SIGTERM) ==========
let apagando = false;
function apagar(senal) {
    if (apagando) return;
    apagando = true;
    logger.info(`[proceso] ${senal} recibido: cerrando conexiones…`);
    live.io.close();                      // los clientes de Socket.IO se reconectan solos al nuevo proceso
    server.close(() => mongoose.connection.close(false).finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 8000).unref();
}
process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('SIGINT', () => apagar('SIGINT'));

// ========== INICIAR SERVIDOR ==========
const PORT = config.PORT;
server.listen(PORT, () => {
    logger.info(`SERVIDOR CORRIENDO EN PUERTO ${PORT}`);
    logger.info(`Endpoint: http://localhost:${PORT}`);
    logger.info(`Sistema de Economía: ACTIVO | el creador gana US$${(CPM_VALUE * AUTHOR_PERCENTAGE).toFixed(2)} (${Math.round(CPM_VALUE * AUTHOR_PERCENTAGE / 0.02)} UC) por 1.000 visualizaciones de publicidad`);
    logger.info(`Anti-bots: Máx ${MAX_DOWNLOADS_PER_IP_PER_DAY} descargas/IP/día`);
    logger.info(`Detección de fraude: ACTIVA | Auto-lista negra: HABILITADA`);

    const alConectar = () => {
        // Crear índices faltantes al arrancar (idempotente)
        crearIndices().catch(err => logger.warn(`crearIndices: ${err.message}`));
        auditarIdentidades().catch(err => logger.warn(`auditarIdentidades: ${err.message}`));
        // Iniciar jobs automáticos
        iniciarJobsAutomaticos();
        push.iniciar({ logger });   // claves VAPID (generadas y guardadas en Mongo si no hay variables)
    };
    // Si Mongo conectó ANTES de que el servidor escuchara, 'open' ya ocurrió y
    // nunca se dispararía: índices y jobs (verificación, links caídos…) no correrían.
    if (mongoose.connection.readyState === 1) alConectar();
    else mongoose.connection.once('open', alConectar);
});

/**
 * Garantiza nombres y emails únicos a nivel de base de datos. Si ya existen
 * duplicados (cuentas creadas antes de las validaciones), el índice único no
 * puede crearse: se registran en el log para que el admin los resuelva.
 */
async function auditarIdentidades() {
    try {
        await Usuario.createIndexes();
    } catch (err) {
        logger.error(`[identidad] No se pudo asegurar el índice único de usuarios: ${err.message}`);
    }
    for (const campo of ['usuario', 'email']) {
        const dups = await Usuario.aggregate([
            { $group: { _id: { $toLower: `$${campo}` }, n: { $sum: 1 }, cuentas: { $push: '$usuario' } } },
            { $match: { n: { $gt: 1 } } },
            { $limit: 50 }
        ]);
        if (dups.length) logger.warn(`[identidad] ${dups.length} ${campo}(s) duplicado(s): ` + dups.map(d => campo === 'email' ? `[${d.cuentas.join(', ')}]` : `${d._id} → [${d.cuentas.join(', ')}]`).join(' | '));
        else logger.info(`[identidad] Sin ${campo}s duplicados ✓`);
    }
}
