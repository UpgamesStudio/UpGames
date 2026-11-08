/**
 * Búsqueda avanzada
 *
 * Autocompletado, búsqueda tolerante a errores (modulos/search.js) y búsquedas populares.
 * Extraído de index.js: recibe sus dependencias explícitas (ver la llamada en index.js).
 */
module.exports = function busqueda({ app, logger, nexusMemoria, searchModule, usuarioOpcional }) {
app.get('/search/autocomplete', async (req, res) => {
    try {
        const q     = (req.query.q || '').trim();
        const limit = Math.min(10, Math.max(1, parseInt(req.query.limit) || 6));
        if (q.length < 2) return res.json({ success: true, items: [], creadores: [], categorias: [] });
        const resultado = await searchModule.autocomplete(q, limit);
        res.json({ success: true, ...resultado });
    } catch (err) {
        logger.error(`[search/autocomplete] ${err.message}`);
        res.status(500).json({ success: false, error: 'Error en autocomplete' });
    }
});

app.get('/search/query', async (req, res) => {
    try {
        const q          = (req.query.q || '').trim();
        const categoria  = req.query.categoria  || null;
        const usuario    = req.query.usuario    || null;
        const orden      = req.query.orden      || 'relevancia';
        const page       = Math.max(1, parseInt(req.query.page)  || 1);
        const limit      = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        const minLikes   = parseInt(req.query.minLikes)   || 0;
        const minDescargas = parseInt(req.query.minDescargas) || 0;
        const desde      = req.query.desde || null;
        const hasta      = req.query.hasta || null;

        const resultado = await searchModule.buscar({ q, categoria, usuario, orden, page, limit, minLikes, minDescargas, desde, hasta, incluirFacets: req.query.facets === '1' });

        if (q.length >= 2) {
            searchModule.registrarBusqueda(q);
            const userId = usuarioOpcional(req);
            if (userId && categoria) nexusMemoria.aprender(userId, 'search', { categoria }).catch(() => {});
        }

        res.json({ success: true, ...resultado });
    } catch (err) {
        logger.error(`[search/query] ${err.message}`);
        res.status(500).json({ success: false, error: 'Error en búsqueda' });
    }
});

app.get('/search/populares', async (req, res) => {
    try {
        const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 10));
        res.json({ success: true, busquedas: searchModule.busquedasPopulares(limit) });
    } catch (err) {
        logger.error(`[search/populares] ${err.message}`);
        res.status(500).json({ success: false, error: 'Error' });
    }
});
};
