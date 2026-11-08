/**
 * Tareas automáticas del servidor
 *
 * Jobs periódicos: limpieza, reportes, enlaces caídos, revisión diaria de enlaces, verificación de títulos comerciales, scores, usuarios inactivos.
 * Extraído de index.js: recibe sus dependencias explícitas (ver la llamada en index.js).
 */
module.exports = function tareas({ Comentario, Juego, Notificacion, Sospecha, Usuario, crearNotif, imagenes, logger, memCache, recalcularScoresUsuario, recalcularTodosLosScores, revisionIA, series }) {
function iniciarJobsAutomaticos() {
    // Aviso único "verifica tu email" a las cuentas que aún no lo hicieron (en lotes)
    async function avisarSinVerificar() {
        try {
            const pendientes = await Usuario.find({ emailVerificado: { $ne: true }, avisoVerifEnviado: { $ne: true }, suspendido: { $ne: true } }).select('usuario').limit(500).lean();
            if (!pendientes.length) return;
            await Notificacion.insertMany(pendientes.map(u => ({ destinatario: u.usuario, tipo: 'sistema', emisor: 'UpGames', itemTitle: 'Verifica tu email', mensaje: '📧 Confirma tu correo para proteger tu cuenta y poder retirar tus ganancias. Toca para reenviar el enlace.', leida: false, fecha: new Date() })), { ordered: false });
            await Usuario.updateMany({ usuario: { $in: pendientes.map(u => u.usuario) } }, { $set: { avisoVerifEnviado: true } });
            logger.info(`[verificación] Aviso enviado a ${pendientes.length} cuenta(s) sin email verificado`);
        } catch (e) { logger.warn(`[verificación] avisarSinVerificar: ${e.message}`); }
    }
    setTimeout(avisarSinVerificar, 90000).unref();
    setInterval(avisarSinVerificar, 6 * 60 * 60000).unref();

    // Portadas externas → Cloudinary (poco a poco: 15 cada 20 min, primero al minuto de arrancar)
    const migrar = () => imagenes.migrarPortadas(Juego).catch(e => logger.warn(`[imagenes] migración: ${e.message}`));
    setTimeout(migrar, 60000).unref();
    setInterval(migrar, 20 * 60000).unref();


    // JOB 2: Limpiar comentarios vacíos y duplicados (cada 24h)
    async function limpiarComentarios() {
        try {
            const vacios = await Comentario.deleteMany({ $or: [{ texto: { $exists: false } }, { texto: null }, { texto: '' }, { texto: /^\s+$/ }] });
            const duplicados = await Comentario.aggregate([{ $group: { _id: { usuario: '$usuario', itemId: '$itemId', texto: '$texto' }, ids: { $push: '$_id' }, count: { $sum: 1 } } }, { $match: { count: { $gt: 1 } } }]);
            let eliminadosDuplicados = 0;
            for (const grupo of duplicados) {
                await Comentario.deleteMany({ _id: { $in: grupo.ids.slice(1) } });
                eliminadosDuplicados += grupo.ids.length - 1;
            }
            if (vacios.deletedCount > 0 || eliminadosDuplicados > 0) logger.info(`JOB 2 Comentarios: ${vacios.deletedCount} vacíos + ${eliminadosDuplicados} duplicados eliminados`);
            else logger.info(`JOB 2 Comentarios: sin basura encontrada`);
        } catch (err) { logger.error(`JOB 2 Error: ${err.message}`); }
    }
    limpiarComentarios();
    setInterval(limpiarComentarios, 24 * 60 * 60 * 1000);
    logger.info('JOB 2: Limpieza de comentarios activa (cada 24h)');

    // JOB 3: Resetear reportes online +48h (cada 12h)
    async function resetearReportesOnline() {
        try {
            const hace48h = new Date(Date.now() - 48 * 60 * 60 * 1000);
            const resultado = await Juego.updateMany({ linkStatus: 'online', reportes: { $gt: 0 }, updatedAt: { $lte: hace48h } }, { $set: { reportes: 0 } });
            if (resultado.modifiedCount > 0) logger.info(`JOB 3 Reportes: ${resultado.modifiedCount} juegos reseteados`);
        } catch (err) { logger.error(`JOB 3 Error: ${err.message}`); }
    }
    setInterval(resetearReportesOnline, 12 * 60 * 60 * 1000);
    logger.info('JOB 3: Reset de reportes activo (cada 12h)');

    // JOB 4: Auto-marcar revisión→caído +2 días (cada 12h)
    async function autoMarcarRevisionCaido() {
        try {
            const hace2dias = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
            const resultado = await Juego.updateMany({ status: 'aprobado', linkStatus: 'revision', updatedAt: { $lte: hace2dias } }, { $set: { linkStatus: 'caido' } });
            if (resultado.modifiedCount > 0) logger.info(`JOB 4: ${resultado.modifiedCount} items marcados caídos`);
        } catch (err) { logger.error(`JOB 4 Error: ${err.message}`); }
    }
    autoMarcarRevisionCaido();
    setInterval(autoMarcarRevisionCaido, 12 * 60 * 60 * 1000);
    logger.info('JOB 4: Auto-marcado revisión→caído activo (cada 12h)');

    // JOB 5: Auto-marcar caídos por reportes (cada 6h)
    async function autoMarcarCaidos() {
        try {
            const hace72h = new Date(Date.now() - 72 * 60 * 60 * 1000);
            const resultado = await Juego.updateMany({ linkStatus: 'revision', reportes: { $gte: 10 }, updatedAt: { $lte: hace72h } }, { $set: { linkStatus: 'caido' } });
            if (resultado.modifiedCount > 0) logger.info(`JOB 5 Links: ${resultado.modifiedCount} links auto-marcados caídos`);
        } catch (err) { logger.error(`JOB 5 Error: ${err.message}`); }
    }
    setInterval(autoMarcarCaidos, 6 * 60 * 60 * 1000);
    logger.info('JOB 5: Auto-marcado de links caídos activo (cada 6h)');

    // JOB 5b: Revisión diaria de enlaces. Comprueba los enlaces publicados (los más antiguos
    // sin revisar primero) y avisa al creador ANTES de que los usuarios lo reporten.
    // 1.ª vez muerto → aviso para que lo cambie; sigue muerto al día siguiente → "caído".
    // Ante la duda (anti-bots, MEGA/GoFile con JavaScript) no se toca nada.
    async function revisarEnlacesDiario() {
        const LOTE = Math.max(20, Number(process.env.ENLACES_LOTE) || 300);
        let vivos = 0, muertos = 0, caidos = 0, dudas = 0;
        try {
            const items = await Juego.find({ status: 'aprobado', linkStatus: 'online', category: { $ne: 'Video' } })
                .select('_id title link usuario image enlaceMuertoDesde').sort({ enlaceRevisado: 1, createdAt: 1 }).limit(LOTE).lean();
            const cola = [...items];
            const trabajador = async () => {
                for (let it; (it = cola.shift());) {
                    let estado = 'no_verificable';
                    try { estado = await revisionIA.estadoEnlace(it.link); } catch (_) {}
                    const set = { enlaceRevisado: new Date() }, unset = {};
                    const titulo = String(it.title || '').replace(/[<>&"']/g, '').slice(0, 80);
                    if (estado === 'vivo') { vivos++; if (it.enlaceMuertoDesde) unset.enlaceMuertoDesde = 1; }
                    else if (estado === 'muerto') {
                        if (!it.enlaceMuertoDesde) {
                            muertos++; set.enlaceMuertoDesde = new Date();
                            crearNotif({ destinatario: it.usuario, tipo: 'sistema', emisor: 'UpGames', itemId: String(it._id), itemTitle: 'Enlace', itemImage: it.image || '',
                                mensaje: `⚠️ El enlace de “${titulo}” parece caído. Cámbialo hoy desde tu perfil para no perder descargas: mañana lo volvemos a revisar.` });
                        } else if (Date.now() - new Date(it.enlaceMuertoDesde) > 20 * 3600e3) {
                            caidos++; set.linkStatus = 'caido';
                            crearNotif({ destinatario: it.usuario, tipo: 'sistema', emisor: 'UpGames', itemId: String(it._id), itemTitle: 'Enlace', itemImage: it.image || '',
                                mensaje: `❌ “${titulo}” quedó marcado como caído porque su enlace sigue sin funcionar. Pega uno nuevo y vuelve a estar disponible.` });
                        }
                    } else dudas++;
                    await Juego.updateOne({ _id: it._id }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) }, { timestamps: false }).catch(() => {});
                    await new Promise(r => setTimeout(r, 400));   // sin saturar a los sitios de descarga
                }
            };
            await Promise.all([trabajador(), trabajador(), trabajador()]);
            logger.info(`JOB 5b Enlaces: ${items.length} revisados · ${vivos} vivos · ${muertos} avisados · ${caidos} caídos · ${dudas} sin verificar`);
        } catch (err) { logger.error(`JOB 5b Error: ${err.message}`); }
    }
    // JOB 5c: Verificación de títulos comerciales en lo ya publicado (modulos/sospecha.js).
    // Al arrancar y cada día: las publicaciones que parecen un juego comercial completo pasan a
    // "en verificación" (sin pagos, visibles y con anuncios). Lo que el equipo ya revisó no se toca.
    // Un aviso por creador con la lista de sus publicaciones afectadas.
    async function verificarComercialesExistentes() {
        try {
            const items = await Juego.find({ status: 'aprobado', category: { $ne: 'Video' }, pagoPausado: { $ne: true }, 'sospecha.revision': { $exists: false } })
                .select('_id title category serie usuario image').lean();
            const porAutor = new Map();
            for (const it of items) {
                const sN = Sospecha.evaluar(it);
                if (!sN) continue;
                await Juego.updateOne({ _id: it._id }, { $set: { pagoPausado: true, sospecha: { ...sN, desde: new Date(), titulo: it.title, retroactiva: true } } }, { timestamps: false });
                if (!porAutor.has(it.usuario)) porAutor.set(it.usuario, []);
                porAutor.get(it.usuario).push({ it, juego: sN.juego });
            }
            for (const [usuario, l] of porAutor) {
                const lista = l.slice(0, 5).map(x => `"${String(x.it.title).slice(0, 40)}"`).join(', ') + (l.length > 5 ? ` y ${l.length - 5} más` : '');
                crearNotif({ destinatario: usuario, tipo: 'sistema', emisor: 'UpGames', itemId: String(l[0].it._id), itemTitle: 'Revisión', itemImage: l[0].it.image || '',
                    mensaje: l.length === 1 ? Sospecha.mensajeCreador(l[0].it.title, l[0].juego)
                        : `⚠️ ${l.length} publicaciones tuyas (${lista}) coinciden con juegos comerciales. Siguen visibles, pero no generarán UpCoins mientras el equipo verifica que no sean juegos completos. Si son mods o configuraciones, edita sus títulos para indicarlo.` });
            }
            const total = [...porAutor.values()].reduce((a, l) => a + l.length, 0);
            if (total) { memCache.invalidate('items:*'); logger.info(`JOB 5c: ${total} publicaciones pasaron a verificación (${porAutor.size} creadores)`); }
        } catch (err) { logger.error(`JOB 5c Error: ${err.message}`); }
    }
    setTimeout(verificarComercialesExistentes, 60000).unref();
    setInterval(verificarComercialesExistentes, 24 * 60 * 60 * 1000).unref();
    logger.info('JOB 5c: Verificación de títulos comerciales activa');

    if (process.env.REVISAR_ENLACES !== '0') {
        setTimeout(revisarEnlacesDiario, 15 * 60000).unref();
        setInterval(revisarEnlacesDiario, 24 * 60 * 60 * 1000).unref();
        logger.info('JOB 5b: Revisión diaria de enlaces activa');
    }

    // JOB: agrupar en series las publicaciones existentes ("… parte 1", "… parte 2")
    async function backfillSeries() {
        try {
            const pendientes = await Juego.find({ serie: { $exists: false } }).select('_id title usuario').lean();
            if (!pendientes.length) return;
            const ops = pendientes.map(j => ({ updateOne: { filter: { _id: j._id }, update: { $set: { serie: series.serieDe(j.title, j.usuario) } }, timestamps: false } }));
            for (let i = 0; i < ops.length; i += 500) await Juego.bulkWrite(ops.slice(i, i + 500), { ordered: false });
            logger.info(`Series: ${pendientes.length} publicaciones revisadas, ${ops.filter(o => o.updateOne.update.$set.serie).length} son partes de una serie`);
        } catch (err) { logger.error(`Series backfill: ${err.message}`); }
    }
    backfillSeries();

    // JOB 6: Auto-verificación por seguidores (cada 6h)
    async function autoVerificarUsuarios() {
        try {
            const usuarios = await Usuario.find({}).select('usuario listaSeguidores verificadoNivel').lean();
            // Solo cuentan seguidores "reales": email verificado, 7+ días de antigüedad y fuera
            // de la lista negra. Antes 100 cuentas recién creadas que se seguían entre sí
            // desbloqueaban el nivel necesario para retirar dinero.
            const reales = new Set((await Usuario.find({
                emailVerificado: true, listaNegraAdmin: { $ne: true }, suspendido: { $ne: true },
                fecha: { $lte: new Date(Date.now() - 7 * 864e5) },
            }).select('usuario').lean()).map(u => u.usuario));
            const ops = [];
            const subieron = [];

            for (const user of usuarios) {
                const seg = (user.listaSeguidores || []).filter(f => reales.has(f)).length;
                let nivelMerecido = 0;
                if (seg >= 1000) nivelMerecido = 3;
                else if (seg >= 500)  nivelMerecido = 2;
                else if (seg >= 100)  nivelMerecido = 1;
                if (nivelMerecido > (user.verificadoNivel || 0)) {
                    ops.push({ updateOne: { filter: { usuario: user.usuario }, update: { $set: { verificadoNivel: nivelMerecido, isVerificado: nivelMerecido >= 1 } } } });
                    subieron.push(user.usuario);
                }
            }

            if (ops.length > 0) {
                await Usuario.bulkWrite(ops);
                // ⭐ Recalcular scores de los que subieron (bulkWrite en scoreHelpers)
                for (const nombreUsuario of subieron) {
                    await recalcularScoresUsuario(nombreUsuario);
                }
                logger.info(`JOB 6 Verificación: ${subieron.length} usuarios subieron de nivel`);
            } else {
                logger.info(`JOB 6 Verificación: todos los niveles al día`);
            }
        } catch (err) { logger.error(`JOB 6 Error: ${err.message}`); }
    }
    autoVerificarUsuarios();
    setInterval(autoVerificarUsuarios, 6 * 60 * 60 * 1000);
    logger.info('JOB 6: Auto-verificación por seguidores activa (cada 6h)');

    // JOB 7: Recalcular TODOS los scores (cada 12h)
    // ⭐ OPTIMIZADO: 2 queries + 1 bulkWrite sin importar cuántos juegos (era N*2 queries)
    async function recalcularTodosLosScoresJob() {
        try {
            await recalcularTodosLosScores();
        } catch (err) { logger.error(`JOB 7 Error: ${err.message}`); }
    }
    // ⭐ NO correr al arrancar — solo cada 12h (evita 2000+ queries en boot)
    setInterval(recalcularTodosLosScoresJob, 12 * 60 * 60 * 1000);
    logger.info('JOB 7: Recalculación masiva de scores activa (cada 12h, NO al arrancar)');

    // JOB 8: Purgar usuarios inactivos por 2 años (cada 7 días)
    async function purgarUsuariosInactivos() {
        try {
            const hace2Anos = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000);
            const usuariosInactivos = await Usuario.find({
                verificadoNivel: { $lt: 3 }, saldo: { $lte: 0 }, solicitudPagoPendiente: { $ne: true }, listaNegraAdmin: { $ne: true },
                $or: [{ ultimoLogin: { $lte: hace2Anos } }, { ultimoLogin: { $exists: false }, fecha: { $lte: hace2Anos } }, { ultimoLogin: null, fecha: { $lte: hace2Anos } }]
            }).select('usuario').lean();
            if (usuariosInactivos.length === 0) { logger.info('JOB 8 Inactividad: sin usuarios que purgar'); return; }
            const nombres = usuariosInactivos.map(u => u.usuario);
            const [juegosEliminados, usuariosEliminados] = await Promise.all([
                Juego.deleteMany({ usuario: { $in: nombres } }),
                Usuario.deleteMany({ usuario: { $in: nombres } })
            ]);
            logger.info(`JOB 8 Inactividad: ${usuariosEliminados.deletedCount} cuentas y ${juegosEliminados.deletedCount} juegos eliminados`);
        } catch (err) { logger.error(`JOB 8 Error: ${err.message}`); }
    }
    setInterval(purgarUsuariosInactivos, 7 * 24 * 60 * 60 * 1000);
    logger.info('JOB 8: Purga de usuarios inactivos activa (cada 7 días)');

    logger.info('TODOS LOS JOBS AUTOMÁTICOS INICIADOS');
}

    return { iniciarJobsAutomaticos };
};
