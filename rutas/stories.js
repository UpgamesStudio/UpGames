/**
 * Stories
 *
 * Historias de 24 horas de los usuarios.
 * Extraído de index.js: recibe sus dependencias explícitas (ver la llamada en index.js).
 */
module.exports = function stories({ CeroTolerancia, Story, Usuario, app, imagenes, logger, verificarToken }) {
app.post('/stories/crear', verificarToken, async (req, res) => {
    try {
        const { imagen, texto } = req.body;
        if (!imagen && !texto?.trim()) return res.status(400).json({ success: false, error: 'Imagen o texto requerido' });
        const cero = await CeroTolerancia.frenarTexto({ texto: String(texto || ''), usuario: req.usuario, donde: 'historia', req });
        if (cero) return res.status(cero.status).json({ success: false, error: cero.error, code: cero.code });
        let imgUrl = '';
        if (imagen) {
            if (typeof imagen !== 'string' || !/^data:image\/(png|jpe?g|webp|gif|heic|heif);base64,/i.test(imagen)) return res.status(400).json({ success: false, error: 'Formato de imagen no válido' });
            imgUrl = await imagenes.subir(imagen, { carpeta: 'stories', ancho: 1080, alto: 1920 });
        }
        const story = new Story({ usuario: req.usuario, imagen: imgUrl, texto: texto?.trim() || '' });
        await story.save();
        CeroTolerancia.vigilarImagen({ imagen: imgUrl, usuario: req.usuario, donde: 'historia', ref: String(story._id), texto: story.texto, req, ocultar: () => Story.deleteOne({ _id: story._id }) });
        res.json({ success: true, story: { id: story._id, usuario: story.usuario, imagen: story.imagen, texto: story.texto, fecha: story.fecha } });
    } catch (err) {
        logger.error(`Error creando story: ${err.message}`);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});

app.get('/stories/seguidos', verificarToken, async (req, res) => {
    try {
        const me = req.usuario;
        const usuario = await Usuario.findOne({ usuario: me }).select('siguiendo').lean();
        const seguidos = [...(usuario?.siguiendo || []), me];
        const stories = await Story.find({ usuario: { $in: seguidos } }).sort({ fecha: -1 }).limit(100).lean();
        const byUser = {};
        for (const s of stories) {
            if (!byUser[s.usuario]) { byUser[s.usuario] = { usuario: s.usuario, imagen: s.imagen, texto: s.texto, fecha: s.fecha, id: s._id, visto: s.vistos.includes(me), total: 0 }; }
            byUser[s.usuario].total++;
        }
        let result = Object.values(byUser);
        result.sort((a, b) => { if (a.usuario === me) return -1; if (b.usuario === me) return 1; if (a.visto !== b.visto) return a.visto ? 1 : -1; return new Date(b.fecha) - new Date(a.fecha); });
        const usernames = result.map(r => r.usuario);
        const perfiles = await Usuario.find({ usuario: { $in: usernames } }).select('usuario foto').lean();
        const fotoMap = Object.fromEntries(perfiles.map(p => [p.usuario, p.foto || '']));
        result = result.map(r => ({ ...r, foto: fotoMap[r.usuario] || '' }));
        res.json({ success: true, stories: result });
    } catch (err) {
        logger.error(`Error obteniendo stories: ${err.message}`);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});

app.post('/stories/:id/ver', verificarToken, async (req, res) => {
    try {
        await Story.updateOne({ _id: req.params.id }, { $addToSet: { vistos: req.usuario } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: 'Error interno' }); }
});
};
