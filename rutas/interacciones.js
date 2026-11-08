/**
 * Favoritos, me gusta y verificación de títulos comerciales
 *
 * Guardar en favoritos, me gusta (distinto de guardar), aviso en vivo de juegos comerciales y panel de verificación.
 * Extraído de index.js: recibe sus dependencias explícitas (ver la llamada en index.js).
 */
module.exports = function interacciones({ Extras, Favorito, Juego, Limites, Sospecha, app, body, calcularScoreRecomendacion, crearNotif, gamification, logger, mongoose, nexusMemoria, param, recommendations, validationResult, verificarAdmin, verificarToken }) {
app.get('/publicar/sospecha', async (req, res) => {
    if (!(await Limites.permitir(`sospecha:${req.ip}`, [[Limites.MIN, 40]]))) return res.status(429).json({ success: false });
    const titulo = String(req.query.titulo || '').slice(0, 120), categoria = String(req.query.categoria || '').slice(0, 40);
    const s = titulo.trim().length >= 3 ? Sospecha.evaluar({ title: titulo, category: categoria }) : null;
    res.set('Cache-Control', 'public, max-age=300').json({ success: true, sospecha: s, mensaje: s ? Sospecha.MENSAJE_PUBLICAR(s.juego) : null });
});

// ── Revisión de posibles juegos comerciales completos (panel admin) ──
app.get('/admin/items/sospechosas', verificarAdmin, async (req, res) => {
    try {
        const l = await Juego.find({ pagoPausado: true }).select('_id title usuario category image link sospecha descargasEfectivas createdAt').sort({ 'sospecha.desde': -1 }).limit(300).lean();
        res.json({ success: true, items: l });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});
// POST /admin/items/:id/sospecha { decision: 'ok' | 'mantener' }  ok = es un mod legítimo: vuelve a pagar
app.post('/admin/items/:id/sospecha', [verificarAdmin, param('id').isMongoId()], async (req, res) => {
    try {
        const d = req.body?.decision;
        if (!['ok', 'mantener'].includes(d)) return res.status(400).json({ success: false, error: 'decision: ok | mantener' });
        const it = await Juego.findById(req.params.id).select('title usuario image sospecha').lean();
        if (!it) return res.status(404).json({ success: false, error: 'No encontrada' });
        const sosp = { ...(it.sospecha || {}), revision: d, revisadoPor: req.admin?.usuario || req.admin?.email || 'admin', revisadoEn: new Date(), titulo: it.title };
        await Juego.updateOne({ _id: it._id }, { $set: { pagoPausado: d !== 'ok', sospecha: sosp } });
        crearNotif({ destinatario: it.usuario, tipo: 'sistema', emisor: 'UpGames', itemId: String(it._id), itemTitle: 'Revisión', itemImage: it.image || '',
            mensaje: d === 'ok' ? `✅ Revisamos "${String(it.title).slice(0, 70)}": todo en orden. Vuelve a generar UpCoins con cada descarga.`
                : `❌ Revisamos "${String(it.title).slice(0, 70)}" y parece un juego comercial completo: seguirá sin generar UpCoins. Si es un mod o configuración, edita el título y la descripción para dejarlo claro.` });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ── ME GUSTA ─────────────────────────────────────────────────────────
// Distinto de guardar: "me gusta" es una reacción rápida (doble toque en los videos);
// guardar (favoritos) es para volver a ello. Los dos pesan en el feed de Nexus.
const MeGusta = mongoose.model('MeGusta', new mongoose.Schema({
    usuario: { type: String, required: true },
    itemId:  { type: String, required: true },
    fecha:   { type: Date, default: Date.now },
}, { collection: 'megusta', versionKey: false }).index({ usuario: 1, itemId: 1 }, { unique: true }).index({ itemId: 1 }));

async function ponerMeGusta(usuario, itemId, quiere) {
    const item = await Juego.findById(itemId).select('usuario title image category tags').lean();
    if (!item) return null;
    if (quiere) {
        try { await MeGusta.create({ usuario, itemId }); }
        catch (e) { if (e.code !== 11000) throw e; return { megusta: true, item }; }   // ya estaba
        await Juego.updateOne({ _id: itemId }, { $inc: { meGustaCount: 1 } });
        nexusMemoria.aprender(usuario, 'like', { item }).catch(() => {});
        crearNotif({ destinatario: item.usuario, tipo: 'favorito', emisor: usuario, itemId, itemTitle: item.title, itemImage: item.image || '', mensaje: `❤️ A @${usuario} le gustó "${item.title}"` });
        return { megusta: true, item, nuevo: true };
    }
    const r = await MeGusta.deleteOne({ usuario, itemId });
    if (r.deletedCount) {
        await Juego.updateOne({ _id: itemId, meGustaCount: { $gt: 0 } }, { $inc: { meGustaCount: -1 } });
        nexusMemoria.aprender(usuario, 'unlike', { item }).catch(() => {});
    }
    return { megusta: false, item };
}

// POST /items/:id/megusta { megusta: true|false }  (sin cuerpo: alterna)
app.post('/items/:id/megusta', [verificarToken, param('id').isMongoId()], async (req, res) => {
    try {
        if (!validationResult(req).isEmpty()) return res.status(400).json({ success: false, error: 'Datos inválidos' });
        if (!(await Limites.permitir(`megusta:${req.usuario}`, [[Limites.MIN, 60], [Limites.DIA, 3000]]))) return res.status(429).json({ success: false, error: 'Vas muy rápido' });
        const itemId = req.params.id;
        const quiere = typeof req.body?.megusta === 'boolean' ? req.body.megusta : !(await MeGusta.exists({ usuario: req.usuario, itemId }));
        const r = await ponerMeGusta(req.usuario, itemId, quiere);
        if (!r) return res.status(404).json({ success: false, error: 'Publicación no encontrada' });
        const n = (await Juego.findById(itemId).select('meGustaCount').lean())?.meGustaCount || 0;
        res.json({ success: true, megusta: r.megusta, n });
    } catch (e) {
        logger.error(`[megusta] ${e.message}`);
        res.status(500).json({ success: false, error: 'No se pudo guardar tu me gusta' });
    }
});
// GET /megusta/mios → ids a los que el usuario dio me gusta (para pintar los corazones en cualquier dispositivo)
app.get('/megusta/mios', verificarToken, async (req, res) => {
    try {
        const l = await MeGusta.find({ usuario: req.usuario }).select('itemId -_id').sort({ fecha: -1 }).limit(2000).lean();
        res.json({ success: true, ids: l.map(x => x.itemId) });
    } catch (_) { res.status(500).json({ success: false, ids: [] }); }
});
// POST /megusta/sync { ids } → los me gusta que dio sin cuenta, al crearla o iniciar sesión
app.post('/megusta/sync', verificarToken, async (req, res) => {
    try {
        const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).filter(x => mongoose.Types.ObjectId.isValid(x)).slice(0, 100);
        let n = 0;
        for (const id of ids) { const r = await ponerMeGusta(req.usuario, String(id), true).catch(() => null); if (r?.nuevo) n++; }
        res.json({ success: true, agregados: n });
    } catch (_) { res.status(500).json({ success: false }); }
});

app.post('/favoritos/add', [verificarToken, body('itemId').isMongoId()], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, error: 'Datos inválidos' });
        const { itemId } = req.body;
        const existe = await Favorito.findOne({ usuario: req.usuario, itemId }).select('_id').lean();
        if (existe) return res.status(400).json({ success: false, error: 'Ya está en favoritos' });
        await new Favorito({ usuario: req.usuario, itemId }).save();
        // ⭐ Incrementar + recalcular en paralelo
        await Juego.findByIdAndUpdate(itemId, { $inc: { likesCount: 1 } });
        calcularScoreRecomendacion(itemId).catch(() => {}); // fire & forget
        gamification.onFavorito(req.usuario).catch(() => {});
        recommendations.invalidateUserCache(req.usuario);
        Extras.evento(req.usuario, 'favorito', String(itemId));   // misiones
        res.json({ success: true, ok: true });

        // Notificar al autor + registrar evento en Nexus (fire & forget, server-side)
        Juego.findById(itemId).select('usuario title image category tags').lean()
            .then(item => {
                if (!item) return;
                crearNotif({
                    destinatario: item.usuario, tipo: 'favorito', emisor: req.usuario,
                    itemId, itemTitle: item.title, itemImage: item.image || '',
                    mensaje: `@${req.usuario} guardó "${item.title}" en favoritos`
                });
                nexusMemoria.aprender(req.usuario, 'favorite', { item }).catch(() => {});
            })
            .catch(() => {});
    } catch (error) {
        logger.error(`Error en favoritos/add: ${error.message}`);
        res.status(500).json({ success: false, error: 'Error al guardar favorito' });
    }
});

app.delete('/favoritos/remove', [verificarToken, body('itemId').isMongoId()], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, error: 'Datos inválidos' });
        const { itemId } = req.body;
        await Favorito.deleteOne({ usuario: req.usuario, itemId });
        await Juego.findByIdAndUpdate(itemId, { $inc: { likesCount: -1 } });
        await Juego.updateOne({ _id: itemId, likesCount: { $lt: 0 } }, { $set: { likesCount: 0 } });
        calcularScoreRecomendacion(itemId).catch(() => {}); // fire & forget
        res.json({ success: true, ok: true });
    } catch (error) {
        logger.error(`Error en favoritos/remove: ${error.message}`);
        res.status(500).json({ success: false, error: "Error al eliminar favorito" });
    }
});

// ⭐ OPTIMIZADO: usa el índice de FavoritosSchema
app.get('/favoritos/:usuario', async (req, res) => {
    try {
        const favs = await Favorito.find({ usuario: req.params.usuario })
            .populate({ path: 'itemId', select: '_id title description image link category usuario status reportes linkStatus descargasEfectivas likesCount' })
            .lean();
        const items = favs.filter(f => f.itemId).map(fav => ({
            _id: fav.itemId._id, title: fav.itemId.title, description: fav.itemId.description,
            image: fav.itemId.image, link: fav.itemId.link, category: fav.itemId.category,
            usuario: fav.itemId.usuario, status: fav.itemId.status, reportes: fav.itemId.reportes,
            linkStatus: fav.itemId.linkStatus, descargasEfectivas: fav.itemId.descargasEfectivas,
            likesCount: fav.itemId.likesCount || 0
        }));
        res.json(items);
    } catch (error) { res.status(500).json([]); }
});
};
