/**
 * Páginas estáticas por publicación (SEO).
 *
 * biblioteca.html?id=… arma el contenido en el navegador: Google tarda en verlo y a veces
 * no lo indexa. Cada día una acción de GitHub (.github/workflows/sitemap.yml) baja la
 * lista de /seo/paginas.json y escribe public/p/<slug>-<id>.html con el título, la imagen,
 * la descripción y los datos estructurados ya listos en el HTML. El botón lleva a la
 * publicación real dentro de UpGames.
 *
 * Lo usan el backend (URL en el sitemap) y scripts/generar-paginas.js (plantilla).
 */
'use strict';
const { filtrarPublicacion } = require('./textoPublico');   // títulos y descripciones sin palabras vetadas

const SITIO = 'https://upgames.games/public';
const esc = v => String(v ?? '').replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&#39;', '"': '&quot;' }[c]));

function slug(t) {
    return String(t || 'publicacion').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '') || 'publicacion';
}
const archivo = it => `${slug(it.title)}-${it.id}.html`;
const urlPagina = it => `${SITIO}/p/${archivo(it)}`;

const CAT = { Juego: 'Juego', Mod: 'Mod', Apps: 'App', Software: 'Software', Ajustes: 'Herramienta', Optimizacion: 'Optimización', Video: 'Video' };
const esImg = u => /^https:\/\//i.test(u || '') && !/\.(mp4|webm|mov|m4v|avi|3gp|3g2|mkv|ogv|mpe?g|wmv|flv)(\?|$)|\/video\/upload\//i.test(u);

// ── Tarjeta para compartir (WhatsApp, Facebook, X, TikTok): portada + título + descargas + marca ──
// La compone Cloudinary al vuelo sobre la portada (1200×630). Solo para portadas de Cloudinary.
const encTxt = t => encodeURIComponent(String(t).replace(/[\u{10000}-\u{10FFFF}]/gu, '').replace(/\s+/g, ' ').trim())
    .replace(/%2C/g, '%252C').replace(/%2F/g, '%252F').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29');
const recorta = (t, n) => { t = String(t || '').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };
function tarjeta(it) {
    it = filtrarPublicacion(it);
    const m = String(it.image || '').match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)((?:[^/]+\/)*?)(v\d+\/.+)$/);
    if (!m || !esImg(it.image)) return null;
    const esVideo = it.category === 'Video';
    const n = esVideo ? (it.vistas || 0) + (it.descargas || 0) : (it.descargas || 0);
    const linea2 = [n > 0 ? `${Number(n).toLocaleString('es-CO')} ${esVideo ? 'vistas' : 'descargas'}` : (CAT[it.category] || it.category || ''), it.usuario ? '@' + it.usuario : ''].filter(Boolean).join(' · ');
    const capas = [
        'c_fill,g_auto,w_1200,h_630', 'e_gradient_fade:40,y_-0.6,b_rgb:07080c',
        `l_text:Arial_60_bold:${encTxt(recorta(it.title, 64))},co_white,c_fit,w_1080`, 'fl_layer_apply,g_south_west,x_60,y_120',
        `l_text:Arial_32_bold:${encTxt(linea2)},co_rgb:32D583`, 'fl_layer_apply,g_south_west,x_60,y_62',
        'l_text:Arial_30_bold:UPGAMES,co_rgb:32D583,b_rgb:07080c,bo_14px_solid_rgb:07080c', 'fl_layer_apply,g_north_east,x_40,y_36',
        'q_auto:good,f_jpg',
    ];
    return m[1] + m[2] + capas.join('/') + '/' + m[3];
}

/** HTML completo de la página de una publicación. */
function pagina(it, grupo) {
    it = filtrarPublicacion(it);   // (el nombre del archivo/URL sigue saliendo del título guardado: no se rompen enlaces)
    const url = urlPagina(it), app = `${SITIO}/biblioteca.html?id=${it.id}`;
    const cat = CAT[it.category] || it.category || 'Contenido';
    const desc = String(it.description || `${cat} compartido por @${it.usuario} en UpGames.`).replace(/\s+/g, ' ').trim();
    const corta = desc.slice(0, 158) + (desc.length > 158 ? '…' : '');
    const img = tarjeta(it) || (esImg(it.image) ? it.image.replace('/upload/', '/upload/w_1200,h_630,c_fill,q_auto,f_jpg/') : `${SITIO}/og-cover.png`);
    const esVideo = it.category === 'Video';
    // Ficha informativa: UpGames indexa metadatos, no aloja archivos (el título no promete "Descargar")
    const titulo = `${it.title} — ${esVideo ? 'Video' : cat} en UpGames`;
    const vistas = (it.vistas || 0) + (esVideo ? it.descargas || 0 : 0);   // videos antiguos guardaban sus vistas en descargas
    const ld = esVideo ? {
        '@context': 'https://schema.org', '@type': 'VideoObject', name: it.title, description: corta, thumbnailUrl: [img], uploadDate: it.fecha,
        url, author: { '@type': 'Person', name: '@' + it.usuario },
        interactionStatistic: { '@type': 'InteractionCounter', interactionType: { '@type': 'WatchAction' }, userInteractionCount: vistas },
    } : {
        '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: it.title, description: corta, image: img, url,
        applicationCategory: ['Juego', 'Mod'].includes(it.category) ? 'GameApplication' : 'UtilitiesApplication',
        operatingSystem: 'Windows, Android', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, author: { '@type': 'Person', name: '@' + it.usuario }, datePublished: it.fecha,
    };
    const migas = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'UpGames', item: `${SITIO}/biblioteca.html` },
        { '@type': 'ListItem', position: 2, name: cat, item: `${SITIO}/biblioteca.html?cat=${encodeURIComponent(it.category || '')}` },
        { '@type': 'ListItem', position: 3, name: it.title, item: url }] };
    const json = o => JSON.stringify(o).replace(/</g, '\\u003c');
    return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(corta)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="${esVideo ? 'video.other' : 'website'}"><meta property="og:site_name" content="UpGames">
<meta property="og:title" content="${esc(it.title)}"><meta property="og:description" content="${esc(corta)}">
<meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(img)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(it.title)} en UpGames">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(it.title)}"><meta name="twitter:image" content="${esc(img)}">
<meta name="theme-color" content="#07080c"><link rel="icon" href="../icons/icon-96.png?v=2">
<script type="application/ld+json">${json(ld)}</script>
<script type="application/ld+json">${json(migas)}</script>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#07080c;color:#e8eaf0;line-height:1.55}
a{color:#32D583}.w{max-width:760px;margin:0 auto;padding:16px}.top{display:flex;align-items:center;justify-content:space-between;padding:6px 0 14px}
.logo{font-weight:900;letter-spacing:2px;font-size:1.2rem;text-decoration:none;color:#fff}.logo span{color:#32D583}
.hero{border-radius:20px;overflow:hidden;background:#11131a;border:1px solid rgba(255,255,255,.07)}.hero img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:#1a1d26}
.c{padding:18px}.cat{display:inline-block;padding:3px 10px;border-radius:99px;background:rgba(50,213,131,.12);color:#32D583;font-size:.75rem;font-weight:800}
h1{margin:10px 0 6px;font-size:1.6rem;line-height:1.25}.meta{color:#9aa1af;font-size:.88rem}.st{display:flex;gap:16px;margin:12px 0;color:#c9ced8;font-size:.9rem}
.btn{display:block;text-align:center;margin:16px 0 8px;padding:15px;border-radius:14px;background:linear-gradient(135deg,#32D583,#5AC8FA);color:#06210f;font-weight:900;text-decoration:none;font-size:1.05rem}
.desc{white-space:pre-line;color:#c9ced8}.pie{margin:26px 0 10px;color:#6c7180;font-size:.8rem;text-align:center}
</style></head>
<body><div class="w">
<div class="top"><a class="logo" href="../biblioteca.html"><span>UP</span>GAMES</a><a href="../biblioteca.html">Explorar</a></div>
<article class="hero">
${esImg(it.image) ? `<img src="${esc(it.image.replace('/upload/', '/upload/w_960,q_auto,f_auto/'))}" alt="${esc(it.title)}" width="960" height="540">` : ''}
<div class="c"><span class="cat">${esc(cat)}</span>
<h1>${esc(it.title)}</h1>
<div class="meta">Publicado por <a href="../perfil-publico.html?usuario=${encodeURIComponent(it.usuario)}">@${esc(it.usuario)}</a> · ${esc(new Date(it.fecha).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }))}</div>
<div class="st"><span>${esVideo ? `👁️ ${vistas.toLocaleString('es-CO')} vistas` : `⬇️ ${Number(it.descargas || 0).toLocaleString('es-CO')} descargas efectivas`}</span><span>❤️ ${Number(it.likes || 0).toLocaleString('es-CO')}</span></div>
<a class="btn" href="${esc(app)}">${esVideo ? '▶ Ver el video en UpGames' : 'Ver la ficha completa en UpGames'}</a>
<p class="desc">${esc(desc.slice(0, 3000))}</p>
${grupo ? `<p><a href="../j/${esc(grupo.slug)}.html">Ver más: ${esc(grupo.titulo)} →</a></p>` : ''}
</div></article>
<p class="pie">UpGames · descargas, videos, lives, red social e IA en un solo lugar · <a href="../terminos_condiciones.html">Términos</a></p>
</div></body></html>
`;
}

// ── Perfiles de creadores: public/u/<usuario>.html ───────────────
// perfil-publico.html arma todo en el navegador: WhatsApp, Facebook y Google veían
// "Perfil de Usuario — UpGames". Esta página trae nombre, bio, foto y sus publicaciones.
const usuarioValido = u => /^[a-z0-9_]{3,20}$/.test(String(u || ''));
const urlPerfil = u => `${SITIO}/u/${u}.html`;
const fmt = n => Number(n || 0).toLocaleString('es-CO');
function paginaPerfil(p) {
    const url = urlPerfil(p.usuario), app = `${SITIO}/perfil-publico.html?usuario=${encodeURIComponent(p.usuario)}`;
    const bio = String(p.bio || '').replace(/\s+/g, ' ').trim();
    const desc = (bio ? bio.slice(0, 120) + ' · ' : '') + `${fmt(p.publicaciones)} publicaciones y ${fmt(p.descargas)} descargas en UpGames. Juegos, mods y apps de @${p.usuario}.`;
    const corta = desc.slice(0, 158) + (desc.length > 158 ? '…' : '');
    const avatar = esImg(p.avatar) ? p.avatar.replace('/upload/', '/upload/w_400,h_400,c_fill,g_face,q_auto,f_jpg/') : '';
    const og = esImg(p.banner) ? p.banner.replace('/upload/', '/upload/w_1200,h_630,c_fill,q_auto,f_jpg/') : avatar || `${SITIO}/og-cover.png`;
    const ld = { '@context': 'https://schema.org', '@type': 'ProfilePage', url, mainEntity: { '@type': 'Person', name: '@' + p.usuario, alternateName: p.usuario, description: bio || undefined, image: avatar || undefined,
        interactionStatistic: [{ '@type': 'InteractionCounter', interactionType: 'https://schema.org/FollowAction', userInteractionCount: p.seguidores || 0 }] } };
    const json = o => JSON.stringify(o).replace(/</g, '\\u003c');
    const items = (p.items || []).slice(0, 12);
    return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>@${esc(p.usuario)} — Juegos, mods y apps | UpGames</title>
<meta name="description" content="${esc(corta)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="profile"><meta property="og:site_name" content="UpGames"><meta property="profile:username" content="${esc(p.usuario)}">
<meta property="og:title" content="@${esc(p.usuario)} en UpGames"><meta property="og:description" content="${esc(corta)}">
<meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(og)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="@${esc(p.usuario)} en UpGames"><meta name="twitter:image" content="${esc(og)}">
<meta name="theme-color" content="#07080c"><link rel="icon" href="../icons/icon-96.png?v=2">
<script type="application/ld+json">${json(ld)}</script>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#07080c;color:#e8eaf0;line-height:1.5}
a{color:#32D583}.w{max-width:760px;margin:0 auto;padding:16px}.top{display:flex;justify-content:space-between;padding:6px 0 14px}
.logo{font-weight:900;letter-spacing:2px;font-size:1.2rem;text-decoration:none;color:#fff}.logo span{color:#32D583}
.cv{aspect-ratio:3/1;border-radius:18px;background:#141821 center/cover;-webkit-mask-image:linear-gradient(#000 50%,transparent);mask-image:linear-gradient(#000 50%,transparent)}
.hd{display:flex;gap:14px;align-items:flex-end;margin-top:-46px;padding:0 12px}.av{width:92px;height:92px;border-radius:50%;border:4px solid #07080c;background:linear-gradient(135deg,#32D583,#5AC8FA);object-fit:cover}
h1{margin:12px 0 4px;font-size:1.4rem}.st{display:flex;gap:18px;color:#c9ced8;font-size:.9rem;margin:8px 0}.bio{white-space:pre-line;color:#c9ced8}
.btn{display:block;text-align:center;margin:16px 0;padding:14px;border-radius:14px;background:linear-gradient(135deg,#32D583,#5AC8FA);color:#06210f;font-weight:900;text-decoration:none}
.g{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}.g a{position:relative;aspect-ratio:1;background:#141821;border-radius:8px;overflow:hidden;color:#fff;text-decoration:none;font-size:.72rem}
.g img{width:100%;height:100%;object-fit:cover}.g span{position:absolute;inset:auto 0 0;padding:16px 6px 5px;background:linear-gradient(transparent,rgba(0,0,0,.8))}
.pie{margin:26px 0 10px;color:#6c7180;font-size:.8rem;text-align:center}
</style></head>
<body><div class="w">
<div class="top"><a class="logo" href="../biblioteca.html"><span>UP</span>GAMES</a><a href="../biblioteca.html">Explorar</a></div>
<div class="cv"${esImg(p.banner) ? ` style="background-image:url('${esc(p.banner.replace('/upload/', '/upload/w_1200,q_auto,f_auto/'))}')"` : ''}></div>
<div class="hd">${avatar ? `<img class="av" src="${esc(avatar)}" alt="@${esc(p.usuario)}" width="92" height="92">` : '<div class="av"></div>'}</div>
<h1>@${esc(p.usuario)}</h1>
<div class="st"><span><b>${fmt(p.publicaciones)}</b> publicaciones</span><span><b>${fmt(p.seguidores)}</b> seguidores</span><span><b>${fmt(p.descargas)}</b> descargas</span></div>
${bio ? `<p class="bio">${esc(bio.slice(0, 600))}</p>` : ''}
<a class="btn" href="${esc(app)}">Ver el perfil completo en UpGames</a>
${items.length ? `<div class="g">${items.map(it => `<a href="${esc(urlPagina(it))}">${esImg(it.image) ? `<img src="${esc(it.image.replace('/upload/', '/upload/w_300,h_300,c_fill,q_auto,f_auto/'))}" alt="" loading="lazy">` : ''}<span>${esc(it.title)}</span></a>`).join('')}</div>` : ''}
<p class="pie">UpGames · descargas, videos, lives, red social e IA en un solo lugar</p>
</div></body></html>
`;
}

// ── Páginas por juego y por tema: public/j/<slug>.html ───────────────
// Agrupan publicaciones para búsquedas amplias ("mods de gta v", "juegos para winlator")
// que una publicación suelta no capta. Juego: detectado por gameDetector (backend → it.juego).
const TEMAS = [
    { slug: 'juegos-para-winlator', titulo: 'Juegos y mods para Winlator', h1: 'Juegos y mods para Winlator (PC en Android)',
      intro: 'Juegos de PC adaptados, configuraciones y mods de rendimiento para jugar en Android con Winlator, compartidos por la comunidad de UpGames.',
      es: it => /winlator/i.test(`${it.title} ${it.description}`) },
    { slug: 'juegos-para-gamehub', titulo: 'Juegos y configuraciones para GameHub', h1: 'Juegos y configuraciones para GameHub',
      intro: 'Configuraciones, juegos y mods probados en GameHub para jugar títulos de PC en tu Android.',
      es: it => /game\s?hub/i.test(`${it.title} ${it.description}`) },
    { slug: 'juegos-y-mods-para-android', titulo: 'Juegos, mods y apps para Android', h1: 'Juegos, mods y apps para Android',
      intro: 'Juegos, ports, mods y apps para Android compartidos por la comunidad: descarga gratis y sin registrarte.',
      es: it => /\b(android|apk|obb|m[óo]vil|mobile|winlator|gamehub)\b/i.test(`${it.title} ${it.description} ${it.plataforma || ''}`) },
    { slug: 'mods-de-rendimiento', titulo: 'Mods de rendimiento y optimización', h1: 'Mods de rendimiento: más FPS y menos lag',
      intro: 'Mods de optimización, versiones lite y ajustes para que tus juegos corran con más FPS en PC y Android.',
      es: it => it.category === 'Optimizacion' || /\b(rendimiento|optimizad[oa]|fps|lite|lag)\b/i.test(it.title) },
];
const MIN_JUEGO = 2, MIN_TEMA = 3;
/** Grupos con suficientes publicaciones: [{ slug, titulo, h1, intro, items }] */
function grupos(items) {
    const porJuego = new Map();
    for (const it of items) if (it.juego && it.category !== 'Video') {
        const g = porJuego.get(it.juego) || []; g.push(it); porJuego.set(it.juego, g);
    }
    const out = [];
    for (const [juego, lista] of porJuego) if (lista.length >= MIN_JUEGO) out.push({
        slug: 'mods-de-' + slug(juego), juego, titulo: `Mods y juegos de ${juego}`, h1: `${juego}: mods, versiones y ajustes`,
        intro: `Todo lo de ${juego} en UpGames: mods de rendimiento, versiones para Android y PC, parches y configuraciones compartidas por la comunidad.`, items: lista });
    for (const t of TEMAS) { const lista = items.filter(it => it.category !== 'Video' && t.es(it)); if (lista.length >= MIN_TEMA) out.push({ ...t, es: undefined, items: lista }); }
    out.forEach(g => g.items.sort((a, b) => (b.descargas || 0) - (a.descargas || 0)));
    return out;
}
const urlGrupo = g => `${SITIO}/j/${g.slug}.html`;
function paginaGrupo(g, todos) {
    const url = urlGrupo(g), lista = g.items.slice(0, 60);
    const total = g.items.reduce((a, it) => a + (it.descargas || 0), 0);
    const desc = `${g.intro} ${g.items.length} publicaciones · ${fmt(total)} descargas.`.slice(0, 158);
    const og = g.items.map(tarjeta).find(Boolean) || `${SITIO}/og-cover.png`;
    const json = o => JSON.stringify(o).replace(/</g, '\\u003c');
    const ld = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: g.titulo, description: desc, url,
        mainEntity: { '@type': 'ItemList', numberOfItems: lista.length, itemListElement: lista.map((it, i) => ({ '@type': 'ListItem', position: i + 1, url: urlPagina(it), name: it.title })) } };
    const migas = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'UpGames', item: `${SITIO}/biblioteca.html` },
        { '@type': 'ListItem', position: 2, name: g.titulo, item: url }] };
    const otros = (todos || []).filter(x => x.slug !== g.slug).slice(0, 12);
    return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(g.titulo)} — descarga gratis | UpGames</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="UpGames">
<meta property="og:title" content="${esc(g.titulo)} | UpGames"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(og)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(g.titulo)}"><meta name="twitter:image" content="${esc(og)}">
<meta name="theme-color" content="#07080c"><link rel="icon" href="../icons/icon-96.png?v=2">
<script type="application/ld+json">${json(ld)}</script>
<script type="application/ld+json">${json(migas)}</script>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#07080c;color:#e8eaf0;line-height:1.55}
a{color:#32D583}.w{max-width:980px;margin:0 auto;padding:16px}.top{display:flex;align-items:center;justify-content:space-between;padding:6px 0 14px}
.logo{font-weight:900;letter-spacing:2px;font-size:1.2rem;text-decoration:none;color:#fff}.logo span{color:#32D583}
h1{margin:6px 0 6px;font-size:1.7rem;line-height:1.2}.intro{color:#c9ced8;margin:0 0 6px}.st{color:#9aa1af;font-size:.88rem;margin-bottom:18px}
.g{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}@media(min-width:700px){.g{grid-template-columns:repeat(3,1fr)}}@media(min-width:960px){.g{grid-template-columns:repeat(4,1fr)}}
.c{display:flex;flex-direction:column;background:#11131a;border:1px solid rgba(255,255,255,.07);border-radius:16px;overflow:hidden;text-decoration:none;color:#e8eaf0}
.c img,.c .ph{width:100%;height:auto;aspect-ratio:16/10;object-fit:cover;background:#1a1d26;display:block}.c b{padding:10px 12px 2px;font-size:.92rem;line-height:1.3}
.c small{padding:0 12px 12px;color:#9aa1af;font-size:.76rem}
.btn{display:block;text-align:center;margin:22px 0 8px;padding:15px;border-radius:14px;background:linear-gradient(135deg,#32D583,#5AC8FA);color:#06210f;font-weight:900;text-decoration:none}
.mas{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}.mas a{padding:7px 12px;border-radius:99px;border:1px solid rgba(255,255,255,.12);text-decoration:none;font-size:.82rem;color:#c9ced8}
.pie{margin:26px 0 10px;color:#6c7180;font-size:.8rem;text-align:center}
</style></head>
<body><div class="w">
<div class="top"><a class="logo" href="../biblioteca.html"><span>UP</span>GAMES</a><a href="../biblioteca.html">Explorar todo</a></div>
<h1>${esc(g.h1)}</h1>
<p class="intro">${esc(g.intro)}</p>
<div class="st">${fmt(g.items.length)} publicaciones · ${fmt(total)} descargas</div>
<div class="g">${lista.map(it => `<a class="c" href="${esc(urlPagina(it))}">${esImg(it.image) ? `<img src="${esc(it.image.replace('/upload/', '/upload/c_fill,g_auto,w_480,h_300,q_auto,f_auto/'))}" alt="${esc(it.title)}" loading="lazy" width="480" height="300">` : '<span class="ph"></span>'}<b>${esc(it.title)}</b><small>${esc(CAT[it.category] || it.category || '')} · @${esc(it.usuario)} · ⬇️ ${fmt(it.descargas)}</small></a>`).join('')}</div>
<a class="btn" href="../biblioteca.html">Explorar más en UpGames</a>
${otros.length ? `<div class="mas">${otros.map(o => `<a href="${esc(o.slug)}.html">${esc(o.titulo)}</a>`).join('')}</div>` : ''}
<p class="pie">UpGames · descargas, videos, lives, red social e IA en un solo lugar · <a href="../terminos_condiciones.html">Términos</a></p>
</div></body></html>
`;
}

module.exports = { SITIO, slug, archivo, urlPagina, pagina, usuarioValido, urlPerfil, paginaPerfil, tarjeta, grupos, urlGrupo, paginaGrupo };
