/**
 * Tarjetas de pago guardadas y procesamiento de retiros (finanzas)
 *
 * Tarjetas del usuario (listar, eliminar, principal), su gestión en el panel admin y
 * la cola de solicitudes de retiro: procesar o rechazar pagos a los creadores.
 * Extraído de index.js: recibe sus dependencias explícitas (ver la llamada en index.js).
 */
module.exports = function tarjetas({ Juego, Pago, Usuario, app, body, config, enviarPagoPayPal, gamification, logger, mongoose, param, validationResult, verificarAdmin, verificarToken }) {
app.get('/economia/mis-tarjetas', verificarToken, async (req, res) => {
    try {
        const usuario = await Usuario.findOne({ usuario: req.usuario }).select('tarjetas').lean();
        if (!usuario) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        res.json({ success: true, tarjetas: usuario.tarjetas || [] });
    } catch (error) {
        logger.error(`Error en mis-tarjetas: ${error.message}`);
        res.status(500).json({ success: false, error: 'Error al obtener tarjetas' });
    }
});

// POST /economia/agregar-tarjeta — RETIRADO: con los últimos 4 dígitos no se puede pagar a nadie.
// Los creadores configuran dónde cobrar en /economia/metodo-cobro (rutas/cobros.js).
app.post('/economia/agregar-tarjeta', verificarToken, (req, res) => res.status(410).json({ success: false, error: 'Ya no se registran tarjetas. Configura tu método de cobro (Nequi, Daviplata, banco, Mercado Pago o PayPal) en Economía.' }));

// DELETE /economia/eliminar-tarjeta/:tarjetaId — eliminar una tarjeta
app.delete('/economia/eliminar-tarjeta/:tarjetaId', verificarToken, async (req, res) => {
    try {
        const { tarjetaId } = req.params;
        const result = await Usuario.updateOne(
            { usuario: req.usuario },
            { $pull: { tarjetas: { _id: new mongoose.Types.ObjectId(tarjetaId) } } }
        );
        if (result.modifiedCount === 0) return res.status(404).json({ success: false, error: 'Tarjeta no encontrada' });
        logger.info(`Tarjeta eliminada - @${req.usuario} | id: ${tarjetaId}`);
        res.json({ success: true, mensaje: 'Tarjeta eliminada' });
    } catch (error) {
        logger.error(`Error en eliminar-tarjeta: ${error.message}`);
        res.status(500).json({ success: false, error: 'Error al eliminar tarjeta' });
    }
});

// PUT /economia/tarjeta-principal/:tarjetaId — establecer tarjeta como principal
app.put('/economia/tarjeta-principal/:tarjetaId', verificarToken, async (req, res) => {
    try {
        const { tarjetaId } = req.params;
        const usuario = await Usuario.findOne({ usuario: req.usuario }).select('tarjetas');
        if (!usuario) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });

        const existe = (usuario.tarjetas || []).some(t => t._id.toString() === tarjetaId);
        if (!existe) return res.status(404).json({ success: false, error: 'Tarjeta no encontrada' });

        // Quitar principal de todas, poner en la seleccionada
        usuario.tarjetas.forEach(t => { t.esPrincipal = t._id.toString() === tarjetaId; });
        await usuario.save();
        res.json({ success: true, mensaje: 'Tarjeta principal actualizada' });
    } catch (error) {
        logger.error(`Error en tarjeta-principal: ${error.message}`);
        res.status(500).json({ success: false, error: 'Error al actualizar tarjeta principal' });
    }
});

// ── ADMIN TARJETAS ────────────────────────────────────────────────────────────

// GET /admin/finanzas/tarjetas — todas las tarjetas de todos los usuarios (admin)
app.get('/admin/finanzas/tarjetas', verificarAdmin, async (req, res) => {
    try {
        const usuarios = await Usuario.find({ 'tarjetas.0': { $exists: true } })
            .select('usuario tarjetas')
            .lean();
        // Aplanar: cada tarjeta lleva el campo usuario
        const tarjetas = [];
        for (const u of usuarios) {
            for (const t of u.tarjetas || []) {
                tarjetas.push({ ...t, usuario: u.usuario });
            }
        }
        tarjetas.sort((a, b) => new Date(b.fechaAgregada) - new Date(a.fechaAgregada));
        res.json({ success: true, tarjetas, total: tarjetas.length });
    } catch (error) {
        logger.error(`Error en admin/tarjetas: ${error.message}`);
        res.status(500).json({ success: false, error: 'Error al obtener tarjetas' });
    }
});

// DELETE /admin/finanzas/tarjetas/:tarjetaId — eliminar tarjeta de cualquier usuario (admin)
app.delete('/admin/finanzas/tarjetas/:tarjetaId', verificarAdmin, async (req, res) => {
    try {
        const { tarjetaId } = req.params;
        const result = await Usuario.updateOne(
            { 'tarjetas._id': new mongoose.Types.ObjectId(tarjetaId) },
            { $pull: { tarjetas: { _id: new mongoose.Types.ObjectId(tarjetaId) } } }
        );
        if (result.modifiedCount === 0) return res.status(404).json({ success: false, error: 'Tarjeta no encontrada' });
        logger.info(`Admin eliminó tarjeta id:${tarjetaId}`);
        res.json({ success: true, mensaje: 'Tarjeta eliminada por admin' });
    } catch (error) {
        logger.error(`Error en admin/eliminar-tarjeta: ${error.message}`);
        res.status(500).json({ success: false, error: 'Error al eliminar tarjeta' });
    }
});

// PUT /admin/finanzas/tarjetas/:tarjetaId/principal — cambiar tarjeta principal (admin)
app.put('/admin/finanzas/tarjetas/:tarjetaId/principal', verificarAdmin, async (req, res) => {
    try {
        const { tarjetaId } = req.params;
        const { usuario } = req.body;
        if (!usuario) return res.status(400).json({ success: false, error: 'Se requiere el campo usuario' });
        const u = await Usuario.findOne({ usuario });
        if (!u) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        const existe = (u.tarjetas || []).some(t => t._id.toString() === tarjetaId);
        if (!existe) return res.status(404).json({ success: false, error: 'Tarjeta no encontrada para este usuario' });
        u.tarjetas.forEach(t => { t.esPrincipal = t._id.toString() === tarjetaId; });
        await u.save();
        logger.info(`Admin cambió tarjeta principal de @${usuario} → ${tarjetaId}`);
        res.json({ success: true, mensaje: 'Tarjeta principal actualizada por admin' });
    } catch (error) {
        logger.error(`Error en admin/tarjeta-principal: ${error.message}`);
        res.status(500).json({ success: false, error: 'Error al actualizar tarjeta principal' });
    }
});

app.get('/admin/finanzas/solicitudes-pendientes', verificarAdmin, async (req, res) => {
    try {
        const solicitudes = await Pago.find({ estado: 'pendiente' }).sort({ fecha: -1 }).lean();
        const usernames = solicitudes.map(s => s.usuario);
        const [usuariosData, juegosAgg] = await Promise.all([
            Usuario.find({ usuario: { $in: usernames } }).select('usuario email verificadoNivel isVerificado descargasTotales').lean(),
            Juego.aggregate([{ $match: { usuario: { $in: usernames }, descargasEfectivas: { $gt: 0 } } }, { $group: { _id: '$usuario', count: { $sum: 1 } } }])
        ]);
        const usuarioMap = Object.fromEntries(usuariosData.map(u => [u.usuario, u]));
        const juegosMap  = Object.fromEntries(juegosAgg.map(j => [j._id, j.count]));
        const solicitudesEnriquecidas = solicitudes.map(s => ({ ...s, datosUsuario: { email: usuarioMap[s.usuario]?.email || '', verificadoNivel: usuarioMap[s.usuario]?.verificadoNivel || 0, isVerificado: usuarioMap[s.usuario]?.isVerificado || false, descargasTotales: usuarioMap[s.usuario]?.descargasTotales || 0, juegosElegibles: juegosMap[s.usuario] || 0 } }));
        res.json({ success: true, solicitudes: solicitudesEnriquecidas, total: solicitudesEnriquecidas.length });
    } catch (error) {
        logger.error(`Error en solicitudes-pendientes: ${error.message}`);
        res.status(500).json({ success: false, error: "Error al cargar solicitudes" });
    }
});

app.post('/admin/finanzas/procesar-pago/:id', verificarAdmin, [param('id').isMongoId(), body('notas').optional().trim(), body('referencia').optional().trim().isLength({ max: 120 })], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, error: "ID inválido" });
        const { id } = req.params;
        const { notas } = req.body;
        // Reclamo atómico: dos clics o dos admins a la vez ya no pueden pagar dos veces
        const pago = await Pago.findOneAndUpdate({ _id: id, estado: 'pendiente' }, { $set: { estado: 'procesado' } }, { new: true });
        if (!pago) {
            const existe = await Pago.exists({ _id: id });
            return res.status(existe ? 409 : 404).json({ success: false, error: existe ? "Este pago ya fue procesado (o se está procesando)" : "Pago no encontrado" });
        }

        // Payouts automáticos solo existen para PayPal; Nequi, Daviplata, banco y Mercado Pago los transfiere el admin
        const pagoAutomatico = config.FEATURES.ENABLE_AUTO_PAYMENTS && (pago.metodo || 'paypal') === 'paypal' && !!pago.paypalEmail;
        let paypalBatchId = null;
        let metodoProcesamiento = 'manual';

        if (pagoAutomatico) {
            try {
                const resultado = await enviarPagoPayPal(pago.paypalEmail, pago.monto, id);
                paypalBatchId = resultado.batchId;
                metodoProcesamiento = `paypal_auto (batch: ${paypalBatchId})`;
                logger.info(`PayPal Payout enviado - @${pago.usuario} → ${pago.paypalEmail} | $${pago.monto.toFixed(2)} | Batch: ${paypalBatchId}`);
            } catch (paypalError) {
                logger.error(`PayPal Payout falló para @${pago.usuario}: ${paypalError.message}`);
                await Pago.updateOne({ _id: id, estado: 'procesado' }, { $set: { estado: 'pendiente' } });
                return res.status(502).json({ success: false, error: `El pago no se pudo enviar vía PayPal: ${paypalError.message}`, detalle: 'El saldo del usuario NO fue modificado. Revisa las credenciales de PayPal o procesa manualmente.', paypalEmail: pago.paypalEmail, monto: pago.monto });
            }
        }

        pago.estado = 'completado';
        if (req.body.referencia) pago.referencia = String(req.body.referencia).slice(0, 120);
        pago.notas = notas || (pagoAutomatico ? `Pago automático vía PayPal Payouts el ${new Date().toLocaleString('es-ES')}. Batch ID: ${paypalBatchId}` : `Pago procesado manualmente el ${new Date().toLocaleString('es-ES')}`);
        await pago.save();

        // Descuento atómico (otra descarga podía sumar saldo entre leer y guardar)
        const r = await Usuario.updateOne({ usuario: pago.usuario }, [{ $set: { saldo: { $max: [0, { $subtract: ['$saldo', pago.monto] }] }, solicitudPagoPendiente: false } }]);
        if (r.matchedCount) gamification.onPagoRecibido(pago.usuario, pago.monto).catch(() => {});

        logger.info(`Pago procesado [${metodoProcesamiento}] - @${pago.usuario}, Monto: $${pago.monto.toFixed(2)}`);
        res.json({ success: true, mensaje: pagoAutomatico ? `Pago enviado automáticamente vía PayPal a ${pago.paypalEmail}` : "Pago marcado como procesado manualmente", metodo: pagoAutomatico ? 'paypal_automatico' : 'manual', paypalBatchId: paypalBatchId || null, pago: { usuario: pago.usuario, monto: pago.monto, paypalEmail: pago.paypalEmail, fecha: pago.fecha } });
    } catch (error) {
        logger.error(`Error en procesar-pago: ${error.message}`);
        res.status(500).json({ success: false, error: "Error al procesar pago" });
    }
});

app.post('/admin/finanzas/rechazar-pago/:id', verificarAdmin, [param('id').isMongoId(), body('motivo').optional().trim()], async (req, res) => {
    try {
        const pago = await Pago.findOneAndUpdate({ _id: req.params.id, estado: 'pendiente' },
            { $set: { estado: 'rechazado', notas: req.body.motivo || 'Rechazado por el administrador' } }, { new: true });
        if (!pago) {
            const existe = await Pago.exists({ _id: req.params.id });
            return res.status(existe ? 409 : 404).json({ success: false, error: existe ? "El pago ya fue procesado" : "Pago no encontrado" });
        }
        await Usuario.updateOne({ usuario: pago.usuario }, { $set: { solicitudPagoPendiente: false } });
        logger.warn(`Pago rechazado - @${pago.usuario}`);
        res.json({ success: true, mensaje: "Pago rechazado", pago: { usuario: pago.usuario, monto: pago.monto, motivo: pago.notas } });
    } catch (error) {
        logger.error(`Error en rechazar-pago: ${error.message}`);
        res.status(500).json({ success: false, error: "Error al rechazar pago" });
    }
});

app.get('/admin/finanzas/historial', verificarAdmin, async (req, res) => {
    try {
        const { estado, usuario, limite = 50 } = req.query;
        const filtro = {};
        if (estado) filtro.estado = estado;
        if (usuario) filtro.usuario = usuario.toLowerCase();
        const historial = await Pago.find(filtro).sort({ fecha: -1 }).limit(parseInt(limite)).lean();
        res.json({ success: true, historial, total: historial.length });
    } catch (error) {
        logger.error(`Error en historial: ${error.message}`);
        res.status(500).json({ success: false, error: "Error al cargar historial" });
    }
});

// GET /economia/historial-pagos — historial de retiros del creador autenticado
app.get('/economia/historial-pagos', verificarToken, async (req, res) => {
    try {
        const historial = await Pago.find({ usuario: req.usuario })
            .sort({ fecha: -1 })
            .limit(50)
            .select('monto paypalEmail metodo resumen referencia estado fecha notas')
            .lean();
        res.json({ success: true, historial, total: historial.length });
    } catch (error) {
        logger.error(`Error en historial-pagos: ${error.message}`);
        res.status(500).json({ success: false, error: 'Error al cargar historial' });
    }
});

app.get('/admin/finanzas/estadisticas', verificarAdmin, async (req, res) => {
    try {
        const [totalSolicitado, totalPagado, totalUsuariosConSaldo, totalUsuariosVerificados, solicitudesPendientes] = await Promise.all([
            Pago.aggregate([{ $match: { estado: 'pendiente' } }, { $group: { _id: null, total: { $sum: '$monto' } } }]),
            Pago.aggregate([{ $match: { estado: 'completado' } }, { $group: { _id: null, total: { $sum: '$monto' } } }]),
            Usuario.countDocuments({ saldo: { $gt: 0 } }),
            Usuario.countDocuments({ isVerificado: true }),
            Pago.countDocuments({ estado: 'pendiente' })
        ]);
        res.json({ success: true, estadisticas: { solicitudesPendientes, totalSolicitado: totalSolicitado[0]?.total || 0, totalPagado: totalPagado[0]?.total || 0, usuariosConSaldo: totalUsuariosConSaldo, usuariosVerificados: totalUsuariosVerificados } });
    } catch (error) {
        logger.error(`Error en estadísticas: ${error.message}`);
        res.status(500).json({ success: false, error: "Error al cargar estadísticas" });
    }
});

app.get('/admin/links/en-revision', verificarAdmin, async (req, res) => {
    try {
        const juegosEnRevision = await Juego.find({ linkStatus: 'revision' }).sort({ reportes: -1, createdAt: -1 }).lean();
        res.json({ success: true, juegos: juegosEnRevision, total: juegosEnRevision.length });
    } catch (error) {
        logger.error(`Error en links en revisión: ${error.message}`);
        res.status(500).json({ success: false, error: "Error al cargar links en revisión" });
    }
});

app.put('/admin/links/marcar-caido/:id', verificarAdmin, [param('id').isMongoId()], async (req, res) => {
    try {
        const juego = await Juego.findByIdAndUpdate(req.params.id, { $set: { linkStatus: 'caido' } }, { new: true });
        if (!juego) return res.status(404).json({ success: false, error: "Juego no encontrado" });
        logger.warn(`Link marcado como caído: ${juego.title}`);
        res.json({ success: true, mensaje: "Link marcado como caído.", juego: { _id: juego._id, title: juego.title, linkStatus: juego.linkStatus } });
    } catch (error) {
        logger.error(`Error: ${error?.message}`);
        res.status(500).json({ success: false, error: "Error al marcar link como caído" });
    }
});

app.post('/items/verify-download/:id', async (req, res) => {
    res.json({ success: true, mensaje: "Por favor usa /economia/validar-descarga con el ID en el body", deprecado: true });
});
};
