/**
 * Caché corta de respuestas GET públicas (en memoria, sin dependencias).
 *
 * Cada consulta a la base de datos cuesta ~200 ms desde Railway, así que las páginas
 * públicas que se piden una y otra vez (perfil, ficha, favoritos, comentarios,
 * rankings…) se sirven desde memoria unos segundos. Nada se pierde:
 *   · solo rutas de lectura de una lista blanca, y solo respuestas 200 en JSON;
 *   · la clave incluye la URL completa y el usuario del token (cada uno ve lo suyo);
 *   · cualquier escritura que termina bien (POST/PUT/PATCH/DELETE) vacía la caché,
 *     así quien publica, comenta, sigue o guarda ve el cambio al instante;
 *   · caducidad de pocos segundos para lo que cambia por otros caminos (sockets).
 * Cabecera X-Cache: HIT | MISS para comprobarlo desde fuera.
 */
'use strict';

const jwt = require('jsonwebtoken');

// [patrón de la ruta, segundos]
const RUTAS = [
    [/^\/items\/[a-f\d]{24}$/i, 20],
    [/^\/items\/[a-f\d]{24}\/serie$/i, 60],
    [/^\/items\/user\/[^/]+$/, 20],
    [/^\/items\/recomendados\/[^/]+$/, 60],
    [/^\/usuarios\/perfil-publico\/[^/]+$/, 30],
    [/^\/usuarios\/stats-seguimiento\/[^/]+$/, 20],
    [/^\/usuarios\/nexus-stats\/[^/]+$/, 60],
    [/^\/usuarios\/verifica-seguimiento\/[^/]+\/[^/]+$/, 10],
    [/^\/favoritos\/[^/]+$/, 15],
    [/^\/comentarios\/[a-f\d]{24}$/i, 10],
    [/^\/auth\/users\/public$/, 60],
    [/^\/live\/activos$/, 5],
    [/^\/live\/canal\/[^/]+$/, 10],
    [/^\/apexgp\/campeonato\/ranking$/, 30],
    [/^\/apexgp\/contrarreloj\/ranking$/, 30],
    [/^\/apexgp\/ranking\/elo$/, 30],
    [/^\/search\/autocomplete$/, 60],
];
// Escrituras muy frecuentes que no cambian lo que se muestra al momento (contadores,
// telemetría): no vacían la caché (si no, no duraría nada)
const NO_VACIAN = /^\/(items\/vistas|misiones\/evento|nexus\/evento|errores\/cliente|live\/diag|push\/|analytics|stats\/)/;

const MAX_ENTRADAS = 600;
const MAX_BYTES = 400 * 1024;       // respuestas más grandes no se guardan

function crear({ secreto, ahora = () => Date.now() } = {}) {
    const mapa = new Map();         // clave → { exp, cuerpo, tipo, cc }
    const est = { hits: 0, misses: 0, vaciados: 0 };

    const ttlDe = (ruta) => { for (const [re, s] of RUTAS) if (re.test(ruta)) return s; return 0; };
    const usuarioDe = (req) => {
        const t = String(req.headers.authorization || '').split(' ')[1];
        if (!t || t.length < 20 || !secreto) return '';
        try { return jwt.verify(t, secreto).usuario || ''; } catch (_) { return '?'; }
    };
    const vaciar = () => { if (mapa.size) { mapa.clear(); est.vaciados++; } };

    function middleware(req, res, next) {
        if (req.method !== 'GET') {
            // escritura: al terminar bien se vacía la caché
            if (req.method !== 'OPTIONS' && req.method !== 'HEAD' && !NO_VACIAN.test(req.path))
                res.on('finish', () => { if (res.statusCode < 400) vaciar(); });
            return next();
        }
        const ttl = ttlDe(req.path);
        if (!ttl) return next();
        const quien = usuarioDe(req);
        if (quien === '?') return next();                     // token inválido: sin caché
        const clave = `${quien}|${req.originalUrl}`;
        const e = mapa.get(clave);
        if (e && e.exp > ahora()) {
            est.hits++;
            mapa.delete(clave); mapa.set(clave, e);           // LRU: al final
            res.set('X-Cache', 'HIT'); if (e.cc) res.set('Cache-Control', e.cc); res.type(e.tipo).send(e.cuerpo);
            return;
        }
        if (e) mapa.delete(clave);
        est.misses++;
        res.set('X-Cache', 'MISS');
        const enviar = res.send.bind(res);
        res.send = (cuerpo) => {
            try {
                const tipo = String(res.get('Content-Type') || '');
                if (res.statusCode === 200 && /json/.test(tipo) && !res.get('Set-Cookie') && (typeof cuerpo === 'string' || Buffer.isBuffer(cuerpo)) && cuerpo.length <= MAX_BYTES) {
                    mapa.set(clave, { exp: ahora() + ttl * 1000, cuerpo, tipo, cc: res.get('Cache-Control') || '' });
                    while (mapa.size > MAX_ENTRADAS) mapa.delete(mapa.keys().next().value);
                }
            } catch (_) { /* la caché nunca rompe una respuesta */ }
            return enviar(cuerpo);
        };
        next();
    }
    return { middleware, vaciar, estadisticas: () => ({ ...est, entradas: mapa.size }), _ttlDe: ttlDe };
}

module.exports = { crear, RUTAS, NO_VACIAN };
