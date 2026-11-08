/**
 * Anti-fraude (panel admin)
 *
 * Consulta de actividad sospechosa detectada por modulos/fraudDetector.
 * Extraído de index.js: recibe sus dependencias explícitas (ver la llamada en index.js).
 */
module.exports = function fraude({ app, body, fraudDetector, logger, param, validationResult, verificarAdmin }) {
app.get('/admin/fraud/suspicious-activities', verificarAdmin, async (req, res) => {
    try {
        const stats = await fraudDetector.getSuspiciousStats();
        res.json({ success: true, ...stats });
    } catch (error) {
        logger.error(`Error: ${error?.message}`);
        res.status(500).json({ success: false, error: 'Error al obtener actividades sospechosas' });
    }
});

app.put('/admin/fraud/mark-reviewed/:activityId', verificarAdmin, [param('activityId').isMongoId(), body('notasAdmin').optional().isString()], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, error: 'ID de actividad inválido' });
        const activity = await fraudDetector.SuspiciousActivity.findById(req.params.activityId);
        if (!activity) return res.status(404).json({ success: false, error: 'Actividad no encontrada' });
        activity.revisado = true;
        if (req.body.notasAdmin) activity.notasAdmin = req.body.notasAdmin;
        await activity.save();
        res.json({ success: true, mensaje: 'Actividad marcada como revisada' });
    } catch (error) {
        logger.error(`Error: ${error?.message}`);
        res.status(500).json({ success: false, error: 'Error al marcar actividad' });
    }
});

app.get('/admin/fraud/user-history/:usuario', verificarAdmin, async (req, res) => {
    try {
        const activities = await fraudDetector.SuspiciousActivity.find({ usuario: req.params.usuario }).sort({ fecha: -1 }).limit(50);
        res.json({ success: true, usuario: req.params.usuario, activities });
    } catch (error) {
        logger.error(`Error: ${error?.message}`);
        res.status(500).json({ success: false, error: 'Error al obtener historial' });
    }
});
};
