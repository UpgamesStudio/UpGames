/**
 * Chat privado
 *
 * Mensajes entre usuarios, no leídos y búsqueda de usuarios para el chat.
 * Extraído de index.js: recibe sus dependencias explícitas (ver la llamada en index.js).
 */
module.exports = function chat({ CeroTolerancia, Limites, Mensaje, Moderacion, Notificacion, Usuario, app, imagenes, logger, push, urlImagenSegura, verificarToken }) {
const CHAT_REACCIONES = ['❤️', '😂', '😮', '😢', '👍', '🔥'];
const CHAT_PAGINA = 40;
const chatEscribiendo = new Map();          // "de->para" → timestamp
const chatEsId = v => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);
const chatConv = (yo, otro) => ({ $or: [{ de: yo, para: otro }, { de: otro, para: yo }], ocultoPara: { $ne: yo } });
const chatOnline = fecha => !!fecha && (Date.now() - new Date(fecha).getTime()) < 2 * 60 * 1000;
function chatSerializar(m) {
    return {
        id: m._id, de: m.de, para: m.para,
        texto: m.borrado ? '' : m.texto, imagen: m.borrado ? '' : (m.imagen || ''),
        leido: !!m.leido, fecha: m.fecha, editado: !!m.editado, borrado: !!m.borrado,
        replyTo: m.replyTo && m.replyTo.id ? m.replyTo : null,
        reacciones: m.borrado ? [] : (m.reacciones || []),
    };
}
async function chatRelacion(yo, otro) {
    const [a, b] = await Promise.all([
        Usuario.findOne({ usuario: yo }).select('siguiendo listaSeguidores bloqueados').lean(),
        Usuario.findOne({ usuario: otro }).select('usuario avatar verificadoNivel ultimoLogin siguiendo listaSeguidores bloqueados').lean(),
    ]);
    if (!a || !b) return { existe: !!b };
    const yoSigo = (a.siguiendo || []).includes(otro);
    const meSigue = (b.siguiendo || []).includes(yo) || (a.listaSeguidores || []).includes(otro);
    const yoBloqueo = (a.bloqueados || []).includes(otro);
    const meBloqueo = (b.bloqueados || []).includes(yo);
    return {
        existe: true, usuario: b.usuario, avatar: b.avatar || '', verificadoNivel: b.verificadoNivel || 0,
        online: !meBloqueo && chatOnline(b.ultimoLogin), ultimaVez: meBloqueo ? null : (b.ultimoLogin || null),
        yoSigo, meSigue, yoBloqueo, meBloqueo,
        puedeChatear: yoSigo && meSigue && !yoBloqueo && !meBloqueo,
    };
}

app.post('/chat/enviar', verificarToken, async (req, res) => {
    try {
        const de = req.usuario;
        const para = String(req.body.para || '').toLowerCase().trim();
        const texto = typeof req.body.texto === 'string' ? req.body.texto.trim() : '';
        const imagenRaw = typeof req.body.imagen === 'string' ? req.body.imagen.trim() : '';
        if (!para) return res.status(400).json({ success: false, error: 'Destinatario requerido' });
        if (!texto && !imagenRaw) return res.status(400).json({ success: false, error: 'Mensaje vacío' });
        if (de === para) return res.status(400).json({ success: false, error: 'No puedes enviarte mensajes a ti mismo' });
        if (texto.length > 2000) return res.status(400).json({ success: false, error: 'Mensaje demasiado largo (máx 2000 caracteres)' });
        const imagen = imagenRaw ? urlImagenSegura(imagenRaw) : '';
        if (imagenRaw && !imagen) return res.status(400).json({ success: false, error: 'Imagen inválida' });
        const cero = await CeroTolerancia.frenarTexto({ texto, usuario: de, donde: `chat privado con @${para}`, ref: para, req });
        if (cero) return res.status(cero.status).json({ success: false, error: cero.error, code: cero.code });

        const rel = await chatRelacion(de, para);
        if (!rel.existe) return res.status(404).json({ success: false, error: 'Ese usuario no existe' });
        if (rel.yoBloqueo) return res.status(403).json({ success: false, error: `Bloqueaste a @${para}. Desbloquéalo para escribirle`, code: 'YO_BLOQUEO' });
        if (rel.meBloqueo) return res.status(403).json({ success: false, error: 'No puedes enviar mensajes a este usuario', code: 'BLOQUEADO' });
        if (!rel.puedeChatear) return res.status(403).json({ success: false, error: 'Solo puedes chatear con usuarios que se siguen mutuamente', code: 'NO_MUTUO' });

        let replyTo = undefined;
        if (chatEsId(req.body.replyTo)) {
            const orig = await Mensaje.findOne({ _id: req.body.replyTo, ...chatConv(de, para) }).select('de texto imagen borrado').lean();
            if (orig && !orig.borrado) replyTo = { id: String(orig._id), de: orig.de, texto: (orig.texto || '').slice(0, 140), imagen: !!orig.imagen };
        }
        const ahora = new Date();
        const msg = await new Mensaje({ de, para, texto, imagen, replyTo, actualizado: ahora, fecha: ahora }).save();
        chatEscribiendo.delete(`${de}->${para}`);
        // NEXUS visión revisa la imagen en segundo plano: si es contenido prohibido se oculta y se abre un incidente
        CeroTolerancia.vigilarImagen({ imagen, usuario: de, donde: `chat privado con @${para}`, ref: String(msg._id), texto, req,
            ocultar: () => Mensaje.updateOne({ _id: msg._id }, { $set: { borrado: true, texto: '', imagen: '', actualizado: new Date() } }) });

        // Una sola notificación por conversación sin leer (antes: una por mensaje)
        Notificacion.findOneAndUpdate(
            { destinatario: para, emisor: de, tipo: 'sistema', leida: false, itemTitle: `Mensaje de @${de}` },
            // (sin el texto del mensaje: el panel de notificaciones lo inserta como HTML)
            { $set: { fecha: ahora, itemId: msg._id.toString(), itemImage: imagen || '', mensaje: '' } },
            { upsert: true }
        ).catch(() => {});
        // Push al móvil con el texto (el sistema operativo lo muestra como texto plano, sin riesgo de HTML)
        if (!(await Usuario.exists({ usuario: para, bloqueados: de })))
            push.alCrear([{ destinatario: para, emisor: de, tipo: 'sistema', itemTitle: `Mensaje de @${de}`, mensaje: texto || (imagen ? '📷 Foto' : '') }]);

        res.json({ success: true, mensaje: chatSerializar(msg.toObject()), cursor: Date.now() });
    } catch (err) {
        logger.error(`Error enviando mensaje: ${err.message}`);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});

// GET /chat/mensajes/:otro            → últimos 40
// GET /chat/mensajes/:otro?antes=ms   → 40 anteriores (scroll hacia arriba)
// GET /chat/mensajes/:otro?desde=ms   → nuevos + cambiados desde el cursor del servidor
app.get('/chat/mensajes/:otroUsuario', verificarToken, async (req, res) => {
    try {
        const yo = req.usuario;
        const otro = String(req.params.otroUsuario || '').toLowerCase();
        const base = chatConv(yo, otro);
        const cursor = Date.now();
        const desde = Number(req.query.desde) || 0;
        const antes = Number(req.query.antes) || 0;
        let mensajes, hayMas = false;
        if (desde) {
            const d = new Date(desde - 1500);   // margen por escrituras concurrentes (el cliente deduplica por id)
            mensajes = await Mensaje.find({ ...base, $and: [{ $or: [{ fecha: { $gt: d } }, { actualizado: { $gt: d } }] }] })
                .sort({ fecha: 1 }).limit(300).lean();
        } else {
            const f = antes ? { ...base, fecha: { $lt: new Date(antes) } } : base;
            const filas = await Mensaje.find(f).sort({ fecha: -1 }).limit(CHAT_PAGINA + 1).lean();
            hayMas = filas.length > CHAT_PAGINA;
            mensajes = filas.slice(0, CHAT_PAGINA).reverse();
        }
        // Marcar como leído TODO lo que me envió (y avisar al emisor vía "actualizado")
        const sinLeer = mensajes.some(m => m.para === yo && !m.leido) || !desde;
        if (sinLeer) {
            const r = await Mensaje.updateMany({ de: otro, para: yo, leido: false }, { $set: { leido: true, actualizado: new Date() } });
            if (r.modifiedCount) mensajes.forEach(m => { if (m.para === yo) m.leido = true; });
            if (r.modifiedCount) Notificacion.updateMany({ destinatario: yo, emisor: otro, tipo: 'sistema', leida: false, itemTitle: `Mensaje de @${otro}` }, { $set: { leida: true } }).catch(() => {});
        }
        const t = chatEscribiendo.get(`${otro}->${yo}`);
        res.json({ success: true, mensajes: mensajes.map(chatSerializar), hayMas, cursor, escribiendo: !!t && cursor - t < 6000 });
    } catch (err) {
        logger.error(`Error cargando mensajes: ${err.message}`);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});

// GET /chat/conversaciones — una fila por contacto, con avatar y estado
app.get('/chat/conversaciones', verificarToken, async (req, res) => {
    try {
        const yo = req.usuario;
        const conversaciones = await Mensaje.aggregate([
            { $match: { $or: [{ de: yo }, { para: yo }], ocultoPara: { $ne: yo } } },
            { $addFields: {
                contacto:  { $cond: { if: { $eq: ['$de', yo] }, then: '$para', else: '$de' } },
                esNoLeido: { $and: [{ $eq: ['$para', yo] }, { $eq: ['$leido', false] }] }
            } },
            { $sort: { fecha: -1 } },
            { $group: {
                _id: '$contacto',
                ultimoTexto:  { $first: '$texto' },
                ultimaImagen: { $first: '$imagen' },
                ultimoDe:     { $first: '$de' },
                ultimaFecha:  { $first: '$fecha' },
                ultimoLeido:  { $first: '$leido' },
                ultimoBorrado:{ $first: '$borrado' },
                noLeidos:     { $sum: { $cond: ['$esNoLeido', 1, 0] } }
            } },
            { $sort: { ultimaFecha: -1 } },
            { $limit: 60 }
        ]);
        const nombres = conversaciones.map(c => c._id);
        const [usuarios, yoDoc] = await Promise.all([
            Usuario.find({ usuario: { $in: nombres } }).select('usuario avatar verificadoNivel ultimoLogin bloqueados').lean(),
            Usuario.findOne({ usuario: yo }).select('bloqueados').lean(),
        ]);
        const porNombre = new Map(usuarios.map(u => [u.usuario, u]));
        const misBloq = new Set(yoDoc?.bloqueados || []);
        res.json({ success: true, conversaciones: conversaciones.map(c => {
            const u = porNombre.get(c._id) || {};
            const meBloq = (u.bloqueados || []).includes(yo);
            return {
                contacto: c._id,
                avatar: u.avatar || '', verificadoNivel: u.verificadoNivel || 0,
                online: !meBloq && chatOnline(u.ultimoLogin),
                bloqueado: misBloq.has(c._id),
                existe: !!u.usuario,
                noLeidos: c.noLeidos,
                ultimoMensaje: {
                    texto: c.ultimoBorrado ? '' : c.ultimoTexto, imagen: c.ultimoBorrado ? '' : c.ultimaImagen,
                    de: c.ultimoDe, fecha: c.ultimaFecha, leido: c.ultimoLeido, borrado: !!c.ultimoBorrado
                }
            };
        }) });
    } catch (err) {
        logger.error(`Error cargando conversaciones: ${err.message}`);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});

// GET /chat/contacto/:otro — perfil breve + relación (seguir, bloqueo, en línea)
app.get('/chat/contacto/:otroUsuario', verificarToken, async (req, res) => {
    try {
        const otro = String(req.params.otroUsuario || '').toLowerCase();
        const rel = await chatRelacion(req.usuario, otro);
        if (!rel.existe) return res.status(404).json({ success: false, error: 'Ese usuario no existe' });
        res.json({ success: true, contacto: rel });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});

// GET /chat/contactos — seguidores mutuos (con quienes puedes chatear)
app.get('/chat/contactos', verificarToken, async (req, res) => {
    try {
        const yo = await Usuario.findOne({ usuario: req.usuario }).select('siguiendo listaSeguidores bloqueados').lean();
        if (!yo) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        const seg = new Set(yo.listaSeguidores || []);
        const bloq = new Set(yo.bloqueados || []);
        const mutuos = (yo.siguiendo || []).filter(u => seg.has(u) && !bloq.has(u));
        const usuarios = await Usuario.find({ usuario: { $in: mutuos } })
            .select('usuario avatar verificadoNivel ultimoLogin').limit(200).lean();
        res.json({ success: true, contactos: usuarios
            .map(u => ({ usuario: u.usuario, avatar: u.avatar || '', verificadoNivel: u.verificadoNivel || 0, online: chatOnline(u.ultimoLogin) }))
            .sort((a, b) => (b.online - a.online) || a.usuario.localeCompare(b.usuario)) });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});

// POST /chat/escribiendo/:otro — indicador "escribiendo…" (vive 6 s en memoria)
app.post('/chat/escribiendo/:otroUsuario', verificarToken, (req, res) => {
    const otro = String(req.params.otroUsuario || '').toLowerCase().slice(0, 40);
    if (chatEscribiendo.size > 20000) chatEscribiendo.clear();
    chatEscribiendo.set(`${req.usuario}->${otro}`, Date.now());
    res.json({ success: true });
});

// PATCH /chat/mensaje/:id — editar mi mensaje (hasta 15 min)
app.patch('/chat/mensaje/:id', verificarToken, async (req, res) => {
    try {
        if (!chatEsId(req.params.id)) return res.status(400).json({ success: false, error: 'ID inválido' });
        const texto = typeof req.body.texto === 'string' ? req.body.texto.trim() : '';
        if (!texto || texto.length > 2000) return res.status(400).json({ success: false, error: 'Texto inválido (1-2000 caracteres)' });
        const cero = await CeroTolerancia.frenarTexto({ texto, usuario: req.usuario, donde: 'chat privado (edición)', ref: req.params.id, req });
        if (cero) return res.status(cero.status).json({ success: false, error: cero.error, code: cero.code });
        const m = await Mensaje.findById(req.params.id);
        if (!m || m.de !== req.usuario) return res.status(404).json({ success: false, error: 'Mensaje no encontrado' });
        if (m.borrado) return res.status(400).json({ success: false, error: 'El mensaje fue eliminado' });
        if (Date.now() - m.fecha.getTime() > 15 * 60 * 1000) return res.status(400).json({ success: false, error: 'Solo puedes editar durante 15 minutos' });
        m.texto = texto; m.editado = true; m.actualizado = new Date();
        await m.save();
        res.json({ success: true, mensaje: chatSerializar(m.toObject()) });
    } catch (err) { res.status(500).json({ success: false, error: 'Error interno' }); }
});

// DELETE /chat/mensaje/:id?modo=todos|mi
app.delete('/chat/mensaje/:id', verificarToken, async (req, res) => {
    try {
        if (!chatEsId(req.params.id)) return res.status(400).json({ success: false, error: 'ID inválido' });
        const yo = req.usuario;
        const m = await Mensaje.findById(req.params.id);
        if (!m || (m.de !== yo && m.para !== yo)) return res.status(404).json({ success: false, error: 'Mensaje no encontrado' });
        if (req.query.modo === 'todos') {
            if (m.de !== yo) return res.status(403).json({ success: false, error: 'Solo puedes eliminar para todos tus propios mensajes' });
            if (Date.now() - m.fecha.getTime() > 24 * 60 * 60 * 1000) return res.status(400).json({ success: false, error: 'Solo puedes eliminar para todos durante 24 horas' });
            m.borrado = true; m.texto = ''; m.imagen = ''; m.reacciones = []; m.replyTo = undefined; m.actualizado = new Date();
            await m.save();
            return res.json({ success: true, mensaje: chatSerializar(m.toObject()) });
        }
        await Mensaje.updateOne({ _id: m._id }, { $addToSet: { ocultoPara: yo } });
        await Mensaje.deleteOne({ _id: m._id, ocultoPara: { $all: [m.de, m.para] } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ success: false, error: 'Error interno' }); }
});

// POST /chat/mensaje/:id/reaccion { emoji } — una reacción por persona; repetirla la quita
app.post('/chat/mensaje/:id/reaccion', verificarToken, async (req, res) => {
    try {
        if (!chatEsId(req.params.id)) return res.status(400).json({ success: false, error: 'ID inválido' });
        const e = String(req.body.emoji || '');
        if (!CHAT_REACCIONES.includes(e)) return res.status(400).json({ success: false, error: 'Reacción no permitida' });
        const yo = req.usuario;
        const m = await Mensaje.findById(req.params.id);
        if (!m || (m.de !== yo && m.para !== yo) || (m.ocultoPara || []).includes(yo)) return res.status(404).json({ success: false, error: 'Mensaje no encontrado' });
        if (m.borrado) return res.status(400).json({ success: false, error: 'El mensaje fue eliminado' });
        const previa = (m.reacciones || []).find(r => r.u === yo);
        m.reacciones = (m.reacciones || []).filter(r => r.u !== yo);
        if (!previa || previa.e !== e) m.reacciones.push({ u: yo, e });
        m.actualizado = new Date();
        await m.save();
        res.json({ success: true, mensaje: chatSerializar(m.toObject()) });
    } catch (err) { res.status(500).json({ success: false, error: 'Error interno' }); }
});

// POST /chat/mensaje/:id/reportar { motivo } — reportar un mensaje recibido
// menores/zoofilia/abuso/gore → incidente de cero tolerancia con la evidencia (aunque luego lo borren) y aviso al admin
app.post('/chat/mensaje/:id/reportar', verificarToken, async (req, res) => {
    try {
        if (!chatEsId(req.params.id)) return res.status(400).json({ success: false, error: 'ID inválido' });
        if (!(await Limites.permitir(`chat-report:${req.usuario}`, [[Limites.HORA, 20]]))) return res.status(429).json({ success: false, error: 'Ya enviaste muchos reportes. Gracias, los estamos revisando.' });
        const m = await Mensaje.findById(req.params.id).lean();
        if (!m || m.para !== req.usuario) return res.status(404).json({ success: false, error: 'Mensaje no encontrado' });
        const motivo = String(req.body.motivo || 'otro');
        if (CeroTolerancia.MOTIVO[motivo]) {
            CeroTolerancia.incidente({ usuario: m.de, categoria: motivo, motivo: `Reportado por @${req.usuario}: ${CeroTolerancia.MOTIVO[motivo]}`, fuente: 'reporte de usuario', donde: `chat privado con @${req.usuario}`, ref: String(m._id), texto: m.texto, imagen: m.imagen });
            if (m.imagen) CeroTolerancia.vigilarImagen({ imagen: m.imagen, usuario: m.de, donde: 'chat privado (reportado)', ref: String(m._id), texto: m.texto,
                ocultar: () => Mensaje.updateOne({ _id: m._id }, { $set: { borrado: true, texto: '', imagen: '', actualizado: new Date() } }) });
        } else {
            Moderacion.registrar({ tipo: 'chat', usuario: m.de, categoria: ['sexual', 'odio', 'acoso', 'spam', 'estafa'].includes(motivo) ? motivo : 'otro', motivo: `Reporte de @${req.usuario} en chat privado`, fuente: 'reporte', texto: m.texto, ref: String(m._id), accion: 'reportado' });
        }
        res.json({ success: true, mensaje: 'Gracias. El reporte llegó al equipo de UpGames.' });
    } catch (err) { res.status(500).json({ success: false, error: 'No se pudo reportar' }); }
});

// DELETE /chat/conversacion/:otro — vaciar el chat SOLO para mí
// (antes borraba los mensajes también para la otra persona)
app.delete('/chat/conversacion/:otroUsuario', verificarToken, async (req, res) => {
    try {
        const yo = req.usuario, otro = String(req.params.otroUsuario || '').toLowerCase();
        const conv = { $or: [{ de: yo, para: otro }, { de: otro, para: yo }] };
        await Mensaje.updateMany(conv, { $addToSet: { ocultoPara: yo } });
        await Mensaje.deleteMany({ ...conv, ocultoPara: { $all: [yo, otro] } });
        res.json({ success: true });
    } catch (err) {
        logger.error(`Error borrando conversación: ${err.message}`);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});

// POST / DELETE /chat/bloqueo/:otro — bloquear o desbloquear a un usuario
app.post('/chat/bloqueo/:otroUsuario', verificarToken, async (req, res) => {
    try {
        const otro = String(req.params.otroUsuario || '').toLowerCase();
        if (otro === req.usuario) return res.status(400).json({ success: false, error: 'No puedes bloquearte a ti mismo' });
        if (!(await Usuario.exists({ usuario: otro }))) return res.status(404).json({ success: false, error: 'Ese usuario no existe' });
        await Usuario.updateOne({ usuario: req.usuario }, { $addToSet: { bloqueados: otro } });
        res.json({ success: true, bloqueado: true });
    } catch (err) { res.status(500).json({ success: false, error: 'Error interno' }); }
});
app.delete('/chat/bloqueo/:otroUsuario', verificarToken, async (req, res) => {
    try {
        await Usuario.updateOne({ usuario: req.usuario }, { $pull: { bloqueados: String(req.params.otroUsuario || '').toLowerCase() } });
        res.json({ success: true, bloqueado: false });
    } catch (err) { res.status(500).json({ success: false, error: 'Error interno' }); }
});

app.get('/chat/no-leidos', verificarToken, async (req, res) => {
    try {
        const total = await Mensaje.countDocuments({ para: req.usuario, leido: false, ocultoPara: { $ne: req.usuario } });
        res.json({ success: true, noLeidos: total });
    } catch (err) { res.status(500).json({ success: false, error: 'Error interno' }); }
});

app.get('/usuarios/descubrir', verificarToken, async (req, res) => {
    try {
        const me = req.usuario;
        const limite = Math.min(parseInt(req.query.limite) || 10, 30);
        const usuario = await Usuario.findOne({ usuario: me }).select('siguiendo listaSeguidores').lean();
        if (!usuario) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
        const siguiendo = usuario.siguiendo || [];
        const seguidores = usuario.listaSeguidores || [];
        const mutuos = siguiendo.filter(u => seguidores.includes(u));
        let extras = [];
        if (mutuos.length < limite) {
            extras = await Usuario.find({ usuario: { $ne: me, $nin: siguiendo } }).select('usuario avatar listaSeguidores isVerificado verificadoNivel').sort({ 'listaSeguidores.length': -1 }).limit(limite - mutuos.length).lean();
        }
        const mutuosData = await Usuario.find({ usuario: { $in: mutuos } }).select('usuario avatar listaSeguidores isVerificado verificadoNivel').limit(limite).lean();
        const todos = [
            ...mutuosData.map(u => ({ usuario: u.usuario, foto: u.avatar || '', avatar: u.avatar || '', verificadoNivel: u.verificadoNivel || 0, mutuo: true, seguidores: u.listaSeguidores?.length || 0 })),
            ...extras.map(u => ({ usuario: u.usuario, foto: u.avatar || '', avatar: u.avatar || '', verificadoNivel: u.verificadoNivel || 0, mutuo: false, seguidores: u.listaSeguidores?.length || 0 }))
        ].slice(0, limite);
        res.json({ success: true, usuarios: todos });
    } catch (err) {
        logger.error(`Error en descubrir: ${err.message}`);
        res.status(500).json({ success: false, error: 'Error interno' });
    }
});

// ── FIX: Búsqueda de usuarios para el chat ──────────────────────────────────
app.get('/usuarios/buscar', verificarToken, async (req, res) => {
    try {
        const q  = String(req.query.q || '').trim().slice(0, 40);
        const me = req.usuario;
        if (!q || q.length < 2) return res.json({ success: true, usuarios: [] });
        // Escapar: el texto del usuario iba directo a $regex (patrones costosos / inyección)
        const qSafe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const usuarios = await Usuario
            .find({ usuario: { $regex: qSafe, $options: 'i', $ne: me } })
            .select('usuario avatar isVerificado verificadoNivel listaSeguidores siguiendo ultimoLogin')
            .limit(15)
            .lean();
        res.json({
            success: true,
            usuarios: usuarios.map(u => ({
                usuario:         u.usuario,
                foto:            u.avatar || '',   // (antes leía "foto", campo que no existe)
                avatar:          u.avatar || '',
                // Relación conmigo: para mostrar "Mensaje" solo si se siguen mutuamente
                yoSigo:          (u.listaSeguidores || []).includes(me),
                meSigue:         (u.siguiendo || []).includes(me),
                isVerificado:    u.isVerificado,
                verificadoNivel: u.verificadoNivel,
                seguidores:      (u.listaSeguidores || []).length,
                ultimoLogin:     u.ultimoLogin || null
            }))
        });
    } catch (err) {
        logger.error(`Error buscando usuarios: ${err.message}`);
        res.status(500).json({ success: false, error: 'Error al buscar usuarios' });
    }
});

app.post('/chat/imagen', verificarToken, async (req, res) => {
    try {
        const { imagen } = req.body;
        if (!imagen) return res.status(400).json({ success: false, error: 'Imagen requerida' });
        if (imagen.length > 5 * 1024 * 1024) return res.status(400).json({ success: false, error: 'Imagen demasiado grande (máx 5MB)' });
        if (typeof imagen !== 'string' || !/^data:image\/(png|jpe?g|webp|gif|heic|heif);base64,/i.test(imagen)) return res.status(400).json({ success: false, error: 'Formato de imagen no válido' });
        res.json({ success: true, url: await imagenes.subir(imagen, { carpeta: 'chat_images', ancho: 1080, alto: 1080 }) });
    } catch (err) {
        logger.error(`Error subiendo imagen de chat: ${err.message}`);
        res.status(500).json({ success: false, error: 'Error al subir imagen' });
    }
});
};
