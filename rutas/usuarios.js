/**
 * Usuarios: listado público y gestión en el panel admin
 *
 * Listado paginado de usuarios públicos, detalle, lista negra, notas, borrado y verificación de cuentas (admin).
 * Extraído de index.js: recibe sus dependencias explícitas (ver la llamada en index.js).
 */
module.exports = function usuarios({ Juego, Usuario, adminPanel, app, body, cacheado, logger, mongoose, recalcularScoresUsuario, verificarAdmin }) {
app.get('/auth/users/public', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 200));
        const users = await cacheado(`usuarios:publicos:${page}:${limit}`, 60, () => Usuario.find()
            .select('usuario verificadoNivel avatar bio listaSeguidores siguiendo')
            .skip((page - 1) * limit)
            .limit(limit)
            .lean());
        res.json(users);
    } catch (error) {
        res.status(500).json([]);
    }
});

app.get('/auth/users', verificarAdmin, async (req, res) => {
    try {
        const page  = Math.max(1, parseInt(req.query.page)  || 1);
        const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 100));
        const skip  = (page - 1) * limit;
        const q     = req.query.q ? { usuario: { $regex: String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } } : {};
        const [total, users] = await Promise.all([
            Usuario.countDocuments(q),
            // Nunca exponer hashes ni tokens de reset/verificación (un sub-admin podría secuestrar cuentas)
            Usuario.find(q).select('-password -resetPasswordToken -resetPasswordExpires -resetCodigoHash -emailVerifToken -emailVerifExpires -cobro.cifrado').sort({ fecha: -1 }).skip(skip).limit(limit).lean()
        ]);
        users.forEach(u => { u.esDueno = adminPanel.esOwnerEmail(u.email); });
        res.json({ users, total, page, limit, pages: Math.ceil(total / limit) });
    } catch (error) {
        res.status(500).json([]);
    }
});

app.get('/admin/users/detalle/:id', verificarAdmin, async (req, res) => {
    try {
        const user = await Usuario.findById(req.params.id).select('-password -resetPasswordToken -resetPasswordExpires -resetCodigoHash -emailVerifToken -emailVerifExpires -cobro.cifrado').lean();
        if (!user) return res.status(404).json({ success: false, error: "Usuario no encontrado" });
        const juegos = await Juego.find({ usuario: user.usuario }).select('title status descargasEfectivas likesCount linkStatus createdAt').lean();
        res.json({ success: true, user, juegos });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error al obtener datos" });
    }
});

app.put('/admin/users/lista-negra/:id', verificarAdmin, [body('listaNegraAdmin').isBoolean(), body('notasAdmin').optional().trim().isLength({ max: 500 })], async (req, res) => {
    try {
        const { listaNegraAdmin, notasAdmin } = req.body;
        const updates = { listaNegraAdmin: !!listaNegraAdmin, fechaListaNegra: listaNegraAdmin ? new Date() : null };
        if (notasAdmin !== undefined) updates.notasAdmin = notasAdmin;
        const user = await Usuario.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true }).select('-password -resetPasswordToken -resetPasswordExpires -resetCodigoHash -emailVerifToken -emailVerifExpires -cobro.cifrado');
        if (!user) return res.status(404).json({ success: false, error: "Usuario no encontrado" });
        logger.warn(`Lista negra actualizada: @${user.usuario} → ${listaNegraAdmin}`);
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error al actualizar lista negra" });
    }
});

app.put('/admin/users/notas/:id', verificarAdmin, [body('notasAdmin').trim().isLength({ max: 500 })], async (req, res) => {
    try {
        const user = await Usuario.findByIdAndUpdate(req.params.id, { $set: { notasAdmin: req.body.notasAdmin } }, { new: true }).select('-password -resetPasswordToken -resetPasswordExpires -resetCodigoHash -emailVerifToken -emailVerifExpires -cobro.cifrado');
        if (!user) return res.status(404).json({ success: false, error: "Usuario no encontrado" });
        res.json({ success: true, mensaje: "Notas actualizadas" });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error al guardar notas" });
    }
});

app.get('/admin/users/lista-negra', verificarAdmin, async (req, res) => {
    try {
        const users = await Usuario.find({ listaNegraAdmin: true }).select('-password -resetPasswordToken -resetPasswordExpires -resetCodigoHash -emailVerifToken -emailVerifExpires -cobro.cifrado').sort({ fechaListaNegra: -1 }).lean();
        res.json({ success: true, users, total: users.length });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error al obtener lista negra" });
    }
});

app.delete('/auth/users/:id', verificarAdmin, async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, error: 'ID inválido' });
        const u = await Usuario.findById(req.params.id).select('email').lean();
        if (u && adminPanel.esOwnerEmail(u.email)) return res.status(400).json({ success: false, error: 'La cuenta del dueño no se puede eliminar' });
        await Usuario.findByIdAndDelete(req.params.id);
        res.json({ success: true, ok: true });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error al eliminar" });
    }
});

app.put('/auth/admin/verificacion/:username', verificarAdmin, [body('nivel').isInt({ min: 0, max: 3 })], async (req, res) => {
    try {
        const { username } = req.params;
        const { nivel } = req.body;
        const user = await Usuario.findOneAndUpdate({ usuario: username.toLowerCase() }, { $set: { verificadoNivel: nivel } }, { new: true }).select('-password -resetPasswordToken -resetPasswordExpires -resetCodigoHash -emailVerifToken -emailVerifExpires -cobro.cifrado');
        if (!user) return res.status(404).json({ success: false, error: "Usuario no encontrado" });
        logger.info(`Verificación actualizada: @${username} → Nivel ${nivel}`);
        // ⭐ Recalcular scores al cambiar nivel
        recalcularScoresUsuario(username.toLowerCase()).catch(() => {});
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, error: "Error al actualizar verificación" });
    }
});
};
