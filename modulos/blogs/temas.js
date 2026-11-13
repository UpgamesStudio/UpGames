/**
 * UpGames Blogs · temas
 *
 * Un tema es un juego de colores, tipografías y un par de decisiones de diseño. Todos
 * comparten la misma plantilla (modulos/blogs/render.js), así un blog puede cambiar de
 * tema sin perder nada. El creador puede además cambiar el color de acento y la fuente.
 */
'use strict';

const FUENTES = {
    manrope:  { nombre: 'Manrope',  css: "'Manrope', system-ui, sans-serif",          google: 'Manrope:wght@400;500;700;800' },
    orbitron: { nombre: 'Orbitron', css: "'Orbitron', 'Manrope', sans-serif",         google: 'Orbitron:wght@600;800' },
    rajdhani: { nombre: 'Rajdhani', css: "'Rajdhani', 'Manrope', sans-serif",         google: 'Rajdhani:wght@500;600;700' },
    serif:    { nombre: 'Serif',    css: "'Playfair Display', Georgia, serif",        google: 'Playfair+Display:wght@500;700;800' },
    mono:     { nombre: 'Mono',     css: "'Share Tech Mono', ui-monospace, monospace", google: 'Share+Tech+Mono' },
};

// v: variables CSS · titulos: fuente de títulos por defecto · portada: 'rejilla' | 'lista' · oscuro: para theme-color
const TEMAS = {
    neon: {
        nombre: 'Neón', descripcion: 'El estilo de UpGames: oscuro, verde neón y cristal.', oscuro: true, titulos: 'orbitron', portada: 'rejilla',
        v: { bg: '#05080F', bg2: '#0B1019', tarjeta: 'rgba(255,255,255,.045)', borde: 'rgba(255,255,255,.09)', txt: '#F4F5F7', txt2: '#A3A8B6', acento: '#39FF88', acento2: '#5CE1FF', sobreAcento: '#04160B', radio: '18px',
             fondo: 'radial-gradient(48% 38% at 88% -4%, rgba(57,255,136,.16), transparent 70%), radial-gradient(42% 34% at 4% 8%, rgba(92,225,255,.11), transparent 70%), radial-gradient(50% 40% at 50% 112%, rgba(143,123,255,.16), transparent 70%)' },
    },
    vidrio: {
        nombre: 'Vidrio', descripcion: 'Cristal líquido con aurora violeta y cian.', oscuro: true, titulos: 'manrope', portada: 'rejilla',
        v: { bg: '#0A0B12', bg2: '#12131D', tarjeta: 'rgba(255,255,255,.06)', borde: 'rgba(255,255,255,.12)', txt: '#F5F5FA', txt2: '#ABAFC2', acento: '#9D8CFF', acento2: '#5AC8FA', sobreAcento: '#0C0A1F', radio: '22px',
             fondo: 'radial-gradient(55% 45% at 12% 0%, rgba(157,140,255,.26), transparent 70%), radial-gradient(50% 42% at 96% 18%, rgba(90,200,250,.2), transparent 70%)' },
    },
    claro: {
        nombre: 'Claro', descripcion: 'Limpio y luminoso, para leer con calma.', oscuro: false, titulos: 'manrope', portada: 'lista',
        v: { bg: '#F7F8FA', bg2: '#FFFFFF', tarjeta: '#FFFFFF', borde: 'rgba(15,23,42,.1)', txt: '#111827', txt2: '#5B6474', acento: '#0E9F6E', acento2: '#0284C7', sobreAcento: '#FFFFFF', radio: '14px', fondo: 'none' },
    },
    revista: {
        nombre: 'Revista', descripcion: 'Titulares con serifa, como una revista.', oscuro: false, titulos: 'serif', portada: 'rejilla',
        v: { bg: '#FBF8F3', bg2: '#FFFFFF', tarjeta: '#FFFFFF', borde: 'rgba(60,40,20,.14)', txt: '#1E1A16', txt2: '#6B6258', acento: '#B4232C', acento2: '#8A5A16', sobreAcento: '#FFFFFF', radio: '6px', fondo: 'none' },
    },
    gamer: {
        nombre: 'Gamer', descripcion: 'Portafolio de creador: negro, rojo y mucha energía.', oscuro: true, titulos: 'rajdhani', portada: 'rejilla',
        v: { bg: '#0B0B0E', bg2: '#141418', tarjeta: 'rgba(255,255,255,.04)', borde: 'rgba(255,90,60,.2)', txt: '#F5F3F0', txt2: '#A8A29E', acento: '#FF4D2E', acento2: '#FFB020', sobreAcento: '#1A0703', radio: '10px',
             fondo: 'radial-gradient(60% 45% at 100% 0%, rgba(255,77,46,.2), transparent 70%), radial-gradient(45% 40% at 0% 100%, rgba(255,176,32,.1), transparent 70%)' },
    },
};
const POR_DEFECTO = 'neon';

// Opciones de diseño que el creador puede cambiar encima de cualquier tema
const ESQUINAS = { rectas: '2px', suaves: '12px', redondas: '26px' };
const PORTADAS = ['rejilla', 'lista', 'revista'];   // cómo se ordenan las entradas en el inicio
const FONDOS = {
    aurora:    { nombre: 'Aurora',    css: 'radial-gradient(60% 50% at 15% 0%, rgba(120,90,255,.30), transparent 70%), radial-gradient(55% 45% at 95% 10%, rgba(0,220,180,.22), transparent 70%)' },
    atardecer: { nombre: 'Atardecer', css: 'radial-gradient(70% 55% at 50% -10%, rgba(255,120,60,.30), transparent 70%), radial-gradient(50% 40% at 100% 100%, rgba(255,60,140,.20), transparent 70%)' },
    oceano:    { nombre: 'Océano',    css: 'radial-gradient(70% 55% at 0% 0%, rgba(40,140,255,.30), transparent 70%), radial-gradient(55% 45% at 100% 90%, rgba(0,210,255,.18), transparent 70%)' },
    bosque:    { nombre: 'Bosque',    css: 'radial-gradient(65% 50% at 90% 0%, rgba(60,220,120,.26), transparent 70%), radial-gradient(50% 45% at 0% 100%, rgba(180,220,60,.14), transparent 70%)' },
    rejilla:   { nombre: 'Rejilla',   css: 'linear-gradient(rgba(128,128,128,.10) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,.10) 1px, transparent 1px)', tam: '34px 34px', repetir: true },
    liso:      { nombre: 'Liso',      css: 'none' },
};

const temaDe = id => TEMAS[id] || TEMAS[POR_DEFECTO];
const esColor = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

/** Color de texto legible (negro o blanco) sobre un color de acento elegido por el creador. */
function sobre(hex) {
    const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#0B0F14' : '#FFFFFF';
}

/** Lista para el panel: lo necesario para dibujar la vista previa de cada tema. */
function lista() {
    return Object.entries(TEMAS).map(([id, t]) => ({ id, nombre: t.nombre, descripcion: t.descripcion, oscuro: t.oscuro,
        colores: { bg: t.v.bg, tarjeta: t.v.bg2, txt: t.v.txt, acento: t.v.acento, acento2: t.v.acento2 } }));
}

module.exports = { TEMAS, FUENTES, POR_DEFECTO, ESQUINAS, PORTADAS, FONDOS, temaDe, esColor, sobre, lista };
