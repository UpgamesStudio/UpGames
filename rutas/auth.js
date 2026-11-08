/**
 * Autenticación: registro, login y sesión
 *
 * Identidad única (usuario y email), registro, inicio de sesión y verificación.
 * Extraído de index.js: recibe sus dependencias explícitas (ver la llamada en index.js).
 */
module.exports = function auth({ API_URL_SELF, EMAIL_NORMALIZE_OPTS, Limites, Referidos, Usuario, app, bcrypt, body, crypto, emailVerifTemplate, firmarToken, gamification, gmailLegacyEmail, logger, sendEmail, twoFactor, validationResult }) {
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const NOMBRES_RESERVADOS = new Set(['admin', 'administrador', 'upgames', 'nexus', 'soporte', 'support',
    'moderador', 'mod', 'staff', 'sistema', 'system', 'root', 'oficial', 'official', 'coral', 'rouce', 'roucedev']);
function errorNombreUsuario(nombre) {
    const n = String(nombre || '').trim().toLowerCase();
    if (n.length < 3 || n.length > 20) return 'El nombre debe tener entre 3 y 20 caracteres';
    if (!USERNAME_RE.test(n)) return 'Solo se permiten letras (a-z), números y guion bajo (_), sin espacios ni tildes';
    if (NOMBRES_RESERVADOS.has(n)) return 'Ese nombre está reservado. Elige otro';
    return null;
}
/** Error E11000 de MongoDB (índice único) → mensaje claro según el campo */
function mensajeDuplicado(err) {
    if (!err || err.code !== 11000) return null;
    const campo = Object.keys(err.keyPattern || err.keyValue || {})[0] || '';
    return campo === 'email' ? 'Ese email ya está registrado en otra cuenta' : 'Ese nombre de usuario ya está en uso';
}
// GET /auth/disponibilidad?usuario=&email= — comprobación en vivo al escribir
app.get('/auth/disponibilidad', async (req, res) => {
    if (!(await Limites.permitir(`disp:${req.ip || ''}`, [[Limites.MIN, 40]]))) return res.status(429).json({ success: false, error: 'Demasiadas consultas, espera un momento' });
    try {
        const out = { success: true };
        if (typeof req.query.usuario === 'string' && req.query.usuario.trim()) {
            const n = req.query.usuario.trim().toLowerCase();
            const err = errorNombreUsuario(n);
            if (err) out.usuario = { disponible: false, motivo: err };
            else {
                const existe = await Usuario.exists({ usuario: n });
                out.usuario = existe ? { disponible: false, motivo: `@${n} ya existe. Prueba con otro nombre` } : { disponible: true };
            }
        }
        if (typeof req.query.email === 'string' && req.query.email.trim()) {
            const e = req.query.email.trim().toLowerCase();
            if (!/^\S+@\S+\.\S+$/.test(e)) out.email = { disponible: false, motivo: 'Email inválido' };
            else {
                const existe = await Usuario.exists({ email: e });
                out.email = existe ? { disponible: false, motivo: 'Ese email ya tiene una cuenta. ¿Quieres iniciar sesión?' } : { disponible: true };
            }
        }
        res.json(out);
    } catch (err) {
        logger.error(`[disponibilidad] ${err.message}`);
        res.status(500).json({ success: false, error: 'No se pudo comprobar' });
    }
});

app.post('/auth/register', [
    body('usuario').trim().isLength({ min: 3, max: 20 }).toLowerCase(),
    body('email').isEmail().normalizeEmail(EMAIL_NORMALIZE_OPTS),
    body('password').isLength({ min: 6 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, error: "Datos inválidos", details: errors.array() });

        const { usuario, email, password } = req.body;
        const errNombre = errorNombreUsuario(usuario);
        if (errNombre) return res.status(400).json({ success: false, error: errNombre, campo: 'usuario' });
        const registrationIP = req.ip;

        const [existeUsuario, existeEmail] = await Promise.all([
            Usuario.findOne({ usuario: usuario.toLowerCase() }).select('_id').lean(),
            Usuario.findOne({ email: email.toLowerCase() }).select('_id').lean()
        ]);
        if (existeUsuario) return res.status(409).json({ success: false, error: `El nombre @${usuario.toLowerCase()} ya está en uso. Elige otro`, campo: 'usuario' });
        if (existeEmail) return res.status(409).json({ success: false, error: "Ese email ya tiene una cuenta. Inicia sesión o recupera tu contraseña", campo: 'email' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const verifToken = crypto.randomBytes(32).toString('hex');

        const nuevoUsuario = new Usuario({
            usuario: usuario.toLowerCase(), email: email.toLowerCase(), password: hashedPassword,
            registrationIP, emailVerifToken: verifToken, emailVerifExpires: new Date(Date.now() + 24 * 60 * 60 * 1000), emailVerificado: false
        });
        await nuevoUsuario.save();
        logger.info(`Nuevo usuario registrado: @${usuario} (${email})`);

        // ── Referidos: ?ref=<usuario> (o código viejo). Se paga al verificar el email ──
        const ref = typeof req.body.ref === 'string' ? req.body.ref : (typeof req.body.codigoReferral === 'string' ? req.body.codigoReferral : '');
        if (ref) {
            Referidos.alRegistrar(Usuario, nuevoUsuario.usuario, ref, registrationIP).catch(() => {});
            require('../modulos/socialFeed').registrarReferido(ref, nuevoUsuario.usuario).catch(() => {});
        }

        const verifLink = `${API_URL_SELF}/auth/verify-email/${verifToken}`;
        sendEmail({ to: email, subject: '✅ Verifica tu email en UpGames', html: emailVerifTemplate(usuario, verifLink) }).catch(() => {});

        const token = firmarToken(nuevoUsuario);
        res.status(201).json({ success: true, ok: true, token, usuario: nuevoUsuario.usuario, email: nuevoUsuario.email, emailVerificado: false, mensaje: 'Cuenta creada. Revisa tu email para verificar tu cuenta.', datosUsuario: { usuario: nuevoUsuario.usuario, email: nuevoUsuario.email, verificadoNivel: nuevoUsuario.verificadoNivel, isVerificado: nuevoUsuario.isVerificado, emailVerificado: false } });
    } catch (error) {
        // Dos registros simultáneos con el mismo nombre/email: el índice único lo frena
        const dup = mensajeDuplicado(error);
        if (dup) return res.status(409).json({ success: false, error: dup, campo: /email/i.test(dup) ? 'email' : 'usuario' });
        logger.error(`Error en register: ${error.message}`);
        res.status(500).json({ success: false, error: "Error al registrar usuario" });
    }
});

app.post('/auth/login', [body('usuario').isString().notEmpty(), body('password').isString().notEmpty()], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, error: "Datos inválidos" });

        const { usuario: identificador, password } = req.body;
        const id = identificador.toLowerCase().trim();
        const orConds = [{ usuario: id }, { email: id }];
        // Fallback para cuentas antiguas de Gmail guardadas sin puntos por el
        // normalizeEmail anterior: permite entrar con el email real "con puntos".
        const legacyGmail = gmailLegacyEmail(id);
        if (legacyGmail) orConds.push({ email: legacyGmail });
        const usuario = await Usuario.findOne({ $or: orConds });
        if (!usuario) return res.status(401).json({ success: false, error: "Usuario o contraseña incorrectos" });

        const esValida = await bcrypt.compare(password, usuario.password);
        if (!esValida) return res.status(401).json({ success: false, error: "Usuario o contraseña incorrectos" });
        if (usuario.suspendido) return res.status(403).json({ success: false, error: 'Tu cuenta está suspendida' + (usuario.motivoSuspension ? `: ${usuario.motivoSuspension}` : '') + '. Contacta a soporte.', code: 'SUSPENDIDO' });

        // ── Verificación 2FA (si el usuario lo tiene activo) ──
        const tieneDFA = await twoFactor.tieneActivo(usuario.usuario);
        if (tieneDFA) {
            if (!req.body.token2fa) {
                return res.status(401).json({ error: 'Se requiere código 2FA', require2FA: true });
            }
            const check = await twoFactor.verificar(usuario.usuario, req.body.token2fa);
            if (!check.ok) {
                return res.status(401).json({ error: check.error || 'Código 2FA incorrecto' });
            }
        }

        const token = firmarToken(usuario);
        logger.info(`Login exitoso: @${usuario.usuario}`);

        // ── Hook gamificación: racha diaria (fire & forget) ──
        gamification.onLogin(usuario.usuario).catch(() => {});

        // Fire & forget — no bloquea la respuesta
        Usuario.updateOne({ usuario: usuario.usuario }, { $set: { ultimoLogin: new Date() } }).catch(() => {});

        res.json({ success: true, ok: true, token, usuario: usuario.usuario, email: usuario.email, datosUsuario: { usuario: usuario.usuario, email: usuario.email, verificadoNivel: usuario.verificadoNivel, isVerificado: usuario.isVerificado, saldo: usuario.saldo, socialLinks: usuario.socialLinks || [], lastUsernameChange: usuario.lastUsernameChange || null, lastEmailChange: usuario.lastEmailChange || null } });
    } catch (error) {
        logger.error(`Error en login: ${error.message}`);
        res.status(500).json({ success: false, error: "Error al iniciar sesión" });
    }
});

    return { errorNombreUsuario, mensajeDuplicado };
};
