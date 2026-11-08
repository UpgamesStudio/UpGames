/**
 * Perfil: datos, seguidores, ajustes y subida directa a Cloudinary
 *
 * Perfil público, seguir/dejar de seguir, cambios de avatar/portada/bio/nombre/email/contraseña y firma para subir imágenes y videos desde el navegador.
 * Extraído de index.js: recibe sus dependencias explícitas (ver la llamada en index.js).
 */
module.exports = function perfil({ API_URL_SELF, EMAIL_NORMALIZE_OPTS, Extras, Juego, UCmod, Usuario, adminPanel, app, bcrypt, body, cacheado, cerrarOtrasSesiones, cloudinary, crearNotif, crypto, emailVerifTemplate, errorNombreUsuario, firmarToken, logger, mensajeDuplicado, mongoose, sendEmail, validationResult, verificarToken, versionActual }) {
app.get('/usuarios/nexus-stats/:usuario', async (req, res) => {
    try {
        const username = req.params.usuario.toLowerCase().trim();
        const user = await Usuario.findOne({ usuario: username })
            .select('usuario verificadoNivel isVerificado descargasTotales listaSeguidores siguiendo saldo')
            .lean();
        if (!user) return res.json({ success: true, stats: null });
        res.json({
            success: true,
            stats: {
                usuario: user.usuario,
                verificadoNivel: user.verificadoNivel || 0,
                isVerificado: user.isVerificado || false,
                seguidores: (user.listaSeguidores || []).length,
                siguiendo: (user.siguiendo || []).length,
                descargasTotales: user.descargasTotales || 0,
            }
        });
    } catch (err) {
        logger.error(`[nexus-stats] ${err.message}`);
        res.status(500).json({ success: false, error: 'Error' });
    }
});

// Tarjetas de creador (avatar + estilo comprado) para el detalle y los comentarios: hasta 40 a la vez, 2 min de caché
app.get('/usuarios/tarjetas', async (req, res) => {
    try {
        const nombres = [...new Set(String(req.query.u || '').toLowerCase().split(',').map(x => x.trim()).filter(x => /^[a-z0-9_.-]{1,30}$/.test(x)))].slice(0, 40);
        if (!nombres.length) return res.json({ success: true, tarjetas: {} });
        const tarjetas = await cacheado('tarjetas:' + nombres.sort().join(','), 120, async () => {
            const us = await Usuario.find({ usuario: { $in: nombres } }).select('usuario avatar verificadoNivel estilo planHasta listaSeguidores').lean();
            return Object.fromEntries(us.map(u => [u.usuario, { avatar: u.avatar || '', verificado: u.verificadoNivel || 0, estilo: u.estilo || {}, premium: !!(u.planHasta && new Date(u.planHasta) > new Date()), seguidores: (u.listaSeguidores || []).length }]));
        });
        res.set('Cache-Control', 'public, max-age=60').json({ success: true, tarjetas });
    } catch (e) { res.status(500).json({ success: false, tarjetas: {} }); }
});

app.get('/usuarios/perfil-publico/:usuario', async (req, res) => {
    try {
        const username = req.params.usuario.toLowerCase().trim();
        const [user, publicaciones] = await Promise.all([
            // LISTA BLANCA: antes se devolvía el documento entero (menos password y
            // paypalEmail) — incluía resetPasswordToken, email, IP, saldo y tarjetas.
            // (los seguidores y seguidos se cuentan en Mongo: no se traen las listas enteras)
            Usuario.aggregate([{ $match: { usuario: username } }, { $limit: 1 }, { $project: {
                usuario: 1, avatar: 1, banner: 1, bio: 1, verificadoNivel: 1, isVerificado: 1, socialLinks: 1, createdAt: 1, fecha: 1, estilo: 1, planHasta: 1, cosmeticos: 1,
                nSeguidores: { $size: { $ifNull: ['$listaSeguidores', []] } }, nSiguiendo: { $size: { $ifNull: ['$siguiendo', []] } } } }]).then(r => r[0] || null),
            Juego.countDocuments({ usuario: username, status: 'aprobado' })
        ]);
        if (!user) return res.status(404).json({ success: false, error: "Usuario no encontrado" });
        const { nSeguidores, nSiguiendo, _id, planHasta, cosmeticos, ...publico } = user;
        // Vitrina: insignias que tiene (todas, no solo las 3 que muestra) y cuántos artículos de estilo coleccionó
        const ids = new Set(require('../modulos/extras').COSMETICOS.map(c => c.id)), suyos = (cosmeticos || []).filter(c => ids.has(c));
        const coleccion = { total: suyos.length, insignias: suyos.filter(c => c.startsWith('ins_')) };
        res.json({ success: true, usuario: { ...publico, coleccion, premium: !!(planHasta && new Date(planHasta) > new Date()), publicaciones, seguidores: nSeguidores || 0, siguiendo: nSiguiendo || 0 } });
    } catch (err) {
        res.status(500).json({ success: false, error: "Error al cargar perfil" });
    }
});

app.get('/usuarios/verifica-seguimiento/:actual/:viendo', async (req, res) => {
    try {
        const actual = req.params.actual.toLowerCase().trim();
        const viendo = req.params.viendo.toLowerCase().trim();
        const user = await Usuario.findOne({ usuario: actual }).select('siguiendo').lean();
        res.json({ estaSiguiendo: !!(user?.siguiendo?.includes(viendo)) });
    } catch (err) {
        res.json({ estaSiguiendo: false });
    }
});

app.put('/usuarios/toggle-seguir/:actual/:objetivo', verificarToken, async (req, res) => {
    try {
        const actual   = req.params.actual.toLowerCase();
        const objetivo = req.params.objetivo.toLowerCase();
        // Solo puedes seguir/dejar de seguir en tu nombre (antes cualquiera podía
        // inflar seguidores ajenos → verificación → requisito para cobrar)
        if (actual !== String(req.usuario || '').toLowerCase()) return res.status(403).json({ success: false, error: "Sin permiso" });
        if (actual === objetivo) return res.status(400).json({ success: false, error: "No puedes seguirte a ti mismo" });
        const [userActual, userObjetivo] = await Promise.all([
            Usuario.findOne({ usuario: actual }).select('siguiendo').lean(),
            Usuario.findOne({ usuario: objetivo }).select('_id').lean()
        ]);
        if (!userActual || !userObjetivo) return res.status(404).json({ success: false, error: "Usuario no encontrado" });
        const yaSigue = userActual.siguiendo?.includes(objetivo);
        if (yaSigue) {
            await Promise.all([
                Usuario.updateOne({ usuario: actual }, { $pull: { siguiendo: objetivo } }),
                Usuario.updateOne({ usuario: objetivo }, { $pull: { listaSeguidores: actual } })
            ]);
            res.json({ success: true, siguiendo: false });
        } else {
            await Promise.all([
                Usuario.updateOne({ usuario: actual }, { $addToSet: { siguiendo: objetivo } }),
                Usuario.updateOne({ usuario: objetivo }, { $addToSet: { listaSeguidores: actual } })
            ]);
            res.json({ success: true, siguiendo: true });
            Extras.evento(actual, 'seguir', objetivo);   // misiones
            // Notificar al usuario seguido + registrar evento en Nexus (fire & forget)
            crearNotif({
                destinatario: objetivo, tipo: 'seguidor', emisor: actual,
                mensaje: `@${actual} empezó a seguirte`
            });
            return;
        }
    } catch (err) {
        res.status(500).json({ success: false, error: "Error al actualizar" });
    }
});

// URL de imagen segura para avatar/portada: https, sin comillas, espacios ni < >
// (antes el avatar aceptaba cualquier texto y se insertaba con innerHTML → XSS).
function urlImagenSegura(u) {
    const v = String(u || '').trim();
    return v.length <= 600 && /^https:\/\/[^\s"'<>`\\]+$/i.test(v) ? v : null;
}
app.put('/usuarios/update-avatar', [verificarToken, body('avatarUrl').optional(), body('nuevaFoto').optional()], async (req, res) => {
    try {
        const raw = req.body.avatarUrl || req.body.nuevaFoto;
        if (!raw) return res.status(400).json({ success: false, error: 'URL de avatar requerida' });
        const avatarUrl = urlImagenSegura(raw);
        if (!avatarUrl) return res.status(400).json({ success: false, error: 'La URL debe empezar por https:// y no tener espacios ni comillas' });
        await Usuario.updateOne({ usuario: req.usuario.toLowerCase() }, { $set: { avatar: avatarUrl } });
        res.json({ success: true, avatar: avatarUrl });
    } catch (err) {
        logger.error(`Error en update-avatar: ${err.message}`);
        res.status(500).json({ success: false, error: 'Error al actualizar avatar' });
    }
});
// PUT /usuarios/update-banner — poner, cambiar o quitar ("") la portada del perfil
app.put('/usuarios/update-banner', verificarToken, async (req, res) => {
    try {
        const raw = req.body?.bannerUrl;
        if (typeof raw !== 'string') return res.status(400).json({ success: false, error: 'bannerUrl requerido ("" para quitar la portada)' });
        let banner = '';
        if (raw.trim()) {
            banner = urlImagenSegura(raw);
            if (!banner) return res.status(400).json({ success: false, error: 'La URL debe empezar por https:// y no tener espacios ni comillas' });
        }
        await Usuario.updateOne({ usuario: req.usuario.toLowerCase() }, { $set: { banner } });
        res.json({ success: true, banner });
    } catch (err) {
        logger.error(`Error en update-banner: ${err.message}`);
        res.status(500).json({ success: false, error: 'Error al actualizar la portada' });
    }
});

// ── Firma unificada: imágenes Y videos suben DIRECTO desde el navegador a Cloudinary ──
// Payload mínimo (solo JSON pequeño), sin límite de tamaño, sin multer, sin dependencias extra
app.get('/upload/sign', verificarToken, (req, res) => {
    try {
        const validFolders = ['avatars','banners','covers','thumbnails','videos'];
        const folder    = validFolders.includes(req.query.folder) ? req.query.folder : 'covers';
        const timestamp = Math.round(Date.now() / 1000);
        const params    = { timestamp, folder };
        const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET);
        logger.info(`[upload/sign] @${req.usuario} firma para: ${folder}`);
        res.json({
            signature,
            timestamp,
            api_key:    process.env.CLOUDINARY_API_KEY,
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            folder
        });
    } catch (err) {
        logger.error(`Error en upload/sign: ${err.message}`);
        res.status(500).json({ success: false, error: 'Error generando firma de subida' });
    }
});


app.put('/usuarios/update-bio', [verificarToken, body('bio').isLength({ max: 200 })], async (req, res) => {
    try {
        await Usuario.updateOne({ usuario: req.usuario.toLowerCase() }, { $set: { bio: req.body.bio || '' } });
        res.json({ success: true });
    } catch (err) {
        logger.error(`Error en update-bio: ${err.message}`);
        res.status(500).json({ success: false, error: 'Error al actualizar bio' });
    }
});

/**
 * Renombra a un usuario en TODAS las colecciones que guardan su nombre: cualquier
 * modelo con usuario/destinatario/creador/emisor/de/para (publicaciones, comentarios,
 * pagos, regalos y accesos, lives, notificaciones, mensajes…), sus seguidores y sus
 * misiones. Antes faltaban pagos y transacciones: el dinero retenido de regalos se
 * liberaba al nombre viejo y se perdía.
 */
async function cascadaNombre(oldName, newName) {
    const tareas = [];
    for (const [nombre, M] of Object.entries(mongoose.models)) {
        if (nombre === 'Usuario') continue;
        for (const campo of ['usuario', 'destinatario', 'creador', 'emisor', 'de', 'para']) {
            const t = M.schema.path(campo);
            if (t && t.instance === 'String') tareas.push(M.updateMany({ [campo]: oldName }, { $set: { [campo]: newName } }));
        }
    }
    tareas.push(mongoose.connection.collection('misiones_progreso').updateMany({ usuario: oldName }, { $set: { usuario: newName } }));
    tareas.push(mongoose.connection.collection('stats_items').updateMany({ autor: oldName }, { $set: { autor: newName } }));
    tareas.push(Usuario.updateMany({ referidoPor: oldName }, { $set: { referidoPor: newName } }));
    tareas.push(Usuario.updateMany({ listaSeguidores: oldName }, { $set: { 'listaSeguidores.$': newName } }));
    tareas.push(Usuario.updateMany({ siguiendo: oldName }, { $set: { 'siguiendo.$': newName } }));
    const r = await Promise.allSettled(tareas);
    const fallos = r.filter(x => x.status === 'rejected');
    if (fallos.length) logger.error(`[update-username] ${fallos.length} actualización(es) de la cascada fallaron: ${fallos[0].reason?.message}`);
}

app.put('/usuarios/update-username', [verificarToken, body('nuevoUsuario').trim().isLength({ min: 3, max: 20 }).matches(/^[a-z0-9_]+$/), body('password').notEmpty()], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, error: 'Nombre inválido (3-20 chars, solo letras minúsculas, números y _)' });
    try {
        const { nuevoUsuario, password } = req.body;
        const oldName = req.usuario.toLowerCase();
        const newName = nuevoUsuario.toLowerCase();
        if (newName === oldName) return res.status(400).json({ success: false, error: 'Ese ya es tu nombre de usuario' });
        const errNombre = errorNombreUsuario(newName);
        if (errNombre) return res.status(400).json({ success: false, error: errNombre });
        const usuario = await Usuario.findOne({ usuario: oldName });
        if (!usuario) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        const passOk = await bcrypt.compare(password, usuario.password);
        if (!passOk) return res.status(401).json({ success: false, error: 'Contraseña incorrecta' });
        // Antes de 30 días solo se puede pagando UpCoins (cambio inmediato)
        let cobroNombre = null, precioNombre = 0;
        if (usuario.lastUsernameChange) {
            const diffDays = (Date.now() - new Date(usuario.lastUsernameChange).getTime()) / (1000 * 60 * 60 * 24);
            if (diffDays < 30) {
                const restante = Math.ceil(30 - diffDays);
                const cfgX = await Extras.config();
                if (!req.body.pagarUC || !cfgX.activo.nombre) return res.status(429).json({ success: false, code: 'NOMBRE_ESPERA', diasRestantes: restante, precioUC: cfgX.activo.nombre ? cfgX.precios.nombre : null,
                    error: `Debes esperar ${restante} día${restante !== 1 ? 's' : ''} más para cambiar tu nombre${cfgX.activo.nombre ? ` (o cámbialo ya por ${cfgX.precios.nombre} UpCoins)` : ''}` });
                precioNombre = cfgX.precios.nombre;
            }
        }
        const existe = await Usuario.findOne({ usuario: newName }).select('_id').lean();
        if (existe) return res.status(409).json({ success: false, error: `El nombre @${newName} ya está en uso. Elige otro` });
        if (precioNombre) {
            cobroNombre = await UCmod.cobrar(Usuario, oldName, precioNombre);
            if (!cobroNombre) return res.status(402).json({ success: false, error: await UCmod.motivoSinSaldo(Usuario, oldName, precioNombre) });
        }
        // Primero el usuario (el índice único frena una carrera); luego la cascada
        try { await Usuario.updateOne({ usuario: oldName }, { $set: { usuario: newName, lastUsernameChange: new Date() } }); }
        catch (e) { if (cobroNombre) await UCmod.devolver(Usuario, oldName, cobroNombre); throw e; }
        await cascadaNombre(oldName, newName);
        if (cobroNombre) {
            mongoose.models.LiveTx?.create({ tipo: 'compra', usuario: newName, monedas: precioNombre, usd: Math.round(precioNombre * UCmod.UC_USD * 100) / 100, planId: 'nombre', metodo: 'upcoins', ref: `nombre:${oldName}:${newName}:${Date.now()}`, estado: 'completada' }).catch(() => {});
        }
        const nuevoToken = firmarToken({ ...usuario.toObject?.() ?? usuario, usuario: newName });
        logger.info(`[update-username] ${oldName} → ${newName} | Cascada completada`);
        res.json({ success: true, nuevoToken, nuevoUsuario: newName });
    } catch (err) {
        const dup = mensajeDuplicado(err);
        if (dup) return res.status(409).json({ success: false, error: dup });
        logger.error(`Error en update-username: ${err.message}`);
        res.status(500).json({ success: false, error: 'Error al actualizar nombre' });
    }
});

app.put('/usuarios/update-email', [verificarToken, body('nuevoEmail').isEmail().normalizeEmail(EMAIL_NORMALIZE_OPTS), body('password').notEmpty()], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, error: 'Email inválido' });
    try {
        const { nuevoEmail, password } = req.body;
        const usuario = await Usuario.findOne({ usuario: req.usuario.toLowerCase() });
        if (!usuario) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        const passOk = await bcrypt.compare(password, usuario.password);
        if (!passOk) return res.status(401).json({ success: false, error: 'Contraseña incorrecta' });
        if (usuario.lastEmailChange) {
            const diffDays = (Date.now() - new Date(usuario.lastEmailChange).getTime()) / (1000 * 60 * 60 * 24);
            if (diffDays < 30) { const restante = Math.ceil(30 - diffDays); return res.status(429).json({ success: false, error: `Debes esperar ${restante} día${restante !== 1 ? 's' : ''} más para cambiar tu email` }); }
        }
        if (nuevoEmail.toLowerCase() === String(usuario.email || '').toLowerCase()) return res.status(400).json({ success: false, error: 'Ese ya es tu email actual' });
        // El email del dueño es la llave del panel: si cambiara, otra persona podría registrarse con él y quedarse con el control
        if (adminPanel.esOwnerEmail(usuario.email)) return res.status(403).json({ success: false, error: 'Esta cuenta es la del dueño: su email está ligado al panel de administración. Para cambiarlo, actualiza primero OWNER_EMAIL en el servidor.' });
        const existe = await Usuario.findOne({ email: nuevoEmail.toLowerCase() }).select('_id').lean();
        if (existe) return res.status(409).json({ success: false, error: 'Ese email ya está registrado en otra cuenta' });
        const verifToken = crypto.randomBytes(32).toString('hex');
        await Usuario.updateOne({ usuario: req.usuario.toLowerCase() }, { $set: { email: nuevoEmail.toLowerCase(), lastEmailChange: new Date(), emailVerificado: false, emailVerifToken: verifToken, emailVerifExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
        const nuevoToken = firmarToken({ usuario: req.usuario.toLowerCase(), email: nuevoEmail.toLowerCase(), sesionVer: await versionActual(req.usuario.toLowerCase()) });
        logger.info(`Usuario ${req.usuario} cambió su email a ${nuevoEmail}`);
        const verifLink = `${API_URL_SELF}/auth/verify-email/${verifToken}`;
        sendEmail({ to: nuevoEmail, subject: '✅ Verifica tu nuevo email en UpGames', html: emailVerifTemplate(req.usuario.toLowerCase(), verifLink) }).catch(() => {});
        res.json({ success: true, nuevoToken, mensaje: 'Email actualizado. Revisa tu bandeja para verificar el nuevo email.' });
    } catch (err) {
        const dup = mensajeDuplicado(err);
        if (dup) return res.status(409).json({ success: false, error: dup });
        logger.error(`Error en update-email: ${err.message}`);
        res.status(500).json({ success: false, error: 'Error al actualizar email' });
    }
});

app.put('/usuarios/update-password', [verificarToken, body('passwordActual').notEmpty(), body('nuevaPassword').isLength({ min: 8 })], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, error: 'La nueva contraseña debe tener al menos 8 caracteres' });
    try {
        const { passwordActual, nuevaPassword } = req.body;
        const usuario = await Usuario.findOne({ usuario: req.usuario.toLowerCase() });
        if (!usuario) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        const passOk = await bcrypt.compare(passwordActual, usuario.password);
        if (!passOk) return res.status(401).json({ success: false, error: 'La contraseña actual es incorrecta' });
        if (await bcrypt.compare(nuevaPassword, usuario.password)) return res.status(400).json({ success: false, error: 'La nueva contraseña no puede ser igual a la actual' });
        const hashed = await bcrypt.hash(nuevaPassword, 10);
        await Usuario.updateOne({ usuario: req.usuario.toLowerCase() }, { $set: { password: hashed } });
        const actualizado = await cerrarOtrasSesiones(req.usuario.toLowerCase());
        logger.info(`Usuario ${req.usuario} cambió su contraseña (otras sesiones cerradas)`);
        res.json({ success: true, token: firmarToken(actualizado), mensaje: 'Contraseña actualizada. Se cerró tu sesión en los demás dispositivos.' });
    } catch (err) {
        logger.error(`Error en update-password: ${err.message}`);
        res.status(500).json({ success: false, error: 'Error al actualizar contraseña' });
    }
});

app.put('/usuarios/update-social-links', [verificarToken, body('socialLinks').isArray({ max: 4 })], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, error: 'Máximo 4 links permitidos' });
    try {
        const cleaned = (req.body.socialLinks || []).filter(l => typeof l === 'string' && l.trim().length > 0).map(l => l.trim()).slice(0, 4);
        const urlRegex = /^https?:\/\/.+/i;
        const invalid = cleaned.find(l => !urlRegex.test(l));
        if (invalid) return res.status(400).json({ success: false, error: `URL inválida: ${invalid}` });
        await Usuario.updateOne({ usuario: req.usuario.toLowerCase() }, { $set: { socialLinks: cleaned } });
        res.json({ success: true });
    } catch (err) {
        logger.error(`Error en update-social-links: ${err.message}`);
        res.status(500).json({ success: false, error: 'Error al guardar links' });
    }
});

    return { urlImagenSegura };
};
