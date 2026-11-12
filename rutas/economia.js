/**
 * Economía: visualizaciones de publicidad, saldo, referidos y retiros
 *
 * Ticket y validación de la página puente (pago por visualizaciones de publicidad: el campo descargasEfectivas las cuenta), vistas, referidos, saldo, solicitud de retiro y estadísticas del creador.
 * Extraído de index.js: recibe sus dependencias explícitas (ver la llamada en index.js).
 */
module.exports = function economia({ AUTHOR_PERCENTAGE, CPM_VALUE, DescargaIP, EMAIL_NORMALIZE_OPTS, JWT_SECRET, Juego, Limites, MAX_DOWNLOADS_PER_IP_PER_DAY, MIN_WITHDRAWAL, Moderacion, Pago, Referidos, StatsItems, Usuario, app, body, calcularScoreRecomendacion, crearNotif, fraudDetector, gamification, logger, mongoose, recommendations, usuarioOpcional, validationResult, verificarAdmin, verificarToken }) {
// Creadas en index.js después de registrar este módulo: llegan con vincularTarde()
let cobros, live;
const TicketPuente = require('../modulos/ticketPuente');
app.post('/economia/ticket', [body('juegoId').isMongoId()], async (req, res) => {
    if (!validationResult(req).isEmpty()) return res.status(400).json({ success: false, error: 'ID inválido' });
    if (!(await Limites.permitir(`ticket:${req.ip}`, [[Limites.MIN, 20]]))) return res.status(429).json({ success: false, error: 'Demasiadas peticiones' });
    res.json({ success: true, ...TicketPuente.emitir(JWT_SECRET, req.body.juegoId, req.ip) });
});

app.post('/economia/validar-descarga', [body('juegoId').isMongoId()], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, error: "ID de juego inválido", details: errors.array() });

        const { juegoId, tieneAdBlocker } = req.body;
        const ip = req.ip;

        logger.info(`Validación de descarga - Juego: ${juegoId}, IP: ${ip}, AdBlocker: ${tieneAdBlocker ? '⚠️ SÍ' : '✅ NO'}`);

        const juego = await Juego.findById(juegoId);
        if (!juego) return res.status(404).json({ success: false, error: "Juego no encontrado" });
        if (juego.status !== 'aprobado') return res.status(403).json({ success: false, error: "El juego no está aprobado para descargas" });

        const tk = TicketPuente.verificar(JWT_SECRET, req.body.ticket, juegoId, ip);
        if (!tk.ok) {
            if (tk.motivo === 'pronto') return res.status(425).json({ success: false, esperaRestante: tk.esperaRestante, error: `Espera ${tk.esperaRestante} s más` });
            if (tk.motivo !== 'falta' || TicketPuente.obligatorio()) return res.status(428).json({ success: false, renovarTicket: true, error: 'Recarga la página para obtener el enlace' });
            // Transición: puente viejo sin ticket → enlace sí, pero la descarga no cuenta
            logger.warn(`[puente] validar-descarga sin ticket — Juego: ${juegoId}, IP: ${ip}`);
            return res.json({ success: true, descargaContada: false, sinTicket: true, link: juego.link, mensaje: 'Descarga permitida (página antigua: no cuenta para el autor)' });
        }

        if (tieneAdBlocker === true) {
            logger.info(`Ad Blocker detectado — Juego: ${juegoId}, IP: ${ip}`);
            return res.json({ success: true, descargaContada: false, adBlockerDetectado: true, link: juego.link, mensaje: "Acceso permitido, pero con bloqueador de anuncios no hay visualización de publicidad y el autor no gana" });
        }

        let registroIP = await DescargaIP.findOne({ juegoId, ip });
        if (registroIP) {
            if (registroIP.contadorHoy >= MAX_DOWNLOADS_PER_IP_PER_DAY) {
                logger.warn(`Límite alcanzado - IP: ${ip}, Juego: ${juegoId}`);
                return res.json({ success: true, limiteAlcanzado: true, mensaje: "Has alcanzado el límite de descargas para hoy", link: juego.link });
            }
            registroIP.contadorHoy += 1;
            await registroIP.save();
        } else {
            await new DescargaIP({ juegoId, ip, contadorHoy: 1 }).save();
        }

        await Juego.findByIdAndUpdate(juegoId, { $inc: { descargasEfectivas: 1 } });
        juego.descargasEfectivas = (juego.descargasEfectivas || 0) + 1;

        // ⭐ Fire & forget — el like responde inmediatamente, score se actualiza en background
        calcularScoreRecomendacion(juegoId).catch(() => {});

        const autor = await Usuario.findOne({ usuario: juego.usuario });
        if (!autor) {
            logger.warn(`Autor no encontrado: ${juego.usuario}`);
            return res.json({ success: true, descargaContada: true, link: juego.link, mensaje: "Descarga válida" });
        }

        if (autor.listaNegraAdmin) {
            logger.warn(`Usuario en lista negra: @${autor.usuario}`);
            autor.descargasTotales = (autor.descargasTotales || 0) + 1;
            await autor.save();
            return res.json({ success: true, descargaContada: true, link: juego.link, descargasEfectivas: juego.descargasEfectivas, mensaje: "Descarga válida", warning: "Usuario bajo revisión - ganancia suspendida" });
        }

        autor.descargasTotales = (autor.descargasTotales || 0) + 1;

        const ADMIN_USERS = (process.env.ADMIN_USERS || '').split(',').map(u => u.trim()).filter(Boolean);

        let gananciaGenerada = 0;
        let shouldAnalyzeFraud = false;

        // Posible juego comercial completo: los anuncios se muestran igual, pero el creador no cobra
        // mientras el equipo lo revisa (UpGames no saca beneficio directo de ese enlace)
        if (juego.pagoPausado) {
            await autor.save();
            StatsItems.sumar(juegoId, juego.usuario, { d: 1, g: 0 });
            return res.json({ success: true, descargaContada: true, link: juego.link, descargasEfectivas: juego.descargasEfectivas, mensaje: 'Descarga válida', pagoPausado: true });
        }
        gananciaGenerada = (CPM_VALUE * AUTHOR_PERCENTAGE) / 1000;
        autor.saldo = (autor.saldo || 0) + gananciaGenerada;
        shouldAnalyzeFraud = !ADMIN_USERS.includes(autor.usuario);
        logger.info(`Ganancia generada - Autor: @${autor.usuario}, +$${gananciaGenerada.toFixed(4)} USD`);

        if (shouldAnalyzeFraud) {
            const fraudAnalysis = await fraudDetector.analyzeDownloadBehavior(autor.usuario, juegoId, ip, gananciaGenerada);
            if (fraudAnalysis.suspicious) {
                logger.warn(`COMPORTAMIENTO SOSPECHOSO - @${autor.usuario}:`);
                fraudAnalysis.reasons.forEach(reason => logger.warn(`  - ${reason}`));
                if (fraudAnalysis.autoFlag) {
                    const flagged = await fraudDetector.autoFlagUser(Usuario, autor.usuario, `Detección automática: ${fraudAnalysis.reasons.join(', ')}`);
                    if (flagged) {
                        autor.saldo -= gananciaGenerada;
                        gananciaGenerada = 0;
                        logger.warn(`Usuario auto-marcado y ganancia revertida: @${autor.usuario}`);
                    }
                }
            }
        }

        await autor.save();
        StatsItems.sumar(juegoId, juego.usuario, { d: 1, g: gananciaGenerada });   // panel "Rendimiento por publicación"

        // ── Hooks gamificación & recomendaciones (fire & forget) ──
        gamification.onDescarga(juego.usuario).catch(() => {});
        recommendations.invalidateItemCache(juegoId);

        // Hitos de descargas: avisa al autor (gamificación + notificación)
        if ([10, 50, 100, 500, 1000, 5000].includes(juego.descargasEfectivas)) {
            crearNotif({
                destinatario: juego.usuario, tipo: 'logro', emisor: 'UpGames',
                itemId: juegoId, itemTitle: juego.title, itemImage: juego.image || '',
                mensaje: `🎉 ¡"${juego.title}" alcanzó ${juego.descargasEfectivas} descargas!`
            });
        }
        if (juego.descargasEfectivas === 100 || juego.descargasEfectivas === 1000) {
            gamification.onItemViral(juego.usuario, juego.descargasEfectivas).catch(() => {});
        }

        logger.info(`Visualización de publicidad validada - Juego: ${juego.title}, Total: ${juego.descargasEfectivas}`);

        res.json({
            success: true, descargaContada: true, link: juego.link,
            descargasEfectivas: juego.descargasEfectivas, mensaje: "Descarga válida y contada",
            title: juego.title || '', category: juego.category || '', tags: juego.tags || [], usuario: juego.usuario || ''
        });
    } catch (error) {
        logger.error(`Error en validar-descarga: ${error.message}`);
        res.status(500).json({ success: false, error: "Error al validar descarga" });
    }
});

// Moderación automática: lo que NEXUS y las reglas quitaron (panel admin)
app.get('/admin/moderacion', verificarAdmin, async (req, res) => {
    try {
        const filtro = {};
        if (['comentario', 'chat', 'publicacion', 'live'].includes(req.query.tipo)) filtro.tipo = req.query.tipo;
        const [lista, resumen7, top] = await Promise.all([
            Moderacion.recientes(parseInt(req.query.limit, 10) || 150, filtro), Moderacion.resumen(7),
            Usuario.find({ strikesModeracion: { $gt: 0 } }).sort({ strikesModeracion: -1 }).limit(15).select('usuario strikesModeracion ultimoStrike listaNegraAdmin suspendido').lean(),
        ]);
        res.json({ success: true, lista, resumen: resumen7, reincidentes: top, ia: llmEstadoModeracion() });
    } catch (e) { logger.error(`admin/moderacion: ${e.message}`); res.status(500).json({ success: false, error: 'No se pudo cargar' }); }
});
const llmEstadoModeracion = () => ({ disponible: require('../modulos/nexus/llm').disponible() });

// Invita y gana: enlace, recompensas y quiénes se unieron
app.get('/referidos/mio', verificarToken, async (req, res) => {
    try { res.json({ success: true, ...(await Referidos.resumen(Usuario, req.usuario)) }); }
    catch (e) { logger.error(`referidos/mio: ${e.message}`); res.status(500).json({ success: false, error: 'No se pudo cargar' }); }
});

// Vista de una publicación (1 por persona y día) → estadísticas del creador
app.post('/items/:id/vista', async (req, res) => {
    try {
        const j = await Juego.findById(req.params.id).select('usuario status').lean();
        if (!j || j.status !== 'aprobado') return res.json({ success: true, contada: false });
        const yo = usuarioOpcional(req), quien = yo ? 'u:' + yo : 'ip:' + (req.ip || '');
        if (quien === 'u:' + j.usuario) return res.json({ success: true, contada: false });   // el autor no se cuenta a sí mismo
        res.json({ success: true, contada: await StatsItems.vista(String(j._id), j.usuario, quien) });
    } catch (e) { res.json({ success: true, contada: false }); }
});

// Rendimiento real de MIS publicaciones: vistas, descargas, apoyos y ganancias (últimos N días)
app.get('/economia/mis-estadisticas', verificarToken, async (req, res) => {
    try {
        const dias = [7, 30, 90].includes(parseInt(req.query.dias, 10)) ? parseInt(req.query.dias, 10) : 30;
        const [st, items] = await Promise.all([
            StatsItems.delAutor(req.usuario, dias),
            Juego.find({ usuario: req.usuario }).select('title category image status descargasEfectivas likesCount createdAt').sort({ descargasEfectivas: -1 }).limit(300).lean(),
        ]);
        const vacio = { v: 0, d: 0, a: 0, auc: 0, g: 0, serie: {} };
        const lista = items.map(j => {
            const x = st.items[String(j._id)] || vacio;
            return { id: String(j._id), title: j.title || '', category: j.category || '', image: j.image || '', status: j.status, totalDescargas: j.descargasEfectivas || 0, likes: j.likesCount || 0,
                vistas: x.v, descargas: x.d, apoyos: x.a, apoyosUC: x.auc, gananciaUsd: Math.round(x.g * 10000) / 10000, serie: st.dias.map(d => x.serie[d] || 0) };
        });
        const tot = lista.reduce((t, x) => ({ vistas: t.vistas + x.vistas, descargas: t.descargas + x.descargas, apoyos: t.apoyos + x.apoyos, gananciaUsd: t.gananciaUsd + x.gananciaUsd }), { vistas: 0, descargas: 0, apoyos: 0, gananciaUsd: 0 });
        tot.gananciaUsd = Math.round(tot.gananciaUsd * 10000) / 10000;
        tot.conversion = tot.vistas ? Math.round(tot.descargas / tot.vistas * 1000) / 10 : null;
        res.json({ success: true, dias, desde: st.desde, totales: tot, serie: st.serie, publicaciones: lista });
    } catch (e) {
        logger.error(`mis-estadisticas: ${e.message}`);
        res.status(500).json({ success: false, error: 'No se pudieron cargar tus estadísticas' });
    }
});

app.post('/economia/solicitar-pago', verificarToken, async (req, res) => {
    try {
        const usuario = await Usuario.findOne({ usuario: req.usuario });
        if (!usuario) return res.status(404).json({ success: false, error: "Usuario no encontrado" });
        if (!usuario.isVerificado || usuario.verificadoNivel < 1) return res.status(403).json({ success: false, error: "Debes ser verificado (nivel 1+) para solicitar pagos" });
        if (!usuario.emailVerificado) return res.status(403).json({ success: false, error: "Verifica tu email antes de retirar dinero (revisa tu correo o pide uno nuevo desde el aviso de la biblioteca)", code: 'EMAIL_NO_VERIFICADO' });
        if (usuario.saldo < MIN_WITHDRAWAL) return res.status(400).json({ success: false, error: `Necesitas al menos ${Math.round(MIN_WITHDRAWAL / 0.02)} UpCoins ganados (US$${MIN_WITHDRAWAL}) para retirar. Tienes ${Math.floor(usuario.saldo / 0.02)} UC retirables.` });
        const metodo = cobros.metodoDe(usuario);
        if (!metodo) return res.status(400).json({ success: false, error: "Configura primero dónde quieres recibir tu dinero (PayPal, Nequi, Daviplata, banco o Mercado Pago)" });
        const espera = cobros.esperaHasta(usuario);
        if (espera) return res.status(403).json({ success: false, error: `Cambiaste tu método de cobro hace poco. Por seguridad podrás retirar desde el ${espera.toLocaleString('es-CO')}.` });
        if (usuario.solicitudPagoPendiente) return res.status(400).json({ success: false, error: "Ya tienes una solicitud de pago pendiente" });

        const juegoElegible = await Juego.findOne({ usuario: usuario.usuario, category: { $ne: 'Video' }, descargasEfectivas: { $gt: 0 } }).select('_id').lean();
        if (!juegoElegible && !(await live.tieneIngresosLive(usuario.usuario))) return res.status(403).json({ success: false, error: "Aún no tienes ingresos por visualizaciones de publicidad ni por regalos en tus lives" });

        // Reclamo atómico de la marca: un doble clic creaba dos solicitudes por el mismo saldo
        const marcado = await Usuario.updateOne({ _id: usuario._id, solicitudPagoPendiente: { $ne: true } }, { $set: { solicitudPagoPendiente: true } });
        if (!marcado.modifiedCount) return res.status(400).json({ success: false, error: "Ya tienes una solicitud de pago pendiente" });
        const nuevoPago = new Pago({ usuario: usuario.usuario, monto: usuario.saldo, metodo: metodo.tipo, resumen: metodo.resumen, datosCobro: metodo.cifrado,
            paypalEmail: metodo.tipo === 'paypal' ? (usuario.paypalEmail || '') : '', estado: 'pendiente' });
        try { await nuevoPago.save(); }
        catch (e) { await Usuario.updateOne({ _id: usuario._id }, { $set: { solicitudPagoPendiente: false } }); throw e; }
        logger.info(`Solicitud de pago creada - @${usuario.usuario}, Monto: $${usuario.saldo.toFixed(2)}`);
        res.json({ success: true, mensaje: `Solicitud enviada. Recibirás el dinero en ${metodo.resumen} cuando el administrador la procese (24-72 h hábiles).`, solicitud: { monto: usuario.saldo, metodo: metodo.tipo, resumen: metodo.resumen, fecha: nuevoPago.fecha } });
    } catch (error) {
        logger.error(`Error en solicitar-pago: ${error.message}`);
        res.status(500).json({ success: false, error: "Error al procesar solicitud de pago" });
    }
});

app.get('/economia/mi-saldo', verificarToken, async (req, res) => {
    try {
        const usuario = await Usuario.findOne({ usuario: req.usuario })
            .select('saldo saldoRetenido monedas descargasTotales paypalEmail cobro isVerificado solicitudPagoPendiente verificadoNivel emailVerificado');
        if (!usuario) return res.status(404).json({ success: false, error: "Usuario no encontrado" });

        const [juegosElegibles, ingresosLive] = await Promise.all([
            Juego.countDocuments({ usuario: req.usuario, category: { $ne: 'Video' }, descargasEfectivas: { $gt: 0 } }),
            live.tieneIngresosLive(req.usuario),
        ]);
        const puedeRetirar = usuario.saldo >= MIN_WITHDRAWAL && usuario.isVerificado && usuario.verificadoNivel >= 1 && !!cobros.metodoDe(usuario) && !cobros.esperaHasta(usuario) && (juegosElegibles > 0 || ingresosLive) && !usuario.solicitudPagoPendiente && !!usuario.emailVerificado;

        // Retención: de dónde viene y cuándo se libera lo próximo (antes solo salía "en retención" sin explicar)
        const ret = (usuario.saldoRetenido || 0) > 0 ? await mongoose.connection.collection('live_transacciones').find({ destinatario: req.usuario, estado: 'retenida' })
            .project({ liberarEn: 1, creadorUsd: 1, regaloId: 1, tipo: 1 }).sort({ liberarEn: 1 }).limit(300).toArray().catch(() => []) : [];
        const origen = {}; for (const t of ret) { const k = t.tipo === 'acceso' ? 'acceso' : t.regaloId === 'apoyo' ? 'apoyo' : t.regaloId === 'superchat' ? 'superchat' : 'regalo'; origen[k] = Math.round(((origen[k] || 0) + (t.creadorUsd || 0) / 0.02) * 100) / 100; }
        const retencion = { dias: require('../modulos/live').RETENCION_DIAS, proxima: ret[0]?.liberarEn || null, proximaUC: ret[0] ? Math.round(ret[0].creadorUsd / 0.02 * 100) / 100 : 0, origen };
        res.json({ success: true, retencion, saldo: usuario.saldo, saldoRetenido: usuario.saldoRetenido || 0, monedas: usuario.monedas || 0, emailVerificado: !!usuario.emailVerificado, descargasTotales: usuario.descargasTotales, paypalEmail: usuario.paypalEmail || '', metodoCobro: (m => m ? { tipo: m.tipo, resumen: m.resumen } : null)(cobros.metodoDe(usuario)), upcoins: require('../modulos/upcoins').saldoUC(usuario), minRetiroUC: Math.round(MIN_WITHDRAWAL / require('../modulos/live').MONEDA_USD), esperaCobroHasta: cobros.esperaHasta(usuario), isVerificado: usuario.isVerificado, verificadoNivel: usuario.verificadoNivel, solicitudPagoPendiente: usuario.solicitudPagoPendiente, juegosElegibles, puedeRetirar, minRetiro: MIN_WITHDRAWAL, requisitos: { saldoMinimo: MIN_WITHDRAWAL, verificacionNecesaria: 1 } });
    } catch (error) {
        logger.error(`Error en mi-saldo: ${error.message}`);
        res.status(500).json({ success: false, error: "Error al obtener saldo" });
    }
});

app.put('/economia/actualizar-paypal', [verificarToken, body('paypalEmail').isEmail().normalizeEmail(EMAIL_NORMALIZE_OPTS)], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, error: "Email de PayPal inválido", details: errors.array() });
        const { paypalEmail } = req.body;
        await Usuario.updateOne({ usuario: req.usuario }, { $set: { paypalEmail: paypalEmail.toLowerCase() } });
        logger.info(`PayPal actualizado - @${req.usuario} → ${paypalEmail}`);
        res.json({ success: true, mensaje: "Email de PayPal actualizado correctamente", paypalEmail: paypalEmail.toLowerCase() });
    } catch (error) {
        logger.error(`Error en actualizar-paypal: ${error.message}`);
        res.status(500).json({ success: false, error: "Error al actualizar PayPal" });
    }
});

    return { vincularTarde(d) { ({ cobros, live } = d); } };
};
