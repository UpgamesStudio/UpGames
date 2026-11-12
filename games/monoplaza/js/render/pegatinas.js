// Rótulos de patrocinio, dorsales y pegatinas técnicas para las libreas (monoplaza y coches
// cerrados). Todo se dibuja con el lienzo 2D, centrado en el origen y en «unidades» del
// transformado actual (las libreas trabajan en centímetros del coche): así el mismo rótulo sirve
// para cualquier tamaño de textura.
//
// Las marcas son de la casa (UPGAMES, UPCOINS, NEXUS IA…) o inventadas para dar ambiente de
// parrilla: proveedores de frenos, aceite, neumáticos, etc.

export function azar(semilla) {
  let s = (semilla >>> 0) || 1;
  return () => { s = (Math.imul(s ^ (s >>> 15), 2246822519) + 0x6D2B79F5) >>> 0; return s / 4294967296; };
}
export function semillaDe(txt) {
  let h = 2166136261;
  for (const ch of String(txt)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}
function rgb(hex) {
  const n = parseInt(String(hex).replace('#', '').padEnd(6, '0').slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function luma(hex) { const [r, g, b] = rgb(hex); return 0.299 * r + 0.587 * g + 0.114 * b; }
export function contraste(hex) { return luma(hex) > 150 ? '#111111' : '#ffffff'; }
export function mezcla(a, b, t) {
  const A = rgb(a), B = rgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
export const oscuro = (hex, t = 0.45) => mezcla(hex, '#000000', t);
export const claro = (hex, t = 0.45) => mezcla(hex, '#ffffff', t);

const FUENTE = '"Arial Black", "Helvetica Neue", Arial, system-ui, sans-serif';
export const fuente = (alto, estilo = 'italic 900') => `${estilo} ${alto}px ${FUENTE}`;

// t: texto · c: color de la letra · f: fondo de la placa · i: icono · ic: color del icono
export const MARCAS = {
  UPGAMES: { t: 'UPGAMES', c: '#ffffff', f: '#0b0d14', i: 'cheuron', ic: '#00e5ff' },
  UPCOINS: { t: 'UPCOINS', c: '#ffc928', f: '#0b0d14', i: 'moneda', ic: '#ffc928' },
  NEXUS: { t: 'NEXUS IA', c: '#7fe7ff', f: '#0a1626', i: 'hex', ic: '#7fe7ff' },
  APEX: { t: 'RACING', c: '#ffffff', f: '#e8202a', i: 'meta', ic: '#ffffff' },
  TV: { t: 'UPGAMES TV', c: '#ffffff', f: '#6a1bd8', i: 'play', ic: '#ffffff' },
  UPSTAR: { t: 'UPSTAR', c: '#14110a', f: '#ffd43b', i: 'estrella', ic: '#14110a' },
  TURBOLAR: { t: 'TURBOLAR', c: '#ffffff', f: '#d4380d', i: 'aro', ic: '#ffffff' },
  FRENOX: { t: 'FRENOX', c: '#ffffff', f: '#17181c', i: 'disco', ic: '#ff3b3b' },
  RODAMAX: { t: 'RODAMAX', c: '#15130a', f: '#f5c518', i: null },
  LUBRIK: { t: 'LUBRIK', c: '#ffffff', f: '#0a7d3c', i: 'gota', ic: '#ffe14d' },
  NITRUM: { t: 'NITRUM', c: '#ffffff', f: '#0b3fb5', i: 'rayo', ic: '#ffe14d' },
  AEROVAL: { t: 'AEROVAL', c: '#0b0d14', f: '#f4f6f8', i: 'cheuron', ic: '#e8202a' },
  CHISPA: { t: 'CHISPA', c: '#ffffff', f: '#ff6a00', i: 'rayo', ic: '#ffffff' },
  GOMAX: { t: 'GOMAX', c: '#ffffff', f: '#101012', i: 'aro', ic: '#ffd200' },
  VELOZIA: { t: 'VELOZIA', c: '#ffffff', f: '#b0126b', i: null },
  DATAPIT: { t: 'DATAPIT', c: '#9dff7a', f: '#10161c', i: 'hex', ic: '#9dff7a' },
  BUJIX: { t: 'BUJIX', c: '#ffffff', f: '#0f6f8f', i: 'disco', ic: '#ffffff' },
  CARBONIA: { t: 'CARBONIA', c: '#e6e8ec', f: '#2a2d33', i: null },
};
const CASA = ['UPGAMES', 'UPCOINS', 'NEXUS', 'APEX', 'TV', 'UPSTAR'];
const TECNICAS = ['TURBOLAR', 'FRENOX', 'RODAMAX', 'LUBRIK', 'NITRUM', 'AEROVAL', 'CHISPA', 'GOMAX', 'VELOZIA', 'DATAPIT', 'BUJIX', 'CARBONIA'];

/** Patrocinadores de un equipo (los mismos siempre para la misma semilla): principal y
 *  secundarios de la casa, y una lista de proveedores para las pegatinas pequeñas. */
export function patrocinadores(semilla) {
  const r = azar(semillaDe(semilla) + 11);
  const baraja = (l) => { const a = l.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const casa = baraja(CASA.slice(1)), tec = baraja(TECNICAS);
  // UPGAMES va siempre en el coche; el principal alterna entre las marcas de la casa
  const principal = r() < 0.45 ? 'UPGAMES' : casa[0];
  const resto = ['UPGAMES', ...casa].filter(m => m !== principal);
  return { principal, segundo: resto[0], tercero: resto[1], cuarto: resto[2], casa: [principal, ...resto], tecnicas: tec };
}

function icono(c, tipo, r, color) {
  c.save(); c.fillStyle = color; c.strokeStyle = color; c.lineJoin = 'round';
  c.beginPath();
  switch (tipo) {
    case 'moneda':
      c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
      c.lineWidth = r * 0.16; c.strokeStyle = 'rgba(120,80,0,.9)'; c.beginPath(); c.arc(0, 0, r * 0.72, 0, Math.PI * 2); c.stroke();
      c.fillStyle = 'rgba(110,70,0,.95)'; c.font = fuente(r * 1.15, '900'); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('U', 0, r * 0.06);
      break;
    case 'hex':
      for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      c.closePath(); c.lineWidth = r * 0.28; c.stroke();
      c.beginPath(); c.arc(0, 0, r * 0.26, 0, Math.PI * 2); c.fill();
      break;
    case 'cheuron':
      for (const d of [-0.55, 0.25]) { c.beginPath(); c.moveTo(r * (d - 0.35), -r * 0.8); c.lineTo(r * (d + 0.45), 0); c.lineTo(r * (d - 0.35), r * 0.8); c.lineTo(r * (d - 0.75), r * 0.8); c.lineTo(r * (d + 0.05), 0); c.lineTo(r * (d - 0.75), -r * 0.8); c.closePath(); c.fill(); }
      break;
    case 'play':
      c.moveTo(-r * 0.6, -r * 0.8); c.lineTo(r * 0.8, 0); c.lineTo(-r * 0.6, r * 0.8); c.closePath(); c.fill();
      break;
    case 'estrella':
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? r * 0.45 : r; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); }
      c.closePath(); c.fill();
      break;
    case 'rayo':
      c.moveTo(r * 0.25, -r); c.lineTo(-r * 0.55, r * 0.15); c.lineTo(-r * 0.05, r * 0.15); c.lineTo(-r * 0.3, r); c.lineTo(r * 0.55, -r * 0.2); c.lineTo(r * 0.05, -r * 0.2); c.closePath(); c.fill();
      break;
    case 'gota':
      c.moveTo(0, -r); c.bezierCurveTo(r * 0.9, r * 0.1, r * 0.75, r, 0, r); c.bezierCurveTo(-r * 0.75, r, -r * 0.9, r * 0.1, 0, -r); c.fill();
      break;
    case 'disco':
      c.arc(0, 0, r * 0.8, 0, Math.PI * 2); c.lineWidth = r * 0.34; c.stroke();
      c.beginPath(); c.arc(0, 0, r * 0.22, 0, Math.PI * 2); c.fill();
      break;
    case 'aro':
      c.arc(0, 0, r * 0.78, Math.PI * 0.15, Math.PI * 1.85); c.lineWidth = r * 0.36; c.stroke();
      break;
    case 'meta':
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if ((i + j) % 2 === 0) c.fillRect(-r * 0.9 + i * r * 0.6, -r * 0.9 + j * r * 0.6, r * 0.6, r * 0.6);
      break;
    default:
  }
  c.restore();
}

/**
 * Dibuja el logotipo de una marca centrado en el origen. alto: altura de la letra.
 * placa: con su fondo de color (pegatina) · tinta: color forzado de la letra (sin fondo).
 * ancho: anchura máxima (se estrecha la letra si no cabe). Devuelve la anchura ocupada.
 */
export function logo(c, id, alto, { placa = true, tinta = null, ancho = 0, borde = null } = {}) {
  const m = MARCAS[id] || { t: String(id), c: '#ffffff', f: '#0b0d14', i: null };
  c.save();
  c.font = fuente(alto); c.textAlign = 'left'; c.textBaseline = 'middle';
  const wT = c.measureText(m.t).width, wI = m.i ? alto * 1.15 : 0, margen = placa ? alto * 0.42 : 0;
  let w = wT + wI + margen * 2, k = 1;
  if (ancho && w > ancho) { k = ancho / w; w = ancho; }
  c.scale(k, 1);
  const w0 = w / k;
  if (placa) {
    c.fillStyle = m.f; c.beginPath();
    if (c.roundRect) c.roundRect(-w0 / 2, -alto * 0.74, w0, alto * 1.48, alto * 0.24); else c.rect(-w0 / 2, -alto * 0.74, w0, alto * 1.48);
    c.fill();
    if (borde) { c.lineWidth = alto * 0.07; c.strokeStyle = borde; c.stroke(); }
  }
  const color = tinta || m.c;
  if (m.i) { c.save(); c.translate(-w0 / 2 + margen + wI * 0.42, 0); icono(c, m.i, alto * 0.46, tinta || m.ic || m.c); c.restore(); }
  c.fillStyle = color; c.fillText(m.t, -w0 / 2 + margen + wI, alto * 0.05);
  c.restore();
  return w;
}

/** Fila de pegatinas pequeñas (proveedores), centrada en el origen. */
export function fila(c, ids, alto, hueco = alto * 0.35) {
  c.save(); c.font = fuente(alto);
  const anchos = ids.map(id => { const m = MARCAS[id]; return c.measureText(m.t).width + (m.i ? alto * 1.15 : 0) + alto * 0.84; });
  let x = -(anchos.reduce((a, b) => a + b, 0) + hueco * (ids.length - 1)) / 2;
  ids.forEach((id, k) => { c.save(); c.translate(x + anchos[k] / 2, 0); logo(c, id, alto); c.restore(); x += anchos[k] + hueco; });
  c.restore();
}

/** Columna de pegatinas pequeñas, centrada en el origen (todas del mismo ancho). */
export function columna(c, ids, alto, ancho) {
  const paso = alto * 1.75;
  ids.forEach((id, k) => { c.save(); c.translate(0, (k - (ids.length - 1) / 2) * paso); logo(c, id, alto, { ancho }); c.restore(); });
}

/** Dorsal de carreras: placa blanca con el número y una franja de clase encima. */
export function dorsal(c, numero, alto, { clase = 'GT3', colorClase = '#e8202a', fondo = '#ffffff', tinta = '#101114' } = {}) {
  const w = alto * 1.18, h = alto;
  c.save();
  c.fillStyle = '#101114'; c.beginPath();
  if (c.roundRect) c.roundRect(-w / 2 - h * 0.035, -h / 2 - h * 0.035, w + h * 0.07, h * 1.07, h * 0.1); else c.rect(-w / 2, -h / 2, w, h);
  c.fill();
  c.fillStyle = fondo; c.beginPath();
  if (c.roundRect) c.roundRect(-w / 2, -h / 2, w, h, h * 0.08); else c.rect(-w / 2, -h / 2, w, h);
  c.fill();
  if (clase) {
    c.save(); c.beginPath(); if (c.roundRect) c.roundRect(-w / 2, -h / 2, w, h, h * 0.08); else c.rect(-w / 2, -h / 2, w, h); c.clip();
    c.fillStyle = colorClase; c.fillRect(-w / 2, -h / 2, w, h * 0.2);
    c.restore();
    c.fillStyle = contraste(colorClase); c.font = fuente(h * 0.13, '900'); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(clase, 0, -h * 0.395);
  }
  const txt = String(numero);
  c.fillStyle = tinta; c.font = fuente(h * 0.66); c.textAlign = 'center'; c.textBaseline = 'middle';
  const m = c.measureText(txt).width, max = w * 0.84;
  c.save(); c.translate(0, h * (clase ? 0.13 : 0.03)); if (m > max) c.scale(max / m, 1); c.fillText(txt, 0, 0); c.restore();
  c.restore();
}

/** Número grande perfilado (Stock Car, morro del monoplaza). */
export function numeroGrande(c, numero, alto, color, perfil = '#101114', sombra = null) {
  c.save();
  c.font = fuente(alto); c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  const t = String(numero);
  if (sombra) { c.fillStyle = sombra; c.fillText(t, alto * 0.06, alto * 0.06); }
  c.lineWidth = alto * 0.16; c.strokeStyle = perfil; c.strokeText(t, 0, 0);
  c.fillStyle = color; c.fillText(t, 0, 0);
  c.restore();
}

/** Pegatinas técnicas reglamentarias: cortacorrientes, extintor, gancho de remolque, gato. */
export function tecnica(c, tipo, r) {
  c.save(); c.lineJoin = 'round';
  if (tipo === 'corriente') {            // triángulo azul con el rayo rojo
    c.fillStyle = '#1456d8'; c.beginPath(); c.moveTo(0, -r); c.lineTo(r, r * 0.8); c.lineTo(-r, r * 0.8); c.closePath(); c.fill();
    c.lineWidth = r * 0.12; c.strokeStyle = '#ffffff'; c.stroke();
    c.translate(0, r * 0.2); icono(c, 'rayo', r * 0.5, '#ff3b3b');
  } else if (tipo === 'extintor') {      // círculo rojo con la E
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
    c.lineWidth = r * 0.2; c.strokeStyle = '#e8202a'; c.stroke();
    c.fillStyle = '#e8202a'; c.font = fuente(r * 1.2, '900'); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('E', 0, r * 0.06);
  } else if (tipo === 'remolque') {      // flecha roja
    c.fillStyle = '#e8202a'; c.beginPath(); c.moveTo(r * 1.3, 0); c.lineTo(r * 0.2, -r * 0.9); c.lineTo(r * 0.2, -r * 0.4); c.lineTo(-r * 1.3, -r * 0.4); c.lineTo(-r * 1.3, r * 0.4); c.lineTo(r * 0.2, r * 0.4); c.lineTo(r * 0.2, r * 0.9); c.closePath(); c.fill();
    c.lineWidth = r * 0.1; c.strokeStyle = '#ffffff'; c.stroke();
  } else if (tipo === 'gato') {          // triángulo amarillo del gato neumático
    c.fillStyle = '#ffd200'; c.beginPath(); c.moveTo(0, r); c.lineTo(r, -r * 0.8); c.lineTo(-r, -r * 0.8); c.closePath(); c.fill();
    c.lineWidth = r * 0.12; c.strokeStyle = '#101114'; c.stroke();
  }
  c.restore();
}
