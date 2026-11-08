/**
 * Panel admin: estadísticas, usuarios, pagos y contenido
 *
 * Dashboard, ajustes de saldo, acciones masivas, pagos pendientes y gestión de publicaciones.
 * Extraído de index.js: recibe sus dependencias explícitas (ver la llamada en index.js).
 */
module.exports = function admin({ Comentario, DescargaIP, Juego, Notificacion, Pago, Usuario, app, body, gameDetector, logger, param, series, validationResult, verificarAdmin }) {
// Creadas en index.js después de registrar este módulo: llegan con vincularTarde()
let errorLinkPublicacion;
app.get('/admin/stats/dashboard', verificarAdmin, async (req, res) => {
    try {
        const ahora = new Date();
        const hoy   = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
        const semana = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);

        const [
            totalUsers, usersHoy, usersSemana,
            totalItems, itemsPendientes, itemsAprobados, itemsHoy,
            descargasAggregate, descargasHoy,
            saldoTotal, saldoPendientePago,
            totalComentarios, comentariosHoy,
            topUploaders, usuariosListaNegra,
            itemsMasDescargados
        ] = await Promise.all([
            Usuario.countDocuments(),
            Usuario.countDocuments({ createdAt: { $gte: hoy } }),
            Usuario.countDocuments({ createdAt: { $gte: semana } }),
            Juego.countDocuments(),
            Juego.countDocuments({ status: { $in: ['pendiente', 'pending'] } }),
            Juego.countDocuments({ status: 'aprobado' }),
            Juego.countDocuments({ createdAt: { $gte: hoy } }),
            Juego.aggregate([{ $group: { _id: null, total: { $sum: '$descargasEfectivas' } } }]),
            DescargaIP.countDocuments({ fecha: { $gte: hoy } }),
            Usuario.aggregate([{ $group: { _id: null, total: { $sum: '$saldo' } } }]),
            Pago.aggregate([{ $match: { estado: 'pendiente' } }, { $group: { _id: null, total: { $sum: '$monto' } } }]),
            Comentario.countDocuments(),
            Comentario.countDocuments({ fecha: { $gte: hoy } }),
            // ⭐ topUploaders — usa el índice compuesto (usuario, descargasEfectivas)
            Juego.aggregate([
                { $match: { status: 'aprobado' } },
                { $group: { _id: '$usuario', totalDescargas: { $sum: '$descargasEfectivas' }, totalItems: { $sum: 1 } } },
                { $sort: { totalDescargas: -1 } },
                { $limit: 5 }
            ]),
            Usuario.countDocuments({ listaNegraAdmin: true }),
            Juego.find({ status: 'aprobado' }).sort({ likesCount: -1 }).limit(5).select('title usuario likesCount descargasEfectivas').lean()
        ]);

        res.json({ success: true, dashboard: {
            usuarios: { total: totalUsers, hoy: usersHoy, semana: usersSemana, listaNegra: usuariosListaNegra },
            items:    { total: totalItems, pendientes: itemsPendientes, aprobados: itemsAprobados, hoy: itemsHoy },
            descargas:{ total: descargasAggregate[0]?.total || 0, hoy: descargasHoy },
            finanzas: { saldoEnCirculacion: parseFloat((saldoTotal[0]?.total || 0).toFixed(2)), pendienteDePago: parseFloat((saldoPendientePago[0]?.total || 0).toFixed(2)) },
            comentarios: { total: totalComentarios, hoy: comentariosHoy },
            topUploaders, itemsMasDescargados
        }});
    } catch (error) {
        logger.error(`Error en dashboard: ${error.message}`);
        res.status(500).json({ success: false, error: "Error al cargar dashboard" });
    }
});

app.put('/admin/users/ajustar-saldo/:id', verificarAdmin, [param('id').isMongoId(), body('saldo').isFloat({ min: 0 }), body('motivo').optional().trim()], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, error: "Datos inválidos" });
        const { saldo, motivo } = req.body;
        const user = await Usuario.findByIdAndUpdate(req.params.id, { $set: { saldo: parseFloat(saldo) } }, { new: true }).select('-password -resetPasswordToken -resetPasswordExpires -resetCodigoHash -emailVerifToken -emailVerifExpires -cobro.cifrado');
        if (!user) return res.status(404).json({ success: false, error: "Usuario no encontrado" });
        logger.info(`ADMIN: Saldo ajustado @${user.usuario} → $${saldo} (${motivo || 'Sin motivo'})`);
        res.json({ success: true, usuario: user.usuario, nuevoSaldo: user.saldo });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error al ajustar saldo" });
    }
});

app.put('/admin/items/bulk-action', verificarAdmin, [body('ids').isArray({ min: 1, max: 500 }), body('ids.*').isMongoId(), body('action').isIn(['aprobar', 'rechazar', 'eliminar', 'online', 'caido'])], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, error: "Datos inválidos" });
        const { ids, action } = req.body;
        let resultado;
        if (action === 'aprobar')    resultado = await Juego.updateMany({ _id: { $in: ids } }, { $set: { status: 'aprobado' } });
        else if (action === 'rechazar') resultado = await Juego.updateMany({ _id: { $in: ids } }, { $set: { status: 'rechazado' } });
        else if (action === 'eliminar') resultado = await Juego.deleteMany({ _id: { $in: ids } });
        else if (action === 'online') resultado = await Juego.updateMany({ _id: { $in: ids } }, { $set: { linkStatus: 'online', reportes: 0 } });
        else if (action === 'caido')  resultado = await Juego.updateMany({ _id: { $in: ids } }, { $set: { linkStatus: 'caido' } });
        const afectados = resultado?.modifiedCount || resultado?.deletedCount || 0;
        logger.info(`ADMIN BULK: ${action} en ${afectados} items`);
        res.json({ success: true, afectados, action });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error en acción en lote" });
    }
});

app.post('/admin/finanzas/rechazar-pago-admin/:id', verificarAdmin, [param('id').isMongoId(), body('motivo').optional().trim()], async (req, res) => {
    try {
        const pago = await Pago.findOneAndUpdate({ _id: req.params.id, estado: 'pendiente' },
            { $set: { estado: 'rechazado', notas: req.body.motivo || 'Rechazado por el administrador' } }, { new: true });
        if (!pago) {
            const existe = await Pago.exists({ _id: req.params.id });
            return res.status(existe ? 409 : 404).json({ success: false, error: existe ? "El pago ya fue procesado" : "Pago no encontrado" });
        }
        await Usuario.updateOne({ usuario: pago.usuario }, { $set: { solicitudPagoPendiente: false } });
        logger.warn(`ADMIN: Pago rechazado @${pago.usuario}`);
        res.json({ success: true, mensaje: "Pago rechazado" });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error al rechazar pago" });
    }
});

app.get('/admin/finanzas/historial-completo', verificarAdmin, async (req, res) => {
    try {
        const { estado, limite = 100 } = req.query;
        const filtro = estado ? { estado } : {};
        const historial = await Pago.find(filtro).sort({ fecha: -1 }).limit(parseInt(limite)).lean();
        res.json({ success: true, historial, total: historial.length });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error al cargar historial" });
    }
});

app.get('/admin/stats/top-usuarios', verificarAdmin, async (req, res) => {
    try {
        const { por = 'saldo', limite = 10 } = req.query;
        const sortField = por === 'descargas' ? { descargasTotales: -1 } : { saldo: -1 };
        const users = await Usuario.find({ [por === 'descargas' ? 'descargasTotales' : 'saldo']: { $gt: 0 } }).sort(sortField).limit(parseInt(limite)).select('usuario email saldo descargasTotales verificadoNivel paypalEmail').lean();
        res.json({ success: true, users, criterio: por });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error al cargar top usuarios" });
    }
});

app.delete('/admin/users/:id/items', verificarAdmin, [param('id').isMongoId()], async (req, res) => {
    try {
        const user = await Usuario.findById(req.params.id).select('usuario');
        if (!user) return res.status(404).json({ success: false, error: "Usuario no encontrado" });
        const resultado = await Juego.deleteMany({ usuario: user.usuario });
        logger.info(`ADMIN: ${resultado.deletedCount} items de @${user.usuario} eliminados`);
        res.json({ success: true, eliminados: resultado.deletedCount, usuario: user.usuario });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error al eliminar items" });
    }
});

app.put('/admin/users/:id/reset-saldo', verificarAdmin, [param('id').isMongoId()], async (req, res) => {
    try {
        const user = await Usuario.findByIdAndUpdate(req.params.id, { $set: { saldo: 0, solicitudPagoPendiente: false } }, { new: true }).select('usuario saldo');
        if (!user) return res.status(404).json({ success: false, error: "Usuario no encontrado" });
        logger.info(`ADMIN: Saldo reseteado a 0 para @${user.usuario}`);
        res.json({ success: true, usuario: user.usuario });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error al resetear saldo" });
    }
});

app.get('/admin/payments-pending', verificarAdmin, async (req, res) => {
    try {
        const usuariosParaPagar = await Usuario.find({ saldo: { $gte: 10 }, isVerificado: true, verificadoNivel: { $gte: 1 } }).select('usuario email paypalEmail saldo descargasTotales verificadoNivel');
        res.json(usuariosParaPagar);
    } catch (error) {
        res.status(500).json({ error: "Error al obtener pagos" });
    }
});

// GET /admin/items/:id/analisis-ia — recomendación de Nexus para revisar (caché 6 h; ?forzar=1 rehace)
const revisionIA = require('../modulos/revisionIA');
app.get('/admin/items/:id/analisis-ia', verificarAdmin, [param('id').isMongoId()], async (req, res) => {
    try {
        if (!validationResult(req).isEmpty()) return res.status(400).json({ success: false, error: 'ID inválido' });
        const item = await Juego.findById(req.params.id).lean();
        if (!item) return res.status(404).json({ success: false, error: 'Publicación no encontrada' });
        const previo = item.analisisIA;
        if (previo && req.query.forzar !== '1' && Date.now() - new Date(previo.fecha) < 6 * 3600e3) return res.json({ success: true, analisis: previo, cache: true });
        const analisis = await revisionIA.analizar(item, { Juego, Usuario, errorLinkPublicacion, gameDetector, logger });
        // timestamps:false → no reinicia el plazo de revisión (JOB 4 usa updatedAt)
        await Juego.updateOne({ _id: item._id }, { $set: { analisisIA: analisis } }, { timestamps: false });
        logger.info(`[revisionIA] "${item.title}" → ${analisis.decision} (${analisis.puntos} pts, IA: ${analisis.ia?.fuente || 'no'})`);
        res.json({ success: true, analisis, cache: false });
    } catch (e) {
        logger.error(`[revisionIA] ${e.message}`);
        res.status(500).json({ success: false, error: 'No se pudo analizar la publicación' });
    }
});

app.put("/admin/items/:id", verificarAdmin, [
    param('id').isMongoId(), body('title').optional().trim().isLength({ max: 200 }),
    body('description').optional().trim().isLength({ max: 1000 }), body('link').optional().trim(),
    body('image').optional().trim(), body('images').optional().isArray({ max: 4 }),
    body('category').optional().trim(), body('status').optional().isIn(['pendiente', 'aprobado', 'rechazado', 'pending']),
    body('linkStatus').optional().isIn(['online', 'revision', 'caido']), body('reportes').optional().isInt({ min: 0 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, error: "Datos inválidos", details: errors.array() });
        const updates = {};
        ['title', 'description', 'link', 'image', 'images', 'category', 'status', 'linkStatus', 'reportes'].forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
        if (updates.status === 'rechazado') updates.motivoRechazo = String(req.body.motivo || '').trim().slice(0, 300);
        const antes = await Juego.findById(req.params.id).select('status usuario').lean();
        if (updates.title !== undefined && antes) updates.serie = series.serieDe(updates.title, antes.usuario);
        const item = await Juego.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
        if (!item) return res.status(404).json({ success: false, error: "Item no encontrado" });
        // Avisar al autor cuando su publicación se rechaza (antes desaparecía sin explicación)
        if (updates.status === 'rechazado' && antes?.status !== 'rechazado') {
            const motivo = updates.motivoRechazo ? `: ${updates.motivoRechazo}` : '. Revisa las normas de publicación y vuelve a intentarlo.';
            Notificacion.create({ destinatario: item.usuario, tipo: 'sistema', emisor: 'UpGames', itemId: item._id.toString(), itemTitle: 'Revisión',
                mensaje: `❌ Tu publicación “${String(item.title).replace(/[<>&"']/g, '')}” no fue aprobada${motivo.replace(/[<>&"']/g, '')}` }).catch(() => {});
        }
        logger.info(`ADMIN: Item ${item._id} actualizado`);
        res.json({ success: true, item });
    } catch (error) {
        logger.error(`Error: ${error?.message}`);
        res.status(500).json({ success: false, error: "Error al actualizar item" });
    }
});

app.get("/admin/items", verificarAdmin, async (req, res) => {
    try {
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 100));
        const skip  = (page - 1) * limit;
        const filtro = {};
        if (req.query.status)     filtro.status     = req.query.status;
        if (req.query.linkStatus) filtro.linkStatus = req.query.linkStatus;
        const [total, items] = await Promise.all([
            Juego.countDocuments(filtro),
            Juego.find(filtro).sort({ createdAt: -1 }).skip(skip).limit(limit).lean()
        ]);
        const now = Date.now();
        const itemsWithInfo = items.map(item => ({ ...item, diasDesdeCreacion: Math.floor((now - new Date(item.createdAt).getTime()) / (1000 * 60 * 60 * 24)), necesitaRevision: item.reportes >= 3 || item.linkStatus === 'revision' }));
        res.json({ success: true, total, page, limit, pages: Math.ceil(total / limit), count: items.length, items: itemsWithInfo });
    } catch (error) {
        logger.error(`Error: ${error?.message}`);
        res.status(500).json({ success: false, error: "Error al obtener items" });
    }
});

app.put("/admin/items/:id/reset-reports", verificarAdmin, [param('id').isMongoId()], async (req, res) => {
    try {
        const item = await Juego.findByIdAndUpdate(req.params.id, { $set: { reportes: 0, linkStatus: 'online' } }, { new: true });
        if (!item) return res.status(404).json({ success: false, error: "Item no encontrado" });
        logger.info(`ADMIN: Reportes reseteados para ${item.title}`);
        res.json({ success: true, item });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error al resetear reportes" });
    }
});

app.put("/admin/items/:id/link-status", verificarAdmin, [param('id').isMongoId(), body('linkStatus').isIn(['online', 'revision', 'caido'])], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, error: "Estado inválido" });
        const item = await Juego.findByIdAndUpdate(req.params.id, { $set: { linkStatus: req.body.linkStatus } }, { new: true });
        if (!item) return res.status(404).json({ success: false, error: "Item no encontrado" });
        logger.info(`ADMIN: Link status → ${req.body.linkStatus} para ${item.title}`);
        res.json({ success: true, item });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error al actualizar estado del link" });
    }
});

    return { revisionIA, vincularTarde(d) { ({ errorLinkPublicacion } = d); } };
};
