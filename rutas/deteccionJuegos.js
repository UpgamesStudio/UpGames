/**
 * Detección de juegos e intención de compra
 *
 * Detección de juego por título, botón Comprar y publicaciones con juego detectado.
 * Extraído de index.js: recibe sus dependencias explícitas (ver la llamada en index.js).
 */
module.exports = function deteccionJuegos({ Juego, Limites, app, body, gameDetector, logger, param, validationResult }) {
app.post('/items/detect-game', [body('title').notEmpty().trim()], async (req, res) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()) return res.status(400).json({ detected: false });
    try {
        const { title = '', description = '' } = req.body;
        const det = gameDetector.detectGame(title, description);
        if(det) {
            return res.json({
                detected:     true,
                gameName:     det.gameName,
                gameKey:      det.gameKey,
                platform:     det.platform,
                purchaseLink: det.purchaseLink
            });
        }
        res.json({ detected: false });
    } catch(err) {
        logger.error(`[detect-game] ${err.message}`);
        res.status(500).json({ detected: false });
    }
});

// POST /items/buy-intent/:id — registra intención de compra (analytics, no bloqueante)
app.post('/items/buy-intent/:id', [param('id').isMongoId()], async (req, res) => {
    try {
        const errors = validationResult(req);
        if(!errors.isEmpty()) return res.status(400).json({ ok: false });
        if (!(await Limites.permitir(`buyIntent:${req.params.id}:${req.ip}`, [[Limites.DIA, 3]]))) return res.json({ ok: true });
        const { usuario, gameName, purchaseLink } = req.body || {};
        logger.info(`[BuyIntent] item=${req.params.id} | game="${gameName}" | user=${usuario||'anon'} | link=${purchaseLink}`);
        // Guardar en extraData del juego para analytics futuros
        await Juego.findByIdAndUpdate(req.params.id, {
            $inc: { 'extraData.buyIntentCount': 1 }
        }).catch(()=>{});
        res.json({ ok: true });
    } catch(err) {
        res.status(500).json({ ok: false });
    }
});

// GET /items/detected — lista todos los juegos con detección activa
app.get('/items/detected', async (req, res) => {
    try {
        const juegos = await Juego.find({
            status: 'aprobado',
            'extraData.detectedGame': { $exists: true }
        })
        .sort({ descargasEfectivas: -1 })
        .limit(100)
        .select('title usuario category extraData.detectedGame descargasEfectivas likesCount createdAt');
        res.json({ success: true, count: juegos.length, data: juegos });
    } catch(err) {
        logger.error(`[items/detected] ${err.message}`);
        res.status(500).json({ success: false });
    }
});
};
