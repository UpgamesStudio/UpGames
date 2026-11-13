/**
 * UpGames Blogs · render
 *
 * Convierte un blog y sus entradas (bloques JSON) en páginas HTML completas. Todo lo que
 * escribió el creador se escapa: el único HTML que sale es el de estas plantillas.
 * Sin dependencias y sin acceso a la base de datos: recibe los datos ya cargados.
 */
'use strict';

const { TEMAS, FUENTES, ESQUINAS, PORTADAS, FONDOS, temaDe, esColor, sobre } = require('./temas');
const V = require('./validar');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Formato dentro de un párrafo: **negrita**, *cursiva*, `código` y [texto](https://enlace). */
function enLinea(texto) {
    let h = esc(texto);
    const codigos = [];
    h = h.replace(/`([^`\n]+)`/g, (_, c) => { codigos.push(c); return `\u0001${codigos.length - 1}\u0001`; });
    h = h.replace(/\[([^\]\n]+)\]\((https:\/\/[^\s()]+)\)/g, '<a href="$2" target="_blank" rel="nofollow ugc noopener">$1</a>');
    h = h.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    return h.replace(/\u0001(\d+)\u0001/g, (_, i) => `<code>${codigos[+i]}</code>`);
}

/** Un bloque de texto: párrafos separados por línea en blanco, listas con «- » o «1. ». */
function textoHtml(texto) {
    return String(texto).split(/\n{2,}/).map(p => {
        const lineas = p.split('\n').filter(l => l.trim());
        if (!lineas.length) return '';
        if (lineas.every(l => /^\s*[-•]\s+/.test(l))) return `<ul>${lineas.map(l => `<li>${enLinea(l.replace(/^\s*[-•]\s+/, ''))}</li>`).join('')}</ul>`;
        if (lineas.every(l => /^\s*\d+[.)]\s+/.test(l))) return `<ol>${lineas.map(l => `<li>${enLinea(l.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`;
        return `<p>${lineas.map(enLinea).join('<br>')}</p>`;
    }).join('');
}

// Las imágenes de Cloudinary se piden al ancho justo y en formato moderno
const img = (url, ancho) => String(url).replace(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(?!.*\/(?:w_|c_))/, `$1f_auto,q_auto,w_${ancho},c_limit/`);

function bloqueHtml(b, ctx) {
    switch (b.tipo) {
        case 'texto': return b.centro || b.grande ? `<div class="${[b.centro && 't-centro', b.grande && 't-grande'].filter(Boolean).join(' ')}">${textoHtml(b.texto)}</div>` : textoHtml(b.texto);
        case 'titulo': return `<h${b.nivel === 3 ? 3 : 2}${b.centro ? ' class="t-centro"' : ''}>${esc(b.texto)}</h${b.nivel === 3 ? 3 : 2}>`;
        case 'imagen': {
            const foto = `<img src="${esc(img(b.url, 1200))}" alt="${esc(b.alt || b.pie || '')}" loading="lazy" decoding="async">`;
            return `<figure>${b.enlace ? `<a href="${esc(b.enlace)}" target="_blank" rel="nofollow ugc noopener">${foto}</a>` : foto}${b.pie ? `<figcaption>${esc(b.pie)}</figcaption>` : ''}</figure>`;
        }
        case 'aviso': return `<div class="aviso aviso-${esc(b.estilo)}">${textoHtml(b.texto)}</div>`;
        case 'faq': return `<div class="faq">${b.items.map(i => `<details><summary>${esc(i.p)}</summary><div>${textoHtml(i.r)}</div></details>`).join('')}</div>`;
        case 'ficha': return `<div class="ficha">${b.titulo ? `<b class="ficha-t">${esc(b.titulo)}</b>` : ''}<dl>${b.filas.map(f => `<div><dt>${esc(f.k)}</dt><dd>${esc(f.v)}</dd></div>`).join('')}</dl></div>`;
        case 'audio': return `<div class="audio"><iframe src="https://open.spotify.com/embed/${esc(b.clase)}/${esc(b.id)}" height="${b.clase === 'track' || b.clase === 'episode' ? 152 : 352}" title="Spotify" loading="lazy" allow="encrypted-media; clipboard-write; fullscreen; picture-in-picture"></iframe></div>`;
        case 'galeria': return `<div class="galeria">${b.urls.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(img(u, 600))}" alt="" loading="lazy" decoding="async"></a>`).join('')}</div>`;
        case 'video': return `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${esc(b.id)}" title="Video" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
        case 'cita': return `<blockquote>${textoHtml(b.texto)}${b.autor ? `<cite>${esc(b.autor)}</cite>` : ''}</blockquote>`;
        case 'boton': return `<p class="centro"><a class="boton" href="${esc(b.url)}" target="_blank" rel="nofollow ugc noopener">${esc(b.texto)}</a></p>`;
        case 'separador': return '<hr>';
        case 'codigo': return `<pre><code>${esc(b.texto)}</code></pre>`;
        case 'descarga': {
            // La descarga pasa SIEMPRE por la página puente (espera + anuncios + ticket): así cuenta igual que una descarga normal
            const j = ctx.juegos?.[b.id];
            if (!j) return '';
            const puente = `${ctx.appUrl}/public/puente.html?id=${encodeURIComponent(b.id)}&media=${encodeURIComponent(j.image || '')}&title=${encodeURIComponent(j.title || '')}`;
            return `<div class="descarga">${j.image ? `<img src="${esc(img(j.image, 320))}" alt="" loading="lazy">` : ''}<div class="d-info"><b>${esc(j.title)}</b><small>por @${esc(j.usuario)} · descarga gratis</small></div><a class="d-boton" href="${esc(puente)}" target="_blank" rel="nofollow noopener">Descargar</a></div>`;
        }
        case 'juego': {
            const j = ctx.juegos?.[b.id];
            if (!j) return '';
            return `<a class="juego" href="${esc(ctx.appUrl)}/public/biblioteca.html?id=${esc(b.id)}" target="_blank" rel="noopener">${j.image ? `<img src="${esc(img(j.image, 320))}" alt="" loading="lazy">` : ''}<span><b>${esc(j.title)}</b><small>por @${esc(j.usuario)} · Ver en UpGames</small></span></a>`;
        }
    }
    return '';
}
const bloquesHtml = (bloques, ctx) => (bloques || []).map(b => bloqueHtml(b, ctx)).join('\n');

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function fecha(d) {
    const f = new Date(d);
    return isNaN(f) ? '' : `${f.getUTCDate()} de ${MESES[f.getUTCMonth()]} de ${f.getUTCFullYear()}`;
}

// ── Estilos ──────────────────────────────────────────────────────────────────────────
function variables(blog) {
    const t = temaDe(blog.tema), a = blog.ajustes || {};
    const v = { ...t.v };
    if (esColor(a.acento)) { v.acento = a.acento; v.sobreAcento = sobre(a.acento); }
    if (ESQUINAS[a.esquinas]) v.radio = ESQUINAS[a.esquinas];
    const f = FONDOS[a.fondo];
    if (f) { v.fondo = f.css; v.fondoTam = f.tam || 'auto'; v.fondoRep = f.repetir ? 'repeat' : 'no-repeat'; }
    const fTit = FUENTES[a.fuente] || FUENTES[t.titulos], fTxt = FUENTES.manrope;
    const google = [...new Set([fTit.google, fTxt.google])].map(f => `family=${f}`).join('&');
    return { t, v, fTit, fTxt, google };
}

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{font-family:var(--f-txt);color:var(--txt);background:var(--bg);background-image:var(--fondo);background-attachment:fixed;background-repeat:var(--fondo-rep,no-repeat);background-size:var(--fondo-tam,auto);line-height:1.7;-webkit-font-smoothing:antialiased;min-height:100vh;display:flex;flex-direction:column}
a{color:var(--acento);text-decoration:none}a:hover{text-decoration:underline}
img{max-width:100%;height:auto;display:block}
.ancho{width:100%;max-width:1080px;margin:0 auto;padding:0 16px}
header.cab{border-bottom:1px solid var(--borde);background:color-mix(in srgb,var(--bg) 78%,transparent);backdrop-filter:blur(18px) saturate(1.5);-webkit-backdrop-filter:blur(18px) saturate(1.5);position:sticky;top:0;z-index:5}
.cab .ancho{display:flex;align-items:center;gap:12px;min-height:60px;flex-wrap:wrap;padding-top:8px;padding-bottom:8px}
.marca{display:flex;align-items:center;gap:10px;font-family:var(--f-tit);font-weight:800;font-size:1.15rem;color:var(--txt);letter-spacing:.01em;min-width:0}
.marca:hover{text-decoration:none}.marca img{width:36px;height:36px;border-radius:10px;object-fit:cover}
.marca span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
nav.menu{margin-left:auto;display:flex;gap:4px;flex-wrap:wrap}
nav.menu a{color:var(--txt2);font-weight:600;font-size:.9rem;padding:6px 12px;border-radius:99px}
nav.menu a:hover,nav.menu a.activo{color:var(--txt);background:var(--tarjeta);text-decoration:none}
.heroe{position:relative;padding:44px 0 36px;text-align:center;overflow:hidden}
.heroe.con-foto{padding:84px 0 64px;color:#fff}
.heroe .foto{position:absolute;inset:0;background-size:cover;background-position:center;z-index:-2}
.heroe .velo{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,.72));z-index:-1}
.heroe h1{font-family:var(--f-tit);font-size:clamp(1.7rem,6vw,2.9rem);line-height:1.15;font-weight:800;letter-spacing:-.01em}
.heroe p{color:var(--txt2);max-width:640px;margin:10px auto 0;font-size:1.02rem}.heroe.con-foto p{color:rgba(255,255,255,.86)}
main{flex:1;padding:28px 0 56px}
.cuerpo{display:grid;gap:28px;grid-template-columns:minmax(0,1fr)}
@media(min-width:900px){.cuerpo.con-lateral{grid-template-columns:minmax(0,1fr) 290px}}
.rejilla{display:grid;gap:18px;grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}
.lista{display:grid;gap:18px}
.tarjeta{background:var(--tarjeta);border:1px solid var(--borde);border-radius:var(--radio);overflow:hidden;display:flex;flex-direction:column;transition:transform .2s,border-color .2s;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
.tarjeta:hover{transform:translateY(-3px);border-color:var(--acento);text-decoration:none}
.tarjeta .port{aspect-ratio:16/9;background:var(--bg2);overflow:hidden}.tarjeta .port img{width:100%;height:100%;object-fit:cover}
.tarjeta .txt{padding:16px 18px 18px;display:flex;flex-direction:column;gap:6px;flex:1}
.tarjeta h2{font-family:var(--f-tit);font-size:1.12rem;line-height:1.3;color:var(--txt);font-weight:700}
.tarjeta p{color:var(--txt2);font-size:.92rem;line-height:1.55}
.lista .tarjeta{flex-direction:row}.lista .tarjeta .port{width:38%;max-width:260px;aspect-ratio:4/3;flex-shrink:0}
@media(max-width:560px){.lista .tarjeta{flex-direction:column}.lista .tarjeta .port{width:100%;max-width:none;aspect-ratio:16/9}}
.meta{color:var(--txt2);font-size:.8rem;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.chip{display:inline-block;padding:3px 11px;border-radius:99px;border:1px solid var(--borde);color:var(--txt2);font-size:.78rem;font-weight:600}
.chip:hover{color:var(--acento);border-color:var(--acento);text-decoration:none}
article.entrada{max-width:760px;margin:0 auto;width:100%}
article.entrada>header{margin-bottom:22px}
article.entrada h1{font-family:var(--f-tit);font-size:clamp(1.6rem,5.4vw,2.5rem);line-height:1.18;font-weight:800;margin-bottom:10px;letter-spacing:-.01em}
.portada-entrada{border-radius:var(--radio);overflow:hidden;margin:0 0 24px;border:1px solid var(--borde)}.portada-entrada img{width:100%}
.contenido{font-size:1.06rem;overflow-wrap:break-word}
.contenido>*+*{margin-top:1.1em}
.contenido h2{font-family:var(--f-tit);font-size:1.5rem;line-height:1.25;margin-top:1.6em}
.contenido h3{font-family:var(--f-tit);font-size:1.2rem;line-height:1.3;margin-top:1.4em}
.contenido ul,.contenido ol{padding-left:1.4em}.contenido li+li{margin-top:.35em}
.contenido figure img,.contenido .galeria img{border-radius:calc(var(--radio)*.7);width:100%}
.contenido figcaption{color:var(--txt2);font-size:.85rem;text-align:center;margin-top:8px}
.galeria{display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}.galeria img{aspect-ratio:1;object-fit:cover}
.video{position:relative;aspect-ratio:16/9;border-radius:calc(var(--radio)*.7);overflow:hidden;background:#000}.video iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
blockquote{border-left:3px solid var(--acento);padding:6px 0 6px 18px;color:var(--txt2);font-style:italic}blockquote cite{display:block;margin-top:8px;font-style:normal;font-size:.88rem;color:var(--txt)}blockquote cite::before{content:'— '}
hr{border:0;height:1px;background:var(--borde);margin:2em 0}
pre{background:var(--bg2);border:1px solid var(--borde);border-radius:12px;padding:14px 16px;overflow-x:auto;font-size:.88rem;line-height:1.55}
code{font-family:ui-monospace,'Share Tech Mono',Menlo,monospace;background:var(--tarjeta);border:1px solid var(--borde);border-radius:6px;padding:1px 6px;font-size:.9em}pre code{background:none;border:0;padding:0}
.centro{text-align:center}
.boton{display:inline-block;background:var(--acento);color:var(--sobre-acento);font-weight:800;padding:12px 26px;border-radius:99px;box-shadow:0 10px 30px -12px var(--acento)}.boton:hover{text-decoration:none;filter:brightness(1.08)}
.juego{display:flex;gap:14px;align-items:center;background:var(--tarjeta);border:1px solid var(--borde);border-radius:var(--radio);padding:12px;color:var(--txt)}
.juego:hover{border-color:var(--acento);text-decoration:none}.juego img{width:96px;height:64px;object-fit:cover;border-radius:10px;flex-shrink:0}
.juego span{display:flex;flex-direction:column;min-width:0}.juego small{color:var(--txt2)}
.descarga{display:flex;align-items:center;gap:14px;padding:14px;border-radius:calc(var(--radio) + 4px);background:linear-gradient(135deg,rgba(255,255,255,.1),rgba(255,255,255,.03));border:1px solid var(--borde);box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 18px 40px -22px rgba(0,0,0,.6);backdrop-filter:blur(18px) saturate(140%);-webkit-backdrop-filter:blur(18px) saturate(140%)}
.descarga img{width:84px;height:84px;object-fit:cover;border-radius:16px;flex-shrink:0}
.d-info{display:flex;flex-direction:column;min-width:0;flex:1;gap:2px}.d-info b{font-size:1.02rem;line-height:1.25}.d-info small{color:var(--txt2)}
.d-boton{flex-shrink:0;background:var(--acento);color:var(--sobre-acento);font-weight:800;padding:11px 20px;border-radius:99px;box-shadow:0 10px 26px -12px var(--acento)}.d-boton:hover{text-decoration:none;filter:brightness(1.08)}
@media(max-width:520px){.descarga{flex-wrap:wrap}.descarga img{width:64px;height:64px}.d-boton{width:100%;text-align:center}}
.etiquetas{display:flex;gap:8px;flex-wrap:wrap;margin-top:28px}
.compartir{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px;padding-top:20px;border-top:1px solid var(--borde);align-items:center;color:var(--txt2);font-size:.9rem}
aside.lateral{display:grid;gap:18px;align-content:start}
.caja{background:var(--tarjeta);border:1px solid var(--borde);border-radius:var(--radio);padding:18px;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
.caja h3{font-family:var(--f-tit);font-size:.82rem;text-transform:uppercase;letter-spacing:.1em;color:var(--txt2);margin-bottom:12px}
.caja.perfil{text-align:center}.caja.perfil img{width:76px;height:76px;border-radius:50%;object-fit:cover;margin:0 auto 10px;border:2px solid var(--acento)}
.caja.perfil b{display:block;font-size:1.05rem}.caja.perfil p{color:var(--txt2);font-size:.9rem;margin-top:6px}
.caja ul{list-style:none;display:grid;gap:10px}.caja li a{color:var(--txt);font-weight:600;font-size:.93rem;line-height:1.35;display:block}
.caja .nube{display:flex;gap:8px;flex-wrap:wrap}
.paginas{display:flex;justify-content:space-between;gap:12px;margin-top:28px}
.vacio{text-align:center;color:var(--txt2);padding:60px 16px;border:1px dashed var(--borde);border-radius:var(--radio)}
footer.pie{border-top:1px solid var(--borde);padding:22px 0 30px;color:var(--txt2);font-size:.84rem}
footer.pie .ancho{display:flex;gap:10px 18px;flex-wrap:wrap;justify-content:space-between;align-items:center}
footer.pie a{color:var(--txt2)}footer.pie .hecho b{color:var(--acento)}
.pixel{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
.t-centro{text-align:center}.t-grande{font-size:1.28em;line-height:1.55;font-weight:500}
.contenido figure a{display:block}
.aviso{border:1px solid var(--borde);border-left:4px solid var(--a,var(--acento));background:color-mix(in srgb,var(--a,var(--acento)) 9%,transparent);border-radius:calc(var(--radio)*.6);padding:14px 16px}
.aviso-info{--a:#3B9EFF}.aviso-exito{--a:#2FBF71}.aviso-alerta{--a:#F5A524}.aviso-peligro{--a:#F04438}
.faq{display:grid;gap:10px}.faq details{background:var(--tarjeta);border:1px solid var(--borde);border-radius:calc(var(--radio)*.6);padding:0 16px}
.faq summary{cursor:pointer;font-weight:700;padding:14px 0;list-style:none;display:flex;justify-content:space-between;gap:12px}.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:'+';color:var(--acento);font-weight:800;font-size:1.2em;line-height:1}.faq details[open] summary::after{content:'–'}
.faq details>div{padding:0 0 14px;color:var(--txt2)}
.ficha{background:var(--tarjeta);border:1px solid var(--borde);border-radius:calc(var(--radio)*.7);overflow:hidden}
.ficha-t{display:block;padding:12px 16px;font-family:var(--f-tit);border-bottom:1px solid var(--borde);background:color-mix(in srgb,var(--acento) 8%,transparent)}
.ficha dl>div{display:flex;gap:14px;padding:10px 16px;font-size:.96rem}.ficha dl>div+div{border-top:1px solid var(--borde)}
.ficha dt{color:var(--txt2);width:38%;flex-shrink:0}.ficha dd{font-weight:600;min-width:0;overflow-wrap:anywhere}
.audio iframe{width:100%;border:0;border-radius:14px;display:block}
.anuncio{margin:30px auto 0;text-align:center;max-width:320px}.anuncio small{display:block;color:var(--txt2);font-size:.68rem;letter-spacing:.14em;text-transform:uppercase;margin-bottom:6px;opacity:.7}
.anuncio iframe{width:300px;height:250px;border:0;border-radius:10px;background:var(--tarjeta);max-width:100%}
.previa{background:#F5A524;color:#1A1203;text-align:center;font-weight:800;font-size:.86rem;padding:8px 12px}
.revista .tarjeta:first-child{grid-column:1/-1}
@media(min-width:700px){.revista .tarjeta:first-child{flex-direction:row}.revista .tarjeta:first-child .port{width:58%;aspect-ratio:16/9}.revista .tarjeta:first-child h2{font-size:1.7rem}.revista .tarjeta:first-child .txt{justify-content:center;padding:26px}}
`.trim();

// ── Partes comunes ───────────────────────────────────────────────────────────────────
/**
 * ctx: { blog, base, origen, appUrl, paginas[], autor{usuario,avatar,bio}, populares[], nube[], juegos{} }
 *   base   → prefijo de las rutas del blog ('' con dominio propio, '/b/direccion' sin él)
 *   origen → https://host, para las URL absolutas (canonical, feed, sitemap)
 */
function documento(ctx, { titulo, descripcion, ruta, imagen, cuerpo, tipo = 'website', jsonld, noindex, activo, previa }) {
    const { blog, base, origen } = ctx;
    const { t, v, fTit, fTxt, google } = variables(blog);
    const a = blog.ajustes || {};
    const url = origen + base + ruta;
    const tituloPag = titulo ? `${titulo} · ${blog.titulo}` : blog.titulo;
    const desc = descripcion || blog.descripcion || `Blog de @${blog.usuario} en UpGames`;
    const oculto = noindex || blog.visibilidad !== 'publico';
    const vars = `--bg:${v.bg};--bg2:${v.bg2};--tarjeta:${v.tarjeta};--borde:${v.borde};--txt:${v.txt};--txt2:${v.txt2};--acento:${v.acento};--acento2:${v.acento2};--sobre-acento:${v.sobreAcento};--radio:${v.radio};--fondo:${v.fondo};--fondo-tam:${v.fondoTam || 'auto'};--fondo-rep:${v.fondoRep || 'no-repeat'};--f-tit:${fTit.css};--f-txt:${fTxt.css}`;
    const menu = [`<a href="${esc(base)}/"${activo === 'inicio' ? ' class="activo"' : ''}>Inicio</a>`,
        ...(ctx.paginas || []).slice(0, 6).map(p => `<a href="${esc(base)}/p/${esc(p.slug)}"${activo === 'p:' + p.slug ? ' class="activo"' : ''}>${esc(p.titulo)}</a>`)].join('');
    return `<!DOCTYPE html>
<html lang="${esc(a.idioma || 'es')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(tituloPag)}</title>
<meta name="description" content="${esc(desc)}">
${oculto ? '<meta name="robots" content="noindex, nofollow">' : `<link rel="canonical" href="${esc(url)}">`}
<meta name="theme-color" content="${esc(v.bg)}">
<meta property="og:type" content="${tipo}">
<meta property="og:title" content="${esc(titulo || blog.titulo)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:site_name" content="${esc(blog.titulo)}">
${imagen ? `<meta property="og:image" content="${esc(imagen)}">\n<meta name="twitter:card" content="summary_large_image">` : '<meta name="twitter:card" content="summary">'}
<link rel="alternate" type="application/rss+xml" title="${esc(blog.titulo)}" href="${esc(origen + base)}/feed.xml">
${a.logo ? `<link rel="icon" href="${esc(img(a.logo, 96))}">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?${google}&display=swap" rel="stylesheet">
<style>:root{${vars}}
${CSS}</style>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body class="tema-${esc(TEMAS[blog.tema] ? blog.tema : 'neon')}${t.oscuro ? ' oscuro' : ''}">
${previa ? '<div class="previa">Vista previa · así se verá cuando la publiques</div>' : ''}<header class="cab"><div class="ancho">
<a class="marca" href="${esc(base)}/">${a.logo ? `<img src="${esc(img(a.logo, 96))}" alt="">` : ''}<span>${esc(blog.titulo)}</span></a>
<nav class="menu" aria-label="Secciones">${menu}</nav>
</div></header>
${cuerpo}
<footer class="pie"><div class="ancho">
<span>© ${new Date().getUTCFullYear()} ${esc(blog.titulo)} · <a href="${esc(base)}/feed.xml">RSS</a> · <a href="${esc(ctx.appUrl)}/public/blog.html?reportar=${esc(blog.direccion)}" rel="nofollow">Reportar</a></span>
${blog.sinMarca ? '' : `<a class="hecho" href="${esc(ctx.appUrl)}/public/blog.html" rel="noopener">Hecho con <b>UpGames</b> · crea tu blog gratis</a>`}
</div></footer>
</body>
</html>`;
}

function lateral(ctx) {
    const g = { perfil: true, etiquetas: true, populares: true, ...(ctx.blog.ajustes?.gadgets || {}) };
    const cajas = [];
    if (g.perfil && ctx.autor) {
        const au = ctx.autor;
        cajas.push(`<section class="caja perfil">${au.avatar ? `<img src="${esc(img(au.avatar, 160))}" alt="">` : ''}<b>@${esc(au.usuario)}</b>${au.bio ? `<p>${esc(au.bio)}</p>` : ''}<p><a href="${esc(ctx.appUrl)}/public/perfil-publico.html?usuario=${encodeURIComponent(au.usuario)}" rel="noopener">Ver perfil en UpGames</a></p></section>`);
    }
    if (g.populares && ctx.populares?.length)
        cajas.push(`<section class="caja"><h3>Lo más leído</h3><ul>${ctx.populares.map(e => `<li><a href="${esc(ctx.base)}/e/${esc(e.slug)}">${esc(e.titulo)}</a></li>`).join('')}</ul></section>`);
    if (g.etiquetas && ctx.nube?.length)
        cajas.push(`<section class="caja"><h3>Etiquetas</h3><div class="nube">${ctx.nube.map(e => `<a class="chip" href="${esc(ctx.base)}/etiqueta/${esc(V.slug(e))}">${esc(e)}</a>`).join('')}</div></section>`);
    const enlaces = (ctx.blog.ajustes?.enlaces || []).filter(e => e?.url && e?.texto);
    if (enlaces.length)
        cajas.push(`<section class="caja"><h3>Enlaces</h3><ul>${enlaces.map(e => `<li><a href="${esc(e.url)}" target="_blank" rel="nofollow ugc noopener">${esc(e.texto)}</a></li>`).join('')}</ul></section>`);
    return cajas.length ? `<aside class="lateral">${cajas.join('')}</aside>` : '';
}

/** Espacio de publicidad (solo si el creador activó la monetización). El anuncio va en un marco aislado. */
const anuncio = ctx => ctx.anuncio ? `<aside class="anuncio"><small>Publicidad</small><iframe src="${esc(ctx.base)}/_anuncio" title="Publicidad" loading="lazy" scrolling="no" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"></iframe></aside>` : '';

function tarjeta(e, ctx) {
    const port = e.portada || V.primeraImagen(e.bloques);
    return `<a class="tarjeta" href="${esc(ctx.base)}/e/${esc(e.slug)}">${port ? `<div class="port"><img src="${esc(img(port, 640))}" alt="" loading="lazy" decoding="async"></div>` : ''}<div class="txt"><h2>${esc(e.titulo)}</h2><p>${esc(e.resumen || V.resumen(e.bloques, 150))}</p><span class="meta">${esc(fecha(e.publicadaEn))}</span></div></a>`;
}

// ── Páginas ──────────────────────────────────────────────────────────────────────────
/** Portada del blog (o el listado de una etiqueta). */
function inicio(ctx, { entradas, pagina = 1, hayMas = false, etiqueta = '' }) {
    const { blog, base } = ctx, a = blog.ajustes || {};
    const lat = lateral(ctx);
    const pedida = PORTADAS.includes(a.portadaForma) ? a.portadaForma : temaDe(blog.tema).portada;
    const forma = pedida === 'lista' ? 'lista' : pedida === 'revista' ? 'rejilla revista' : 'rejilla';
    const ruta = etiqueta ? `/etiqueta/${V.slug(etiqueta)}` : '/';
    const heroe = etiqueta
        ? `<section class="heroe"><div class="ancho"><h1>#${esc(etiqueta)}</h1><p>Entradas con esta etiqueta</p></div></section>`
        : `<section class="heroe${a.portada ? ' con-foto' : ''}">${a.portada ? `<div class="foto" style="background-image:url('${esc(img(a.portada, 1600))}')"></div><div class="velo"></div>` : ''}<div class="ancho"><h1>${esc(blog.titulo)}</h1>${blog.descripcion ? `<p>${esc(blog.descripcion)}</p>` : ''}</div></section>`;
    const lista = entradas.length
        ? `<div class="${forma}">${entradas.map(e => tarjeta(e, ctx)).join('')}</div>`
        : `<div class="vacio">${etiqueta ? 'No hay entradas con esta etiqueta.' : 'Este blog todavía no tiene entradas. ¡Vuelve pronto!'}</div>`;
    const nav = (pagina > 1 || hayMas) ? `<nav class="paginas">${pagina > 1 ? `<a class="chip" href="${esc(base + ruta)}${pagina > 2 ? `?pagina=${pagina - 1}` : ''}">← Más recientes</a>` : '<span></span>'}${hayMas ? `<a class="chip" href="${esc(base + ruta)}?pagina=${pagina + 1}">Más antiguas →</a>` : ''}</nav>` : '';
    return documento(ctx, {
        titulo: etiqueta ? `#${etiqueta}` : '', ruta, imagen: a.portada || '', activo: etiqueta ? '' : 'inicio', noindex: pagina > 1,
        jsonld: etiqueta ? null : { '@context': 'https://schema.org', '@type': 'Blog', name: blog.titulo, description: blog.descripcion || undefined, url: ctx.origen + base + '/' },
        cuerpo: `${pagina === 1 ? heroe : ''}<main><div class="ancho cuerpo${lat ? ' con-lateral' : ''}"><div>${lista}${nav}${anuncio(ctx)}</div>${lat}</div></main>`,
    });
}

/** Una entrada (o una página fija, que no lleva fecha, etiquetas ni contador). */
function entrada(ctx, e, { previa = false } = {}) {
    const { blog, base, origen } = ctx;
    const esPagina = e.tipo === 'pagina';
    const ruta = `/${esPagina ? 'p' : 'e'}/${e.slug}`;
    const port = e.portada || '';
    const imagen = port || V.primeraImagen(e.bloques);
    const desc = e.resumen || V.resumen(e.bloques, 160);
    const url = origen + base + ruta;
    const compartir = `<div class="compartir"><span>Compartir:</span><a class="chip" href="https://wa.me/?text=${encodeURIComponent(`${e.titulo} ${url}`)}" target="_blank" rel="noopener">WhatsApp</a><a class="chip" href="https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(e.titulo)}" target="_blank" rel="noopener">Telegram</a><a class="chip" href="https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(e.titulo)}" target="_blank" rel="noopener">X</a><a class="chip" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" rel="noopener">Facebook</a></div>`;
    const cuerpo = `<main><div class="ancho"><article class="entrada">
<header><h1>${esc(e.titulo)}</h1>${esPagina ? '' : `<div class="meta"><span>${esc(fecha(e.publicadaEn))}</span><span>·</span><span>@${esc(blog.usuario)}</span></div>`}</header>
${port ? `<div class="portada-entrada"><img src="${esc(img(port, 1400))}" alt=""></div>` : ''}
<div class="contenido">${bloquesHtml(e.bloques, ctx)}</div>
${!esPagina && e.etiquetas?.length ? `<div class="etiquetas">${e.etiquetas.map(t => `<a class="chip" href="${esc(base)}/etiqueta/${esc(V.slug(t))}">#${esc(t)}</a>`).join('')}</div>` : ''}
${esPagina || previa ? '' : compartir}
${previa ? '' : anuncio(ctx)}
</article></div></main>
${e._id && !previa ? `<img class="pixel" src="${esc(base)}/_v/${esc(e._id)}.gif" alt="" width="1" height="1">` : ''}`;
    return documento(ctx, {
        titulo: e.titulo, descripcion: desc, ruta, imagen, tipo: 'article', activo: esPagina ? 'p:' + e.slug : '', cuerpo, previa, noindex: previa,
        jsonld: esPagina ? null : { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: e.titulo, description: desc || undefined, image: imagen || undefined,
            datePublished: e.publicadaEn ? new Date(e.publicadaEn).toISOString() : undefined, dateModified: e.updatedAt ? new Date(e.updatedAt).toISOString() : undefined,
            author: { '@type': 'Person', name: blog.usuario }, mainEntityOfPage: url },
    });
}

function noEncontrada(ctx) {
    return documento(ctx, { titulo: 'No encontrada', ruta: '/', noindex: true,
        cuerpo: `<main><div class="ancho"><div class="vacio"><h1 style="font-family:var(--f-tit);margin-bottom:8px">Esta página no existe</h1><p>Puede que la hayan borrado o que el enlace esté mal.</p><p style="margin-top:16px"><a class="boton" href="${esc(ctx.base)}/">Ir al inicio</a></p></div></div></main>` });
}

/** Página suelta para cuando el blog no existe o está suspendido (sin datos del blog). */
function aviso(titulo, texto, appUrl) {
    return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${esc(titulo)} · UpGames</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#05080F;color:#F4F5F7;font-family:system-ui,sans-serif;text-align:center;padding:24px}h1{font-size:1.5rem;margin:0 0 10px}p{color:#A3A8B6;margin:0 0 22px;max-width:420px}a{background:#39FF88;color:#04160B;font-weight:800;padding:12px 24px;border-radius:99px;text-decoration:none}</style></head>
<body><div><h1>${esc(titulo)}</h1><p>${esc(texto)}</p><a href="${esc(appUrl)}/public/blog.html">Crea tu blog en UpGames</a></div></body></html>`;
}

const xml = s => esc(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

function feed(ctx, entradas) {
    const { blog, base, origen } = ctx, raiz = origen + base;
    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>${xml(blog.titulo)}</title><link>${xml(raiz)}/</link><description>${xml(blog.descripcion || `Blog de @${blog.usuario}`)}</description><language>${xml(blog.ajustes?.idioma || 'es')}</language>
<atom:link href="${xml(raiz)}/feed.xml" rel="self" type="application/rss+xml"/>
${entradas.map(e => `<item><title>${xml(e.titulo)}</title><link>${xml(raiz)}/e/${xml(e.slug)}</link><guid isPermaLink="true">${xml(raiz)}/e/${xml(e.slug)}</guid><pubDate>${new Date(e.publicadaEn).toUTCString()}</pubDate><description>${xml(e.resumen || V.resumen(e.bloques, 300))}</description></item>`).join('\n')}
</channel></rss>`;
}

function sitemap(ctx, entradas) {
    const raiz = ctx.origen + ctx.base;
    const u = (loc, f) => `<url><loc>${xml(loc)}</loc>${f ? `<lastmod>${new Date(f).toISOString().slice(0, 10)}</lastmod>` : ''}</url>`;
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${u(raiz + '/')}
${entradas.map(e => u(`${raiz}/${e.tipo === 'pagina' ? 'p' : 'e'}/${e.slug}`, e.updatedAt || e.publicadaEn)).join('\n')}
</urlset>`;
}

module.exports = { esc, enLinea, textoHtml, bloquesHtml, inicio, entrada, noEncontrada, aviso, feed, sitemap, fecha };
