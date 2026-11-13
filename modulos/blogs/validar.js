/**
 * UpGames Blogs · validación y limpieza
 *
 * Todo lo que escribe el creador pasa por aquí antes de guardarse: la dirección del blog,
 * el dominio propio y los bloques de cada entrada. El contenido se guarda como bloques
 * (JSON), nunca como HTML libre: así un blog no puede llevar scripts.
 */
'use strict';

const LIMITES = {
    BLOGS_POR_CUENTA: 3,
    BLOGS_PREMIUM: 10,
    ENTRADAS_POR_BLOG: 300,
    BLOQUES_POR_ENTRADA: 80,
    TEXTO_BLOQUE: 20000,
    TITULO: 140,
    DESCRIPCION: 300,
    ETIQUETAS: 8,
    GALERIA: 12,
};

// Direcciones que no puede usar un blog (se confundirían con UpGames o con servicios conocidos)
const RESERVADOS = new Set(['www', 'admin', 'api', 'app', 'blog', 'blogs', 'upgames', 'upgame', 'soporte', 'support', 'ayuda', 'help',
    'login', 'registro', 'cuenta', 'account', 'pago', 'pagos', 'paypal', 'google', 'facebook', 'banco', 'bank', 'seguridad', 'security',
    'mail', 'correo', 'ftp', 'cdn', 'static', 'assets', 'nexus', 'live', 'studio', 'racing', 'premium', 'oficial', 'official',
    'root', 'null', 'undefined', 'test', 'dev', 'staging', 'status', 'docs', 'legal', 'terminos', 'privacidad']);

const TIPOS = new Set(['texto', 'titulo', 'imagen', 'galeria', 'video', 'cita', 'boton', 'separador', 'codigo', 'juego', 'descarga', 'aviso', 'faq', 'ficha', 'audio']);
const ESTILOS_AVISO = new Set(['info', 'exito', 'alerta', 'peligro']);

/** Texto plano de una línea: sin etiquetas, sin saltos, recortado. */
function linea(v, max) {
    return String(v ?? '').replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Texto de varios párrafos: conserva los saltos de línea, quita caracteres de control. */
function parrafos(v, max) {
    return String(v ?? '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').replace(/\n{4,}/g, '\n\n\n').trim().slice(0, max);
}

/** Convierte un título en la parte final de una URL: «¡Hola, Mundo!» → «hola-mundo». */
function slug(texto, max = 80) {
    return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/g, '');
}

/** Dirección del blog (la parte de la URL): 3–30 caracteres, letras, números y guiones. */
function validarDireccion(v) {
    const d = String(v ?? '').trim().toLowerCase();
    if (!/^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/.test(d)) return { error: 'La dirección debe tener entre 3 y 30 caracteres: letras, números y guiones (sin empezar ni terminar en guion).' };
    if (d.includes('--')) return { error: 'La dirección no puede tener dos guiones seguidos.' };
    if (RESERVADOS.has(d)) return { error: 'Esa dirección está reservada. Elige otra.' };
    return { valor: d };
}

/** Dominio propio: «www.misitio.com». Se rechazan IP, puertos, rutas y los dominios de UpGames. */
function validarDominio(v) {
    let d = String(v ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/\.$/, '');
    if (!d || d.length > 253) return { error: 'Escribe tu dominio, por ejemplo www.misitio.com' };
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(d)) return { error: 'Ese dominio no es válido. Escríbelo así: www.misitio.com (sin https:// ni barras).' };
    if (/(^|\.)(upgames\.games|upgames\.site|railway\.app|github\.io|localhost)$/.test(d)) return { error: 'Ese dominio no se puede conectar.' };
    return { valor: d };
}

/** URL https segura (o '' si no lo es). Sin espacios, comillas ni símbolos de etiqueta. */
function urlSegura(v, max = 600) {
    const u = String(v ?? '').trim();
    if (!u || u.length > max || /[\s"'<>`\\]/.test(u)) return '';
    try { const p = new URL(u); return p.protocol === 'https:' && p.hostname.includes('.') ? p.href : ''; } catch (_) { return ''; }
}

/** Saca el identificador de un video de YouTube de cualquiera de sus formatos de enlace. */
function idYouTube(v) {
    const s = String(v ?? '').trim();
    if (/^[\w-]{11}$/.test(s)) return s;
    const m = s.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
    return m ? m[1] : '';
}

/** Canción, álbum, lista, programa o episodio de Spotify a partir de su enlace. */
function idSpotify(v) {
    const m = String(v ?? '').trim().match(/^https:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(?:embed\/)?(track|album|playlist|episode|show)\/([A-Za-z0-9]{22})(?:[/?#].*)?$/);
    return m ? { clase: m[1], id: m[2] } : null;
}

function etiquetas(v) {
    const lista = Array.isArray(v) ? v : String(v ?? '').split(',');
    const vistas = new Set(), out = [];
    for (const e of lista) {
        const t = linea(e, 30).replace(/^#/, '');
        const k = slug(t);
        if (!k || vistas.has(k)) continue;
        vistas.add(k); out.push(t);
        if (out.length >= LIMITES.ETIQUETAS) break;
    }
    return out;
}

/**
 * Limpia la lista de bloques de una entrada. Devuelve solo bloques conocidos y con sus
 * campos permitidos; lo demás se descarta. Nunca lanza.
 */
function limpiarBloques(entrada) {
    if (!Array.isArray(entrada)) return [];
    const out = [];
    for (const b of entrada) {
        if (!b || typeof b !== 'object' || !TIPOS.has(b.tipo)) continue;
        let n = null;
        switch (b.tipo) {
            case 'texto': { const t = parrafos(b.texto, LIMITES.TEXTO_BLOQUE); if (t) n = { tipo: 'texto', texto: t, ...(b.centro ? { centro: true } : {}), ...(b.grande ? { grande: true } : {}) }; break; }
            case 'titulo': { const t = linea(b.texto, 160); if (t) n = { tipo: 'titulo', texto: t, nivel: b.nivel === 3 ? 3 : 2, ...(b.centro ? { centro: true } : {}) }; break; }
            case 'imagen': { const url = urlSegura(b.url); if (url) n = { tipo: 'imagen', url, pie: linea(b.pie, 200), alt: linea(b.alt, 200), enlace: urlSegura(b.enlace) }; break; }
            case 'aviso': { const t = parrafos(b.texto, 1500); if (t) n = { tipo: 'aviso', texto: t, estilo: ESTILOS_AVISO.has(b.estilo) ? b.estilo : 'info' }; break; }
            case 'faq': {
                const items = (Array.isArray(b.items) ? b.items : []).map(i => ({ p: linea(i?.p, 200), r: parrafos(i?.r, 1500) })).filter(i => i.p && i.r).slice(0, 20);
                if (items.length) n = { tipo: 'faq', items };
                break;
            }
            case 'ficha': {
                const filas = (Array.isArray(b.filas) ? b.filas : []).map(f => ({ k: linea(f?.k, 60), v: linea(f?.v, 200) })).filter(f => f.k && f.v).slice(0, 20);
                if (filas.length) n = { tipo: 'ficha', filas, titulo: linea(b.titulo, 80) };
                break;
            }
            case 'audio': { const a = idSpotify(b.url || (b.clase && b.id ? `https://open.spotify.com/${b.clase}/${b.id}` : '')); if (a) n = { tipo: 'audio', clase: a.clase, id: a.id }; break; }
            case 'galeria': {
                const urls = (Array.isArray(b.urls) ? b.urls : []).map(u => urlSegura(u)).filter(Boolean).slice(0, LIMITES.GALERIA);
                if (urls.length) n = { tipo: 'galeria', urls };
                break;
            }
            case 'video': { const id = idYouTube(b.id || b.url); if (id) n = { tipo: 'video', id }; break; }
            case 'cita': { const t = parrafos(b.texto, 1200); if (t) n = { tipo: 'cita', texto: t, autor: linea(b.autor, 80) }; break; }
            case 'boton': { const url = urlSegura(b.url), t = linea(b.texto, 60); if (url && t) n = { tipo: 'boton', texto: t, url }; break; }
            case 'separador': n = { tipo: 'separador' }; break;
            case 'codigo': { const t = String(b.texto ?? '').replace(/\r\n?/g, '\n').replace(/\u0000/g, '').slice(0, 8000); if (t.trim()) n = { tipo: 'codigo', texto: t }; break; }
            case 'descarga': { const id = String(b.id ?? ''); if (/^[a-f0-9]{24}$/i.test(id)) n = { tipo: 'descarga', id: id.toLowerCase() }; break; }
            case 'juego': { const id = String(b.id ?? ''); if (/^[a-f0-9]{24}$/i.test(id)) n = { tipo: 'juego', id: id.toLowerCase() }; break; }
        }
        if (n) out.push(n);
        if (out.length >= LIMITES.BLOQUES_POR_ENTRADA) break;
    }
    return out;
}

/** Todo el texto de una entrada junto, para la moderación y para el resumen. */
function textoDe(bloques) {
    return (bloques || []).map(b => [b.texto, b.pie, b.autor, b.titulo, ...(b.items || []).flatMap(i => [i.p, i.r]), ...(b.filas || []).flatMap(f => [f.k, f.v])].filter(Boolean).join(' ')).filter(Boolean).join('\n');
}

/** Enlaces que aparecen en una entrada (botones y enlaces dentro del texto). */
function enlacesDe(bloques) {
    const out = [];
    for (const b of bloques || []) {
        if (b.tipo === 'boton') out.push(b.url);
        if (b.tipo === 'imagen' && b.enlace) out.push(b.enlace);
        for (const i of b.items || []) for (const m of String(i.r).matchAll(/\]\((https:\/\/[^\s)]+)\)/g)) out.push(m[1]);
        if (b.tipo === 'texto' || b.tipo === 'cita' || b.tipo === 'aviso') for (const m of String(b.texto).matchAll(/\]\((https:\/\/[^\s)]+)\)/g)) out.push(m[1]);
    }
    return out;
}

/** Resumen corto de la entrada (para la portada, el feed y las etiquetas meta). */
function resumen(bloques, max = 180) {
    const t = (bloques || []).filter(b => b.tipo === 'texto').map(b => b.texto).join(' ')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*|`/g, '').replace(/(^|\s)[-•]\s+/g, '$1').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : t;
}

/** Primera imagen de la entrada: sirve de portada si el autor no eligió una. */
function primeraImagen(bloques) {
    for (const b of bloques || []) {
        if (b.tipo === 'imagen') return b.url;
        if (b.tipo === 'galeria' && b.urls[0]) return b.urls[0];
    }
    return '';
}

module.exports = { LIMITES, RESERVADOS, linea, parrafos, slug, validarDireccion, validarDominio, urlSegura, idYouTube, idSpotify, etiquetas, limpiarBloques, textoDe, enlacesDe, resumen, primeraImagen };
