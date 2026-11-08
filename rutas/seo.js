/**
 * SEO: sitemap y datos de páginas estáticas
 *
 * Sitemap, datos para /p/, /u/ y /j/ (scripts/generar-paginas.js) y aviso a GitHub para generarlas al publicar.
 * Extraído de index.js: recibe sus dependencias explícitas (ver la llamada en index.js).
 */
module.exports = function seo({ Juego, Seo, Usuario, app, cacheado, gameDetector, logger, memCache }) {
const SITIO = 'https://upgames.games/public';
const xmlEsc = v => String(v).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
app.get('/seo/sitemap.xml', async (req, res) => {
    try {
        const xml = await cacheado('seo:sitemap', 900, async () => {
            const items = await Juego.find({ status: 'aprobado', linkStatus: { $in: ['online', 'revision'] } })
                .select('_id usuario title updatedAt createdAt').sort({ createdAt: -1 }).limit(40000).lean();
            const hace36h = new Date(Date.now() - 3 * 3600e3);   // las páginas /p/ se generan cada hora (y al publicar)
            const autores = new Map();
            for (const j of items) { const f = j.updatedAt || j.createdAt; if (!autores.has(j.usuario) || f > autores.get(j.usuario)) autores.set(j.usuario, f); }
            const dia = f => (f ? new Date(f) : new Date()).toISOString().slice(0, 10);
            const url = (loc, lastmod, freq, prio) => `<url><loc>${xmlEsc(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}<changefreq>${freq}</changefreq><priority>${prio}</priority></url>`;
            return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + [
                url(`${SITIO}/biblioteca.html`, dia(items[0]?.createdAt), 'hourly', '1.0'),
                url(`${SITIO}/live.html`, null, 'hourly', '0.8'),
                // Páginas por juego y por tema (public/j/…): mismas reglas que scripts/generar-paginas.js
                ...Seo.grupos(await datosPaginasSeo()).map(g => url(Seo.urlGrupo(g), dia(g.items.reduce((m, it) => (it.fecha > m ? it.fecha : m), '')), 'daily', '0.8')),
                // Publicaciones: su página estática (public/p/…), ya generada si tiene más de un día
                ...items.map(j => url(new Date(j.createdAt || 0) < hace36h ? Seo.urlPagina({ id: String(j._id), title: j.title }) : `${SITIO}/biblioteca.html?id=${j._id}`, dia(j.updatedAt || j.createdAt), 'weekly', '0.7')),
                // Perfiles: su página estática (public/u/…), generada en la misma acción diaria
                ...[...autores].map(([u, f]) => url(Seo.usuarioValido(u) ? Seo.urlPerfil(u) : `${SITIO}/perfil-publico.html?usuario=${encodeURIComponent(u)}`, dia(f), 'weekly', '0.5')),
                url(`${SITIO}/terminos_condiciones.html`, null, 'monthly', '0.2'),
                url(`${SITIO}/politica-privacidad.html`, null, 'monthly', '0.2'),
            ].join('\n') + '\n</urlset>\n';
        });
        res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send(xml);
    } catch (e) { logger.error(`[seo] sitemap: ${e.message}`); res.status(500).type('text/plain').send('error'); }
});

// Datos de las páginas estáticas (publicaciones, y de ahí las de juego/tema)
function datosPaginasSeo() {
    return cacheado('seo:paginas', 600, async () => {
        const items = await Juego.find({ status: 'aprobado', linkStatus: { $in: ['online', 'revision'] } })
            .select('_id title description image category usuario createdAt descargasEfectivas vistas likesCount extraData').sort({ createdAt: -1 }).limit(20000).lean();
        return items.map(j => {
            const ex = j.extraData || {};
            const juego = ex.detectedGame?.gameName || gameDetector.detectGame(j.title, j.description)?.gameName || '';
            return { id: String(j._id), title: j.title || '', description: String(j.description || '').slice(0, 3000), image: j.image || '', category: j.category || '',
                usuario: j.usuario, fecha: (j.createdAt || new Date()).toISOString(), descargas: j.descargasEfectivas || 0, vistas: j.vistas || 0, likes: j.likesCount || 0,
                juego, plataforma: [ex.plataforma, ex.so].filter(Boolean).join(' ') };
        });
    });
}

// Páginas estáticas al momento: pide a GitHub que corra ya la acción del sitemap
// (.github/workflows/sitemap.yml). Agrupa las publicaciones de 10 minutos en una sola
// ejecución. Necesita GITHUB_DISPATCH_TOKEN (token con permiso "Actions: write" sobre el
// repositorio); sin él, la acción igual corre cada hora.
let _seoPronto = null;
function paginasSeoPronto() {
    const token = process.env.GITHUB_DISPATCH_TOKEN;
    if (!token || _seoPronto) return;
    _seoPronto = setTimeout(async () => {
        _seoPronto = null;
        memCache.invalidate('seo:*');
        try {
            const repo = process.env.GITHUB_REPO || 'UpgamesStudio/UpGames';
            const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/sitemap.yml/dispatches`, {
                method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'upgames-backend' },
                body: JSON.stringify({ ref: 'main' }),
            });
            if (!r.ok) logger.warn(`[seo] no se pudo pedir las páginas: ${r.status}`);
            else logger.info('[seo] páginas estáticas solicitadas');
        } catch (e) { logger.warn(`[seo] ${e.message}`); }
    }, 10 * 60000);
    _seoPronto.unref?.();
}

// Datos para las páginas estáticas por publicación (scripts/generar-paginas.js las escribe cada hora)
app.get('/seo/paginas.json', async (req, res) => {
    try {
        const data = await datosPaginasSeo();
        res.set('Cache-Control', 'public, max-age=600').json({ success: true, total: data.length, items: data });
    } catch (e) { logger.error(`[seo] paginas: ${e.message}`); res.status(500).json({ success: false }); }
});

// Datos para las páginas estáticas de perfiles (creadores con publicaciones aprobadas)
app.get('/seo/perfiles.json', async (req, res) => {
    try {
        const data = await cacheado('seo:perfiles', 3600, async () => {
            const grupos = await Juego.aggregate([
                { $match: { status: 'aprobado', linkStatus: { $in: ['online', 'revision'] } } },
                { $sort: { descargasEfectivas: -1 } },
                { $group: { _id: '$usuario', publicaciones: { $sum: 1 }, descargas: { $sum: '$descargasEfectivas' },
                    items: { $push: { id: { $toString: '$_id' }, title: '$title', image: '$image' } } } },
                { $project: { publicaciones: 1, descargas: 1, items: { $slice: ['$items', 12] } } },
                { $limit: 5000 },
            ]);
            const us = await Usuario.find({ usuario: { $in: grupos.map(g => g._id) } }).select('usuario bio avatar banner listaSeguidores suspendido').lean();
            const m = new Map(us.map(u => [u.usuario, u]));
            return grupos.filter(g => m.has(g._id) && !m.get(g._id).suspendido).map(g => { const u = m.get(g._id);
                return { usuario: u.usuario, bio: String(u.bio || '').slice(0, 600), avatar: u.avatar || '', banner: u.banner || '', seguidores: (u.listaSeguidores || []).length,
                    publicaciones: g.publicaciones, descargas: g.descargas || 0, items: g.items }; });
        });
        res.set('Cache-Control', 'public, max-age=3600').json({ success: true, total: data.length, perfiles: data });
    } catch (e) { logger.error(`[seo] perfiles: ${e.message}`); res.status(500).json({ success: false }); }
});

    return { paginasSeoPronto };
};
