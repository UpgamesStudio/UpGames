/**
 * Notificaciones y push
 *
 * Campana de notificaciones, marcar leídas y suscripción push del dispositivo.
 * Extraído de index.js: recibe sus dependencias explícitas (ver la llamada en index.js).
 */
module.exports = function notificaciones({ Juego, Notificacion, Usuario, app, logger, mongoose, nexusMemoria, push, verificarToken }) {
app.get('/notificaciones/:usuario', verificarToken, async (req, res) => {
    try {
        const { usuario } = req.params;
        if (req.usuario !== usuario) return res.status(403).json({ success: false, error: 'Sin permiso' });
        const notifs = await Notificacion.find({ destinatario: usuario }).sort({ fecha: -1 }).limit(50).lean();
        const noLeidas = notifs.filter(n => !n.leida).length;
        res.json({ success: true, notificaciones: notifs, noLeidas });
    } catch (err) {
        logger.error(`Error obteniendo notificaciones: ${err.message}`);
        res.status(500).json({ success: false, error: 'Error al cargar notificaciones' });
    }
});

app.put('/notificaciones/leida/:id', verificarToken, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false });
    await Notificacion.updateOne({ _id: req.params.id, destinatario: req.usuario }, { $set: { leida: true } }).catch(() => {});
    res.json({ success: true });
});

app.put('/notificaciones/marcar-leidas/:usuario', verificarToken, async (req, res) => {
    try {
        const { usuario } = req.params;
        if (req.usuario !== usuario) return res.status(403).json({ success: false, error: 'Sin permiso' });
        await Notificacion.updateMany({ destinatario: usuario, leida: false }, { $set: { leida: true } });
        res.json({ success: true });
    } catch (err) {
        logger.error(`Error marcando notificaciones: ${err.message}`);
        res.status(500).json({ success: false, error: 'Error al actualizar notificaciones' });
    }
});

app.get('/notificaciones/count/:usuario', verificarToken, async (req, res) => {
    try {
        const { usuario } = req.params;
        if (req.usuario !== usuario) return res.status(403).json({ success: false, error: 'Sin permiso' });
        const noLeidas = await Notificacion.countDocuments({ destinatario: usuario, leida: false });
        res.json({ success: true, noLeidas });
    } catch (err) { res.status(500).json({ success: false, error: 'Error' }); }
});

// POST /notificaciones — solo "alguien descargó tu publicación" (lo llama la página puente).
// Antes aceptaba cualquier tipo, título e imagen para cualquier destinatario: con push real
// serviría para mandar spam o anuncios falsos al móvil de otros. Ahora todo sale de la BD.
app.post('/notificaciones', verificarToken, async (req, res) => {
    try {
        const { itemId } = req.body || {};
        if (!mongoose.isValidObjectId(itemId)) return res.status(400).json({ success: false, error: 'itemId inválido' });
        const item = await Juego.findById(itemId).select('usuario title image category tags').lean();
        if (item) nexusMemoria.aprender(req.usuario, 'download', { item }).catch(() => {});
        if (!item || item.usuario === req.usuario) return res.json({ success: true });
        const hoy = new Date(Date.now() - 24 * 3600e3);
        const ya = await Notificacion.exists({ destinatario: item.usuario, emisor: req.usuario, tipo: 'descarga', itemId, fecha: { $gte: hoy } });
        if (!ya) await new Notificacion({ destinatario: item.usuario, tipo: 'descarga', emisor: req.usuario, itemId, itemTitle: item.title, itemImage: item.image || '', leida: false, fecha: new Date() }).save();
        res.json({ success: true });
    } catch (err) {
        logger.error(`Error creando notificación: ${err.message}`);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});

// ── PUSH: suscripción del dispositivo y preferencias ──
app.get('/push/clave', async (req, res) => {
    const ok = await push.iniciar({ logger });
    res.json({ success: ok, publicKey: push.clave() });
});
app.post('/push/suscribir', verificarToken, async (req, res) => {
    try {
        const sub = req.body?.subscription || {};
        if (!/^https:\/\//.test(sub.endpoint || '') || !sub.keys?.p256dh || !sub.keys?.auth) return res.status(400).json({ success: false, error: 'Suscripción inválida' });
        await push.PushSub.updateOne({ endpoint: sub.endpoint },
            { $set: { usuario: req.usuario, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, ua: String(req.headers['user-agent'] || '').slice(0, 200) }, $setOnInsert: { creado: new Date() } },
            { upsert: true });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: 'No se pudo activar' }); }
});
app.post('/push/desuscribir', verificarToken, async (req, res) => {
    await push.PushSub.deleteOne({ endpoint: String(req.body?.endpoint || ''), usuario: req.usuario }).catch(() => {});
    res.json({ success: true });
});
app.get('/push/prefs', verificarToken, async (req, res) => {
    const u = await Usuario.findOne({ usuario: req.usuario }).select('notifPrefs').lean();
    const dispositivos = await push.PushSub.countDocuments({ usuario: req.usuario });
    res.json({ success: true, prefs: { publicaciones: true, mensajes: true, social: true, anuncios: true, ...(u?.notifPrefs || {}) }, dispositivos });
});
app.put('/push/prefs', verificarToken, async (req, res) => {
    const set = {};
    ['publicaciones', 'mensajes', 'social', 'anuncios'].forEach(k => { if (typeof req.body?.[k] === 'boolean') set[`notifPrefs.${k}`] = req.body[k]; });
    if (Object.keys(set).length) await Usuario.updateOne({ usuario: req.usuario }, { $set: set });
    res.json({ success: true });
});
app.post('/push/prueba', verificarToken, async (req, res) => {
    const n = await push.enviarA([req.usuario], () => ({ title: '🔔 ¡Listo!', body: 'Así te llegarán los avisos de UpGames aunque no estés en la app.', url: (process.env.APP_URL || 'https://upgames.games') + '/public/biblioteca.html', tag: 'prueba', icon: './icons/icon-192.png?v=2', badge: './icons/icon-96.png?v=2' }));
    res.json({ success: true, enviados: n });
});

app.delete('/notificaciones/:id', verificarToken, async (req, res) => {
    try {
        const notif = await Notificacion.findById(req.params.id).lean();
        if (!notif) return res.status(404).json({ success: false, error: 'No encontrada' });
        if (notif.destinatario !== req.usuario) return res.status(403).json({ success: false, error: 'Sin permiso' });
        await Notificacion.deleteOne({ _id: req.params.id });
        res.json({ success: true });
    } catch (err) {
        logger.error(`Error eliminando notificación: ${err.message}`);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});

app.delete('/notificaciones/todas/:usuario', verificarToken, async (req, res) => {
    try {
        const { usuario } = req.params;
        if (req.usuario !== usuario) return res.status(403).json({ success: false, error: 'Sin permiso' });
        await Notificacion.deleteMany({ destinatario: usuario });
        res.json({ success: true });
    } catch (err) {
        logger.error(`Error vaciando notificaciones: ${err.message}`);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});

app.get('/usuarios/stats-seguimiento/:usuario', async (req, res) => {
    try {
        // solo los números: no hace falta traer las listas enteras de seguidores
        const [user] = await Usuario.aggregate([{ $match: { usuario: req.params.usuario } }, { $limit: 1 },
            { $project: { seguidores: { $size: { $ifNull: ['$listaSeguidores', []] } }, siguiendo: { $size: { $ifNull: ['$siguiendo', []] } } } }]);
        if (!user) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        res.json({ success: true, stats: { seguidores: user.seguidores || 0, siguiendo: user.siguiendo || 0 } });
    } catch (err) {
        logger.error(`Error en stats-seguimiento: ${err.message}`);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});
};
