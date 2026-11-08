/**
 * Comentarios
 *
 * Listar, crear y borrar comentarios de las publicaciones.
 * Extraído de index.js: recibe sus dependencias explícitas (ver la llamada en index.js).
 */
module.exports = function comentarios({ CeroTolerancia, Comentario, Extras, Juego, Limites, Moderacion, app, body, crearNotif, gamification, logger, validationResult, verificarAdmin, verificarToken }) {
app.get('/comentarios', async (req, res) => {
    try {
        // Antes devolvía TODOS los comentarios de la base en cada llamada
        const limite = Math.min(2000, Math.max(1, parseInt(req.query.limit, 10) || 1000));
        const comms = await Comentario.find().sort({ fecha: -1 }).limit(limite).lean();
        res.json(comms);
    } catch (error) { res.status(500).json([]); }
});

app.get('/comentarios/:itemId', async (req, res) => {
    try {
        const comms = await Comentario.find({ itemId: String(req.params.itemId) }).sort({ fecha: -1 }).limit(300).lean();
        res.json(comms);
    } catch (error) { res.status(500).json([]); }
});

app.post('/comentarios', [verificarToken, body('itemId').notEmpty(), body('texto').notEmpty().isLength({ max: 500 })], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, error: 'Datos inválidos' });
        const textoLimpio = (req.body.texto || '').replace(/<[^>]*>/g, '').trim();
        if (!textoLimpio) return res.status(400).json({ success: false, error: 'El comentario está vacío' });
        if (await CeroTolerancia.restringido(req.usuario)) return res.status(403).json({ success: false, error: 'Tu cuenta está restringida mientras el equipo de seguridad revisa un reporte.', code: 'RESTRINGIDO' });
        const modC = Moderacion.reglas(textoLimpio, 'comentario');
        if (modC.bloquear) {
            Moderacion.registrar({ tipo: 'comentario', usuario: req.usuario, categoria: modC.categoria, motivo: modC.motivo, fuente: 'reglas', texto: textoLimpio, ref: req.body.itemId, accion: 'bloqueado-antes' });
            return res.status(400).json({ success: false, error: `Tu comentario no se publicó porque ${Moderacion.MENSAJE[modC.categoria] || 'incumple las normas'}. Escríbelo de otra forma.` });
        }
        if (!(await Limites.permitir(`coment:${req.usuario}`, [[10 * Limites.MIN, 15]]))) return res.status(429).json({ success: false, error: 'Vas muy rápido. Espera unos minutos para comentar de nuevo.' });
        // Solo los campos permitidos: antes {...req.body} dejaba elegir la fecha (un comentario "del futuro" quedaba siempre primero)
        const nuevo = new Comentario({ itemId: String(req.body.itemId), texto: textoLimpio, usuario: req.usuario });
        await nuevo.save();
        gamification.onComentario(req.usuario).catch(() => {});
        // NEXUS lo revisa en segundo plano (cupo global para no agotar la IA): si es sexual, odio, acoso,
        // insulto o spam con confianza alta, se borra solo y se avisa al autor
        if (textoLimpio.length >= 8 && (modC.dudoso || await Limites.permitir('mod-ia-coment', [[Limites.MIN, 20]]))) {
            Moderacion.ia(textoLimpio, 'comentario').then(async v => {
                if (!Moderacion.debeQuitar(v)) return;
                await Comentario.deleteOne({ _id: nuevo._id });
                Moderacion.registrar({ tipo: 'comentario', usuario: req.usuario, categoria: v.categoria, motivo: v.motivo, fuente: 'NEXUS', texto: textoLimpio, ref: req.body.itemId, accion: 'borrado' });
                crearNotif({ destinatario: req.usuario, tipo: 'sistema', emisor: 'UpGames', itemId: String(req.body.itemId), itemTitle: 'Revisión', mensaje: `🚫 Quitamos tu comentario porque ${Moderacion.MENSAJE[v.categoria]}. Mantengamos la comunidad sana.` });
            }).catch(() => {});
        }
        res.status(201).json({ success: true, comentario: nuevo });

        // Notificar al autor del contenido + registrar evento en Nexus (fire & forget)
        Juego.findById(req.body.itemId).select('usuario title image category tags').lean()
            .then(item => {
                if (!item) return;
                if (item.usuario !== req.usuario && textoLimpio.length >= 10) Extras.evento(req.usuario, 'comentar', String(req.body.itemId));   // misiones
                crearNotif({
                    destinatario: item.usuario, tipo: 'comentario', emisor: req.usuario,
                    itemId: req.body.itemId, itemTitle: item.title, itemImage: item.image || '',
                    mensaje: `@${req.usuario} comentó en "${item.title}"`
                });
            })
            .catch(() => {});
    } catch (error) {
        logger.error(`Error en POST /comentarios: ${error.message}`);
        res.status(500).json({ success: false, error: 'Error al guardar comentario' });
    }
});

app.delete('/comentarios/:id', verificarAdmin, async (req, res) => {
    try {
        await Comentario.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) { res.status(500).json({ success: false, error: "Error al eliminar" }); }
});
};
