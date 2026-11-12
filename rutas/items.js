/**
 * Publicaciones: catálogo, publicar, editar y reportes
 *
 * GET /items (orden de Nexus), publicar con verificación de títulos comerciales, editar, reportes, vistas, series, autoinfo y plantillas.
 * Extraído de index.js: recibe sus dependencias explícitas (ver la llamada en index.js).
 */
module.exports = function items({ CeroTolerancia, ContenidoLegal, JWT_SECRET, Juego, Limites, Moderacion, Notificacion, Ranking, Reporte, Sospecha, StatsItems, Usuario, app, autoInfo, body, cacheado, calcularScoreRecomendacion, cloudinary, crearNotif, esCategoriaRom, gameDetector, gamification, jwt, logger, moderarPublicacion, mongoose, nexusLLM, nexusMentor, param, recommendations, revisionIA, series, validationResult, verificarAdmin, verificarToken }) {
// Creadas en index.js después de registrar este módulo: llegan con vincularTarde()
let paginasSeoPronto;
app.put("/items/report/:id", [verificarToken, param('id').isMongoId(), body('motivo').isIn(['caido', 'viejo', 'malware'])], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, error: "Datos inválidos" });
        const { motivo } = req.body;
        const ip = req.ip || 'unknown';
        const usuarioReportante = req.usuario;   // reportar exige sesión (antes era anónimo)
        const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const reporteExistente = await Reporte.findOne({ juegoId: req.params.id, ip, fecha: { $gte: hace24h } });
        if (reporteExistente) return res.status(429).json({ success: false, error: "Ya reportaste este contenido. Espera 24h." });
        await new Reporte({ juegoId: req.params.id, motivo, usuarioReportante, ip }).save();
        const juego = await Juego.findByIdAndUpdate(req.params.id, { $inc: { reportes: 1, [`reportesDesglose.${motivo}`]: 1 } }, { new: true });
        if (!juego) return res.status(404).json({ success: false, error: "Item no encontrado" });
        if (juego.reportes >= 5 && juego.linkStatus !== 'revision') { juego.linkStatus = 'revision'; await juego.save(); }
        logger.info(`Reporte #${juego.reportes} (${motivo}) para: ${juego.title}`);
        res.json({ success: true, ok: true, reportes: juego.reportes, linkStatus: juego.linkStatus, motivoReportado: motivo });
    } catch (error) {
        logger.error(`Error: ${error?.message}`);
        res.status(500).json({ success: false, error: "Error al reportar" });
    }
});

app.get("/items/reportes/:id", async (req, res) => {
    try {
        const juego = await Juego.findById(req.params.id).select('reportes reportesDesglose linkStatus usuario title');
        if (!juego) return res.status(404).json({ success: false, error: "Juego no encontrado" });
        const reportesDetallados = await Reporte.find({ juegoId: req.params.id }).sort({ fecha: -1 }).limit(100).select('motivo usuarioReportante fecha').lean();
        res.json({ success: true, juego: { id: juego._id, title: juego.title, autor: juego.usuario, reportesTotales: juego.reportes, linkStatus: juego.linkStatus, desglose: juego.reportesDesglose || { caido: 0, viejo: 0, malware: 0 } }, reportes: reportesDetallados });
    } catch (error) {
        logger.error(`Error: ${error?.message}`);
        res.status(500).json({ success: false, error: "Error al obtener reportes" });
    }
});

app.get("/items/mis-reportes/:usuario", async (req, res) => {
    try {
        const juegosConReportes = await Juego.find({ usuario: req.params.usuario, reportes: { $gt: 0 } }).select('_id title reportes reportesDesglose linkStatus image createdAt').sort({ reportes: -1 }).lean();
        res.json({ success: true, publicaciones: juegosConReportes });
    } catch (error) {
        logger.error(`Error: ${error?.message}`);
        res.status(500).json({ success: false, error: "Error" });
    }
});

app.put('/items/vistas/:id', [param('id').isMongoId()], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, error: 'ID inválido' });
        const juegoId = req.params.id;
        const juego = await Juego.findById(juegoId).select('title vistas descargasEfectivas').lean();
        if (!juego) return res.status(404).json({ success: false, error: 'Item no encontrado' });
        // Una vista de video NO es una descarga: va a su propio contador, no genera ganancia
        // y no toca el registro de descargas por IP (DescargaIP) de la página puente.
        // descargasEfectivas de videos antiguos guarda vistas de antes de separarlas.
        const total = j => (j.vistas || 0) + (j.descargasEfectivas || 0);
        if (!(await Limites.permitir(`vistaVideo:${juegoId}:${req.ip}`, [[Limites.DIA, 1]]))) return res.json({ success: true, duplicada: true, vistas: total(juego) });
        const updated = await Juego.findByIdAndUpdate(juegoId, { $inc: { vistas: 1 } }, { new: true }).select('vistas descargasEfectivas').lean();
        logger.info(`Vista registrada — Video: ${juego.title} | Total: ${total(updated)}`);
        res.json({ success: true, duplicada: false, vistas: total(updated) });
    } catch (error) {
        logger.error(`Error en PUT /items/vistas: ${error.message}`);
        res.status(500).json({ success: false, error: 'Error al registrar vista' });
    }
});

app.get("/items", async (req, res) => {
    try {
        const categoria = typeof req.query.categoria === 'string' ? req.query.categoria.slice(0, 40) : '';
        const catalogo = await cacheado(`items:lista:${categoria}`, 30, async () => {
            const filtro = { status: 'aprobado', linkStatus: { $in: ['online', 'revision'] } };
            if (categoria && categoria !== 'Todo') filtro.category = categoria;
            // Orden: fórmula de Nexus (public/upgames-ranking.js): promoción con UpCoins según el
            // nivel pagado + reseñas, guardados, seguidores del creador, descargas de la semana y
            // novedad. La web luego lo ajusta a los gustos de cada usuario con la MISMA fórmula.
            // Candidatas: las promocionadas y las 400 más relevantes/recientes; se devuelven 100.
            const candidatas = await Juego.aggregate([
                { $match: filtro },
                { $addFields: {
                    promocionado: { $gt: [{ $ifNull: ['$destacadoHasta', new Date(0)] }, '$$NOW'] },
                    impulsado: { $gt: [{ $ifNull: ['$impulsoHasta', new Date(0)] }, '$$NOW'] },
                } },
                { $sort: { promocionado: -1, scoreRecomendacion: -1, createdAt: -1 } },
                { $limit: 400 },
                { $lookup: { from: 'usuarios', localField: 'usuario', foreignField: 'usuario', as: '_autor',
                    pipeline: [{ $project: { _id: 0, n: { $size: { $ifNull: ['$listaSeguidores', []] } } } }] } },
                { $addFields: { seguidoresAutor: { $ifNull: [{ $arrayElemAt: ['$_autor.n', 0] }, 0] } } },
                { $project: { _id: 1, title: 1, description: 1, image: 1, images: 1, link: 1, category: 1, usuario: 1, resenas: 1, reportes: 1, linkStatus: 1, descargasEfectivas: 1, vistas: 1, likesCount: 1, extraData: 1, videoType: 1, featuredItemId: 1, scoreRecomendacion: 1, serie: 1, createdAt: 1, updatedAt: 1, promocionado: 1, tutorialId: 1,
                    tieneGuia: { $gt: [{ $strLenCP: { $ifNull: ['$guiaInstalacion', ''] } }, 0] },
                    impulsado: 1, seguidoresAutor: 1, meGustaCount: 1, compat: 1, promoUCDia: 1, promoNivel: { $cond: ['$promocionado', { $ifNull: ['$promoNivel', 'estandar'] }, '$$REMOVE'] } } },
            ]);
            // Descargas de los últimos 7 días (stats_items): alimenta "Más descargados esta semana"
            const semana = await StatsItems.actividadReciente(7);
            candidatas.forEach(i => {
                const a = semana[String(i._id)];
                i.descargasSemana = a?.d || 0;
                i.vistasSemana = a?.v || 0;   // videos: "elecciones" de la semana
                // Juego de la publicación (también en las antiguas sin detección guardada): gustos y recurrencia
                i.juego = i.extraData?.detectedGame?.gameName || gameDetector.detectGame(i.title, i.description)?.gameName || i.extraData?.['juego-base'] || undefined;
            });
            const items = Ranking.ordenar(candidatas).slice(0, 100);
            // Series por partes: solo la primera parte aparece en el catálogo
            return series.colapsar(items, Juego, { status: 'aprobado', linkStatus: { $in: ['online', 'revision'] } });
        });
        res.json(catalogo);
    } catch (error) {
        res.status(500).json([]);
    }
});

app.get("/items/user/:usuario", async (req, res) => {
    try {
        // Los proyectos privados (status 'privado') no se listan en el perfil público: solo accesibles por link directo.
        // El autor ve todo lo suyo (pendiente/rechazado incluidos y cada parte por separado);
        // los demás solo lo aprobado, con las series agrupadas como en el catálogo.
        let yo = null;
        const t = req.headers.authorization?.split(' ')[1];
        if (t && t.length > 20) { try { yo = jwt.verify(t, JWT_SECRET).usuario; } catch (_) {} }
        const propio = yo && yo === String(req.params.usuario).toLowerCase();
        const filtro = propio ? { usuario: req.params.usuario, status: { $ne: 'privado' } } : { usuario: req.params.usuario, status: 'aprobado' };
        const aportes = await Juego.find(filtro).select('_id title description image images link category usuario reportes reportesDesglose linkStatus descargasEfectivas vistas likesCount status createdAt scoreRecomendacion extraData videoType featuredItemId serie guiaInstalacion tutorialId motivoRechazo nexusMentor destacadoHasta promoNivel promoUCDia meGustaCount prioridadDesde prioridadReembolso').sort({ scoreRecomendacion: -1, createdAt: -1 }).lean();
        res.json(propio ? aportes : await series.colapsar(aportes, Juego, { usuario: req.params.usuario, status: 'aprobado' }));
    } catch (error) {
        res.status(500).json([]);
    }
});

// ── Enlaces permitidos para publicar (misma lista que PF_ALLOWED_LINKS del frontend) ──
const LINKS_PERMITIDOS = ['mediafire.com', 'mega.nz', 'mega.co.nz', 'drive.google.com',
    'gofile.io', 'onedrive.live.com', 'icloud.com', 'proton.me', 'pcloud.com',
    'pixeldrain.com', '1fichier.com', 'qiwi.gg', 'krakenfiles.com', 'dropbox.com',
    'github.com', 'github.io', 'sto.romsfast.com', 'clarodrive.com',
    // descargas oficiales de UpGames (APK de UpGames RACING): solo este servidor, no todo railway.app
    'upgames-production.up.railway.app'];

// Devuelve null si el enlace es válido o un mensaje de error si no.
function errorLinkPublicacion(link, category) {
    let u;
    try { u = new URL(String(link || '').trim()); } catch (_) { return 'Formato de enlace inválido'; }
    if (!['https:', 'http:'].includes(u.protocol)) return 'El enlace debe empezar por https://';
    if (category === 'Video') return null;   // videos: Cloudinary, YouTube u otra URL directa
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    if (!LINKS_PERMITIDOS.some(d => host === d || host.endsWith('.' + d)))
        return 'Plataforma no permitida. Usa MediaFire, MEGA, Drive, ClaroDrive, etc. (sin acortadores)';
    if (/\.(exe|msi)$/i.test(u.pathname)) return 'No se permiten enlaces directos a .exe/.msi; usa .zip o .rar';
    return null;
}

const CAMPOS_PUBLICACION = ['title', 'description', 'link', 'image', 'images', 'category', 'videoType', 'extraData', 'featuredItemId', 'tags', 'guiaInstalacion', 'tutorialId'];

// Guía de instalación (opcional, la escribe quien publica): texto paso a paso y/o un video
// tutorial que el mismo autor ya publicó en UpGames. UpGames no la redacta: solo la muestra.
const GUIA_MAX = 3000;
async function sanearGuia(datos, usuario) {
    if (datos.guiaInstalacion !== undefined) datos.guiaInstalacion = String(datos.guiaInstalacion || '').replace(/\r\n/g, '\n').trim().slice(0, GUIA_MAX);
    if (datos.tutorialId !== undefined) {
        const id = String(datos.tutorialId || '').trim();
        if (!id) datos.tutorialId = '';
        else if (!mongoose.Types.ObjectId.isValid(id)) return 'El tutorial elegido no es válido';
        else {
            const v = await Juego.findOne({ _id: id, usuario, category: 'Video', status: { $in: ['aprobado', 'pendiente', 'pending'] } }).select('_id').lean();
            if (!v) return 'El tutorial debe ser un video tuyo publicado en UpGames';
            datos.tutorialId = id;
        }
    }
    if (datos.guiaInstalacion) {
        const modG = Moderacion.reglas(datos.guiaInstalacion, 'publicacion');
        if (modG.bloquear) return `La guía de instalación no cumple las normas: ${Moderacion.MENSAJE[modG.categoria] || 'revísala'}`;
        if (ContenidoLegal.revisar({ title: '', description: datos.guiaInstalacion }).bloquear) return 'La guía de instalación menciona contenido no permitido';
    }
    return null;
}

// POST /items/precheck — Nexus revisa la publicación ANTES de publicarla:
// enlace (si el archivo existe), portada, texto, derechos, duplicados y si es
// una parte de una serie. ia:false = solo comprobaciones rápidas (al pulsar Publicar).
app.post('/items/precheck', verificarToken, async (req, res) => {
    try {
        if (!(await Limites.permitir(`precheck:${req.usuario}`, [[Limites.MIN, 12]]))) return res.status(429).json({ success: false, error: 'Espera un momento antes de volver a revisar' });

        const b = req.body || {};
        const item = {
            _id: new mongoose.Types.ObjectId(), usuario: req.usuario, createdAt: new Date(),
            title: String(b.title || '').trim().slice(0, 200), description: String(b.description || '').slice(0, 1000),
            link: String(b.link || '').trim(), image: String(b.image || '').trim(),
            images: Array.isArray(b.images) ? b.images.filter(x => typeof x === 'string').slice(0, 4) : [],
            category: String(b.category || 'General').slice(0, 40), extraData: {},
        };
        if (!item.title || !item.link) return res.status(400).json({ success: false, error: 'Escribe al menos el título y el enlace' });
        // Al editar: se revisa como la publicación existente (no se marca duplicada de sí misma)
        if (b.editId && mongoose.Types.ObjectId.isValid(b.editId)) {
            const propia = await Juego.findOne({ _id: b.editId, usuario: req.usuario }).select('_id createdAt').lean();
            if (propia) { item._id = propia._id; item.createdAt = propia.createdAt || item.createdAt; }
        }
        const a = await revisionIA.analizar(item, { Juego, Usuario, errorLinkPublicacion, gameDetector, logger, sinIA: b.ia === false });
        // Al creador solo le sirve lo que puede corregir (no su propio historial)
        const hechos = a.hechos.filter(h => ['enlace', 'medios', 'texto', 'derechos', 'duplicado'].includes(h.area));

        // ¿Es una parte de una serie?
        const s = series.serieDe(item.title, req.usuario);
        if (s) {
            const otras = await Juego.find({ 'serie.clave': s.clave, _id: { $ne: item._id } }).select('serie.parte').lean();
            const nums = [...new Set(otras.map(o => o.serie?.parte).filter(Boolean))].sort((x, y) => x - y);
            if (nums.includes(s.parte)) hechos.push({ tipo: 'warn', area: 'serie', texto: `Ya publicaste la Parte ${s.parte} de "${s.base}": ¿no será la siguiente?`, peso: 0 });
            else if (nums.length) hechos.push({ tipo: 'ok', area: 'serie', texto: `Es la Parte ${s.parte} de "${s.base}": se agrupará en una carpeta con tus partes ${nums.join(', ')}. Cada parte suma sus propias descargas.`, peso: 0 });
            else if (s.parte > 1) hechos.push({ tipo: 'warn', area: 'serie', texto: `Detecté la Parte ${s.parte} de "${s.base}", pero aún no has publicado la Parte 1. Publícalas con el mismo título base para que se agrupen.`, peso: 0 });
            else hechos.push({ tipo: 'info', area: 'serie', texto: `Detecté la Parte ${s.parte} de "${s.base}". Publica las siguientes como "${s.base} parte 2", "parte 3"… y se agruparán en una carpeta.`, peso: 0 });
        }
        // ¿Nombre de un juego comercial que no parece un mod? Se avisa ANTES de publicar
        const com = Sospecha.evaluar({ title: item.title, category: String(b.category || ''), serie: series.serieDe(item.title, req.usuario) });
        if (com) hechos.unshift({ tipo: 'warn', area: 'comercial', texto: `${Sospecha.MENSAJE_PUBLICAR(com.juego)} Mientras se verifica no ganarás UpCoins.`, peso: 0 });
        const problemas = hechos.filter(h => h.tipo === 'bad').length;
        res.json({ comercial: com,
            success: true, listo: problemas === 0, problemas, avisos: hechos.filter(h => h.tipo === 'warn').length,
            puntos: a.puntos, resumen: problemas ? 'Nexus encontró problemas que harían que rechacen tu publicación.' : (a.ia?.resumen || 'Tu publicación se ve bien.'),
            hechos, sugerencias: a.ia?.sugerencias || [], razones: a.ia?.razones || [], fuente: a.ia?.fuente || null,
            enlace: a.enlace?.estado || null, serie: s ? { base: s.base, parte: s.parte } : null,
        });
    } catch (e) {
        logger.error(`[precheck] ${e.message}`);
        res.status(500).json({ success: false, error: 'Nexus no pudo revisar la publicación ahora' });
    }
});

app.post("/items/add", [verificarToken, body('title').notEmpty().trim().isLength({ max: 200 }), body('link').notEmpty().trim()], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, error: "Datos inválidos" });

        const errLink = errorLinkPublicacion(req.body.link, req.body.category);
        if (errLink) return res.status(400).json({ success: false, error: errLink });
        // Filtro automático por palabras clave: si el título o la descripción declaran piratería, no se publica
        const legal = ContenidoLegal.revisar(req.body);
        if (legal.bloquear) return res.status(400).json({ success: false, error: `No se puede publicar: ${legal.bloquear}. Revisa las normas de contenido.` });
        if (await CeroTolerancia.restringido(req.usuario)) return res.status(403).json({ success: false, error: 'Tu cuenta está restringida mientras el equipo de seguridad revisa un reporte.', code: 'RESTRINGIDO' });
        const modP = Moderacion.reglas(`${req.body.title} ${req.body.description || ''}`, 'publicacion');
        if (modP.bloquear) {
            Moderacion.registrar({ tipo: 'publicacion', usuario: req.usuario, categoria: modP.categoria, motivo: modP.motivo, fuente: 'reglas', texto: req.body.title, accion: 'bloqueado-antes' });
            return res.status(400).json({ success: false, error: `No se puede publicar: ${Moderacion.MENSAJE[modP.categoria] || 'incumple las normas'}. Revisa las normas de la comunidad.` });
        }

        // Solo campos editables por el autor: con strict:false, un ...req.body permitía
        // inyectar descargasEfectivas, likesCount, nexusMentor, etc.
        const datos = {};
        CAMPOS_PUBLICACION.forEach(f => { if (req.body[f] !== undefined) datos[f] = req.body[f]; });
        if (datos.extraData && (typeof datos.extraData !== 'object' || Array.isArray(datos.extraData))) datos.extraData = {};
        if (datos.tags !== undefined && !Array.isArray(datos.tags)) delete datos.tags;
        const errGuia = await sanearGuia(datos, req.usuario);
        if (errGuia) return res.status(400).json({ success: false, error: errGuia });
        datos.serie = series.serieDe(datos.title, req.usuario);
        // Categoría Juego: el creador declara que tiene derecho a compartirlo (casilla del formulario)
        if (datos.category === 'Juego' && req.body.declaraDerechos !== true)
            return res.status(400).json({ success: false, error: 'Para publicar en Juegos confirma que tienes derecho a compartir este contenido.', code: 'DECLARACION' });
        const nuevoJuego = new Juego({ ...datos, usuario: req.usuario, status: "aprobado", linkStatus: "revision" });
        if (datos.category === 'Juego') nuevoJuego.declaracion = { fecha: new Date(), texto: 'Declaro que soy el autor o tengo permiso para compartir este contenido, y que no es un juego comercial completo.' };
        // ¿Parece un juego comercial completo? Se publica, pero sin pagos hasta revisarlo
        const sospechaN = Sospecha.evaluar({ ...datos, serie: datos.serie });
        if (sospechaN) { nuevoJuego.pagoPausado = true; nuevoJuego.sospecha = { ...sospechaN, desde: new Date(), titulo: datos.title }; }
        // Premium: sus publicaciones nuevas también tienen más visibilidad mientras dure
        const premiumHasta = (await Usuario.findOne({ usuario: req.usuario }).select('planHasta').lean())?.planHasta;
        if (premiumHasta && new Date(premiumHasta) > new Date()) nuevoJuego.impulsoHasta = premiumHasta;

        // ── Detección automática de juego conocido ──────────────────
        const deteccion = gameDetector.detectGame(nuevoJuego.title, nuevoJuego.description);
        if(deteccion) {
            nuevoJuego.extraData = nuevoJuego.extraData || {};
            nuevoJuego.extraData.detectedGame = {
                gameName:     deteccion.gameName,
                gameKey:      deteccion.gameKey,
                platform:     deteccion.platform,
                purchaseLink: deteccion.purchaseLink
            };
            logger.info(`[GameDetector] "${nuevoJuego.title}" → ${deteccion.gameName}`);
        }
        // ────────────────────────────────────────────────────────────

        await nuevoJuego.save();

        // Fire & forget
        calcularScoreRecomendacion(nuevoJuego._id).catch(() => {});
        gamification.onUpload(nuevoJuego.usuario).catch(() => {});
        recommendations.invalidateTrending();

        try {
            const autorData = await Usuario.findOne({ usuario: nuevoJuego.usuario }).select('listaSeguidores').lean();
            const seguidores = autorData?.listaSeguidores || [];
            if (seguidores.length > 0) {
                const notifs = seguidores.map(seg => ({ destinatario: seg, tipo: 'nueva_publicacion', emisor: nuevoJuego.usuario, itemId: nuevoJuego._id.toString(), itemTitle: nuevoJuego.title, itemImage: nuevoJuego.image || '', leida: false, fecha: new Date() }));
                await Notificacion.insertMany(notifs, { ordered: false });
                logger.info(`Notificaciones enviadas a ${seguidores.length} seguidores de @${nuevoJuego.usuario}`);
            }
        } catch (notifErr) {
            logger.error(`Error enviando notificaciones: ${notifErr.message}`);
        }

        logger.info(`Nuevo item agregado: ${nuevoJuego.title} por @${nuevoJuego.usuario}`);
        res.status(201).json({ success: true, ok: true, item: nuevoJuego, id: nuevoJuego._id, sospecha: sospechaN || null });
        if (sospechaN) crearNotif({ destinatario: req.usuario, tipo: 'sistema', emisor: 'UpGames', itemId: String(nuevoJuego._id), itemTitle: 'Revisión', itemImage: nuevoJuego.image || '', mensaje: Sospecha.mensajeCreador(nuevoJuego.title, sospechaN.juego) });
        paginasSeoPronto();   // su página para Google y WhatsApp en minutos, no al día siguiente
        moderarPublicacion(nuevoJuego._id);   // NEXUS revisa texto y portada; si es sexual la quita sola

        // Fire & forget — Nexus revisa la publicación y deja consejos al autor
        nexusMentor.mentor(nuevoJuego.toObject()).then(m => {
            Juego.updateOne({ _id: nuevoJuego._id }, { $set: { nexusMentor: m } }, { timestamps: false }).catch(() => {});
            logger.info(`[nexus-mentor] "${nuevoJuego.title}" puntuación=${m.puntuacion} (${m.fuente})`);
        }).catch(() => {});
    } catch (error) {
        logger.error(`Error: ${error?.message}`);
        res.status(500).json({ success: false, error: "Error al guardar aporte" });
    }
});

app.put("/items/:id", verificarToken, [
    param('id').isMongoId(), body('title').optional().trim().isLength({ min: 1, max: 200 }),
    body('description').optional().trim().isLength({ max: 1000 }), body('link').optional().trim(),
    body('image').optional().trim(), body('images').optional().isArray({ max: 4 }), body('category').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, error: "Datos inválidos", details: errors.array() });
        const item = await Juego.findById(req.params.id);
        if (!item) return res.status(404).json({ success: false, error: "Publicación no encontrada" });
        if (item.usuario !== req.usuario) return res.status(403).json({ success: false, error: "No tienes permiso para editar esta publicación" });
        if (esCategoriaRom(item.category) && (req.body.category === undefined || esCategoriaRom(req.body.category)))
            return res.status(400).json({ success: false, error: 'Esa categoría ya no existe en UpGames. Para volver a publicarla, elige otra categoría (Juego, Mod, App…).', code: 'SIN_ROMS' });
        const updates = {};
        CAMPOS_PUBLICACION.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
        if (Object.keys(updates).length === 0) return res.status(400).json({ success: false, error: "No se enviaron campos para actualizar" });
        if (updates.tags !== undefined) updates.tags = Array.isArray(updates.tags) ? updates.tags.filter(t => typeof t === 'string').map(t => t.trim().slice(0, 40)).filter(Boolean).slice(0, 15) : undefined;
        if (updates.tags === undefined) delete updates.tags;
        const errGuiaE = await sanearGuia(updates, item.usuario);
        if (errGuiaE) return res.status(400).json({ success: false, error: errGuiaE });
        if (updates.title !== undefined) updates.serie = series.serieDe(updates.title, item.usuario);
        // Campos extra (plataforma, tamaño, consola…): se fusionan con lo que ya había y se
        // sanean. Los que el servidor calcula (detectedGame, duracion de videos) no los pisa el cliente.
        if (updates.extraData !== undefined || updates.title !== undefined || updates.description !== undefined) {
            const previo = (item.extraData && typeof item.extraData === 'object') ? { ...item.extraData } : {};
            const nuevo = (updates.extraData && typeof updates.extraData === 'object' && !Array.isArray(updates.extraData)) ? updates.extraData : null;
            const ex = { ...previo };
            if (nuevo) {
                Object.entries(nuevo).slice(0, 20).forEach(([k, v]) => {
                    if (!/^[\w-]{1,40}$/.test(k) || k === 'detectedGame') return;
                    if (v === '' || v === null) delete ex[k];
                    else if (typeof v === 'string' || typeof v === 'number') ex[k] = String(v).trim().slice(0, 600);
                });
            }
            const det = gameDetector.detectGame(updates.title ?? item.title, updates.description ?? item.description);
            if (det) ex.detectedGame = { gameName: det.gameName, gameKey: det.gameKey, platform: det.platform, purchaseLink: det.purchaseLink };
            else delete ex.detectedGame;
            updates.extraData = ex;
        }
        // Cambiar el enlace de una publicación ya verificada la devuelve a revisión:
        // evita publicar un enlace bueno y luego cambiarlo por otro distinto sin control.
        if (updates.link !== undefined && String(updates.link).trim() !== String(item.link || '').trim()) { updates.linkStatus = 'revision'; updates.enlaceMuertoDesde = null; }
        // Si cambia el título o la categoría se vuelve a evaluar (lo aprobado por el equipo se respeta
        // mientras el título siga igual; lo pausado a mano por el equipo no lo despausa el creador)
        if (updates.title !== undefined || updates.category !== undefined) {
            const tituloN = updates.title ?? item.title, catN = updates.category ?? item.category;
            const aprobadoEquipo = item.sospecha?.revision === 'ok' && item.sospecha?.titulo === tituloN;
            const manual = item.sospecha?.revision === 'mantener';
            const sN = aprobadoEquipo ? null : Sospecha.evaluar({ title: tituloN, category: catN, serie: updates.serie ?? item.serie });
            if (sN && !item.pagoPausado) {
                updates.pagoPausado = true; updates.sospecha = { ...sN, desde: new Date(), titulo: tituloN };
                crearNotif({ destinatario: item.usuario, tipo: 'sistema', emisor: 'UpGames', itemId: String(item._id), itemTitle: 'Revisión', itemImage: item.image || '', mensaje: Sospecha.mensajeCreador(tituloN, sN.juego) });
            } else if (!sN && item.pagoPausado && !manual && !aprobadoEquipo) { updates.pagoPausado = false; updates.sospecha = null; }
        }
        const legalE = ContenidoLegal.revisar({ title: updates.title ?? item.title, description: updates.description ?? item.description });
        if (legalE.bloquear) return res.status(400).json({ success: false, error: `No se puede guardar: ${legalE.bloquear}.` });
        const modE = Moderacion.reglas(`${updates.title ?? item.title} ${updates.description ?? item.description ?? ''}`, 'publicacion');
        if (modE.bloquear) return res.status(400).json({ success: false, error: `No se puede guardar: ${Moderacion.MENSAJE[modE.categoria] || 'incumple las normas'}.` });
        if (updates.link !== undefined) {
            const errLink = errorLinkPublicacion(updates.link, updates.category || item.category);
            if (errLink) return res.status(400).json({ success: false, error: errLink });
        }
        const updated = await Juego.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
        logger.info(`Usuario @${req.usuario} editó su publicación: ${updated.title}`);
        res.json({ success: true, item: updated });
        if (updates.title !== undefined || updates.description !== undefined || updates.image !== undefined || updates.images !== undefined) moderarPublicacion(updated._id);
    } catch (error) {
        logger.error(`Error: ${error?.message}`);
        res.status(500).json({ success: false, error: "Error al actualizar publicación" });
    }
});

app.put("/items/approve/:id", verificarAdmin, [param('id').isMongoId()], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, error: "ID inválido" });
        await Juego.findByIdAndUpdate(req.params.id, { $set: { status: "aprobado" } });
        res.json({ success: true, ok: true });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error de aprobación" });
    }
});

app.delete("/items/:id/video", verificarToken, [param('id').isMongoId()], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, error: "ID inválido" });
        const item = await Juego.findById(req.params.id);
        if (!item) return res.status(404).json({ success: false, error: "Video no encontrado" });
        if (item.usuario !== req.usuario) return res.status(403).json({ success: false, error: "Sin permiso" });
        if (item.link && item.link.includes("cloudinary.com")) {
            try {
                const parts = item.link.split("/");
                const idx = parts.indexOf("upload");
                if (idx !== -1) {
                    let pub = parts.slice(idx + 1).join("/");
                    pub = pub.replace(/^v\d+\//, "").replace(/\.[^.]+$/, "");
                    await cloudinary.uploader.destroy(pub, { resource_type: "video" });
                }
            } catch (cldErr) { logger.error("Cloudinary delete error: " + cldErr.message); }
        }
        await Juego.findByIdAndDelete(req.params.id);
        logger.info(`Video eliminado: "${item.title}" por @${req.usuario}`);
        res.json({ success: true, ok: true });
    } catch (error) {
        logger.error("Error al eliminar video: " + error.message);
        res.status(500).json({ success: false, error: "Error al eliminar video" });
    }
});

app.delete("/items/:id", async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, error: "ID inválido" });
        const item = await Juego.findById(req.params.id);
        if (!item) return res.status(404).json({ success: false, error: "Publicación no encontrada" });
        const adminToken = req.headers['x-admin-token'];
        const bearerToken = req.headers.authorization?.split(' ')[1];
        if (adminToken) {
            return verificarAdmin(req, res, async () => {
                await Juego.findByIdAndDelete(req.params.id);
                logger.info(`ADMIN @${req.admin.usuario} eliminó publicación: ${item.title}`);
                res.json({ success: true, ok: true });
            });
        } else if (bearerToken) {
            try {
                const decoded = jwt.verify(bearerToken, JWT_SECRET);
                if (item.usuario !== decoded.usuario) return res.status(403).json({ success: false, error: "No tienes permiso para eliminar esta publicación" });
                await Juego.findByIdAndDelete(req.params.id);
                logger.info(`Usuario @${decoded.usuario} eliminó su publicación: ${item.title}`);
                return res.json({ success: true, ok: true });
            } catch { return res.status(401).json({ success: false, error: "Token inválido o expirado" }); }
        } else {
            return res.status(401).json({ success: false, error: "Se requiere autenticación para eliminar" });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: "Error al eliminar" });
    }
});

app.get('/items/recomendados/:usuario', async (req, res) => {
    try {
        const { usuario } = req.params;
        const { categorias = '', tags = '', excluir = '', limite = '12' } = req.query;
        const lim = Math.min(parseInt(limite) || 12, 30);
        const query = { status: 'aprobado', linkStatus: { $ne: 'caido' } };
        const excluirIds = excluir ? excluir.split(',').filter(id => id.match(/^[a-f\d]{24}$/i)) : [];
        if (excluirIds.length > 0) query._id = { $nin: excluirIds };
        const catPesos = categorias ? categorias.split(',').map(c => { const [cat, peso] = c.split(':'); return { cat: cat?.trim(), peso: parseInt(peso) || 1 }; }).filter(c => c.cat) : [];
        const tagList = tags ? tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : [];
        if (catPesos.length > 0 || tagList.length > 0) {
            const orClauses = [];
            if (catPesos.length > 0) orClauses.push({ category: { $in: catPesos.map(c => c.cat) } });
            if (tagList.length > 0) orClauses.push({ tags: { $in: tagList } });
            query.$or = orClauses;
        }
        let items = await Juego.find(query).sort({ scoreRecomendacion: -1, likesCount: -1 }).limit(lim * 3).lean();
        if (catPesos.length > 0) {
            const pesoMap = {};
            catPesos.forEach(({ cat, peso }) => { pesoMap[cat] = peso; });
            items = items.map(item => ({ ...item, _recoScore: (item.scoreRecomendacion || 0) + (pesoMap[item.category] || 0) * 10 + (tagList.some(t => item.tags?.includes(t)) ? 5 : 0) }));
            items.sort((a, b) => b._recoScore - a._recoScore);
        }
        const resultado = items.slice(0, lim).map(item => ({ _id: item._id, title: item.title, description: item.description, image: item.image, category: item.category, tags: item.tags || [], descargasEfectivas: item.descargasEfectivas || 0, scoreRecomendacion: item.scoreRecomendacion || 0, usuario: item.usuario, linkStatus: item.linkStatus }));
        res.json({ success: true, usuario, total: resultado.length, items: resultado });
    } catch (error) {
        logger.error(`Error: ${error?.message}`);
        res.status(500).json({ success: false, error: 'Error al obtener recomendaciones' });
    }
});

// GET /items/autoinfo?title=&cat= — reconoce el título y devuelve imagen + descripción breve
// Debe ir ANTES de /items/:id, si no Express interpreta "autoinfo" como un id.
app.get('/items/autoinfo', async (req, res) => {
    const title = String(req.query.title || '').trim().slice(0, 120);
    const cat   = String(req.query.cat || 'Juego').trim().slice(0, 30);
    if (title.length < 3) return res.json({ found: false });
    try {
        const info = await autoInfo.lookup(title, cat);
        if (!info) return res.json({ found: false });
        res.set('Cache-Control', 'public, max-age=3600');
        res.json({ found: true, ...info });
    } catch (err) {
        logger.error(`[autoinfo] ${err.message}`);
        res.status(500).json({ found: false });
    }
});

// Plantillas de descripción y "Que NEXUS la escriba": llena la plantilla con lo que se sabe del título,
// sin inventar datos (deja "(complétalo)" donde no hay certeza). 10 por usuario y hora.
const Plantillas = require('../modulos/plantillas');
app.get('/items/plantillas', (req, res) => res.set('Cache-Control', 'public, max-age=3600').json({ success: true, plantillas: Plantillas.PLANTILLAS }));
app.post('/items/describir', verificarToken, async (req, res) => {
    try {
        const title = String(req.body?.title || '').trim().slice(0, 120), cat = String(req.body?.category || 'Juego').slice(0, 30);
        if (title.length < 3) return res.status(400).json({ success: false, error: 'Escribe primero el título' });
        if (!(await Limites.permitir(`describir:${req.usuario}`, [[Limites.HORA, 10]]))) return res.status(429).json({ success: false, error: 'Ya pediste varias descripciones. Intenta en un rato.' });
        const base = Plantillas.plantilla(cat);
        const info = await autoInfo.lookup(title, cat).catch(() => null);
        const extras = Object.entries(req.body?.extras || {}).filter(([k, v]) => typeof v === 'string' && v.trim()).slice(0, 8).map(([k, v]) => `${k}: ${v.slice(0, 80)}`).join('\n');
        const r = await nexusLLM.json(`Eres NEXUS, el asistente de UpGames. Escribe la descripción de una publicación de la categoría "${cat}" en español neutro, clara y útil.
Usa EXACTAMENTE esta estructura (mismos títulos con emoji y viñetas) y llénala:
${base}
Reglas: no inventes requisitos, versiones, tamaños ni datos técnicos que no conozcas con certeza: en esos casos escribe "(complétalo)". No prometas nada ilegal ni "gratis/full/crack". Máximo 900 caracteres.
Responde SOLO JSON: {"descripcion":"..."}`, `Título: ${title}\n${info?.description ? 'Lo que se sabe: ' + String(info.description).slice(0, 500) + '\n' : ''}${extras ? 'Datos del creador:\n' + extras : ''}`, { rapido: true, maxTokens: 700, timeout: 20000 }).catch(() => null);
        const desc = String(r?.descripcion || '').replace(/\r/g, '').trim().slice(0, 1000);
        if (desc.length >= 40) return res.json({ success: true, descripcion: desc, fuente: 'nexus' });
        // Sin IA: la plantilla con lo que se sabe del título al inicio
        res.json({ success: true, descripcion: (info?.description ? String(info.description).slice(0, 300) + '\n\n' : '') + base, fuente: 'plantilla' });
    } catch (e) { logger.error(`[describir] ${e.message}`); res.status(500).json({ success: false, error: 'No se pudo generar la descripción' }); }
});

// GET /items/:id/serie — todas las partes de la serie de esta publicación, en orden
app.get('/items/:id/serie', async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, error: 'ID inválido' });
        const item = await Juego.findById(req.params.id).select('serie usuario').lean();
        if (!item) return res.status(404).json({ success: false, error: 'Publicación no encontrada' });
        if (!item.serie?.clave) return res.json({ success: true, serie: null });
        const partes = await Juego.find({ 'serie.clave': item.serie.clave, status: 'aprobado', linkStatus: { $in: ['online', 'revision', 'caido'] } })
            .select('_id title image images description category usuario linkStatus descargasEfectivas likesCount reportes serie createdAt')
            .sort({ 'serie.parte': 1, createdAt: 1 }).lean();
        if (partes.length < 2) return res.json({ success: true, serie: null });
        res.json({ success: true, serie: { clave: item.serie.clave, base: item.serie.base, total: partes.length, totalDeclarado: item.serie.total || null,
            descargas: partes.reduce((a, p) => a + (p.descargasEfectivas || 0), 0), partes } });
    } catch (e) {
        res.status(500).json({ success: false, error: 'Error al cargar la serie' });
    }
});

app.get('/items/:id', async (req, res) => {
    try {
        const item = await Juego.findById(req.params.id).lean();
        if (!item) return res.status(404).json({ success: false, error: "Item no encontrado" });
        res.json(item);
    } catch (error) {
        res.status(500).json({ success: false, error: "Error al cargar item" });
    }
});

    return { LINKS_PERMITIDOS, errorLinkPublicacion, vincularTarde(d) { ({ paginasSeoPronto } = d); } };
};
