// Carrocerías cerradas (GT y Stock Car), modeladas por código con medidas de coches de carreras
// reales (GT3: ~4,55 m de largo, 2,04 m de ancho y 1,22 m de alto).
//  · Carrocería baja: secciones cosidas a lo largo del coche con fondo plano, costado, hombro y
//    aletas que cubren las ruedas (el capó va hundido entre ellas); el morro es romo y curvo en
//    planta, y los pasos de rueda van recortados en círculo con su labio de carbono.
//  · Cabina: más estrecha y con caída, con el parabrisas y la luneta curvos en planta.
//  · Piezas de carreras: splitter con derivas y aletas (canards), faldones, difusor con aletas,
//    alerón de cuello de cisne con derivas, retrovisores, escapes, faros y pilotos LED.
//  · Librea: un atlas con cinco vistas (arriba, los dos costados, frente y trasera). Los cristales,
//    las líneas de las piezas, las rejillas, los dorsales y la publicidad van pintados con nitidez
//    en la textura, como en los coches de un simulador.
// Ejes como el monoplaza: +X delante, +Y arriba, +Z a la derecha; origen bajo el CG en el suelo.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { logo, columna, dorsal, numeroGrande, tecnica, patrocinadores, contraste, oscuro, claro, luma, fuente } from './pegatinas.js';

// baja: [x, semiancho, suelo, hombro (aleta), centro (capó/maletero)]
// techo: perfil del techo por el eje [x, y] · ancho: [x, semiancho al pie, semiancho del techo]
const FORMAS = {
  // GT de motor delantero (coupé): capó largo, cabina retrasada y zaga corta
  gt: {
    baja: [
      [2.42, 0.86, 0.11, 0.49, 0.49], [2.37, 0.93, 0.105, 0.55, 0.52], [2.22, 0.98, 0.11, 0.64, 0.56],
      [1.95, 1.005, 0.12, 0.76, 0.61], [1.46, 1.01, 0.12, 0.82, 0.66], [1.00, 0.975, 0.12, 0.80, 0.70],
      [0.55, 0.94, 0.12, 0.79, 0.75], [0.00, 0.93, 0.12, 0.81, 0.80], [-0.60, 0.96, 0.12, 0.85, 0.84],
      [-1.24, 1.02, 0.12, 0.92, 0.89], [-1.72, 1.005, 0.13, 0.93, 0.92], [-2.02, 0.97, 0.20, 0.91, 0.91],
      [-2.12, 0.91, 0.30, 0.87, 0.88],
    ],
    techo: [[0.72, 0.66], [0.52, 0.79], [0.20, 0.99], [-0.12, 1.15], [-0.45, 1.215], [-0.85, 1.19], [-1.25, 1.07], [-1.62, 0.95], [-1.85, 0.86]],
    ancho: [[0.72, 0.80, 0.74], [0.20, 0.82, 0.66], [-0.45, 0.83, 0.63], [-1.0, 0.85, 0.58], [-1.5, 0.87, 0.50], [-1.85, 0.87, 0.46]],
    xPar: -0.12, xLun: -0.85, kF: 0.30, kR: 0.22, pilarB: [-0.63, -0.56], lat: [0.50, -1.42], puerta: [0.50, -0.60],
    ruedas: { del: 0.31, tras: 0.33 }, piloto: [-0.70, 0.13, -0.36],
    ala: true, toma: [1.02, 1.58], branquia: true, tomaLateral: false, faro: 'almendra', escape: 'tras',
  },
  // GT de motor central (berlinetta): morro corto y bajo, cabina adelantada, caderas anchas y tomas laterales
  gtb: {
    baja: [
      [2.30, 0.86, 0.11, 0.44, 0.44], [2.25, 0.93, 0.105, 0.50, 0.47], [2.10, 0.98, 0.11, 0.60, 0.51],
      [1.85, 1.005, 0.12, 0.74, 0.56], [1.46, 1.01, 0.12, 0.81, 0.62], [1.10, 0.97, 0.12, 0.78, 0.67],
      [0.60, 0.93, 0.12, 0.76, 0.72], [0.00, 0.94, 0.12, 0.80, 0.78], [-0.60, 1.00, 0.12, 0.87, 0.85],
      [-1.24, 1.04, 0.12, 0.93, 0.90], [-1.70, 1.02, 0.13, 0.93, 0.91], [-2.00, 0.98, 0.20, 0.91, 0.90],
      [-2.08, 0.92, 0.30, 0.87, 0.87],
    ],
    techo: [[1.25, 0.58], [1.05, 0.70], [0.70, 0.93], [0.35, 1.10], [0.00, 1.155], [-0.40, 1.13], [-0.90, 1.03], [-1.40, 0.93], [-1.72, 0.86]],
    ancho: [[1.25, 0.78, 0.72], [0.70, 0.80, 0.64], [0.00, 0.82, 0.60], [-0.60, 0.85, 0.55], [-1.2, 0.88, 0.47], [-1.72, 0.88, 0.42]],
    xPar: 0.35, xLun: -0.40, kF: 0.32, kR: 0.20, pilarB: [-0.24, -0.17], lat: [0.98, -0.80], puerta: [0.95, -0.22],
    ruedas: { del: 0.31, tras: 0.34 }, piloto: [-0.25, 0.10, -0.36],
    ala: true, toma: null, branquia: false, tomaLateral: true, faro: 'cuchilla', escape: 'tras',
  },
  // GT de motor delantero grande (estilo muscle): capó largo y alto, parabrisas más recto y zaga cuadrada
  gtm: {
    baja: [
      [2.45, 0.89, 0.11, 0.58, 0.58], [2.40, 0.95, 0.105, 0.64, 0.62], [2.25, 1.00, 0.11, 0.71, 0.66],
      [1.95, 1.015, 0.12, 0.79, 0.70], [1.46, 1.02, 0.12, 0.84, 0.73], [0.95, 0.99, 0.12, 0.83, 0.77],
      [0.40, 0.96, 0.12, 0.83, 0.81], [-0.20, 0.96, 0.12, 0.85, 0.84], [-0.80, 0.99, 0.12, 0.89, 0.87],
      [-1.24, 1.03, 0.12, 0.94, 0.90], [-1.75, 1.015, 0.13, 0.95, 0.93], [-2.08, 0.98, 0.20, 0.94, 0.93],
      [-2.16, 0.92, 0.30, 0.90, 0.90],
    ],
    techo: [[0.62, 0.72], [0.42, 0.84], [0.15, 1.04], [-0.10, 1.19], [-0.40, 1.255], [-0.85, 1.24], [-1.20, 1.14], [-1.50, 1.01], [-1.72, 0.88]],
    ancho: [[0.62, 0.83, 0.78], [0.15, 0.85, 0.70], [-0.40, 0.86, 0.67], [-0.90, 0.88, 0.63], [-1.35, 0.90, 0.55], [-1.72, 0.90, 0.50]],
    xPar: -0.10, xLun: -0.85, kF: 0.26, kR: 0.18, pilarB: [-0.60, -0.52], lat: [0.40, -1.36], puerta: [0.42, -0.57],
    ruedas: { del: 0.31, tras: 0.33 }, piloto: [-0.68, 0.15, -0.38],
    ala: true, toma: [0.92, 1.52], branquia: true, tomaLateral: false, faro: 'barra', escape: 'lado',
  },
  // Turismo de tres volúmenes (berlina de carreras): cabina alta y recta, maletero y alerón bajo
  gtt: {
    baja: [
      [2.33, 0.84, 0.11, 0.60, 0.60], [2.28, 0.90, 0.105, 0.66, 0.64], [2.14, 0.94, 0.11, 0.72, 0.67],
      [1.90, 0.965, 0.12, 0.79, 0.70], [1.46, 0.975, 0.12, 0.84, 0.73], [1.00, 0.95, 0.12, 0.84, 0.78],
      [0.40, 0.93, 0.12, 0.85, 0.83], [-0.30, 0.93, 0.12, 0.87, 0.86], [-0.80, 0.95, 0.12, 0.89, 0.88],
      [-1.24, 0.975, 0.12, 0.92, 0.90], [-1.72, 0.965, 0.13, 0.93, 0.92], [-2.02, 0.94, 0.20, 0.93, 0.92],
      [-2.12, 0.89, 0.30, 0.90, 0.90],
    ],
    techo: [[0.95, 0.72], [0.75, 0.84], [0.45, 1.08], [0.20, 1.27], [-0.10, 1.335], [-0.75, 1.33], [-1.10, 1.26], [-1.38, 1.08], [-1.62, 0.90]],
    ancho: [[0.95, 0.80, 0.76], [0.45, 0.82, 0.70], [-0.10, 0.83, 0.68], [-0.75, 0.84, 0.67], [-1.20, 0.85, 0.62], [-1.62, 0.85, 0.58]],
    xPar: 0.20, xLun: -0.75, kF: 0.20, kR: 0.14, pilarB: [-0.34, -0.26], lat: [0.70, -1.25], puerta: [0.72, -0.30],
    ruedas: { del: 0.31, tras: 0.33 }, piloto: [-0.35, 0.22, -0.36],
    ala: true, alaY: 1.19, toma: null, branquia: false, tomaLateral: false, faro: 'redondos', escape: 'tras',
  },
  // Compacto de dos volúmenes (hatchback de carreras): techo largo y portón casi vertical
  gth: {
    baja: [
      [2.30, 0.84, 0.11, 0.58, 0.58], [2.25, 0.90, 0.105, 0.64, 0.62], [2.12, 0.94, 0.11, 0.70, 0.65],
      [1.88, 0.97, 0.12, 0.78, 0.69], [1.46, 0.985, 0.12, 0.83, 0.72], [1.00, 0.95, 0.12, 0.83, 0.78],
      [0.40, 0.93, 0.12, 0.85, 0.83], [-0.40, 0.94, 0.12, 0.88, 0.87], [-1.24, 0.99, 0.12, 0.93, 0.91],
      [-1.62, 0.98, 0.13, 0.94, 0.93], [-1.88, 0.95, 0.20, 0.93, 0.93], [-1.96, 0.90, 0.30, 0.90, 0.90],
    ],
    techo: [[0.98, 0.71], [0.78, 0.83], [0.48, 1.07], [0.22, 1.26], [-0.10, 1.33], [-0.80, 1.33], [-1.35, 1.29], [-1.62, 1.15], [-1.80, 0.95], [-1.90, 0.86]],
    ancho: [[0.98, 0.80, 0.76], [0.48, 0.82, 0.70], [-0.10, 0.83, 0.68], [-0.80, 0.84, 0.67], [-1.35, 0.85, 0.64], [-1.90, 0.85, 0.60]],
    xPar: 0.22, xLun: -1.35, kF: 0.20, kR: 0.12, pilarB: [-0.36, -0.28], lat: [0.72, -1.32], puerta: [0.74, -0.32],
    ruedas: { del: 0.31, tras: 0.33 }, piloto: [-0.35, 0.22, -0.36],
    ala: true, toma: null, branquia: true, tomaLateral: false, faro: 'barra', escape: 'tras',
  },
  // GT clásico: morro largo y redondeado, cabina muy retrasada, zaga corta que cae y faros redondos
  gtc: {
    baja: [
      [2.40, 0.80, 0.11, 0.52, 0.52], [2.35, 0.88, 0.105, 0.58, 0.56], [2.20, 0.94, 0.11, 0.66, 0.60],
      [1.95, 0.975, 0.12, 0.76, 0.64], [1.46, 0.985, 0.12, 0.81, 0.68], [1.00, 0.95, 0.12, 0.79, 0.72],
      [0.45, 0.92, 0.12, 0.79, 0.77], [-0.10, 0.92, 0.12, 0.81, 0.80], [-0.70, 0.95, 0.12, 0.85, 0.84],
      [-1.24, 1.00, 0.12, 0.90, 0.87], [-1.70, 0.97, 0.13, 0.88, 0.87], [-1.98, 0.92, 0.20, 0.84, 0.84],
      [-2.08, 0.85, 0.30, 0.78, 0.79],
    ],
    techo: [[0.55, 0.70], [0.35, 0.82], [0.05, 1.02], [-0.22, 1.17], [-0.55, 1.225], [-0.90, 1.19], [-1.30, 1.06], [-1.68, 0.92], [-1.95, 0.80]],
    ancho: [[0.55, 0.79, 0.73], [0.05, 0.81, 0.66], [-0.55, 0.82, 0.63], [-1.0, 0.83, 0.58], [-1.5, 0.84, 0.50], [-1.95, 0.82, 0.44]],
    xPar: -0.22, xLun: -0.90, kF: 0.28, kR: 0.20, pilarB: [-0.70, -0.63], lat: [0.35, -1.45], puerta: [0.36, -0.66],
    ruedas: { del: 0.31, tras: 0.33 }, piloto: [-0.78, 0.13, -0.36],
    ala: true, toma: null, branquia: true, tomaLateral: false, faro: 'redondos', escape: 'lado',
  },
  // Hiperdeportivo de motor central: muy bajo, cabina adelantada en gota y cola larga
  gtp: {
    baja: [
      [2.32, 0.86, 0.10, 0.40, 0.40], [2.27, 0.93, 0.10, 0.46, 0.43], [2.12, 0.98, 0.11, 0.57, 0.47],
      [1.86, 1.01, 0.12, 0.73, 0.52], [1.46, 1.02, 0.12, 0.80, 0.58], [1.10, 0.97, 0.12, 0.76, 0.64],
      [0.60, 0.92, 0.12, 0.74, 0.70], [0.00, 0.94, 0.12, 0.79, 0.77], [-0.60, 1.01, 0.12, 0.87, 0.84],
      [-1.24, 1.05, 0.12, 0.93, 0.88], [-1.75, 1.03, 0.13, 0.92, 0.89], [-2.10, 0.99, 0.20, 0.89, 0.88],
      [-2.20, 0.93, 0.30, 0.85, 0.85],
    ],
    techo: [[1.35, 0.55], [1.15, 0.67], [0.80, 0.90], [0.45, 1.06], [0.10, 1.11], [-0.35, 1.09], [-0.90, 1.00], [-1.45, 0.92], [-1.80, 0.84]],
    ancho: [[1.35, 0.76, 0.70], [0.80, 0.78, 0.62], [0.10, 0.80, 0.57], [-0.50, 0.84, 0.52], [-1.2, 0.87, 0.45], [-1.80, 0.87, 0.40]],
    xPar: 0.45, xLun: -0.35, kF: 0.34, kR: 0.20, pilarB: [-0.16, -0.09], lat: [1.05, -0.70], puerta: [1.02, -0.14],
    ruedas: { del: 0.31, tras: 0.34 }, piloto: [-0.18, 0.06, -0.34],
    ala: true, toma: null, branquia: false, tomaLateral: true, faro: 'cuchilla', escape: 'tras',
  },
  // Stock Car: berlina de tres volúmenes para óvalos
  stock: {
    baja: [
      [2.56, 0.90, 0.13, 0.60, 0.60], [2.50, 0.97, 0.12, 0.67, 0.65], [2.28, 1.005, 0.12, 0.74, 0.70],
      [1.34, 1.02, 0.12, 0.83, 0.77], [0.90, 1.00, 0.12, 0.85, 0.82], [0.00, 0.99, 0.12, 0.87, 0.87],
      [-1.45, 1.02, 0.12, 0.94, 0.92], [-2.30, 1.01, 0.14, 0.96, 0.95], [-2.52, 0.97, 0.20, 0.95, 0.95],
      [-2.59, 0.92, 0.30, 0.92, 0.92],
    ],
    techo: [[0.98, 0.74], [0.78, 0.85], [0.45, 1.08], [0.15, 1.25], [-0.20, 1.305], [-0.75, 1.30], [-1.15, 1.20], [-1.50, 1.05], [-1.80, 0.90]],
    ancho: [[0.98, 0.86, 0.82], [0.45, 0.88, 0.75], [-0.20, 0.89, 0.72], [-0.80, 0.90, 0.70], [-1.30, 0.91, 0.62], [-1.80, 0.91, 0.56]],
    xPar: 0.15, xLun: -0.75, kF: 0.22, kR: 0.16, pilarB: [-0.50, -0.42], lat: [0.72, -1.34], puerta: [0.70, -0.46],
    ruedas: { del: 0.30, tras: 0.30 }, piloto: [-0.42, 0.22, -0.38],
    ala: false, toma: null, branquia: false, tomaLateral: false, faro: 'pegatina', escape: 'lado',
  },
};
for (const F of Object.values(FORMAS)) { F.xN = F.baja[0][0]; F.xC = F.baja[F.baja.length - 1][0]; }
export const FORMAS_GT = ['gt', 'gtb', 'gtm', 'gtt', 'gth', 'gtc', 'gtp'];
export const NOMBRES_FORMA = { gt: 'Coupé GT', gtb: 'Berlinetta', gtm: 'Muscle', gtt: 'Turismo', gth: 'Compacto', gtc: 'GT clásico', gtp: 'Hiperdeportivo' };
export const DESC_FORMA = { gt: 'Motor delantero, capó largo', gtb: 'Motor central, morro corto', gtm: 'Capó alto y zaga cuadrada', gtt: 'Berlina de tres volúmenes', gth: 'Dos volúmenes con portón', gtc: 'Morro largo y faros redondos', gtp: 'Muy bajo, cabina en gota' };
/** Silueta de perfil de una carrocería (SVG) para elegirla en el garaje. */
export function siluetaSVG(forma, color = 'currentColor') {
  const F = FORMAS[forma] || FORMAS.gt, X = (x) => ((F.xN - x) * 60 + 6).toFixed(1), Y = (y) => ((1.42 - y) * 60).toFixed(1), pts = [];
  for (let x = F.xN; x >= F.xC - 0.001; x -= 0.06) pts.push(`${X(x)},${Y(Math.max(ySup(datos(F, x), 0.55), x < F.techo[0][0] && x > F.techo[F.techo.length - 1][0] ? yTecho(F, x) : 0))}`);
  const d = datos(F, 0), ruedas = F.rx.map((x, k) => `<circle cx="${X(x)}" cy="${Y(F.rr[k])}" r="${(F.rr[k] * 60 + 2).toFixed(1)}" fill="#0b0c10"/><circle cx="${X(x)}" cy="${Y(F.rr[k])}" r="${(F.rr[k] * 36).toFixed(1)}" fill="#8a8f98"/>`).join('');
  return `<svg viewBox="0 0 ${((F.xN - F.xC) * 60 + 12).toFixed(0)} 82" xmlns="http://www.w3.org/2000/svg"><polygon fill="${color}" points="${X(F.xN)},${Y(d.yb + 0.03)} ${pts.join(' ')} ${X(F.xC)},${Y(d.yb + 0.16)} ${X(F.xC + 0.2)},${Y(d.yb)}"/>${ruedas}</svg>`;
}
export const ANCHO_RUEDAS = { gt: FORMAS.gt.ruedas, stock: FORMAS.stock.ruedas };
/** Carrocería de cada coche: en GT hay cinco (coupé, berlinetta, muscle, turismo y compacto). */
export function formaDe(categoria, semilla = 0) {
  if (categoria !== 'gt') return categoria;
  return FORMAS_GT[Math.abs(Math.floor(semilla)) % FORMAS_GT.length];
}

// ─── Superficie ──────────────────────────────────────────────────────────────────────────────
const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// interpolación suave (Catmull-Rom) de una tabla ordenada por x descendente
function interp(tabla, x, k) {
  const n = tabla.length;
  if (x >= tabla[0][0]) return tabla[0][k];
  if (x <= tabla[n - 1][0]) return tabla[n - 1][k];
  let i = 0; while (i < n - 2 && x < tabla[i + 1][0]) i++;
  const p0 = tabla[Math.max(0, i - 1)][k], p1 = tabla[i][k], p2 = tabla[i + 1][k], p3 = tabla[Math.min(n - 1, i + 2)][k];
  const t = (tabla[i][0] - x) / (tabla[i][0] - tabla[i + 1][0]);
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
}
const datos = (F, x) => ({ w: interp(F.baja, x, 1), yb: interp(F.baja, x, 2), ys: interp(F.baja, x, 3), yc: interp(F.baja, x, 4) });
/** Altura de la cara de arriba de la carrocería baja (aletas más altas que el capó). */
function ySup(d, z) {
  const u = Math.min(1, Math.abs(z) / (d.w - 0.12));
  return d.yc + (d.ys - d.yc) * sst(0.30, 0.80, u) + 0.012 * (1 - u * u) - 0.012;
}
/** z del costado a la altura y. */
function zCostado(d, y) {
  const ya = d.yb + 0.09, yz = d.ys - 0.07, t = Math.min(1, Math.max(0, (y - ya) / (yz - ya)));
  return d.w - 0.004 + 0.012 * Math.sin(Math.PI * t) - 0.018 * t * t;
}
/** El morro (y un poco la cola) son curvos en planta: desplazamiento en x según z. */
function arco(F, x, z) {
  return x - 0.16 * z * z * sst(F.xN - 0.42, F.xN, x) + 0.07 * z * z * (1 - sst(F.xC, F.xC + 0.3, x));
}
const kCab = (F, x) => { const m = (F.xPar + F.xLun) / 2; return -F.kR + (F.kF + F.kR) * sst(m - 0.3, m + 0.3, x); };
/** Altura del techo (parabrisas y luneta incluidos) en (x, z). */
const yTecho = (F, x, z = 0) => interp(F.techo, x + kCab(F, x) * z * z, 1) - 0.035 * (z / 0.7) ** 2;
const anchoCab = (F, x) => [interp(F.ancho, x, 1), interp(F.ancho, x, 2)];
/** x donde el parabrisas sale del capó y donde la luneta llega al maletero (por el eje). */
function limitesCabina(F) {
  if (F._lim) return F._lim;
  let a = F.techo[0][0], b = F.techo[F.techo.length - 1][0];
  while (a > F.xPar && yTecho(F, a) < ySup(datos(F, a), 0) + 0.004) a -= 0.005;
  while (b < F.xLun && yTecho(F, b) < ySup(datos(F, b), 0) + 0.004) b += 0.005;
  return (F._lim = [a, b]);
}

const NIVEL = [{ nF: 1, nL: 6, nT: 5, fino: 0.06, grueso: 0.18, cab: 0.10, nS: 3, nR: 4 }, { nF: 2, nL: 8, nT: 7, fino: 0.045, grueso: 0.14, cab: 0.07, nS: 4, nR: 5 },
  { nF: 2, nL: 11, nT: 9, fino: 0.03, grueso: 0.10, cab: 0.045, nS: 5, nR: 7 }];
const nivel = (calidad) => NIVEL[Math.max(0, Math.min(2, calidad))];

/** Media sección de la carrocería baja (lado +z): [z, y, tipo]; tipo 2 fondo, 0 costado, 3 arriba. */
function seccion(F, x, q) {
  const d = datos(F, x), { w, yb, ys } = d, p = [];
  for (let i = 0; i <= q.nF; i++) p.push([(w - 0.12) * i / q.nF, yb, 2]);
  p.push([w - 0.05, yb + 0.008, 2], [w - 0.015, yb + 0.045, 0]);
  const ya = yb + 0.09, yz = ys - 0.07;
  for (let i = 0; i <= q.nL; i++) { const y = ya + (yz - ya) * i / q.nL; p.push([zCostado(d, y), y, 0]); }
  p.push([w - 0.04, ys - 0.03, 0], [w - 0.075, ys - 0.008, 3]);
  for (let i = 0; i <= q.nT; i++) { const z = (w - 0.12) * (1 - i / q.nT); p.push([z, ySup(d, z), 3]); }
  return p;
}
const iCostado = (q) => q.nF + 3, iArriba = (q) => q.nF + q.nL + 6;

// malla a partir de anillos de puntos [x, y, z, marca]
function coser(anillos, tapas) {
  const nA = anillos.length, nP = anillos[0].length, pos = [], mar = [], idx = [];
  for (const a of anillos) for (const p of a) { pos.push(p[0], p[1], p[2]); mar.push(p[3] || 0); }
  for (let a = 0; a < nA - 1; a++) for (let p = 0; p < nP - 1; p++) {
    const i0 = a * nP + p, i1 = i0 + 1, i2 = i0 + nP, i3 = i2 + 1;
    idx.push(i0, i2, i1, i1, i2, i3);
  }
  // tapas del morro y de la cola, con sus propios vértices (cara plana, sin sombreado corrido)
  if (tapas) for (const [a, inv] of [[0, false], [nA - 1, true]]) {
    const r = anillos[a], c = pos.length / 3;
    const cy = r.reduce((s, p) => s + p[1], 0) / r.length;
    pos.push(r[0][0], cy, 0); mar.push(3);
    for (const p of r) { pos.push(p[0], p[1], p[2]); mar.push(3); }
    for (let p = 0; p < nP - 1; p++) { const i = c + 1 + p; if (inv) idx.push(c, i + 1, i); else idx.push(c, i, i + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('marca', new THREE.Float32BufferAttribute(mar, 1));
  g.setIndex(idx);
  return g;
}
function haciaFuera(g, centro) {
  g.computeVertexNormals();
  const P = g.attributes.position.array, N = g.attributes.normal.array; let s = 0;
  for (let i = 0; i < P.length; i += 3) s += (P[i] - centro[0]) * N[i] + (P[i + 1] - centro[1]) * N[i + 1] + P[i + 2] * N[i + 2];
  if (s < 0) { const I = g.index.array; for (let t = 0; t < I.length; t += 3) { const x = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = x; } g.computeVertexNormals(); }
  return g;
}
/** Normales suaves, pero sin mezclar la piel con los pasos de rueda ni con las tapas (aristas vivas). */
function normalesPorClase(g) {
  const P = g.attributes.position.array, M = g.attributes.marca.array, n = g.attributes.position.count;
  const N = new Float32Array(n * 3), suma = new Map(), clase = new Uint8Array(n / 3), claves = new Array(n);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    const t = i / 3; clase[t] = (M[i] === 1 || M[i + 1] === 1 || M[i + 2] === 1) ? 1 : M[i] === 3 || M[i + 1] === 3 || M[i + 2] === 3 ? 2 : 0;
    a.fromArray(P, i * 3); b.fromArray(P, i * 3 + 3); c.fromArray(P, i * 3 + 6);
    b.sub(a); c.sub(a); b.cross(c);                      // sin normalizar: pesa por área
    for (let k = 0; k < 3; k++) {
      const j = (i + k) * 3, cl = `${Math.round(P[j] * 2000)},${Math.round(P[j + 1] * 2000)},${Math.round(P[j + 2] * 2000)}|${clase[t]}`;
      claves[i + k] = cl;
      const s = suma.get(cl); if (s) { s[0] += b.x; s[1] += b.y; s[2] += b.z; } else suma.set(cl, [b.x, b.y, b.z]);
    }
  }
  for (let i = 0; i < n; i++) { const s = suma.get(claves[i]), l = Math.hypot(s[0], s[1], s[2]) || 1; N[i * 3] = s[0] / l; N[i * 3 + 1] = s[1] / l; N[i * 3 + 2] = s[2] / l; }
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  return g;
}
const HUECO = 0.045;      // holgura entre el neumático y el paso de rueda

function carroceriaBaja(F, ruedas, q) {
  const xs = [];
  const cerca = (x) => ruedas.some(w => Math.abs(x - w.x) < w.r + HUECO + 0.08);
  for (let x = F.xN; x > F.xC + 0.001; x -= cerca(x) ? q.fino : (x > F.xN - 0.3 || x < F.xC + 0.25) ? q.fino * 1.4 : q.grueso) xs.push(x);
  xs.push(F.xC);
  // 1) anillos en bruto; lo que tapa la rueda se mete hasta su cara interior (la aleta de encima se queda)
  const bruto = [];
  for (const x of xs) {
    const media = seccion(F, x, q);
    const lado = [...media.map(p => [p[0], p[1], p[2], 1]), ...media.slice(0, -1).reverse().map(p => [p[0], p[1], p[2], -1])];
    bruto.push(lado.map(([zz, y, tipo, sg]) => {
      const v = { x, y, z: zz * sg, tipo, marca: tipo === 2 ? 2 : 0, rueda: null };
      // lo que queda bajo la cabina se quita: por los cristales se ve el interior
      if (tipo === 3 && x < F.techo[0][0] - 0.02 && x > F.techo[F.techo.length - 1][0] + 0.02 && zz < anchoCab(F, x)[0] - 0.05 && yTecho(F, x, zz) > y + 0.035) v.marca = 4;
      if (tipo !== 3) for (const r of ruedas) {
        const zIn = Math.abs(r.z) - r.w / 2 - 0.05;
        if (Math.sign(v.z || 1) !== Math.sign(r.z) || Math.abs(v.z) <= zIn) continue;
        const dist = Math.hypot(x - r.x, y - r.r), ra = r.r + HUECO;
        if (dist < ra) { v.z = Math.sign(v.z) * zIn; v.marca = 1; } else if (dist < ra + 0.2) v.rueda = r;
      }
      return v;
    }));
  }
  // 2) los vértices del costado vecinos de uno metido se ponen sobre el círculo: el borde del arco sale redondo
  const nP = bruto[0].length, dentro = (a, p) => a >= 0 && a < bruto.length && p >= 0 && p < nP && bruto[a][p].marca === 1;
  const mover = [];
  bruto.forEach((an, a) => an.forEach((v, p) => {
    if (v.marca === 1 || !v.rueda || v.tipo !== 0) return;
    let vecino = false;
    for (let da = -1; da <= 1 && !vecino; da++) for (let dp = -1; dp <= 1; dp++) if (dentro(a + da, p + dp)) { vecino = true; break; }
    if (vecino) mover.push(v);
  }));
  for (const v of mover) {
    const r = v.rueda, ra = r.r + HUECO, dx = v.x - r.x, dy = v.y - r.r, dist = Math.hypot(dx, dy);
    if (dy > -0.16) { v.x = r.x + dx / dist * ra; v.y = r.r + dy / dist * ra; }
  }
  const anillos = bruto.map(an => an.map(v => [arco(F, v.x, v.z), v.y, v.z, v.marca]));
  return haciaFuera(coser(anillos, true), [0, 0.5]);
}

function cabina(F, q) {
  const xA = F.techo[0][0], xB = F.techo[F.techo.length - 1][0], xs = [];
  for (let x = xA; x > xB + 0.001; x -= q.cab) xs.push(x);
  xs.push(xB);
  const anillos = [];
  for (const x of xs) {
    const [wb, wr] = anchoCab(F, x), base = ySup(datos(F, x), wb) - 0.02;
    const yL = yTecho(F, x, wr), m = [[wb, base]];
    for (let i = 1; i <= q.nS; i++) { const t = i / q.nS; m.push([wb + (wr + 0.035 - wb) * t, base + (yL - 0.07 - base) * t]); }
    m.push([wr + 0.012, yL - 0.03], [wr - 0.03, yL - 0.008]);
    for (let i = 0; i <= q.nR; i++) { const z = (wr - 0.09) * (1 - i / q.nR); m.push([z, yTecho(F, x, z)]); }
    const media = m.map(([z, y]) => [z, Math.max(base, y)]);
    // (marca 5: costado de la cabina; su librea sale siempre de la vista de costado)
    const mc = (i) => (i <= q.nS + 1 ? 5 : 0), n = media.length;
    anillos.push([...media.map((p, i) => [x, p[1], p[0], mc(i)]), ...media.slice(0, -1).reverse().map((p, i) => [x, p[1], -p[0], mc(n - 2 - i)])]);
  }
  return haciaFuera(coser(anillos, false), [(xA + xB) / 2, 0.6]);
}

// ─── Atlas de la librea ──────────────────────────────────────────────────────────────────────
//   ┌──────────────── ARRIBA (morro a la derecha) ──────────────┐  v 0 – 0,40
//   ├──────────────── LADO DERECHO (morro a la derecha) ────────┤  v 0,40 – 0,62
//   ├──────────────── LADO IZQUIERDO (morro a la izquierda) ────┤  v 0,62 – 0,84
//   └── FRENTE ──┴── TRASERA ──┴── oscuro (fondo y pasos) ──────┘  v 0,84 – 1
const ZM = 1.07, YM = 1.34, OSCURO_UV = [0.87, 0.92];
/** Matrices (a, d, e, f) de cada vista para un lienzo de W × H: píxel = (a·p + e, d·q + f). */
function vistas(F, W, H) {
  const x1 = F.xC - 0.05, L = F.xN + 0.05 - x1, ex = W / L;
  return {
    arriba: { m: [ex, 0.2 * H / ZM, -x1 * ex, 0.2 * H], rect: [0, 0, W, 0.4 * H] },                     // (x, z)
    der: { m: [ex, -0.22 * H / YM, -x1 * ex, 0.62 * H], rect: [0, 0.4 * H, W, 0.22 * H] },              // (x, y)
    izq: { m: [-ex, -0.22 * H / YM, W + x1 * ex, 0.84 * H], rect: [0, 0.62 * H, W, 0.22 * H] },         // (x, y)
    frente: { m: [-0.18 * W / ZM, -0.16 * H / YM, 0.18 * W, H], rect: [0, 0.84 * H, 0.36 * W, 0.16 * H] },   // (z, y)
    tras: { m: [0.18 * W / ZM, -0.16 * H / YM, 0.54 * W, H], rect: [0.36 * W, 0.84 * H, 0.36 * W, 0.16 * H] }, // (z, y)
  };
}
/** UV de cada triángulo según hacia dónde mira (malla sin índices con el atributo «marca»). */
function asignarUV(g, F) {
  const P = g.attributes.position.array, M = g.attributes.marca.array, n = g.attributes.position.count;
  const uv = new Float32Array(n * 2), V = vistas(F, 1, 1);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nr = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    a.fromArray(P, i * 3); b.fromArray(P, i * 3 + 3); c.fromArray(P, i * 3 + 6);
    nr.subVectors(b, a).cross(c.clone().sub(a)).normalize();
    const xc = (a.x + b.x + c.x) / 3, zc = (a.z + b.z + c.z) / 3;
    const paso = M[i] === 1 || M[i + 1] === 1 || M[i + 2] === 1, fondo = M[i] === 2 && M[i + 1] === 2 && M[i + 2] === 2;
    let v = null;
    const costado = M[i] === 5 && M[i + 1] === 5 && M[i + 2] === 5;
    if (paso || fondo) v = null;
    else if (costado) v = zc >= 0 ? 'der' : 'izq';
    else if (nr.x > 0.6 && xc > F.xN - 0.45) v = 'frente';
    else if (nr.x < -0.6 && xc < F.xC + 0.45) v = 'tras';
    else if (nr.y > 0.55 || (nr.y > Math.abs(nr.z) && Math.abs(nr.x) < 0.7)) v = 'arriba';
    else v = (Math.abs(nr.z) > 0.2 ? nr.z > 0 : zc >= 0) ? 'der' : 'izq';
    for (let k = 0; k < 3; k++) {
      const p = k === 0 ? a : k === 1 ? b : c, j = (i + k) * 2;
      let U, Vv;
      if (!v) [U, Vv] = OSCURO_UV;
      else { const m = V[v].m, [s, t] = v === 'arriba' ? [p.x, p.z] : v === 'der' || v === 'izq' ? [p.x, p.y] : [p.z, p.y]; U = m[0] * s + m[2]; Vv = m[1] * t + m[3]; }
      uv[j] = U; uv[j + 1] = 1 - Vv;         // las texturas de lienzo van con flipY
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.deleteAttribute('marca');
  return g;
}

// ─── Librea ──────────────────────────────────────────────────────────────────────────────────
const CRISTAL = '#06080c', NEGRO = '#08090b';
function poli(c, pts) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); }
function relleno(c, pts, color) { poli(c, pts); c.fillStyle = color; c.fill(); }
/** Cinta a lo largo de una línea [[x, y]…] con el grosor dado hacia abajo (o [grosor por punto]). */
function cinta(c, linea, grosor, color, dy = 0) {
  const g = (i) => (Array.isArray(grosor) ? grosor[i] : grosor);
  relleno(c, [...linea.map(([x, y]) => [x, y + dy]), ...linea.map(([x, y], i) => [x, y + dy - g(i)]).reverse()], color);
}
/** Rejilla: fondo oscuro con lamas. */
function rejilla(c, x, y, w, h, n, vertical = false, color = 'rgba(120,128,140,.5)') {
  c.fillStyle = NEGRO; c.fillRect(x, y, w, h);
  c.fillStyle = color;
  for (let k = 1; k < n; k++) { if (vertical) c.fillRect(x + w * k / n - w * 0.012, y, w * 0.024, h); else c.fillRect(x, y + h * k / n - h * 0.012, w, h * 0.024); }
}
/** Malla de panal en un polígono. */
function malla(c, pts, paso = 0.035) {
  c.save(); poli(c, pts); c.fillStyle = NEGRO; c.fill(); c.clip();
  c.strokeStyle = 'rgba(96,104,118,.6)'; c.lineWidth = paso * 0.11;
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  c.beginPath();
  for (let k = -((y1 - y0) / paso) | 0; k < (x1 - x0) / paso + 1; k++) { c.moveTo(x0 + k * paso, y0); c.lineTo(x0 + k * paso + (y1 - y0), y1); c.moveTo(x0 + k * paso + (y1 - y0), y0); c.lineTo(x0 + k * paso, y1); }
  c.stroke(); c.restore();
}

// Dibujos de la librea. k: 'l' costado (x, y) · 'a' arriba (x, z) · 'f' frente · 't' trasera (z, y)
const PATRONES = {
  lisa(c, k, F, col) {
    if (k === 'l') { c.fillStyle = col.acento; c.fillRect(F.xC - 0.2, 0.275, F.xN - F.xC + 0.4, 0.028); c.fillStyle = col.tercero; c.fillRect(F.xC - 0.2, 0.255, F.xN - F.xC + 0.4, 0.010); }
    if (k === 'f' || k === 't') { c.fillStyle = col.acento; c.fillRect(-1.2, 0.275, 2.4, 0.028); }
  },
  franjas(c, k, F, col) {
    const L = F.xN - F.xC + 0.4;
    if (k === 'a') for (const s of [-1, 1]) {
      c.fillStyle = col.acento; c.fillRect(F.xC - 0.2, s * 0.19 - 0.12, L, 0.24);
      c.fillStyle = col.tercero; c.fillRect(F.xC - 0.2, s * 0.19 - 0.155, L, 0.018); c.fillRect(F.xC - 0.2, s * 0.19 + 0.137, L, 0.018);
    }
    if (k === 'f' || k === 't') for (const s of [-1, 1]) {
      c.fillStyle = col.acento; c.fillRect(s * 0.19 - 0.12, 0, 0.24, 1.4);
      c.fillStyle = col.tercero; c.fillRect(s * 0.19 - 0.155, 0, 0.018, 1.4); c.fillRect(s * 0.19 + 0.137, 0, 0.018, 1.4);
    }
    if (k === 'l') {
      const [xf, xr] = F.rx, l = [[F.xN + 0.1, 0.36], [xf - 0.3, 0.42], [0.2, 0.44], [xr + 0.75, 0.50], [xr + 0.1, 0.80], [F.xC - 0.2, 0.92]];
      cinta(c, l, [0.16, 0.2, 0.22, 0.24, 0.3, 0.34], col.acento);
      cinta(c, l, 0.022, col.tercero, 0.05); cinta(c, l, [0.016, 0.016, 0.016, 0.016, 0.016, 0.016], col.tercero, -0.27);
    }
  },
  flecha(c, k, F, col) {
    if (k === 'l') {
      relleno(c, [[F.xC - 0.2, 0], [F.xC - 0.2, 1.4], [-0.95, 1.4], [0.25, 0.60], [F.rx[0] + 0.1, 0.12], [F.rx[0] - 0.2, 0]], col.acento);
      relleno(c, [[-0.80, 1.4], [0.42, 0.60], [F.rx[0] + 0.30, 0.12], [F.rx[0] + 0.42, 0.12], [0.52, 0.60], [-0.68, 1.4]], col.tercero);
      relleno(c, [[-0.58, 1.4], [0.62, 0.60], [F.rx[0] + 0.52, 0.12], [F.rx[0] + 0.57, 0.12], [0.66, 0.60], [-0.53, 1.4]], col.acento);
    }
    if (k === 'a') {
      relleno(c, [[F.xC - 0.2, -1.2], [F.xC - 0.2, 1.2], [0.1, 1.2], [-0.75, 0.6], [-1.25, 0], [-0.75, -0.6], [0.1, -1.2]], col.acento);
      relleno(c, [[0.25, 1.2], [-0.62, 0.6], [-1.12, 0], [-0.62, -0.6], [0.25, -1.2], [0.38, -1.2], [-0.5, -0.6], [-1.0, 0], [-0.5, 0.6], [0.38, 1.2]], col.tercero);
      // flecha del capó
      relleno(c, [[F.xN + 0.1, 0], [F.xN - 0.75, 0.9], [F.xN - 1.0, 0.9], [F.xN - 0.3, 0], [F.xN - 1.0, -0.9], [F.xN - 0.75, -0.9]], col.acento);
    }
    if (k === 't') { c.fillStyle = col.acento; c.fillRect(-1.2, 0, 2.4, 1.4); }
    if (k === 'f') relleno(c, [[0, 0.7], [0.42, 0], [-0.42, 0]], col.acento);
  },
  degradado(c, k, F, col) {
    const puntos = (px, x0, x1, y0, y1) => {
      c.fillStyle = col.acento;
      for (let i = 0, x = x0; x < x1; x += 0.062, i++) {
        const t = (x - x0) / (x1 - x0), r = 0.041 * (1 - t) ** 0.8;
        if (r < 0.004) continue;
        for (let y = y0 + (i % 2) * 0.031; y < y1; y += 0.062) { c.beginPath(); c.arc(px ? x : y, px ? y : x, r, 0, Math.PI * 2); c.fill(); }
      }
    };
    if (k === 'l' || k === 'a') {
      c.fillStyle = col.acento; c.fillRect(F.xC - 0.2, -1.4, -1.3 - F.xC + 0.2, 2.8);
      puntos(true, -1.32, 1.1, k === 'l' ? 0 : -1.2, k === 'l' ? 1.4 : 1.2);
      if (k === 'l') { c.fillStyle = col.tercero; c.fillRect(F.xC - 0.2, 0.235, F.xN - F.xC + 0.4, 0.018); }
    }
    if (k === 't') { c.fillStyle = col.acento; c.fillRect(-1.2, 0, 2.4, 1.4); }
    if (k === 'f') { c.fillStyle = col.tercero; c.fillRect(-1.2, 0.235, 2.4, 0.018); }
  },
  rayo(c, k, F, col) {
    if (k === 'l') {
      const sup = [[F.xC - 0.2, 0.80], [-1.0, 0.66], [-0.72, 0.80], [0.3, 0.54], [0.56, 0.68], [1.5, 0.40], [F.xN + 0.1, 0.34]];
      const inf = [[F.xN + 0.1, 0.29], [1.42, 0.27], [0.5, 0.50], [0.24, 0.38], [-0.78, 0.62], [-1.06, 0.47], [F.xC - 0.2, 0.58]];
      relleno(c, [...sup, ...inf], col.acento);
      relleno(c, inf.map(([x, y]) => [x, y - 0.035]).concat(inf.map(([x, y]) => [x, y - 0.075]).reverse()), col.tercero);
    }
    if (k === 'a') for (const s of [-1, 1]) {
      const sup = [[F.xN + 0.1, 0.14], [1.5, 0.30], [0.9, 0.16], [-0.1, 0.44], [-0.5, 0.26], [F.xC - 0.2, 0.52]];
      const inf = [[F.xC - 0.2, 0.70], [-0.42, 0.44], [0.0, 0.62], [0.98, 0.33], [1.56, 0.47], [F.xN + 0.1, 0.24]];
      relleno(c, [...sup, ...inf].map(([x, z]) => [x, z * s]), col.acento);
      relleno(c, inf.map(([x, z]) => [x, (z + 0.035) * s]).concat(inf.map(([x, z]) => [x, (z + 0.07) * s]).reverse()), col.tercero);
    }
    if (k === 'f' || k === 't') for (const s of [-1, 1]) { c.fillStyle = col.acento; c.fillRect(s * (k === 'f' ? 0.19 : 0.61) - 0.06, 0, 0.12, 1.4); }
  },
  geometrico(c, k, F, col) {
    const tonos = [col.acento, col.tercero, col.acento, oscuro(col.base, 0.35), col.acento, col.tercero, col.acento];
    const anchos = [0.55, 0.07, 0.30, 0.20, 0.16, 0.05, 0.09];
    let x0 = F.xC - 0.35;
    tonos.forEach((t, i) => {
      const w = anchos[i];
      if (k === 'l') relleno(c, [[x0, 0], [x0 + w, 0], [x0 + w + 0.85, 1.4], [x0 + 0.85, 1.4]], t);
      if (k === 'a') { const xa = x0 + 0.78; relleno(c, [[xa, 1.2], [xa + w, 1.2], [xa + w - 0.55, 0], [xa + w, -1.2], [xa, -1.2], [xa - 0.55, 0]], t); }
      x0 += w + (i % 2 ? 0.10 : 0.06);
    });
    if (k === 't') { c.fillStyle = col.acento; c.fillRect(-1.2, 0, 2.4, 1.4); relleno(c, [[-1.2, 0.5], [1.2, 0.9], [1.2, 1.0], [-1.2, 0.6]], col.tercero); }
    if (k === 'f') relleno(c, [[-1.2, 0.30], [1.2, 0.44], [1.2, 0.50], [-1.2, 0.36]], col.acento);
  },
  digital(c, k, F, col) {
    const t = 0.085, tonos = [col.acento, col.tercero, oscuro(col.base, 0.4), claro(col.base, 0.25)];
    const h = (i, j, s) => { const v = Math.sin(i * 127.1 + j * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };
    const celdas = (a0, a1, b0, b1, dens, s) => {
      for (let i = Math.floor(a0 / t); i * t < a1; i++) for (let j = Math.floor(b0 / t); j * t < b1; j++) {
        const q = h(i, j, s), d = dens(i * t);
        if (q < d) { c.fillStyle = tonos[Math.floor(h(i, j, s + 5) * 3.99)]; c.fillRect(i * t, j * t, t * (h(i, j, s + 9) < 0.3 ? 2 : 1) + 0.002, t + 0.002); }
      }
    };
    const dens = (x) => 0.10 + 0.5 * sst(1.2, -1.8, x);
    if (k === 'l') celdas(F.xC - 0.2, F.xN + 0.1, 0, 1.4, dens, 1);
    if (k === 'a') celdas(F.xC - 0.2, F.xN + 0.1, -1.2, 1.2, dens, 2);
    if (k === 't') celdas(-1.2, 1.2, 0, 1.4, () => 0.6, 3);
    if (k === 'f') celdas(-1.2, 1.2, 0, 1.4, () => 0.10, 4);
  },
  llamas(c, k, F, col) {
    const lengua = (x0, yc, largo, alto) => {
      const yp = yc + alto * 0.5;                          // la punta sube un poco, como una llama
      c.beginPath(); c.moveTo(x0, yc - alto);
      c.bezierCurveTo(x0 - largo * 0.35, yc - alto * 1.05, x0 - largo * 0.62, yc - alto * 0.5, x0 - largo, yp);
      c.bezierCurveTo(x0 - largo * 0.55, yc + alto * 0.55, x0 - largo * 0.3, yc + alto * 1.1, x0, yc + alto);
      c.closePath();
    };
    const x0 = F.rx[0] + 0.25;
    // primero todas en el tercer color y algo mayores (el filo de la llama) y encima las del acento;
    // las raíces se solapan y forman un frente continuo
    const todas = (lista) => {
      for (const pasada of [0, 1]) for (const [yc, largo, alto] of lista) {
        if (pasada === 0) lengua(x0 + 0.03, yc, largo + 0.10, alto * 1.32); else lengua(x0 + 0.03, yc, largo, alto);
        c.fillStyle = pasada === 0 ? col.tercero : col.acento; c.fill();
      }
    };
    if (k === 'l') {
      c.fillStyle = col.acento; c.fillRect(x0, 0, F.xN - x0 + 0.3, 1.4);
      todas([[0.26, 1.2, 0.13], [0.45, 2.1, 0.14], [0.64, 1.5, 0.14], [0.83, 2.4, 0.13], [1.0, 1.1, 0.12]]);
    }
    if (k === 'a') {
      c.fillStyle = col.acento; c.fillRect(x0, -1.2, F.xN - x0 + 0.3, 2.4);
      todas([[-0.92, 1.0, 0.13], [-0.68, 1.9, 0.15], [-0.42, 1.3, 0.15], [-0.15, 2.3, 0.16], [0.15, 2.3, 0.16], [0.42, 1.3, 0.15], [0.68, 1.9, 0.15], [0.92, 1.0, 0.13]]);
    }
    if (k === 'f') { c.fillStyle = col.acento; c.fillRect(-1.2, 0, 2.4, 1.4); }
  },
};

/** Contorno de las ventanillas en la vista de costado: [[x, abajo, arriba]…] (de delante atrás). */
function ventanilla(F) {
  const yL = (x) => yTecho(F, x, anchoCab(F, x)[1]), out = [];
  for (let x = F.lat[0]; x >= F.lat[1] - 0.001; x -= 0.03) {
    const ab = ySup(datos(F, x), anchoCab(F, x)[0]) + 0.03;
    const ar = Math.min(yL(x - 0.07), yL(x), yL(x + 0.07)) - 0.078;
    if (ar > ab + 0.012) out.push([x, ab, ar]);
  }
  return out;
}
/** Parabrisas (del = true) o luneta en la vista de arriba: polígono [[x, z]…]. */
function lunaArriba(F, del) {
  const [xCowl, xDeck] = limitesCabina(F), pts = [];
  const k = del ? F.kF : -F.kR;
  const xa = del ? xCowl - 0.015 : F.xLun - 0.05, xb = del ? F.xPar + 0.05 : xDeck + 0.04;      // delante · detrás (por el eje)
  const za = anchoCab(F, del ? xCowl : F.xLun)[del ? 0 : 1] - (del ? 0.10 : 0.06);
  const zb = anchoCab(F, del ? F.xPar : xDeck)[del ? 1 : 0] - (del ? 0.055 : 0.14);
  for (let i = -10; i <= 10; i++) { const z = za * i / 10; pts.push([xa - k * z * z, z]); }
  for (let i = 10; i >= -10; i--) { const z = zb * i / 10; pts.push([xb - k * z * z, z]); }
  return pts;
}

/** En una vista: recorta a su rectángulo, pone metros del coche y llama a fn. */
function enVista(c, v, fn) {
  c.save(); c.beginPath(); c.rect(...v.rect); c.clip();
  c.setTransform(v.m[0], 0, 0, v.m[1], v.m[2], v.m[3]);
  fn(v); c.restore();
}
/** Dibuja algo «derecho» (letras) en (x, y) de la vista, en centímetros; rot en radianes. */
function selloV(c, v, x, y, fn, rot = 0) {
  c.save(); c.translate(x, y); c.scale(0.01 * Math.sign(v.m[0]), 0.01 * Math.sign(v.m[1])); if (rot) c.rotate(rot);
  fn(); c.restore();
}

/**
 * Pinta la librea completa de una carrocería cerrada: colores y dibujo del equipo, cristales,
 * líneas de las piezas, rejillas, dorsales y patrocinadores.
 */
export function pintarLibreaCerrada(cv, { categoria, patron = 'franjas', colores, numero = 7, nombre = '', transparente = false, relieve = false }) {
  const W = cv.width, H = cv.height, c = cv.getContext('2d');
  const F = FORMAS[categoria] || FORMAS.gt, stock = categoria === 'stock';
  // (relieve: el mismo dibujo en blanco con solo las juntas, rejillas y huecos; de ahí sale el mapa de normales)
  const col = relieve ? { base: '#ffffff', acento: '#ffffff', tercero: '#ffffff' } : { base: '#0d47ff', acento: '#00e5ff', tercero: '#ffffff', ...colores };
  const V = vistas(F, W, H), pat = relieve ? () => {} : (PATRONES[patron] || PATRONES.lisa);
  const sello = relieve ? () => {} : selloV;
  // cristal: transparente (se recorta la textura) u oscuro
  const luna = (g) => { if (transparente) { c.globalCompositeOperation = 'destination-out'; c.fillStyle = '#000'; c.fill(); c.globalCompositeOperation = 'source-over'; } else { c.fillStyle = relieve ? '#9a9a9a' : g; c.fill(); } };
  const pub = patrocinadores(nombre || col.base + col.acento);
  const [xf, xr] = F.rx, rF = F.rr[0], rT = F.rr[1];
  const [xCowl, xDeck] = limitesCabina(F), techoMax = Math.max(...F.techo.map(p => p[1]));
  const dN = datos(F, F.xN), dC = datos(F, F.xC), cinturon = (x) => datos(F, x).ys;
  const tinta = contraste(col.base), linea = relieve ? '#000000' : luma(col.base) > 60 ? 'rgba(0,0,0,.5)' : 'rgba(255,255,255,.22)';
  const sello_ = (v, x, y, fn, rot) => sello(c, v, x, y, fn, rot);
  const xd = (F.puerta[0] + F.puerta[1]) / 2;

  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = col.base; c.fillRect(0, 0, W, H);
  c.fillStyle = NEGRO; c.fillRect(0.72 * W, 0.84 * H, 0.28 * W, 0.16 * H);

  // ── costados ──
  const vent = ventanilla(F);
  for (const lado of ['der', 'izq']) enVista(c, V[lado], (v) => {
    pat(c, 'l', F, col);
    // faldón y bajos de los paragolpes en carbono
    c.fillStyle = NEGRO; c.fillRect(F.xC - 0.2, 0, F.xN - F.xC + 0.4, 0.205);
    c.fillStyle = col.acento; c.fillRect(xr + rT + 0.08, 0.205, xf - rF - xr - rT - 0.16, 0.012);
    // salida de aire tras la rueda delantera · toma de aire ante la trasera
    if (F.branquia) {
      const x0 = xf - rF - 0.075;
      relleno(c, [[x0, 0.215], [x0, 0.60], [x0 - 0.20, 0.56], [x0 - 0.40, 0.215]], NEGRO);
      c.fillStyle = 'rgba(120,128,140,.55)';
      for (let k = 1; k <= 3; k++) relleno(c, [[x0 - 0.008, 0.215 + k * 0.09], [x0 - 0.008, 0.225 + k * 0.09], [x0 - 0.37 + k * 0.045, 0.225 + k * 0.09], [x0 - 0.38 + k * 0.045, 0.215 + k * 0.09]], 'rgba(120,128,140,.55)');
    }
    if (F.tomaLateral) {
      const x0 = xr + rT + 0.10;
      relleno(c, [[x0, 0.30], [x0, 0.74], [x0 + 0.20, 0.72], [x0 + 0.66, 0.50], [x0 + 0.60, 0.30]], NEGRO);
      relleno(c, [[x0 + 0.03, 0.52], [x0 + 0.03, 0.535], [x0 + 0.62, 0.50], [x0 + 0.60, 0.485]], col.acento);
    }
    // cristales: ventanillas (con el pilar B pintado) y marco negro
    if (vent.length > 2) {
      const marco = [...vent.map(([x, ab]) => [x, ab - 0.014]), ...vent.map(([x, , ar]) => [x, ar + 0.014]).reverse()];
      relleno(c, marco, '#101216');
      const corta = (a, b) => vent.filter(([x]) => x <= a && x >= b);
      for (const tramo of [corta(F.lat[0], F.pilarB[1]), corta(F.pilarB[0], F.lat[1])]) {
        if (tramo.length < 2) continue;
        poli(c, [...tramo.map(([x, ab]) => [x, ab]), ...tramo.map(([x, , ar]) => [x, ar]).reverse()]);
        const g = c.createLinearGradient(0, techoMax, 0, cinturon(0));
        g.addColorStop(0, '#1b2531'); g.addColorStop(0.45, CRISTAL); g.addColorStop(1, '#0c1016');
        luna(g);
      }
      // red de la ventanilla del piloto y nombre del equipo en la trasera
      const del = corta(F.lat[0], F.pilarB[1]);
      if (del.length > 3 && !relieve) {
        c.save(); poli(c, [...del.map(([x, ab]) => [x, ab]), ...del.map(([x, , ar]) => [x, ar]).reverse()]); c.clip();
        c.strokeStyle = transparente ? 'rgba(20,22,26,1)' : 'rgba(150,160,175,.22)'; c.lineWidth = transparente ? 0.009 : 0.006; c.beginPath();
        for (let x = F.pilarB[1]; x < F.lat[0] + 0.5; x += transparente ? 0.085 : 0.05) { c.moveTo(x, 0.6); c.lineTo(x - 0.5, 1.4); c.moveTo(x - 0.5, 0.6); c.lineTo(x, 1.4); }
        c.stroke(); c.restore();
      }
      const tras = corta(F.pilarB[0], F.lat[1]);
      if (tras.length > 4) { const m = tras[Math.min(tras.length - 1, 3)]; sello_(v, m[0] - 0.14, (m[1] + m[2]) / 2, () => { c.fillStyle = '#ffffff'; c.font = fuente(4.2); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(numero), 0, 0); }); }
    }
    // líneas de las piezas: puerta, paragolpes, tapón de gasolina
    c.strokeStyle = linea; c.lineWidth = 0.009; c.lineJoin = 'round';
    if (!stock) {
      const yp = Math.min(cinturon(F.puerta[0]), cinturon(F.puerta[1])) - 0.012;
      c.beginPath(); c.moveTo(F.puerta[0], yp); c.lineTo(F.puerta[0] - 0.04, 0.26); c.quadraticCurveTo(F.puerta[0] - 0.05, 0.215, F.puerta[0] - 0.11, 0.215);
      c.lineTo(F.puerta[1] + 0.08, 0.215); c.quadraticCurveTo(F.puerta[1], 0.215, F.puerta[1], 0.30); c.lineTo(F.puerta[1], yp + 0.03); c.stroke();
      c.fillStyle = '#15171b'; c.fillRect(F.puerta[1] + 0.06, yp - 0.085, 0.13, 0.022);         // tirador
    }
    for (const x of [xf + rF + 0.20, xr - rT - 0.17]) { c.beginPath(); c.moveTo(x, 0.21); c.lineTo(x + (x > 0 ? 0.03 : -0.03), cinturon(x) - 0.04); c.stroke(); }
    { const x = xr + rT + 0.16, y = cinturon(x) - 0.085;
      c.fillStyle = '#b9bec6'; c.beginPath(); c.arc(x, y, 0.047, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#e8202a'; c.beginPath(); c.arc(x, y, 0.030, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1a1c20'; c.beginPath(); c.arc(x, y, 0.011, 0, Math.PI * 2); c.fill(); }
    // ── publicidad ──
    if (stock) {
      sello_(v, xd - 0.05, 0.535, () => numeroGrande(c, numero, 58, col.tercero, contraste(col.tercero), 'rgba(0,0,0,.35)'));
      sello_(v, xr + 0.02, cinturon(xr) - 0.075, () => logo(c, pub.principal, 8.5, { ancho: 78 }));
      sello_(v, xf - 0.02, cinturon(xf) - 0.045, () => logo(c, pub.segundo, 5, { ancho: 60 }));
      sello_(v, xf - rF - 0.21, 0.50, () => columna(c, pub.tecnicas.slice(0, 5), 3.6, 27));
      sello_(v, xf - rF - 0.50, 0.50, () => columna(c, pub.tecnicas.slice(5, 10), 3.6, 27));
      sello_(v, xr + rT + 0.42, 0.42, () => logo(c, pub.tercero, 6.5, { ancho: 62 }));
      sello_(v, (xr - rT + F.xC) / 2, 0.52, () => logo(c, pub.cuarto, 6, { ancho: 46 }));
    } else {
      sello_(v, xd + 0.20, 0.60, () => dorsal(c, numero, 31, { clase: 'GT3', colorClase: col.acento }));
      sello_(v, xd - 0.07, 0.315, () => logo(c, pub.principal, 11.5, { ancho: (F.puerta[0] - F.puerta[1]) * 92, borde: col.acento }));
      sello_(v, xd - 0.30, 0.60, () => columna(c, pub.tecnicas.slice(0, 4), 3.8, 30));
      if (F.branquia) sello_(v, xf - rF - 0.30, 0.685, () => logo(c, pub.segundo, 5.2, { ancho: 46 }));
      else sello_(v, xf - rF - 0.36, 0.46, () => logo(c, pub.segundo, 6.5, { ancho: 56 }));
      sello_(v, xr - 0.02, cinturon(xr) - 0.085, () => logo(c, pub.tercero, 5.6, { ancho: 70 }));
      sello_(v, (xr - rT + F.xC) / 2 - 0.02, 0.60, () => logo(c, pub.cuarto, 5.2, { ancho: 40 }));
      sello_(v, (xf + rF + F.xN) / 2, 0.37, () => logo(c, 'APEX', 4.6, { ancho: 40 }));
    }
    sello_(v, (xf + xr) / 2, 0.155, () => { c.fillStyle = '#f2f4f7'; c.font = fuente(4.6); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('UPGAMES.GAMES', 0, 0); });
    // pegatinas técnicas
    sello_(v, F.puerta[0] + 0.10, cinturon(F.puerta[0]) - 0.075, () => tecnica(c, 'corriente', 3.4));
    sello_(v, F.puerta[0] + 0.19, cinturon(F.puerta[0]) - 0.075, () => tecnica(c, 'extintor', 3));
    sello_(v, xr - rT - 0.10, 0.27, () => tecnica(c, 'gato', 3));
  });

  // ── arriba ──
  enVista(c, V.arriba, (v) => {
    pat(c, 'a', F, col);
    // líneas del capó y del maletero
    c.strokeStyle = linea; c.lineWidth = 0.009; c.lineJoin = 'round';
    const zc = 0.60, xc0 = xCowl + 0.07, xc1 = F.xN - 0.16;
    c.beginPath(); c.moveTo(xc0, -zc); c.lineTo(xc1 - 0.1, -zc + 0.04); c.quadraticCurveTo(xc1, -zc + 0.08, xc1, -zc + 0.2); c.lineTo(xc1, zc - 0.2); c.quadraticCurveTo(xc1, zc - 0.08, xc1 - 0.1, zc - 0.04); c.lineTo(xc0, zc); c.stroke();
    if (xDeck - F.xC > 0.3) { c.beginPath(); c.moveTo(xDeck - 0.06, -0.62); c.lineTo(F.xC + 0.10, -0.60); c.lineTo(F.xC + 0.10, 0.60); c.lineTo(xDeck - 0.06, 0.62); c.stroke(); }
    // salida del radiador en el capó (motor delantero) o tomas NACA (motor central)
    if (F.toma) {
      const [a, b] = F.toma;
      relleno(c, [[a, -0.40], [b, -0.30], [b, 0.30], [a, 0.40]], NEGRO);
      c.fillStyle = 'rgba(120,128,140,.5)';
      for (let k = 1; k < 6; k++) { const x = a + (b - a) * k / 6, z = 0.40 - 0.10 * k / 6; c.fillRect(x - 0.008, -z + 0.02, 0.016, 2 * z - 0.04); }
      relleno(c, [[a - 0.02, -0.42], [a, -0.40], [a, 0.40], [a - 0.02, 0.42]], col.acento);
    } else if (!stock) {
      for (const s of [-1, 1]) relleno(c, [[xCowl + 0.62, s * 0.30], [xCowl + 0.62, s * 0.44], [xCowl + 0.34, s * 0.50], [xCowl + 0.30, s * 0.47], [xCowl + 0.30, s * 0.27], [xCowl + 0.34, s * 0.24]], NEGRO);
    }
    // lamas sobre los pasos de rueda delanteros (y traseros en el de motor central)
    if (!stock) for (const s of [-1, 1]) {
      for (let k = 0; k < 5; k++) relleno(c, [[xf - 0.20 + k * 0.085, s * 0.66], [xf - 0.165 + k * 0.085, s * 0.66], [xf - 0.125 + k * 0.085, s * 0.885], [xf - 0.16 + k * 0.085, s * 0.885]], NEGRO);
      if (F.tomaLateral) for (let k = 0; k < 4; k++) relleno(c, [[xr - 0.14 + k * 0.085, s * 0.70], [xr - 0.105 + k * 0.085, s * 0.70], [xr - 0.07 + k * 0.085, s * 0.90], [xr - 0.105 + k * 0.085, s * 0.90]], NEGRO);
    }
    // cierres rápidos del capó
    for (const [x, z] of [[xc1 - 0.14, 0.44], [xc1 - 0.14, -0.44], [xc0 + 0.10, 0.50], [xc0 + 0.10, -0.50]]) {
      c.fillStyle = '#15171b'; c.beginPath(); c.arc(x, z, 0.026, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#c2c7ce'; c.beginPath(); c.arc(x, z, 0.015, 0, Math.PI * 2); c.fill();
    }
    // parabrisas con su parasol y luneta
    const par = lunaArriba(F, true), lun = lunaArriba(F, false);
    const cristal = (pts, x0, x1) => { poli(c, pts); const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, '#0b0f15'); g.addColorStop(0.55, CRISTAL); g.addColorStop(1, '#1d2834'); luna(g); c.lineWidth = 0.022; c.strokeStyle = '#101216'; c.stroke(); };
    cristal(par, xCowl, F.xPar); cristal(lun, xDeck, F.xLun);
    c.save(); poli(c, par); c.clip();
    const zPar = anchoCab(F, F.xPar)[1];
    relleno(c, [...Array.from({ length: 21 }, (_, i) => { const z = zPar * (i - 10) / 10; return [F.xPar + 0.21 - F.kF * z * z, z]; }), ...Array.from({ length: 21 }, (_, i) => { const z = zPar * (10 - i) / 10; return [F.xPar - 0.1 - F.kF * z * z, z]; })], oscuro(col.acento, luma(col.acento) > 170 ? 0.15 : 0));
    c.restore();
    sello_(v, F.xPar + 0.125, 0, () => { const t = (nombre || 'UPGAMES').toUpperCase(); c.fillStyle = contraste(col.acento); c.font = fuente(9.5); c.textAlign = 'center'; c.textBaseline = 'middle'; const m = c.measureText(t).width; if (m > 96) c.scale(96 / m, 1); c.fillText(t, 0, 0.4); }, -Math.PI / 2);
    // luneta: lamas (motor central) o parasol trasero
    c.save(); poli(c, lun); c.clip();
    if (F.tomaLateral) { c.fillStyle = 'rgba(30,34,40,.95)'; for (let x = F.xLun - 0.12; x > xDeck; x -= 0.085) c.fillRect(x, -1, 0.03, 2); }
    else { c.fillStyle = oscuro(col.acento, luma(col.acento) > 170 ? 0.15 : 0); c.fillRect(F.xLun - 0.19, -1, 0.14, 2); }
    c.restore();
    if (!F.tomaLateral) sello_(v, F.xLun - 0.125, 0, () => { c.fillStyle = contraste(col.acento); c.font = fuente(6.2); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('UPGAMES.GAMES', 0, 0.3); }, Math.PI / 2);
    // techo: trampilla, dorsal y luces de posición
    const xt = (F.xPar + F.xLun) / 2;
    if (stock) sello_(v, xt - 0.04, 0, () => numeroGrande(c, numero, 62, col.tercero, contraste(col.tercero), 'rgba(0,0,0,.35)'), Math.PI / 2);
    else {
      c.strokeStyle = linea; c.lineWidth = 0.008; c.strokeRect(xt - 0.06, -0.50, 0.32, 0.30);
      sello_(v, xt - 0.08, 0.20, () => dorsal(c, numero, 30, { clase: 'GT3', colorClase: col.acento }), Math.PI / 2);
      sello_(v, xt + 0.24, 0.20, () => logo(c, pub.segundo, 4.6, { ancho: 46 }), Math.PI / 2);
    }
    // capó: patrocinador principal (se lee de frente) y dorsal
    const xLogo = F.toma ? (F.toma[1] + xc1) / 2 + 0.02 : stock ? (xc0 + xc1) / 2 : xc1 - 0.30;
    sello_(v, xLogo, 0, () => logo(c, pub.principal, stock ? 24 : F.toma ? Math.min(13, (xc1 - F.toma[1]) * 42) : 12, { ancho: stock ? 150 : 104, borde: col.acento }), -Math.PI / 2);
    if (stock) sello_(v, xc1 - 0.22, 0, () => logo(c, pub.tercero, 8, { ancho: 90 }), -Math.PI / 2);
    else if (F.toma && F.toma[0] - xc0 > 0.3) {
      sello_(v, (F.toma[0] + xc0) / 2, 0.32, () => dorsal(c, numero, Math.min(30, (F.toma[0] - xc0) * 72), { clase: 'GT3', colorClase: col.acento }), -Math.PI / 2);
      sello_(v, (F.toma[0] + xc0) / 2, -0.26, () => logo(c, pub.tercero, 6, { ancho: 50 }), -Math.PI / 2);
    } else if (!F.toma) {
      sello_(v, xc0 + 0.40, 0, () => dorsal(c, numero, 26, { clase: 'GT3', colorClase: col.acento }), -Math.PI / 2);
    }
    // maletero o tapa del motor
    if (xDeck - F.xC > 0.34) sello_(v, (xDeck + F.xC) / 2 + 0.03, 0, () => logo(c, stock ? pub.principal : pub.cuarto, Math.min(stock ? 20 : 8, (xDeck - F.xC) * 26), { ancho: 110 }), Math.PI / 2);
    // aletas traseras: una pegatina sobre cada una
    for (const s of [-1, 1]) sello_(v, xr + 0.02, s * 0.80, () => logo(c, 'APEX', 3.6, { ancho: 34 }), s > 0 ? 0 : Math.PI);
  });

  // ── frente ──
  enVista(c, V.frente, (v) => {
    pat(c, 'f', F, col);
    const y0 = dN.yb, y1 = dN.ys, h = y1 - y0, w = dN.w;
    relleno(c, [[-1.2, 0], [1.2, 0], [1.2, y0 + 0.035], [-1.2, y0 + 0.035]], NEGRO);
    relleno(c, [[-w, y0 + 0.035], [w, y0 + 0.035], [w, y0 + 0.05], [-w, y0 + 0.05]], col.acento);
    if (stock) {
      malla(c, [[-0.62, y0 + 0.07], [0.62, y0 + 0.07], [0.56, y0 + h * 0.46], [-0.56, y0 + h * 0.46]]);
      sello_(v, 0, y0 + h * 0.70, () => logo(c, pub.principal, 7, { ancho: 80 }));
    } else {
      malla(c, [[-0.60, y0 + 0.065], [0.60, y0 + 0.065], [0.68, y0 + h * 0.60], [-0.68, y0 + h * 0.60]]);
      for (const s of [-1, 1]) relleno(c, [[s * 0.72, y0 + 0.07], [s * 0.84, y0 + 0.09], [s * 0.84, y0 + h * 0.5], [s * 0.72, y0 + h * 0.56]], NEGRO);
      relleno(c, [[-0.42, y0 + h * 0.70], [0.42, y0 + h * 0.70], [0.38, y0 + h * 0.84], [-0.38, y0 + h * 0.84]], NEGRO);
      c.fillStyle = col.acento; c.fillRect(-0.68, y0 + h * 0.60, 1.36, 0.012);
    }
    sello_(v, 0.40, y0 + h * 0.36, () => tecnica(c, 'remolque', 3.2));
  });

  // ── trasera ──
  enVista(c, V.tras, (v) => {
    pat(c, 't', F, col);
    const y0 = dC.yb, y1 = dC.ys, w = dC.w;
    relleno(c, [[-1.2, 0], [1.2, 0], [1.2, y0 + 0.10], [-1.2, y0 + 0.10]], NEGRO);
    // franja de los pilotos y rejillas
    relleno(c, [[-w + 0.03, y1 - 0.20], [w - 0.03, y1 - 0.20], [w - 0.01, y1 - 0.075], [-w + 0.01, y1 - 0.075]], '#0b0c10');
    if (!stock) for (const s of [-1, 1]) malla(c, [[s * 0.42, y0 + 0.13], [s * 0.80, y0 + 0.13], [s * 0.84, y1 - 0.23], [s * 0.46, y1 - 0.23]], 0.03);
    sello_(v, 0, y0 + (stock ? 0.33 : 0.25), () => logo(c, pub.principal, stock ? 9 : 7, { ancho: stock ? 120 : 70 }));
    c.fillStyle = '#ff2a1a'; c.fillRect(-0.05, y0 + 0.105, 0.10, 0.035);                                  // luz de lluvia
    sello_(v, -0.38, y0 + 0.16, () => tecnica(c, 'remolque', 3));
    sello_(v, 0.62, y1 - 0.035, () => { c.fillStyle = tinta; c.font = fuente(3.4); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('APEX GP', 0, 0); });
  });
  c.setTransform(1, 0, 0, 1, 0, 0);
  return cv;
}

// ─── Piezas ──────────────────────────────────────────────────────────────────────────────────
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
function pon(g, x, y, z, rx = 0, ry = 0, rz = 0) { g.applyMatrix4(_m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s)); return g; }
const caja = (sx, sy, sz, ...a) => pon(new THREE.BoxGeometry(sx, sy, sz), ...a);
/** Lámina con el contorno dado en el plano XY y el grosor centrado en z. */
function lamina(pts, grosor) {
  const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: grosor, bevelEnabled: false }); g.translate(0, 0, -grosor / 2);
  return g;
}
function unir(lista, mat, sombra = true) {
  if (!lista.length) return null;
  const g = mergeGeometries(lista.map(x => { const n = x.index ? x.toNonIndexed() : x; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k); return n; }), false);
  const m = new THREE.Mesh(g, mat); m.castShadow = sombra; return m;
}
function lienzo(w, h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }
function textura(cv) { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

const cache = new Map();
const guardado = (clave, crear) => { if (!cache.has(clave)) cache.set(clave, crear()); return cache.get(clave); };
const MAT = {
  carbono: () => guardado('m:carbono', () => new THREE.MeshPhysicalMaterial({ color: 0x121317, roughness: 0.36, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 })),
  negro: () => guardado('m:negro', () => new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.62 })),
  jaula: () => guardado('m:jaula', () => new THREE.MeshStandardMaterial({ color: 0x9aa1aa, roughness: 0.5, metalness: 0.6 })),
  rojo: () => guardado('m:rojo', () => new THREE.MeshStandardMaterial({ color: 0xd8201c, roughness: 0.6 })),
  cristal: () => guardado('m:cristal', () => new THREE.MeshPhysicalMaterial({ color: 0x0c1218, transparent: true, opacity: 0.46, roughness: 0.03, metalness: 0, envMapIntensity: 2.2, depthWrite: false })),
  charco: () => guardado('m:charco', () => {
    const cv = lienzo(128, 64), c = cv.getContext('2d'), g = c.createRadialGradient(20, 32, 2, 50, 32, 78);
    g.addColorStop(0, 'rgba(255,250,235,.9)'); g.addColorStop(0.5, 'rgba(255,246,225,.32)'); g.addColorStop(1, 'rgba(255,246,225,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 64);
    return new THREE.MeshBasicMaterial({ map: textura(cv), transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  }),
  llama: () => guardado('m:llama', () => new THREE.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })),
  cromo: () => guardado('m:cromo', () => new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.2, metalness: 1 })),
  color: (hex) => guardado('m:color' + hex, () => new THREE.MeshPhysicalMaterial({ color: new THREE.Color(hex), roughness: 0.32, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.06 })),
};

/** Textura de los faros: carcasa oscura, lentes y tira de luz diurna, con el contorno en alfa. */
function texturaFaro(tipo) {
  return guardado('faro:' + tipo, () => {
    const N = 256, cv = lienzo(N, N), c = cv.getContext('2d');
    c.setTransform(N, 0, 0, -N, 0, N);                       // (u, v) con v hacia arriba
    const contorno = {
      almendra: [[0.97, 0.44], [0.86, 0.62], [0.60, 0.80], [0.26, 0.86], [0.10, 0.80], [0.22, 0.60], [0.52, 0.42], [0.80, 0.36]],
      cuchilla: [[0.97, 0.50], [0.84, 0.62], [0.50, 0.74], [0.08, 0.84], [0.05, 0.76], [0.40, 0.58], [0.78, 0.46]],
      barra: [[0.96, 0.40], [0.96, 0.66], [0.84, 0.72], [0.20, 0.72], [0.12, 0.62], [0.12, 0.46], [0.24, 0.40]],
      redondos: [[0.96, 0.38], [0.96, 0.68], [0.20, 0.72], [0.14, 0.64], [0.14, 0.40]],
      pegatina: [[0.95, 0.40], [0.95, 0.66], [0.26, 0.70], [0.20, 0.62], [0.20, 0.42]],
    }[tipo];
    poli(c, contorno); c.fillStyle = '#0a0c10'; c.fill(); c.lineWidth = 0.02; c.lineJoin = 'round'; c.strokeStyle = '#2a2e36'; c.stroke();
    c.save(); poli(c, contorno); c.clip();
    const lente = (u, v, r) => { const g = c.createRadialGradient(u, v, 0, u, v, r); g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#dcebff'); g.addColorStop(0.8, '#7f93b0'); g.addColorStop(1, '#1b2028'); c.fillStyle = g; c.beginPath(); c.arc(u, v, r, 0, Math.PI * 2); c.fill(); };
    c.strokeStyle = '#f4f8ff'; c.lineCap = 'round'; c.lineJoin = 'round';
    if (tipo === 'almendra') { lente(0.66, 0.60, 0.085); lente(0.44, 0.70, 0.07); c.lineWidth = 0.035; c.beginPath(); c.moveTo(0.90, 0.44); c.lineTo(0.56, 0.47); c.lineTo(0.27, 0.63); c.lineTo(0.17, 0.78); c.stroke(); }
    else if (tipo === 'cuchilla') { lente(0.62, 0.585, 0.055); lente(0.48, 0.63, 0.05); lente(0.34, 0.68, 0.045); c.lineWidth = 0.032; c.beginPath(); c.moveTo(0.92, 0.52); c.lineTo(0.50, 0.70); c.lineTo(0.12, 0.80); c.stroke(); }
    else if (tipo === 'redondos') { lente(0.78, 0.54, 0.105); lente(0.54, 0.545, 0.105); lente(0.31, 0.55, 0.085); }
    else if (tipo === 'barra') { lente(0.76, 0.56, 0.085); lente(0.52, 0.56, 0.085); c.lineWidth = 0.03; c.beginPath(); c.moveTo(0.92, 0.445); c.lineTo(0.26, 0.445); c.lineTo(0.17, 0.52); c.lineTo(0.17, 0.60); c.stroke(); }
    else { c.fillStyle = '#dfe8f4'; c.fillRect(0.60, 0.455, 0.30, 0.17); c.fillRect(0.26, 0.465, 0.30, 0.17); c.strokeStyle = 'rgba(40,48,60,.7)'; c.lineWidth = 0.008; c.beginPath(); for (let u = 0.30; u < 0.9; u += 0.05) { c.moveTo(u, 0.44); c.lineTo(u, 0.66); } c.stroke(); }
    c.restore();
    return textura(cv);
  });
}
/** Textura de los pilotos traseros (media cola: u de dentro a fuera). */
function texturaPiloto(tipo) {
  return guardado('piloto:' + tipo, () => {
    const cv = lienzo(256, 64), c = cv.getContext('2d');
    c.setTransform(256, 0, 0, -64, 0, 64);
    c.strokeStyle = '#ff2a1a'; c.fillStyle = '#ff2a1a'; c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = 0.22;
    const tubo = (pts, ancho = 0.2) => { c.lineWidth = ancho; c.strokeStyle = '#ff2a1a'; c.beginPath(); pts.forEach(([u, v], i) => (i ? c.lineTo(u, v) : c.moveTo(u, v))); c.stroke(); c.lineWidth = ancho * 0.35; c.strokeStyle = '#ffd0c8'; c.stroke(); };
    if (tipo === 'almendra') tubo([[0.02, 0.5], [0.80, 0.5], [0.95, 0.82]]);
    else if (tipo === 'cuchilla') { tubo([[0.30, 0.74], [0.96, 0.74]], 0.16); tubo([[0.42, 0.28], [0.90, 0.28]], 0.16); }
    else if (tipo === 'barra') { for (const u of [0.42, 0.62, 0.82]) { c.fillStyle = '#ff2a1a'; c.fillRect(u, 0.12, 0.14, 0.76); c.fillStyle = '#ffd0c8'; c.fillRect(u + 0.045, 0.24, 0.05, 0.52); } }
    else { c.fillStyle = '#d81e10'; c.fillRect(0.40, 0.14, 0.56, 0.72); c.fillStyle = '#ff8a7a'; c.fillRect(0.46, 0.30, 0.44, 0.40); }
    return textura(cv);
  });
}

/** Parche sobre la piel de la carrocería baja (para los faros): sigue su curvatura. */
function parche(F, q, xa, xb, ia, ib, nx = 9) {
  const pos = [], uv = [], idx = [], nv = ib - ia + 1;
  for (const s of [1, -1]) {
    const o = pos.length / 3;
    for (let i = 0; i <= nx; i++) {
      const x = xa + (xb - xa) * i / nx, sec = seccion(F, x, q);
      for (let j = 0; j < nv; j++) { const [z, y] = sec[ia + j]; pos.push(arco(F, x, z), y, z * s); uv.push(i / nx, j / (nv - 1)); }
    }
    for (let i = 0; i < nx; i++) for (let j = 0; j < nv - 1; j++) {
      const a = o + i * nv + j, b = a + 1, c2 = a + nv, d = c2 + 1;
      if (s > 0) idx.push(a, c2, b, b, c2, d); else idx.push(a, b, c2, b, d, c2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  haciaFuera(g, [F.xN - 0.6, 0.4]);
  const P = g.attributes.position.array, N = g.attributes.normal.array;
  for (let i = 0; i < P.length; i++) P[i] += N[i] * 0.006;                    // un pelo por fuera de la pintura
  return g;
}

/** Alerón: perfil invertido con reborde (gurney); la cara de arriba lleva la textura del patrocinador. */
function geoAla(env) {
  const sup = [[0.19, 0.0], [0.13, 0.022], [0.04, 0.036], [-0.07, 0.038], [-0.17, 0.03], [-0.185, 0.066]];
  const inf = [[-0.196, 0.066], [-0.19, 0.012], [-0.08, 0.008], [0.06, -0.004], [0.19, -0.012]];
  const perfil = [...sup.map(p => [...p, 0.1 + 0.9 * (p[0] + 0.19) / 0.38]), ...inf.map(p => [...p, 0.03])];
  const pos = [], uv = [], idx = [], n = perfil.length;
  for (const [k, z] of [[0, -env / 2], [1, env / 2]]) for (const [x, y, v] of perfil) { pos.push(x, y, z); uv.push(k, v); }
  for (let i = 0; i < n; i++) { const a = i, b = (i + 1) % n; idx.push(a, b, a + n, b, b + n, a + n); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const ni = g.toNonIndexed(); ni.computeVertexNormals();
  return ni;
}
function texturaAla(marca, col) {
  return guardado(`ala:${marca}:${col.base}:${col.acento}`, () => {
    const cv = lienzo(1024, 192), c = cv.getContext('2d');
    c.fillStyle = '#0c0d10'; c.fillRect(0, 0, 1024, 192);
    c.fillStyle = col.base; c.fillRect(0, 0, 1024, 172);
    c.fillStyle = col.acento; c.fillRect(0, 0, 1024, 14); c.fillRect(0, 158, 1024, 14);
    c.fillStyle = col.acento; relleno(c, [[0, 0], [150, 0], [90, 172], [0, 172]], col.acento); relleno(c, [[1024, 0], [874, 0], [934, 172], [1024, 172]], col.acento);
    c.save(); c.translate(512, 88); logo(c, marca, 78, { placa: false, tinta: contraste(col.base), ancho: 640 }); c.restore();
    return textura(cv);
  });
}
function texturaDeriva(numero, col) {
  return guardado(`deriva:${numero}:${col.acento}`, () => {
    const cv = lienzo(384, 128), c = cv.getContext('2d');
    c.fillStyle = col.acento; c.fillRect(0, 0, 384, 128);
    c.save(); c.translate(70, 66); numeroGrande(c, numero, 92, contraste(col.acento), 'rgba(0,0,0,0)'); c.restore();
    c.save(); c.translate(250, 64); logo(c, 'APEX', 40, { placa: false, tinta: contraste(col.acento), ancho: 230 }); c.restore();
    return textura(cv);
  });
}

/** Mapa de normales con las juntas de las piezas, las rejillas y los huecos de cada carrocería. */
function relieveDe(forma, tam = 1024) {
  return guardado(`relieve:${forma}:${tam}`, () => {
    const cv = lienzo(tam, tam); pintarLibreaCerrada(cv, { categoria: forma, relieve: true });
    const c = cv.getContext('2d'), src = c.getImageData(0, 0, tam, tam).data, alt = new Float32Array(tam * tam);
    for (let i = 0; i < tam * tam; i++) alt[i] = (src[i * 4] + src[i * 4 + 1] + src[i * 4 + 2]) / 765;
    // un suavizado corto para que la junta sea una ranura y no un escalón de un píxel
    const suave = new Float32Array(tam * tam);
    for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) {
      const xm = Math.max(0, x - 1), xp = Math.min(tam - 1, x + 1), ym = Math.max(0, y - 1), yp = Math.min(tam - 1, y + 1);
      suave[y * tam + x] = (alt[y * tam + x] * 4 + alt[y * tam + xm] * 2 + alt[y * tam + xp] * 2 + alt[ym * tam + x] * 2 + alt[yp * tam + x] * 2 + alt[ym * tam + xm] + alt[ym * tam + xp] + alt[yp * tam + xm] + alt[yp * tam + xp]) / 16;
    }
    const out = c.createImageData(tam, tam), f = 1.7;
    for (let y = 0; y < tam; y++) for (let x = 0; x < tam; x++) {
      const xm = Math.max(0, x - 1), xp = Math.min(tam - 1, x + 1), ym = Math.max(0, y - 1), yp = Math.min(tam - 1, y + 1);
      const nx = (suave[y * tam + xm] - suave[y * tam + xp]) * f, ny = (suave[yp * tam + x] - suave[ym * tam + x]) * f, l = Math.hypot(nx, ny, 1), i = (y * tam + x) * 4;
      out.data[i] = (nx / l * 0.5 + 0.5) * 255; out.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; out.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; out.data[i + 3] = 255;
    }
    c.putImageData(out, 0, 0);
    const t = new THREE.CanvasTexture(cv); t.anisotropy = 4;
    return t;
  });
}

const geos = new Map();
/** Piel pintada (carrocería baja y cabina en una malla sin índices, con sus UV de la librea). */
function geoCuerpo(forma, ruedas, calidad) {
  const clave = `${forma}|${calidad}|${ruedas.map(r => [r.x, r.z, r.r, r.w].map(v => v.toFixed(3)).join(',')).join(';')}`;
  if (geos.has(clave)) return geos.get(clave);
  const F = FORMAS[forma], q = nivel(calidad);
  const partes = [carroceriaBaja(F, ruedas, q), cabina(F, q)].map(g => g.toNonIndexed());
  const g = new THREE.BufferGeometry();
  // (se quitan los triángulos de la carrocería baja que quedan bajo la cabina)
  const Mb = partes[0].attributes.marca.array, quedan = [];
  for (let t = 0; t < Mb.length; t += 3) if (!(Mb[t] === 4 && Mb[t + 1] === 4 && Mb[t + 2] === 4)) quedan.push(t);
  for (const k of ['position', 'normal', 'marca']) {
    const a = partes[0].attributes[k], b = partes[1].attributes[k], n = a.itemSize, arr = new Float32Array(quedan.length * 3 * n + b.array.length);
    quedan.forEach((t, j) => arr.set(a.array.subarray(t * n, (t + 3) * n), j * 3 * n));
    arr.set(b.array, quedan.length * 3 * n);
    g.setAttribute(k, new THREE.BufferAttribute(arr, n));
  }
  normalesPorClase(g);
  asignarUV(g, F);
  g.computeBoundingSphere();
  g.userData.compartida = true;               // quien la deforme (abolladuras) trabaja sobre una copia
  geos.set(clave, g);
  return g;
}

/** Cristales: la piel de la cabina, un pelo por dentro de la pintura (se ve por los huecos de la librea). */
function geoCristal(forma, calidad) {
  return guardado(`cristal:${forma}|${calidad}`, () => {
    const g = cabina(FORMAS[forma], nivel(calidad)); g.deleteAttribute('marca');
    const P = g.attributes.position.array, N = g.attributes.normal.array;
    for (let i = 0; i < P.length; i++) P[i] -= N[i] * 0.006;
    return g;
  });
}
function tubo(a, b, r = 0.02) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
  const g = new THREE.CylinderGeometry(r, r, d.length(), 6, 1, true);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
  const m = A.add(B).multiplyScalar(0.5); g.translate(m.x, m.y, m.z);
  return g;
}

/**
 * Crea la carrocería cerrada. ruedas: [{ x, z, r, w }]. Devuelve la piel pintada (cuerpo, una
 * malla sin índices para las abolladuras), un grupo con lo demás y los datos para colocar el
 * piloto, las cámaras y los espejos.
 */
export function crearCarroceria(categoria, { pintura, ruedas, calidad = 2, colores = {}, numero = 7, nombre = '', transparente = false }) {
  const F = FORMAS[categoria] || FORMAS.gt, q = nivel(calidad), stock = categoria === 'stock';
  const col = { base: '#0d47ff', acento: '#00e5ff', tercero: '#ffffff', ...colores };
  ponerRuedas(F, ruedas);
  const cuerpo = new THREE.Mesh(geoCuerpo(categoria, ruedas, calidad), pintura); cuerpo.castShadow = true; cuerpo.receiveShadow = true;

  const extras = new THREE.Group();
  const G = { carbono: [], negro: [], cromo: [], color: [], jaula: [], rojo: [] };
  const D = (x) => datos(F, x), xN = F.xN, xC = F.xC, [xf, xr] = F.rx;
  const [xCowl, xDeck] = limitesCabina(F), techo = Math.max(...F.techo.map(p => p[1]));
  const pub = patrocinadores(nombre || col.base + col.acento);

  // labio de los pasos de rueda: tapa el borde del recorte con un arco limpio
  if (calidad >= 1) for (const r of ruedas) {
    const ra = r.r + HUECO, s = Math.sign(r.z), pts = [];
    const a0 = Math.asin(Math.max(-1, (D(r.x).yb + 0.05 - r.r) / ra));
    for (let k = 0; k <= 22; k++) { const a = a0 + (Math.PI - 2 * a0) * k / 22, x = r.x + ra * Math.cos(a), y = r.r + ra * Math.sin(a); pts.push(new THREE.Vector3(x, y, s * (zCostado(D(x), y) + 0.003))); }
    G.carbono.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 22, 0.014, 5));
  }
  // splitter delantero (sigue la planta del morro) con derivas y aletas (canards)
  {
    const borde = []; for (let i = 0; i <= 8; i++) { const z = D(xN).w * i / 8 * 1.0; borde.push([arco(F, xN, z) + 0.085, z]); }
    const wL = D(xN - 0.55).w + 0.01, contorno = [...borde, [xN - 0.2, D(xN - 0.2).w + 0.035], [xN - 0.55, wL + 0.02], [xN - 0.75, wL - 0.06], [xN - 0.75, 0]];
    const todo = [...contorno, ...contorno.slice(1, -1).reverse().map(([x, z]) => [x, -z])];
    if (!stock) {
      const g = lamina(todo.map(([x, z]) => [x, -z]), 0.018); g.rotateX(-Math.PI / 2); G.carbono.push(pon(g, 0, D(xN).yb - 0.014, 0));
      for (const s of [-1, 1]) {
        G.carbono.push(caja(0.34, 0.07, 0.008, xN - 0.40, D(xN).yb + 0.012, s * (wL + 0.045), 0, s * 0.10, 0));
        for (const [y, l] of [[0.30, 0.26], [0.42, 0.20]]) G.carbono.push(caja(l, 0.006, 0.085, xN - 0.36 + (0.26 - l), y, s * (D(xN - 0.36).w + 0.03), s * 0.10, s * 0.22, -0.26));
      }
    } else {
      const g = lamina(todo.map(([x, z]) => [x - 0.05, -z * 0.985]), 0.012); g.rotateX(-Math.PI / 2); G.negro.push(pon(g, 0, D(xN).yb - 0.008, 0));
    }
  }
  // faldones entre los ejes
  for (const s of [-1, 1]) {
    const a = xr + F.rr[1] + 0.07, b = xf - F.rr[0] - 0.07, wa = D(a).w, wb = D(b).w;
    G.carbono.push(caja(b - a, 0.022, 0.10, (a + b) / 2, D(0).yb - 0.006, s * ((wa + wb) / 2 + 0.005), 0, s * Math.atan2(wa - wb, b - a), 0));
  }
  // difusor con aletas
  if (!stock) {
    const yb = D(xC).yb;
    G.carbono.push(caja(0.16, 0.012, D(xC).w * 1.8, xC - 0.03, yb + 0.006, 0, 0, 0, -0.12));
    for (const z of [-0.72, -0.44, -0.15, 0.15, 0.44, 0.72]) G.carbono.push(lamina([[xC - 0.10, yb], [xC - 0.10, yb - 0.035], [xC + 0.42, 0.085], [xC + 0.50, 0.12], [xC + 0.12, yb - 0.06]], 0.010).translate(0, 0, z));
  }
  // escapes (y dónde salen sus llamaradas al levantar el pie)
  const bocas = [];
  if (F.escape === 'tras') for (const s of [-1, 1]) {
    G.cromo.push(pon(new THREE.CylinderGeometry(0.052, 0.052, 0.12, 16, 1, true), xC + 0.02, D(xC).yb + 0.085, s * 0.20, 0, 0, Math.PI / 2));
    G.negro.push(pon(new THREE.CircleGeometry(0.05, 14), xC + 0.05, D(xC).yb + 0.085, s * 0.20, 0, -Math.PI / 2, 0));
    bocas.push(pon(new THREE.ConeGeometry(0.045, 0.34, 8), xC - 0.20, D(xC).yb + 0.085, s * 0.20, 0, 0, Math.PI / 2));
  } else for (const s of stock ? [1] : [-1, 1]) {
    const x = xr + F.rr[1] + 0.26;
    G.cromo.push(pon(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 14, 1, true), x, D(x).yb + 0.035, s * (D(x).w - 0.04), Math.PI / 2, 0, 0));
    G.negro.push(pon(new THREE.CircleGeometry(0.043, 12), x, D(x).yb + 0.035, s * (D(x).w - 0.03), 0, s > 0 ? 0 : Math.PI, 0));
    bocas.push(pon(new THREE.ConeGeometry(0.04, 0.30, 8), x, D(x).yb + 0.035, s * (D(x).w + 0.17), s * Math.PI / 2, 0, 0));
  }
  // retrovisores sobre su brazo, al pie del pilar A
  const espejos = [];
  for (const s of [-1, 1]) {
    const xe = xCowl - 0.30, wb = anchoCab(F, xe)[0], ye = ySup(D(xe), wb) + 0.125, ze = s * (wb + 0.125);
    const car = new THREE.SphereGeometry(1, 14, 10); car.scale(0.058, 0.046, 0.088); G.color.push(pon(car, xe, ye, ze));
    G.carbono.push(caja(0.05, 0.022, 0.20, xe + 0.012, ye - 0.05, ze - s * 0.09, s * 0.45, s * 0.12, 0));
    espejos.push({ x: xe - 0.064, y: ye, z: ze });
  }
  // limpiaparabrisas y antena
  { const L = (x, z) => [x, yTecho(F, x, z) + 0.014, z];
    G.negro.push(tubo(L(xCowl - 0.03, 0.03), L(xCowl - 0.27, -0.15), 0.006), tubo(L(xCowl - 0.40, -0.08), L(xCowl - 0.13, -0.25), 0.009));
    const eje = new THREE.SphereGeometry(0.018, 8, 6); G.negro.push(pon(eje, ...L(xCowl - 0.03, 0.03))); }
  // ganchos de remolque
  { const aro = () => new THREE.TorusGeometry(0.034, 0.009, 6, 12).rotateY(Math.PI / 2);
    G.rojo.push(pon(aro(), arco(F, xN, 0.42) + 0.012, D(xN).yb + 0.13, 0.42), pon(aro(), xC - 0.012, D(xC).yb + 0.13, -0.40)); }
  G.negro.push(pon(new THREE.CylinderGeometry(0.004, 0.006, 0.16, 5), F.xLun + 0.12, yTecho(F, F.xLun + 0.12) + 0.07, 0.22, 0, 0, 0.35));

  // alerón trasero (GT): cuellos de cisne, plano con reborde y derivas · spoiler (Stock)
  if (F.ala) {
    const xA = xC + 0.20, yA = F.alaY ?? techo - 0.035, yD = ySup(D(xA + 0.45), 0.38) - 0.02, env = 1.86;
    const ala = new THREE.Mesh(geoAla(env), guardado(`mAla:${pub.principal}:${col.base}:${col.acento}`, () => new THREE.MeshPhysicalMaterial({ map: texturaAla(pub.principal, col), roughness: 0.34, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 })));
    ala.position.set(xA, yA, 0); ala.rotation.z = -0.12; ala.castShadow = true; extras.add(ala);
    for (const s of [-1, 1]) {
      G.carbono.push(lamina([[xA + 0.58, yD], [xA + 0.24, yA + 0.105], [xA - 0.03, yA + 0.115], [xA - 0.09, yA + 0.045], [xA + 0.05, yA + 0.04], [xA + 0.10, yA + 0.065], [xA + 0.19, yA + 0.05], [xA + 0.38, yD]], 0.016).translate(0, 0, s * 0.40));
      G.carbono.push(lamina([[xA + 0.22, yA - 0.07], [xA + 0.235, yA + 0.035], [xA + 0.02, yA + 0.095], [xA - 0.235, yA + 0.105], [xA - 0.235, yA - 0.02], [xA - 0.17, yA - 0.095], [xA + 0.08, yA - 0.095]], 0.012).translate(0, 0, s * (env / 2 + 0.006)));
    }
    const mDer = guardado(`mDer:${numero}:${col.acento}`, () => new THREE.MeshStandardMaterial({ map: texturaDeriva(numero, col), roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 }));
    const der = unir([1, -1].map(s => pon(new THREE.PlaneGeometry(0.32, 0.105), xA - 0.035, yA + 0.02, s * (env / 2 + 0.0135), 0, s > 0 ? 0 : Math.PI, 0)), mDer, false);
    extras.add(der);
  } else {
    const xS = xC + 0.05, d = D(xS);
    G.negro.push(caja(0.014, 0.17, d.w * 1.86, xS - 0.02, d.ys + 0.07, 0, 0, 0, 0.42));
    for (const z of [-0.5, 0, 0.5]) G.negro.push(caja(0.10, 0.012, 0.012, xS + 0.03, d.ys + 0.03, z, 0, 0, -0.5));
  }

  // faros (siguen la piel del morro) y pilotos traseros LED
  const luces = {};
  {
    const xb = xN - 0.045, xa = xN - (F.faro === 'cuchilla' ? 0.56 : 0.50);
    const g = parche(F, q, xa, xb, iCostado(q) + Math.round(q.nL * 0.45), iArriba(q) + Math.round(q.nT * 0.42));
    const m = guardado('mFaro:' + F.faro, () => new THREE.MeshStandardMaterial({ map: texturaFaro(F.faro), emissiveMap: texturaFaro(F.faro), emissive: 0xffffff, emissiveIntensity: stock ? 0.35 : 1.1, roughness: 0.12, metalness: 0.1, transparent: true, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    luces.faro = m.clone(); luces.faroBase = m.emissiveIntensity; extras.add(new THREE.Mesh(g, luces.faro));
    const d = D(xC), yP = d.ys - 0.137, mp = guardado('mPiloto:' + F.faro, () => new THREE.MeshStandardMaterial({ map: texturaPiloto(F.faro), emissiveMap: texturaPiloto(F.faro), emissive: 0xffffff, emissiveIntensity: stock ? 0.6 : 1.7, roughness: 0.25, transparent: true, alphaTest: 0.3, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    const ancho = d.w - 0.06, zc = ancho / 2 + 0.01;
    const pl = [1, -1].map(s => { const p = new THREE.PlaneGeometry(ancho, 0.115); if (s < 0) { const u = p.attributes.uv; for (let i = 0; i < u.count; i++) u.setX(i, 1 - u.getX(i)); } return pon(p, arco(F, xC, zc) - 0.004, yP, s * zc, 0, -Math.PI / 2 - s * 0.14 * zc, 0); });
    luces.freno = mp.clone(); luces.frenoBase = mp.emissiveIntensity; extras.add(unir(pl, luces.freno, false));
    // charco de luz de los faros sobre el asfalto (de noche) y llamaradas del escape
    luces.charco = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 4.2), MAT.charco()); luces.charco.rotation.x = -Math.PI / 2; luces.charco.position.set(xN + 3.3, 0.03, 0); luces.charco.visible = false; luces.charco.renderOrder = 1; extras.add(luces.charco);
    if (bocas.length && calidad >= 1) { luces.llamas = unir(bocas, MAT.llama(), false); luces.llamas.visible = false; extras.add(luces.llamas); }
  }
  // cristales tintados: la librea va recortada donde hay cristal y por los huecos se ve el interior
  if (transparente) {
    pintura.alphaTest = 0.5;
    const forro = new THREE.Mesh(cuerpo.geometry, new THREE.MeshLambertMaterial({ map: pintura.map, color: 0x24262b, alphaTest: 0.5, side: THREE.BackSide }));
    forro.name = 'forro'; extras.add(forro);
    const cristal = new THREE.Mesh(geoCristal(categoria, calidad), MAT.cristal()); cristal.renderOrder = 3; cristal.name = 'cristal'; extras.add(cristal);
    // jaula antivuelco: arco principal, barras del techo y del pilar A, cruces de las puertas y tirantes
    const xH = (F.pilarB[0] + F.pilarB[1]) / 2, xT = F.xPar - 0.04, xA = xCowl - 0.17, r = 0.021;
    const arriba = (x) => { const wr = anchoCab(F, x)[1] - 0.075; return [x, yTecho(F, x, wr) - 0.08, wr]; };
    const abajo = (x, y) => [x, y, anchoCab(F, x)[0] - 0.085];
    const xR = Math.max(xH - 0.85, xDeck + 0.16);
    for (const sg of [-1, 1]) {
      const e = (p) => [p[0], p[1], p[2] * sg];
      const tH = arriba(xH), tA = arriba(xT), pA = abajo(xA, ySup(D(xA), anchoCab(F, xA)[0]) - 0.04);
      G.jaula.push(tubo(e(abajo(xH, 0.15)), e(tH), r), tubo(e(tH), e(tA), r), tubo(e(tA), e(pA), r), tubo(e(pA), e(abajo(xA + 0.05, 0.15)), r));
      G.jaula.push(tubo(e(abajo(xH, 0.27)), e(abajo(xA, 0.60)), r * 0.9), tubo(e(abajo(xH, 0.62)), e(abajo(xA, 0.28)), r * 0.9));
      G.jaula.push(tubo(e(tH), [xR, ySup(D(xR), 0.42) - 0.05, sg * 0.42], r * 0.9));
    }
    { const tH = arriba(xH), tA = arriba(xT);
      G.jaula.push(tubo(tH, [tH[0], tH[1], -tH[2]], r), tubo(tA, [tA[0], tA[1], -tA[2]], r), tubo(abajo(xH, 0.15), [tH[0], tH[1], -tH[2]], r * 0.9)); }
    // asiento baquet del piloto (con sus orejas a la altura del casco) y suelo
    const [dx, dy, dz] = F.piloto;
    G.negro.push(caja(0.07, 0.64, 0.44, dx - 0.15, 0.50 + dy, dz, 0, 0, 0.22), caja(0.44, 0.07, 0.42, dx + 0.10, 0.30 + dy, dz, 0, 0, 0.10));
    for (const sg of [-1, 1]) G.negro.push(caja(0.20, 0.20, 0.035, dx - 0.10, 0.80 + dy, dz + sg * 0.17, 0, 0, 0.22), caja(0.40, 0.20, 0.035, dx + 0.08, 0.40 + dy, dz + sg * 0.215));
  }
  // salpicadero (por si se mira a través de los pasos de rueda no se ve nada hueco)
  G.negro.push(caja(0.30, 0.10, 1.4, xCowl - 0.30, D(xCowl).yc - 0.06, 0));

  for (const [k, mat] of [['carbono', MAT.carbono()], ['negro', MAT.negro()], ['cromo', MAT.cromo()], ['color', MAT.color(col.acento)], ['jaula', MAT.jaula()], ['rojo', MAT.rojo()]]) { const m = unir(G[k], mat); if (m) extras.add(m); }

  // datos para el resto del modelo (cámaras, piloto, calor del escape, espejos)
  const forma = { piloto: F.piloto, techo, cintura: D(xCowl).ys, cristal: [xCowl + 0.1, xDeck], secciones: [[xN], [xC]], espejos };
  return { cuerpo, extras, forma, luces, relieve: calidad >= 2 ? relieveDe(categoria) : null };
}

/** Apunta en la forma dónde van las ruedas (lo necesita la librea para colocar la publicidad). */
function ponerRuedas(F, ruedas) {
  const del = ruedas.reduce((a, r) => (r.x > a.x ? r : a)), tras = ruedas.reduce((a, r) => (r.x < a.x ? r : a));
  F.rx = [del.x, tras.x]; F.rr = [del.r, tras.r];
}
// posición de las ruedas por defecto (batalla de cada categoría), por si se pinta antes de crear
for (const k of ['gt', 'gtb', 'gtm', 'gtt', 'gth', 'gtc', 'gtp']) { FORMAS[k].rx = [1.458, -1.242]; FORMAS[k].rr = [0.345, 0.35]; }
FORMAS.stock.rx = [1.339, -1.451]; FORMAS.stock.rr = [0.355, 0.355];
