/**
 * UpGames Blogs
 *
 * El creador arma su sitio desde UpGames (public/blog.html): elige un tema, escribe
 * entradas y páginas por bloques y publica. El servidor las convierte en páginas HTML:
 *
 *   /b/<direccion>/…            → dirección gratis de cada blog
 *   https://<dominio propio>/…  → si el creador conectó su dominio (CNAME + TXT de verificación)
 *   https://<direccion>.<BLOGS_DOMINIO>/… → cuando exista el dominio de blogs (variable BLOGS_DOMINIO)
 *
 * Panel (con sesión): /blogs/…   ·   Lógica pura: modulos/blogs/ (validar, render, temas).
 */
'use strict';

const dns = require('dns').promises;
const crypto = require('crypto');
const V = require('../modulos/blogs/validar');
const R = require('../modulos/blogs/render');
const Temas = require('../modulos/blogs/temas');
const Anuncios = require('../modulos/blogs/anuncios');

const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
const ACORTADORES = /^(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|cutt\.ly|shorturl\.at|rb\.gy|ow\.ly|acortar\.link|shre\.ink|ouo\.io|adf\.ly|linkvertise\.com)$/i;
const POR_PAGINA = 12;

/** Enlaces que no se permiten en un blog: acortadores (esconden el destino), IP sueltas y dominios disfrazados. */
function enlaceProhibido(urls) {
    for (const u of urls) {
        let h; try { h = new URL(u).hostname.replace(/^www\./, ''); } catch (_) { return 'Hay un enlace que no es válido.'; }
        if (ACORTADORES.test(h)) return `No se permiten enlaces acortados (${h}). Pon el enlace completo.`;
        if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes('xn--')) return `El enlace a ${h} no está permitido.`;
    }
    return '';
}

function registrar(app, deps) {
    const { verificarToken, verificarAdmin, Usuario, Juego, Limites, Moderacion, CeroTolerancia, fraudDetector, logger, mongoose, APP_URL, API_URL_SELF, JWT_SECRET, Comentario, Notificacion, crearNotif, gamification } = deps;
    const { Blog, Entrada, BlogVista, BlogReporte } = require('../modulos/blogs/modelos')(mongoose);

    const HOST_API = (() => { try { return new URL(API_URL_SELF).hostname; } catch (_) { return ''; } })();
    const BLOGS_DOMINIO = String(process.env.BLOGS_DOMINIO || '').toLowerCase().replace(/^\.+|\.+$/g, '');   // p. ej. upgames.site
    const DESTINO_CNAME = String(process.env.BLOGS_CNAME || HOST_API || '').toLowerCase();                  // a dónde apunta el dominio del creador
    const idOk = v => mongoose.isValidObjectId(v);
    const premiumActivo = d => !!(d?.planHasta && new Date(d.planHasta) > new Date());
    const esPremium = async usuario => premiumActivo(await Usuario.findOne({ usuario }).select('planHasta').lean());
    const fallo = (res, e, donde) => { logger.error(`[blogs] ${donde}: ${e.message}`); res.status(500).json({ success: false, error: 'No se pudo completar. Inténtalo de nuevo.' }); };

    // ── Caché en memoria (un blog se lee muchas más veces de las que cambia) ─────────────
    const cache = new Map();   // clave → { v, hasta }
    async function conCache(clave, seg, cargar) {
        const h = cache.get(clave);
        if (h && h.hasta > Date.now()) return h.v;
        const v = await cargar();
        if (cache.size > 5000) cache.clear();
        cache.set(clave, { v, hasta: Date.now() + seg * 1000 });
        return v;
    }
    const olvidar = () => cache.clear();

    const visibles = blogId => ({ blog: blogId, $or: [{ estado: 'publicada' }, { estado: 'programada', publicadaEn: { $lte: new Date() } }] });
    const urlPublica = b => b.dominio?.verificado && b.dominio.nombre ? `https://${b.dominio.nombre}/`
        : BLOGS_DOMINIO ? `https://${b.direccion}.${BLOGS_DOMINIO}/` : `${API_URL_SELF}/b/${b.direccion}/`;
    const vistaBlog = b => ({ id: String(b._id), direccion: b.direccion, titulo: b.titulo, descripcion: b.descripcion, tema: b.tema, ajustes: b.ajustes || {},
        visibilidad: b.visibilidad, estado: b.estado, vistas: b.vistas || 0, url: urlPublica(b), creado: b.createdAt,
        monetizar: !!b.monetizar, ingresos: Math.round((b.ingresos || 0) * 1e4) / 1e4, anunciosVistos: b.anunciosVistos || 0, cpm: Anuncios.CPM, motivoEstado: b.motivoEstado || '',
        dominio: b.dominio?.nombre ? { nombre: b.dominio.nombre, verificado: !!b.dominio.verificado, registros: registrosDns(b.dominio) } : null });
    const vistaEntrada = (e, completa) => ({ id: String(e._id), tipo: e.tipo, titulo: e.titulo, slug: e.slug, estado: e.estado, publicadaEn: e.publicadaEn,
        etiquetas: e.etiquetas || [], portada: e.portada || V.primeraImagen(e.bloques), resumen: e.resumen || V.resumen(e.bloques, 140), vistas: e.vistas || 0, actualizada: e.updatedAt,
        ...(completa ? { bloques: e.bloques || [], portadaPropia: e.portada || '', resumenPropio: e.resumen || '' } : {}) });
    // Enlace privado para ver un borrador tal como quedará (solo lo conoce el autor)
    const urlPrevia = (b, e) => `${API_URL_SELF}/b/${b.direccion}/_previa/${e._id}?k=${Anuncios.firmaPrevia(JWT_SECRET, String(e._id))}`;

    function registrosDns(d) {
        const partes = d.nombre.split('.');
        const esRaiz = partes.length === 2;
        return [
            { tipo: 'CNAME', nombre: esRaiz ? '@' : partes.slice(0, -2).join('.'), valor: DESTINO_CNAME, nota: esRaiz ? 'Si tu proveedor no permite CNAME en la raíz, usa «www» o un registro ALIAS/ANAME.' : '' },
            { tipo: 'TXT', nombre: `_upgames.${esRaiz ? '' : partes.slice(0, -2).join('.')}`.replace(/\.$/, ''), valor: `upgames-blog=${d.token}`, nota: 'Demuestra que el dominio es tuyo.' },
        ];
    }

    function limpiarAjustes(a, previo = {}) {
        a = a && typeof a === 'object' ? a : {};
        const g = a.gadgets && typeof a.gadgets === 'object' ? a.gadgets : (previo.gadgets || {});
        return {
            acento: Temas.esColor(a.acento) ? a.acento.toLowerCase() : '',
            fuente: Temas.FUENTES[a.fuente] ? a.fuente : '',
            portada: V.urlSegura(a.portada), logo: V.urlSegura(a.logo),
            idioma: ['es', 'en', 'pt'].includes(a.idioma) ? a.idioma : 'es',
            esquinas: Temas.ESQUINAS[a.esquinas] ? a.esquinas : '', fondo: Temas.FONDOS[a.fondo] ? a.fondo : '', portadaForma: Temas.PORTADAS.includes(a.portadaForma) ? a.portadaForma : '',
            gadgets: { perfil: g.perfil !== false, etiquetas: g.etiquetas !== false, populares: g.populares !== false },
            enlaces: (Array.isArray(a.enlaces) ? a.enlaces : []).map(e => ({ texto: V.linea(e?.texto, 40), url: V.urlSegura(e?.url) })).filter(e => e.texto && e.url).slice(0, 6),
        };
    }

    /** Revisa el texto y los enlaces antes de publicar. Devuelve el mensaje de error o ''. */
    function revisar(usuario, titulo, bloques, ref) {
        const texto = `${titulo}\n${V.textoDe(bloques)}`;
        const m = Moderacion.reglas(texto, 'publicacion');
        if (m.bloquear) {
            Moderacion.registrar({ tipo: 'blog', usuario, categoria: m.categoria, motivo: m.motivo, fuente: 'reglas', texto: texto.slice(0, 600), ref, accion: 'bloqueado-antes' });
            return `No se publicó porque ${Moderacion.MENSAJE[m.categoria] || 'incumple las normas de UpGames'}. Cámbialo e inténtalo de nuevo.`;
        }
        return enlaceProhibido(V.enlacesDe(bloques));
    }

    async function slugLibre(blogId, tipo, base, propio) {
        base = base || (tipo === 'pagina' ? 'pagina' : 'entrada');
        for (let i = 1; i < 60; i++) {
            const s = i === 1 ? base : `${base.slice(0, 74)}-${i}`;
            const otro = await Entrada.findOne({ blog: blogId, tipo, slug: s }).select('_id').lean();
            if (!otro || String(otro._id) === String(propio)) return s;
        }
        return `${base.slice(0, 60)}-${crypto.randomBytes(4).toString('hex')}`;
    }

    async function miBlog(req, res) {
        const b = await Blog.findOne({ _id: req.params.id, usuario: req.usuario });
        if (!b) res.status(404).json({ success: false, error: 'Ese blog no existe o no es tuyo.' });
        return b;
    }

    // ═══════════════ PANEL DEL CREADOR ═══════════════

    app.get('/blogs/temas', (req, res) => res.json({ success: true, temas: Temas.lista(), fuentes: Object.entries(Temas.FUENTES).map(([id, f]) => ({ id, nombre: f.nombre })), fondos: Object.entries(Temas.FONDOS).map(([id, f]) => ({ id, nombre: f.nombre })), limites: V.LIMITES, cpm: Anuncios.CPM }));

    // Lo último que publican los creadores en sus blogs: alimenta la fila «Del blog de los creadores» del inicio de UpGames
    app.get('/blogs/recientes', async (req, res) => {
        try {
            const lista = await conCache('recientes', 120, async () => {
                const entradas = await Entrada.find({ tipo: 'entrada', $or: [{ estado: 'publicada' }, { estado: 'programada', publicadaEn: { $lte: new Date() } }] })
                    .sort({ publicadaEn: -1 }).limit(80).select('blog titulo slug portada resumen bloques publicadaEn usuario').lean();
                const blogs = await Blog.find({ _id: { $in: [...new Set(entradas.map(e => String(e.blog)))] }, estado: 'activo', visibilidad: 'publico' }).lean();
                const porId = new Map(blogs.map(b => [String(b._id), b])), cuenta = new Map(), out = [];
                for (const e of entradas) {
                    const b = porId.get(String(e.blog)); if (!b) continue;
                    const n = cuenta.get(String(b._id)) || 0; if (n >= 3) continue;   // que un solo blog no llene la fila
                    cuenta.set(String(b._id), n + 1);
                    out.push({ titulo: e.titulo, resumen: e.resumen || V.resumen(e.bloques, 110), portada: e.portada || V.primeraImagen(e.bloques), url: `${urlPublica(b)}e/${e.slug}`,
                        blog: b.titulo, usuario: b.usuario, fecha: e.publicadaEn });
                    if (out.length >= 12) break;
                }
                return out;
            });
            res.set('Cache-Control', 'public, max-age=120').json({ success: true, entradas: lista });
        } catch (e) { fallo(res, e, 'recientes'); }
    });

    app.get('/blogs/mios', verificarToken, async (req, res) => {
        try {
            const blogs = await Blog.find({ usuario: req.usuario }).sort({ createdAt: 1 }).lean();
            const cuentas = await Entrada.aggregate([{ $match: { blog: { $in: blogs.map(b => b._id) }, tipo: 'entrada' } }, { $group: { _id: '$blog', n: { $sum: 1 } } }]);
            const n = Object.fromEntries(cuentas.map(c => [String(c._id), c.n]));
            const premium = await esPremium(req.usuario);
            res.json({ success: true, blogs: blogs.map(b => ({ ...vistaBlog(b), entradas: n[String(b._id)] || 0 })), maximo: premium ? V.LIMITES.BLOGS_PREMIUM : V.LIMITES.BLOGS_POR_CUENTA, premium });
        } catch (e) { fallo(res, e, 'mios'); }
    });

    app.get('/blogs/direccion-libre', verificarToken, async (req, res) => {
        const d = V.validarDireccion(req.query.d);
        if (d.error) return res.json({ success: true, libre: false, motivo: d.error });
        const hay = await Blog.exists({ direccion: d.valor }).catch(() => true);
        res.json({ success: true, libre: !hay, direccion: d.valor, motivo: hay ? 'Esa dirección ya está en uso.' : '' });
    });

    app.post('/blogs', verificarToken, async (req, res) => {
        try {
            const titulo = V.linea(req.body?.titulo, V.LIMITES.TITULO);
            if (titulo.length < 2) return res.status(400).json({ success: false, error: 'Ponle un nombre a tu blog.' });
            const d = V.validarDireccion(req.body?.direccion);
            if (d.error) return res.status(400).json({ success: false, error: d.error });
            const u = await Usuario.findOne({ usuario: req.usuario }).select('emailVerificado').lean();
            if (!u) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
            if (!u.emailVerificado) return res.status(403).json({ success: false, code: 'EMAIL_SIN_VERIFICAR', error: 'Verifica tu correo para crear un blog. Lo haces desde tu perfil en UpGames.' });
            if (await CeroTolerancia.restringido(req.usuario)) return res.status(403).json({ success: false, code: 'RESTRINGIDO', error: 'Tu cuenta está restringida mientras el equipo de seguridad revisa un reporte.' });
            const premium = await esPremium(req.usuario), maximo = premium ? V.LIMITES.BLOGS_PREMIUM : V.LIMITES.BLOGS_POR_CUENTA;
            if (await Blog.countDocuments({ usuario: req.usuario }) >= maximo) return res.status(400).json({ success: false, code: premium ? undefined : 'PREMIUM', error: premium ? `Puedes tener hasta ${maximo} blogs.` : `Llegaste a ${maximo} blogs. Con Premium puedes tener hasta ${V.LIMITES.BLOGS_PREMIUM}.` });
            if (Temas.TEMAS[req.body?.tema]?.premium && !premium) return res.status(403).json({ success: false, code: 'PREMIUM', error: 'Ese tema es exclusivo de Premium.' });
            const descripcion = V.linea(req.body?.descripcion, V.LIMITES.DESCRIPCION);
            const malo = revisar(req.usuario, titulo, [{ tipo: 'texto', texto: descripcion }], d.valor);
            if (malo) return res.status(400).json({ success: false, error: malo });
            if (!(await Limites.permitir(`blog-crear:${req.usuario}`, [[Limites.DIA, 5]]))) return res.status(429).json({ success: false, error: 'Creaste muchos blogs hoy. Inténtalo mañana.' });
            const b = await Blog.create({ usuario: req.usuario, direccion: d.valor, titulo, descripcion, tema: Temas.TEMAS[req.body?.tema] ? req.body.tema : Temas.POR_DEFECTO, ajustes: limpiarAjustes({}) });
            logger.info(`[blogs] @${req.usuario} creó el blog «${d.valor}»`);
            res.json({ success: true, blog: vistaBlog(b) });
        } catch (e) {
            if (e.code === 11000) return res.status(409).json({ success: false, error: 'Esa dirección ya está en uso. Elige otra.' });
            fallo(res, e, 'crear');
        }
    });

    app.get('/blogs/:id', verificarToken, async (req, res) => {
        try { const b = await miBlog(req, res); if (b) res.json({ success: true, blog: vistaBlog(b) }); } catch (e) { fallo(res, e, 'ver'); }
    });

    app.put('/blogs/:id', verificarToken, async (req, res) => {
        try {
            const b = await miBlog(req, res); if (!b) return;
            const c = req.body || {};
            if (c.titulo !== undefined) { const t = V.linea(c.titulo, V.LIMITES.TITULO); if (t.length < 2) return res.status(400).json({ success: false, error: 'El nombre del blog es muy corto.' }); b.titulo = t; }
            if (c.descripcion !== undefined) b.descripcion = V.linea(c.descripcion, V.LIMITES.DESCRIPCION);
            if (c.direccion !== undefined && c.direccion !== b.direccion) { const d = V.validarDireccion(c.direccion); if (d.error) return res.status(400).json({ success: false, error: d.error }); b.direccion = d.valor; }
            if (c.tema !== undefined && Temas.TEMAS[c.tema]) {
                if (Temas.TEMAS[c.tema].premium && c.tema !== b.tema && !(await esPremium(req.usuario))) return res.status(403).json({ success: false, code: 'PREMIUM', error: 'Ese tema es exclusivo de Premium.' });
                b.tema = c.tema;
            }
            if (c.visibilidad !== undefined && ['publico', 'oculto'].includes(c.visibilidad)) b.visibilidad = c.visibilidad;
            if (typeof c.monetizar === 'boolean') b.monetizar = c.monetizar;   // el creador decide si su blog lleva publicidad
            if (c.ajustes !== undefined) { b.ajustes = limpiarAjustes({ ...(b.ajustes || {}), ...c.ajustes }, b.ajustes); b.markModified('ajustes'); }
            const malo = revisar(req.usuario, b.titulo, [{ tipo: 'texto', texto: b.descripcion }], b.direccion);
            if (malo) return res.status(400).json({ success: false, error: malo });
            await b.save(); olvidar();
            res.json({ success: true, blog: vistaBlog(b) });
        } catch (e) {
            if (e.code === 11000) return res.status(409).json({ success: false, error: 'Esa dirección ya está en uso. Elige otra.' });
            fallo(res, e, 'editar');
        }
    });

    app.delete('/blogs/:id', verificarToken, async (req, res) => {
        try {
            const b = await miBlog(req, res); if (!b) return;
            await Promise.all([Entrada.deleteMany({ blog: b._id }), BlogVista.deleteMany({ blog: b._id }), BlogReporte.deleteMany({ blog: b._id }), b.deleteOne()]);
            olvidar();
            logger.info(`[blogs] @${req.usuario} borró el blog «${b.direccion}»`);
            res.json({ success: true });
        } catch (e) { fallo(res, e, 'borrar'); }
    });

    // ── Entradas y páginas ───────────────────────────────────────────────────────────────
    app.get('/blogs/:id/entradas', verificarToken, async (req, res) => {
        try {
            const b = await miBlog(req, res); if (!b) return;
            const tipo = req.query.tipo === 'pagina' ? 'pagina' : 'entrada';
            const lista = await Entrada.find({ blog: b._id, tipo }).sort({ updatedAt: -1 }).limit(V.LIMITES.ENTRADAS_POR_BLOG).lean();
            res.json({ success: true, entradas: lista.map(e => vistaEntrada(e)) });
        } catch (e) { fallo(res, e, 'entradas'); }
    });

    app.get('/blogs/:id/entradas/:eid', verificarToken, async (req, res) => {
        try {
            const b = await miBlog(req, res); if (!b) return;
            const e = idOk(req.params.eid) && await Entrada.findOne({ _id: req.params.eid, blog: b._id }).lean();
            if (!e) return res.status(404).json({ success: false, error: 'Esa entrada no existe.' });
            res.json({ success: true, entrada: vistaEntrada(e, true), previa: urlPrevia(b, e) });
        } catch (e) { fallo(res, e, 'entrada'); }
    });

    /** Aplica lo que llega del editor a una entrada (nueva o existente). Devuelve un error o ''. */
    async function aplicar(e, c, blog) {
        const titulo = V.linea(c.titulo, V.LIMITES.TITULO);
        if (!titulo) return 'Escribe un título.';
        const bloques = V.limpiarBloques(c.bloques);
        let estado = ['borrador', 'publicada', 'programada'].includes(c.estado) ? c.estado : 'borrador';
        let cuando = e.publicadaEn;
        if (estado === 'programada') {
            const f = new Date(c.publicadaEn);
            if (isNaN(f)) return 'Elige la fecha y la hora para programar la entrada.';
            if (f.getTime() > Date.now() + 366 * 864e5) return 'Solo se puede programar hasta con un año de antelación.';
            if (f.getTime() <= Date.now() + 60000) estado = 'publicada'; else cuando = f;
        }
        if (estado === 'publicada' && (!cuando || e.estado !== 'publicada')) cuando = new Date();
        if (estado !== 'borrador') {
            if (!bloques.length) return 'La entrada está vacía. Añade texto o una imagen antes de publicar.';
            const malo = revisar(blog.usuario, titulo, bloques, `${blog.direccion}/${e.slug || ''}`);
            if (malo) return malo;
        }
        // La URL se fija la primera vez que se publica: cambiarla después rompería los enlaces compartidos
        const yaPublica = !e.isNew && e.estado !== 'borrador';
        const pedido = c.slug !== undefined ? V.slug(c.slug) : '';
        if (!yaPublica || (pedido && pedido !== e.slug)) e.slug = await slugLibre(blog._id, e.tipo, pedido || V.slug(titulo), e._id);
        const et = e.tipo === 'pagina' ? [] : V.etiquetas(c.etiquetas);
        Object.assign(e, { titulo, bloques, etiquetas: et, etiquetasSlug: et.map(t => V.slug(t)), portada: V.urlSegura(c.portada), resumen: V.linea(c.resumen, 300), estado, publicadaEn: estado === 'borrador' ? e.publicadaEn : cuando });
        e.markModified('bloques');
        return '';
    }

    /** Avisa a los seguidores del creador (una sola vez por entrada, y solo de blogs públicos). */
    async function avisarSeguidores(e, blog) {
        if (e.tipo !== 'entrada' || e.estado !== 'publicada' || e.avisada || blog.visibilidad !== 'publico' || !Notificacion) return;
        const marcada = await Entrada.updateOne({ _id: e._id, avisada: { $ne: true } }, { $set: { avisada: true } });
        if (!marcada.modifiedCount) return;
        if (!(await Limites.permitir(`blog-aviso:${blog._id}`, [[Limites.DIA, 3]]))) return;
        const autor = await Usuario.findOne({ usuario: blog.usuario }).select('listaSeguidores').lean();
        const seguidores = (autor?.listaSeguidores || []).slice(0, 5000);
        if (!seguidores.length) return;
        const url = `${urlPublica(blog)}e/${e.slug}`, portada = e.portada || V.primeraImagen(e.bloques) || '';
        await Notificacion.insertMany(seguidores.map(s => ({ destinatario: String(s).toLowerCase(), tipo: 'nueva_entrada', emisor: blog.usuario, itemId: url, itemTitle: e.titulo, itemImage: portada, mensaje: `publicó en su blog «${blog.titulo}»`, leida: false, fecha: new Date() })), { ordered: false });
        logger.info(`[blogs] aviso de «${blog.direccion}/${e.slug}» a ${seguidores.length} seguidores`);
    }

    /** NEXUS revisa lo publicado en segundo plano: si es claramente inaceptable, vuelve a borrador; si no, se avisa a los seguidores. */
    function revisarConIA(e, blog) {
        const texto = `${e.titulo}\n${V.textoDe(e.bloques)}`.slice(0, 6000);
        const seguir = () => avisarSeguidores(e, blog).catch(err => logger.error(`[blogs] aviso: ${err.message}`));
        if (texto.length < 40 || typeof Moderacion.ia !== 'function') return seguir();
        Limites.permitir('mod-ia-blog', [[Limites.MIN, 10]]).then(ok => ok && Moderacion.ia(texto, 'publicacion')).then(async v => {
            if (!v || !Moderacion.debeQuitar(v)) return seguir();
            await Entrada.updateOne({ _id: e._id }, { $set: { estado: 'borrador' } }); olvidar();
            Moderacion.registrar({ tipo: 'blog', usuario: blog.usuario, categoria: v.categoria, motivo: v.motivo, fuente: 'ia', texto: texto.slice(0, 600), ref: `${blog.direccion}/${e.slug}`, accion: 'quitado' });
            logger.warn(`[blogs] NEXUS devolvió a borrador «${blog.direccion}/${e.slug}» (${v.categoria})`);
        }).catch(() => {});
    }

    app.post('/blogs/:id/entradas', verificarToken, async (req, res) => {
        try {
            const b = await miBlog(req, res); if (!b) return;
            if (await CeroTolerancia.restringido(req.usuario)) return res.status(403).json({ success: false, code: 'RESTRINGIDO', error: 'Tu cuenta está restringida mientras el equipo de seguridad revisa un reporte.' });
            if (await Entrada.countDocuments({ blog: b._id }) >= V.LIMITES.ENTRADAS_POR_BLOG) return res.status(400).json({ success: false, error: `Llegaste al máximo de ${V.LIMITES.ENTRADAS_POR_BLOG} entradas y páginas en este blog.` });
            if (!(await Limites.permitir(`blog-entrada:${req.usuario}`, [[Limites.HORA, 40], [Limites.DIA, 120]]))) return res.status(429).json({ success: false, error: 'Vas muy rápido. Espera un poco antes de crear otra entrada.' });
            const e = new Entrada({ blog: b._id, usuario: req.usuario, tipo: req.body?.tipo === 'pagina' ? 'pagina' : 'entrada', titulo: 'x', slug: 'x' });
            const error = await aplicar(e, req.body || {}, b);
            if (error) return res.status(400).json({ success: false, error });
            await e.save(); olvidar();
            if (e.estado !== 'borrador') revisarConIA(e, b);
            res.json({ success: true, entrada: vistaEntrada(e, true), url: `${urlPublica(b)}${e.tipo === 'pagina' ? 'p' : 'e'}/${e.slug}`, previa: urlPrevia(b, e) });
        } catch (e) {
            if (e.code === 11000) return res.status(409).json({ success: false, error: 'Ya hay otra con esa misma dirección. Cambia un poco el título.' });
            fallo(res, e, 'crear entrada');
        }
    });

    app.put('/blogs/:id/entradas/:eid', verificarToken, async (req, res) => {
        try {
            const b = await miBlog(req, res); if (!b) return;
            const e = idOk(req.params.eid) && await Entrada.findOne({ _id: req.params.eid, blog: b._id });
            if (!e) return res.status(404).json({ success: false, error: 'Esa entrada no existe.' });
            if (await CeroTolerancia.restringido(req.usuario)) return res.status(403).json({ success: false, code: 'RESTRINGIDO', error: 'Tu cuenta está restringida mientras el equipo de seguridad revisa un reporte.' });
            const error = await aplicar(e, req.body || {}, b);
            if (error) return res.status(400).json({ success: false, error });
            await e.save(); olvidar();
            if (e.estado !== 'borrador') revisarConIA(e, b);
            res.json({ success: true, entrada: vistaEntrada(e, true), url: `${urlPublica(b)}${e.tipo === 'pagina' ? 'p' : 'e'}/${e.slug}`, previa: urlPrevia(b, e) });
        } catch (e) {
            if (e.code === 11000) return res.status(409).json({ success: false, error: 'Ya hay otra con esa misma dirección. Cambia un poco el título.' });
            fallo(res, e, 'editar entrada');
        }
    });

    app.delete('/blogs/:id/entradas/:eid', verificarToken, async (req, res) => {
        try {
            const b = await miBlog(req, res); if (!b) return;
            if (idOk(req.params.eid)) await Entrada.deleteOne({ _id: req.params.eid, blog: b._id });
            olvidar();
            res.json({ success: true });
        } catch (e) { fallo(res, e, 'borrar entrada'); }
    });

    // ── Estadísticas ─────────────────────────────────────────────────────────────────────
    app.get('/blogs/:id/estadisticas', verificarToken, async (req, res) => {
        try {
            const b = await miBlog(req, res); if (!b) return;
            const desde = new Date(Date.now() - 29 * 864e5).toISOString().slice(0, 10);
            const [dias, top, publicadas] = await Promise.all([
                BlogVista.find({ blog: b._id, dia: { $gte: desde } }).lean(),
                Entrada.find({ blog: b._id, vistas: { $gt: 0 } }).sort({ vistas: -1 }).limit(8).select('titulo slug tipo vistas').lean(),
                Entrada.countDocuments({ blog: b._id, tipo: 'entrada', estado: { $ne: 'borrador' } }),
            ]);
            const porDia = Object.fromEntries(dias.map(d => [d.dia, d.n]));
            const serie = Array.from({ length: 30 }, (_, i) => { const dia = new Date(Date.now() - (29 - i) * 864e5).toISOString().slice(0, 10); return { dia, n: porDia[dia] || 0 }; });
            const r4 = n => Math.round(n * 1e4) / 1e4;
            res.json({ success: true, monetizar: !!b.monetizar, cpm: Anuncios.CPM, ingresos: r4(b.ingresos || 0), ingresosMes: r4(dias.reduce((s, d) => s + (d.g || 0), 0)), anunciosMes: dias.reduce((s, d) => s + (d.a || 0), 0), total: b.vistas || 0, mes: serie.reduce((s, d) => s + d.n, 0), hoy: serie[29].n, publicadas, serie,
                top: top.map(e => ({ titulo: e.titulo, vistas: e.vistas, tipo: e.tipo })) });
        } catch (e) { fallo(res, e, 'estadisticas'); }
    });

    // ── Dominio propio ───────────────────────────────────────────────────────────────────
    // El creador apunta su dominio a UpGames (CNAME) y demuestra que es suyo con un TXT.
    app.post('/blogs/:id/dominio', verificarToken, async (req, res) => {
        try {
            const b = await miBlog(req, res); if (!b) return;
            const d = V.validarDominio(req.body?.dominio);
            if (d.error) return res.status(400).json({ success: false, error: d.error });
            if (await Blog.exists({ _id: { $ne: b._id }, 'dominio.nombre': d.valor, 'dominio.verificado': true })) return res.status(409).json({ success: false, error: 'Ese dominio ya está conectado a otro blog.' });
            if (!(await Limites.permitir(`blog-dominio:${req.usuario}`, [[Limites.HORA, 10]]))) return res.status(429).json({ success: false, error: 'Demasiados intentos. Espera un rato.' });
            if (b.dominio?.nombre !== d.valor) b.dominio = { nombre: d.valor, token: crypto.randomBytes(12).toString('hex'), verificado: false, verificadoEn: null };
            await b.save(); olvidar();
            res.json({ success: true, blog: vistaBlog(b) });
        } catch (e) { fallo(res, e, 'dominio'); }
    });

    app.post('/blogs/:id/dominio/verificar', verificarToken, async (req, res) => {
        try {
            const b = await miBlog(req, res); if (!b) return;
            if (!b.dominio?.nombre) return res.status(400).json({ success: false, error: 'Primero escribe tu dominio.' });
            if (!(await Limites.permitir(`blog-dns:${req.usuario}`, [[Limites.MIN, 6], [Limites.HORA, 60]]))) return res.status(429).json({ success: false, error: 'Espera un momento antes de volver a comprobar.' });
            const r = await comprobarDns(b.dominio.nombre, b.dominio.token);
            if (!r.txt) return res.json({ success: true, verificado: false, apunta: r.apunta, blog: vistaBlog(b),
                mensaje: 'Todavía no vemos el registro TXT. Los cambios de DNS pueden tardar desde unos minutos hasta 24 horas.' });
            await Blog.updateMany({ _id: { $ne: b._id }, 'dominio.nombre': b.dominio.nombre }, { $set: { dominio: { nombre: '', token: '', verificado: false, verificadoEn: null } } });
            b.dominio.verificado = true; b.dominio.verificadoEn = new Date();
            await b.save(); olvidar();
            logger.info(`[blogs] @${req.usuario} verificó el dominio ${b.dominio.nombre} para «${b.direccion}»`);
            res.json({ success: true, verificado: true, apunta: r.apunta, blog: vistaBlog(b),
                mensaje: r.apunta ? 'Dominio verificado y apuntando a UpGames.' : 'Dominio verificado. Falta que el CNAME apunte a UpGames para que el blog abra en tu dominio.' });
        } catch (e) { fallo(res, e, 'verificar dominio'); }
    });

    app.delete('/blogs/:id/dominio', verificarToken, async (req, res) => {
        try {
            const b = await miBlog(req, res); if (!b) return;
            b.dominio = { nombre: '', token: '', verificado: false, verificadoEn: null };
            await b.save(); olvidar();
            res.json({ success: true, blog: vistaBlog(b) });
        } catch (e) { fallo(res, e, 'quitar dominio'); }
    });

    async function comprobarDns(dominio, token) {
        const conLimite = p => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('tiempo')), 6000))]);
        const [txt, cname] = await Promise.all([
            conLimite(dns.resolveTxt(`_upgames.${dominio}`)).then(r => r.map(x => x.join('')), () => []),
            conLimite(dns.resolveCname(dominio)).catch(() => []),
        ]);
        return { txt: txt.some(t => t.trim() === `upgames-blog=${token}`), apunta: !!DESTINO_CNAME && cname.some(c => c.toLowerCase().replace(/\.$/, '') === DESTINO_CNAME) };
    }

    // ── Reportes de visitantes ───────────────────────────────────────────────────────────
    const MOTIVOS = new Set(['estafa', 'malware', 'sexual', 'odio', 'copia', 'otro']);
    app.post('/blogs/reportar', async (req, res) => {
        try {
            const d = String(req.body?.direccion || '').toLowerCase().slice(0, 40);
            const motivo = MOTIVOS.has(req.body?.motivo) ? req.body.motivo : 'otro';
            const ip = req.ip || '';
            if (!(await Limites.permitir(`blog-reporte:${ip}`, [[Limites.HORA, 5]]))) return res.status(429).json({ success: false, error: 'Ya enviaste varios reportes. Inténtalo más tarde.' });
            const b = await Blog.findOne({ direccion: d });
            if (!b) return res.status(404).json({ success: false, error: 'Ese blog no existe.' });
            if (await BlogReporte.exists({ blog: b._id, ip, createdAt: { $gte: new Date(Date.now() - 7 * 864e5) } })) return res.json({ success: true });
            await BlogReporte.create({ blog: b._id, motivo, detalle: V.linea(req.body?.detalle, 500), ip });
            b.reportes = (b.reportes || 0) + 1;
            // Con varios reportes de personas distintas el blog deja de verse hasta que el equipo lo revise
            if (b.reportes >= 5 && b.estado === 'activo') { b.estado = 'revision'; logger.warn(`[blogs] «${b.direccion}» pasó a revisión por reportes`); }
            await b.save(); olvidar();
            res.json({ success: true });
        } catch (e) { fallo(res, e, 'reportar'); }
    });

    // ═══════════════ PANEL DE ADMINISTRACIÓN ═══════════════
    // Blogs reportados o en revisión: el equipo los reactiva o los suspende (admin/index.html → Blogs)
    app.get('/admin/blogs', verificarAdmin, async (req, res) => {
        try {
            const f = req.query.filtro, q = V.linea(req.query.q, 60).toLowerCase();
            const filtro = { ...(f === 'todos' ? {} : f === 'monetizados' ? { monetizar: true } : { $or: [{ estado: { $ne: 'activo' } }, { reportes: { $gt: 0 } }] }),
                ...(q ? { $and: [{ $or: [{ direccion: { $regex: q.replace(/[^a-z0-9-]/g, '') || '^$' } }, { usuario: q.replace(/^@/, '') }] }] } : {}) };
            const [blogs, pendientes, total] = await Promise.all([
                Blog.find(filtro).sort({ reportes: -1, updatedAt: -1 }).limit(100).lean(),
                Blog.countDocuments({ estado: 'revision' }), Blog.countDocuments({}),
            ]);
            const ids = blogs.map(b => b._id);
            const [cuentas, reportes] = await Promise.all([
                Entrada.aggregate([{ $match: { blog: { $in: ids } } }, { $group: { _id: '$blog', n: { $sum: 1 } } }]),
                BlogReporte.find({ blog: { $in: ids } }).sort({ createdAt: -1 }).limit(400).select('blog motivo detalle createdAt').lean(),
            ]);
            const n = Object.fromEntries(cuentas.map(c => [String(c._id), c.n]));
            res.json({ success: true, pendientes, total, blogs: blogs.map(b => ({ id: String(b._id), direccion: b.direccion, titulo: b.titulo, usuario: b.usuario, estado: b.estado, reportes: b.reportes || 0,
                vistas: b.vistas || 0, monetizar: !!b.monetizar, ingresos: Math.round((b.ingresos || 0) * 1e4) / 1e4, anunciosVistos: b.anunciosVistos || 0, entradas: n[String(b._id)] || 0, url: urlPublica(b),
                dominio: b.dominio?.verificado ? b.dominio.nombre : '', motivoEstado: b.motivoEstado || '', creado: b.createdAt,
                ultimosReportes: reportes.filter(r => String(r.blog) === String(b._id)).slice(0, 5).map(r => ({ motivo: r.motivo, detalle: r.detalle || '', fecha: r.createdAt })) })) });
        } catch (e) { fallo(res, e, 'admin lista'); }
    });

    app.put('/admin/blogs/:id/estado', verificarAdmin, async (req, res) => {
        try {
            const estado = req.body?.estado;
            if (!['activo', 'suspendido'].includes(estado)) return res.status(400).json({ success: false, error: 'Estado inválido' });
            const b = await Blog.findById(req.params.id);
            if (!b) return res.status(404).json({ success: false, error: 'Ese blog no existe' });
            b.estado = estado; b.motivoEstado = estado === 'suspendido' ? V.linea(req.body?.motivo, 200) : '';
            if (estado === 'activo') { b.reportes = 0; await BlogReporte.deleteMany({ blog: b._id }); }
            await b.save(); olvidar();
            logger.info(`[blogs] admin: «${b.direccion}» → ${estado}`);
            res.json({ success: true, estado: b.estado });
        } catch (e) { fallo(res, e, 'admin estado'); }
    });

    // ═══════════════ COMENTARIOS ═══════════════
    // Las páginas del blog no llevan scripts: los comentarios se muestran y escriben en un marco aislado
    // (public/blog-comentarios.html, en el dominio de UpGames, donde está la sesión) que usa estas rutas.
    const refComentario = eid => `blog:${eid}`;
    async function entradaComentable(eid) {
        if (!idOk(eid)) return null;
        const e = await Entrada.findOne({ _id: eid, tipo: 'entrada', $or: [{ estado: 'publicada' }, { estado: 'programada', publicadaEn: { $lte: new Date() } }] }).select('blog titulo slug usuario').lean();
        const b = e && await Blog.findById(e.blog).select('direccion titulo usuario estado').lean();
        return b && b.estado === 'activo' ? { e, b } : null;
    }

    app.get('/blogs/comentarios/:eid', async (req, res) => {
        try {
            const c = await entradaComentable(req.params.eid);
            if (!c) return res.status(404).json({ success: false, comentarios: [] });
            const lista = await Comentario.find({ itemId: refComentario(req.params.eid) }).sort({ fecha: -1 }).limit(100).select('usuario texto fecha').lean();
            const autores = [...new Set(lista.map(x => x.usuario))];
            const avatares = Object.fromEntries((await Usuario.find({ usuario: { $in: autores } }).select('usuario avatar').lean()).map(u => [u.usuario, u.avatar || '']));
            res.set('Cache-Control', 'public, max-age=10').json({ success: true, dueno: c.b.usuario, comentarios: lista.map(x => ({ id: String(x._id), usuario: x.usuario, avatar: avatares[x.usuario] || '', texto: x.texto, fecha: x.fecha })) });
        } catch (e) { fallo(res, e, 'comentarios'); }
    });

    app.post('/blogs/comentarios/:eid', verificarToken, async (req, res) => {
        try {
            const c = await entradaComentable(req.params.eid);
            if (!c) return res.status(404).json({ success: false, error: 'Esa entrada ya no está disponible.' });
            const texto = String(req.body?.texto || '').replace(/<[^>]*>/g, '').trim().slice(0, 500);
            if (!texto) return res.status(400).json({ success: false, error: 'El comentario está vacío' });
            if (await CeroTolerancia.restringido(req.usuario)) return res.status(403).json({ success: false, code: 'RESTRINGIDO', error: 'Tu cuenta está restringida mientras el equipo de seguridad revisa un reporte.' });
            const mod = Moderacion.reglas(texto, 'comentario');
            const ref = `${c.b.direccion}/${c.e.slug}`;
            if (mod.bloquear) {
                Moderacion.registrar({ tipo: 'comentario', usuario: req.usuario, categoria: mod.categoria, motivo: mod.motivo, fuente: 'reglas', texto, ref, accion: 'bloqueado-antes' });
                return res.status(400).json({ success: false, error: `Tu comentario no se publicó porque ${Moderacion.MENSAJE[mod.categoria] || 'incumple las normas'}. Escríbelo de otra forma.` });
            }
            const enlace = enlaceProhibido((texto.match(/https?:\/\/[^\s]+/g) || []));
            if (enlace) return res.status(400).json({ success: false, error: enlace });
            if (!(await Limites.permitir(`coment:${req.usuario}`, [[10 * Limites.MIN, 15]]))) return res.status(429).json({ success: false, error: 'Vas muy rápido. Espera unos minutos para comentar de nuevo.' });
            const nuevo = await Comentario.create({ itemId: refComentario(req.params.eid), texto, usuario: req.usuario });
            gamification?.onComentario?.(req.usuario)?.catch?.(() => {});
            if (texto.length >= 8 && (mod.dudoso || await Limites.permitir('mod-ia-coment', [[Limites.MIN, 20]]))) {
                Moderacion.ia(texto, 'comentario').then(async v => {
                    if (!Moderacion.debeQuitar(v)) return;
                    await Comentario.deleteOne({ _id: nuevo._id });
                    Moderacion.registrar({ tipo: 'comentario', usuario: req.usuario, categoria: v.categoria, motivo: v.motivo, fuente: 'NEXUS', texto, ref, accion: 'borrado' });
                    crearNotif({ destinatario: req.usuario, tipo: 'sistema', emisor: 'UpGames', itemTitle: 'Revisión', mensaje: `🚫 Quitamos tu comentario porque ${Moderacion.MENSAJE[v.categoria]}. Mantengamos la comunidad sana.` });
                }).catch(() => {});
            }
            crearNotif({ destinatario: c.b.usuario, tipo: 'comentario', emisor: req.usuario, itemTitle: c.e.titulo, mensaje: `@${req.usuario} comentó en tu entrada «${c.e.titulo}»` });
            res.status(201).json({ success: true, comentario: { id: String(nuevo._id), usuario: req.usuario, avatar: '', texto, fecha: nuevo.fecha } });
        } catch (e) { fallo(res, e, 'comentar'); }
    });

    // Lo borra quien lo escribió o el dueño del blog
    app.delete('/blogs/comentarios/:eid/:cid', verificarToken, async (req, res) => {
        try {
            const c = await entradaComentable(req.params.eid);
            if (!c || !idOk(req.params.cid)) return res.status(404).json({ success: false, error: 'No existe.' });
            const filtro = { _id: req.params.cid, itemId: refComentario(req.params.eid) };
            if (c.b.usuario !== req.usuario) filtro.usuario = req.usuario;
            const r = await Comentario.deleteOne(filtro);
            res.json({ success: !!r.deletedCount });
        } catch (e) { fallo(res, e, 'borrar comentario'); }
    });

    // ═══════════════ PÁGINAS PÚBLICAS ═══════════════

    const APP_ORIGEN = (() => { try { return new URL(APP_URL).origin; } catch (_) { return ''; } })();
    const CSP = `default-src 'none'; img-src 'self' https: data:; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; frame-src 'self' ${APP_ORIGEN} https://www.youtube-nocookie.com https://open.spotify.com; base-uri 'none'; form-action 'none'`;
    function html(res, estado, cuerpo, cacheSeg = 300) {
        if (!cacheSeg) return res.status(estado).set({ 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': CSP, 'Cache-Control': 'no-store' }).send(cuerpo);
        res.status(estado).set({ 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': CSP, 'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Cache-Control': estado === 200 ? `public, max-age=60, s-maxage=${cacheSeg}, stale-while-revalidate=600` : 'public, max-age=30' }).send(cuerpo);
    }

    const vistos = new Map();   // ip|entrada → ms (una visita por persona y entrada cada 30 min)
    function contarVista(blog, eid, ip) {
        const k = `${ip}|${eid}`, ahora = Date.now();
        if ((vistos.get(k) || 0) > ahora - 30 * 60000) return;
        if (vistos.size > 100000) vistos.clear();
        vistos.set(k, ahora);
        const dia = new Date().toISOString().slice(0, 10);
        Promise.all([
            Entrada.updateOne({ _id: eid, blog: blog._id }, { $inc: { vistas: 1 } }),
            Blog.updateOne({ _id: blog._id }, { $inc: { vistas: 1 } }),
            BlogVista.updateOne({ blog: blog._id, dia }, { $inc: { n: 1 } }, { upsert: true }),
        ]).catch(() => {});
    }

    // ── Monetización: pagar al creador por cada anuncio realmente visto ────────────────
    const ticketsUsados = new Map();   // ticket → ms (cada ticket paga una sola vez)
    async function pagarAnuncio(blog, ticket, ip) {
        if (!blog.monetizar || blog.visibilidad !== 'publico' || blog.estado !== 'activo') return;
        if (!Anuncios.verificar(JWT_SECRET, ticket, blog._id, ip).ok || ticketsUsados.has(ticket)) return;
        if (ticketsUsados.size > 200000) ticketsUsados.clear();
        ticketsUsados.set(ticket, Date.now());
        // Por persona: 3 anuncios pagados al día en un mismo blog y 25 entre todos los blogs
        if (!(await Limites.permitir(`blog-ad:${blog._id}:${ip}`, [[Limites.DIA, 3]])) || !(await Limites.permitir(`blog-ad-ip:${ip}`, [[Limites.DIA, 25]]))) return;
        const dia = new Date().toISOString().slice(0, 10);
        const autor = await Usuario.findOne({ usuario: blog.usuario }).select('usuario listaNegraAdmin').lean();
        let ganancia = autor && !autor.listaNegraAdmin ? Anuncios.CPM / 1000 : 0;
        if (ganancia) {
            await Usuario.updateOne({ usuario: autor.usuario }, { $inc: { saldo: ganancia } });
            const fr = fraudDetector ? await fraudDetector.analyzeDownloadBehavior(autor.usuario, String(blog._id), ip, ganancia).catch(() => null) : null;
            if (fr?.suspicious && fr.autoFlag && await fraudDetector.autoFlagUser(Usuario, autor.usuario, `Blog «${blog.direccion}»: ${fr.reasons.join(', ')}`)) {
                await Usuario.updateOne({ usuario: autor.usuario, saldo: { $gte: ganancia } }, { $inc: { saldo: -ganancia } });
                logger.warn(`[blogs] anuncios de «${blog.direccion}»: @${autor.usuario} marcado por fraude, ganancia revertida`);
                ganancia = 0;
            }
        }
        await Promise.all([
            Blog.updateOne({ _id: blog._id }, { $inc: { anunciosVistos: 1, ingresos: ganancia } }),
            BlogVista.updateOne({ blog: blog._id, dia }, { $inc: { a: 1, g: ganancia } }, { upsert: true }),
        ]);
    }

    /** Lo que rodea a cualquier página del blog: menú de páginas, autor, lo más leído y etiquetas. */
    const contexto = (blog, base, origen) => conCache(`ctx:${blog._id}`, 60, async () => {
        const [paginas, autor, populares, nube] = await Promise.all([
            Entrada.find({ ...visibles(blog._id), tipo: 'pagina' }).sort({ createdAt: 1 }).limit(8).select('titulo slug').lean(),
            Usuario.findOne({ usuario: blog.usuario }).select('usuario avatar bio planHasta').lean(),
            Entrada.find({ ...visibles(blog._id), tipo: 'entrada', vistas: { $gt: 0 } }).sort({ vistas: -1 }).limit(5).select('titulo slug').lean(),
            Entrada.aggregate([{ $match: { ...visibles(blog._id), tipo: 'entrada' } }, { $unwind: '$etiquetas' }, { $group: { _id: '$etiquetas', n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 20 }]),
        ]);
        return { paginas, autor: autor && { usuario: autor.usuario, avatar: autor.avatar, bio: autor.bio }, premium: premiumActivo(autor), populares, nube: nube.map(x => x._id) };
    }).then(({ premium, ...c }) => ({ ...c, blog: !premium && Temas.TEMAS[blog.tema]?.premium ? { ...blog, tema: Temas.POR_DEFECTO } : blog, sinMarca: premium, base, origen, appUrl: APP_URL, anuncio: !!blog.monetizar && blog.visibilidad === 'publico' }));

    async function juegosDe(bloques) {
        const ids = [...new Set((bloques || []).filter(b => b.tipo === 'juego' || b.tipo === 'descarga').map(b => b.id))].slice(0, 20);
        if (!ids.length) return {};
        const lista = await Juego.find({ _id: { $in: ids }, status: 'aprobado' }).select('title image usuario').lean();
        return Object.fromEntries(lista.map(j => [String(j._id), j]));
    }

    /** Sirve una ruta de un blog. `ruta` empieza por «/» y ya no lleva el prefijo del blog. */
    async function servir(req, res, blog, base, ruta) {
        // Detrás del proxy de Railway el dominio real llega en X-Forwarded-Host (req.hostname ya lo tiene en cuenta)
        const reenviado = String(req.get('x-forwarded-host') || '').split(',')[0].trim();
        const origen = `${req.protocol}://${reenviado && reenviado.split(':')[0].toLowerCase() === req.hostname ? reenviado : req.get('host')}`;
        if (blog.estado !== 'activo') return html(res, 451, R.aviso('Blog no disponible', blog.estado === 'suspendido' ? 'Este blog fue suspendido por incumplir las normas de UpGames.' : 'Este blog está en revisión por el equipo de UpGames.', APP_URL));
        ruta = ruta.replace(/\/+$/, '') || '/';
        let m;

        if ((m = ruta.match(/^\/_v\/([a-f0-9]{24})\.gif$/))) {
            contarVista(blog, m[1], req.ip || '');
            return res.set({ 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' }).send(GIF);
        }
        // Monetización: el marco del anuncio y el aviso de «anuncio visto» que paga al creador
        if (ruta === '/_anuncio') {
            if (!blog.monetizar) return res.status(404).end();
            res.removeHeader('X-Frame-Options');
            return res.set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' }).send(Anuncios.pagina(Anuncios.emitir(JWT_SECRET, blog._id, req.ip || ''), `${origen}${base}/_av`));
        }
        if (ruta === '/_av') {
            pagarAnuncio(blog, String(req.query.t || ''), req.ip || '').catch(e => logger.error(`[blogs] anuncio: ${e.message}`));
            return res.set({ 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' }).send(GIF);
        }
        const ctx = await contexto(blog, base, origen);
        if ((m = ruta.match(/^\/_previa\/([a-f0-9]{24})$/))) {
            const k = String(req.query.k || ''), buena = Anuncios.firmaPrevia(JWT_SECRET, m[1]);
            const e = k.length === buena.length && crypto.timingSafeEqual(Buffer.from(k), Buffer.from(buena)) && await Entrada.findOne({ _id: m[1], blog: blog._id }).lean();
            if (!e) return html(res, 404, R.noEncontrada(ctx));
            res.set('X-Robots-Tag', 'noindex');
            return html(res, 200, R.entrada({ ...ctx, anuncio: false, juegos: await juegosDe(e.bloques) }, { ...e, publicadaEn: e.publicadaEn || new Date() }, { previa: true }), 0);
        }

        if (ruta === '/' || (m = ruta.match(/^\/etiqueta\/([a-z0-9-]{1,40})$/))) {
            const pagina = Math.min(500, Math.max(1, parseInt(req.query.pagina, 10) || 1));
            const filtro = { ...visibles(blog._id), tipo: 'entrada', ...(m ? { etiquetasSlug: m[1] } : {}) };
            const lista = await Entrada.find(filtro).sort({ publicadaEn: -1 }).skip((pagina - 1) * POR_PAGINA).limit(POR_PAGINA + 1).select('titulo slug portada resumen bloques etiquetas publicadaEn').lean();
            const hayMas = lista.length > POR_PAGINA;
            const etiqueta = m ? (lista[0]?.etiquetas || []).find(t => V.slug(t) === m[1]) || m[1] : '';
            if (m && !lista.length && pagina === 1) return html(res, 404, R.noEncontrada(ctx));
            return html(res, 200, R.inicio(ctx, { entradas: lista.slice(0, POR_PAGINA), pagina, hayMas, etiqueta }));
        }
        if ((m = ruta.match(/^\/(e|p)\/([a-z0-9-]{1,90})$/))) {
            const e = await Entrada.findOne({ ...visibles(blog._id), tipo: m[1] === 'p' ? 'pagina' : 'entrada', slug: m[2] }).lean();
            if (!e) return html(res, 404, R.noEncontrada(ctx));
            return html(res, 200, R.entrada({ ...ctx, juegos: await juegosDe(e.bloques) }, e));
        }
        if (ruta === '/feed.xml') {
            const lista = await Entrada.find({ ...visibles(blog._id), tipo: 'entrada' }).sort({ publicadaEn: -1 }).limit(30).select('titulo slug resumen bloques publicadaEn').lean();
            return res.set({ 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=900' }).send(R.feed(ctx, lista));
        }
        if (ruta === '/sitemap.xml') {
            const lista = blog.visibilidad === 'publico' ? await Entrada.find(visibles(blog._id)).sort({ publicadaEn: -1 }).limit(2000).select('slug tipo publicadaEn updatedAt').lean() : [];
            return res.set({ 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=600, s-maxage=3600' }).send(R.sitemap(ctx, lista));
        }
        if (ruta === '/robots.txt' && !base) {
            return res.type('text/plain').set('Cache-Control', 'public, max-age=3600').send(blog.visibilidad === 'publico' ? `User-agent: *\nAllow: /\nSitemap: ${origen}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n');
        }
        return html(res, 404, R.noEncontrada(ctx));
    }

    const blogPorDireccion = d => conCache(`dir:${d}`, 30, () => Blog.findOne({ direccion: d }).lean());
    const blogPorDominio = h => conCache(`dom:${h}`, 60, () => Blog.findOne({ 'dominio.nombre': { $in: [h, h.startsWith('www.') ? h.slice(4) : `www.${h}`] }, 'dominio.verificado': true }).lean());

    // Dirección gratis: /b/<direccion>/…
    app.get(/^\/b\/([a-z0-9-]{3,30})(\/.*)?$/i, async (req, res) => {
        try {
            const dir = req.params[0].toLowerCase(), resto = req.params[1];
            if (resto === undefined) return res.redirect(301, `/b/${dir}/`);   // con la barra final funcionan los enlaces relativos
            const blog = await blogPorDireccion(dir);
            if (!blog) return html(res, 404, R.aviso('Este blog no existe', 'Puede que la dirección esté mal escrita o que el blog se haya borrado.', APP_URL));
            await servir(req, res, blog, `/b/${blog.direccion}`, resto);
        } catch (e) { logger.error(`[blogs] servir: ${e.message}`); res.status(500).type('text/plain').send('Error al cargar el blog'); }
    });

    /**
     * Dominio propio (o <direccion>.BLOGS_DOMINIO): se decide por el encabezado Host.
     * Va al principio de la cadena de Express (ver index.js) porque en esos dominios
     * TODAS las rutas son del blog, incluida «/».
     */
    const hostPropio = h => !h || h === HOST_API || h === 'localhost' || /^[\d.:]+$/.test(h) || h.endsWith('.railway.app') || h.endsWith('.railway.internal') || h === BLOGS_DOMINIO;
    async function porHost(req, res, next) {
        const h = String(req.hostname || '').toLowerCase();
        if (hostPropio(h) || (req.method !== 'GET' && req.method !== 'HEAD')) return next();
        try {
            const blog = BLOGS_DOMINIO && h.endsWith(`.${BLOGS_DOMINIO}`) ? await blogPorDireccion(h.slice(0, -BLOGS_DOMINIO.length - 1)) : await blogPorDominio(h);
            if (!blog) return BLOGS_DOMINIO && h.endsWith(`.${BLOGS_DOMINIO}`) ? html(res, 404, R.aviso('Este blog no existe', 'Puede que la dirección esté mal escrita o que el blog se haya borrado.', APP_URL)) : next();
            await servir(req, res, blog, '', req.path);
        } catch (e) { logger.error(`[blogs] host ${h}: ${e.message}`); next(); }
    }

    return { porHost, Blog, Entrada };
}

module.exports = { registrar, enlaceProhibido };
