// Carrocerías cerradas (GT y Stock Car). Dos volúmenes como en un coche de verdad:
//  · la carrocería baja (morro, aletas anchas sobre las ruedas, puertas con caída, caderas y
//    cola), con una sección propia (fondo plano, costado, hombro, aleta y capó hundido entre las
//    aletas) y los pasos de rueda abiertos y oscuros;
//  · la cabina, más estrecha y con caída hacia dentro, con parabrisas, luneta y ventanillas
//    de cristal oscuro, techo y pilares pintados.
// Detalles: rejilla, faldones, difusor con aletas, faros y pilotos LED, retrovisores, splitter,
// alerón con cuello de cisne (GT) o spoiler transparente (Stock) y escapes.
// Ejes como el monoplaza: +X delante, +Y arriba, +Z a la derecha; origen bajo el CG en el suelo.
import * as THREE from 'three';

// carrocería baja: [x, semiancho, suelo, hombro (altura del costado), centro (capó/maletero)]
// cabina: [x, semiancho abajo, semiancho del techo, altura del techo]
const FORMAS = {
  gt: {
    baja: [
      [2.42, 0.74, 0.27, 0.40, 0.42], [2.37, 0.88, 0.17, 0.50, 0.50], [2.22, 0.96, 0.13, 0.60, 0.57],
      [1.95, 0.99, 0.12, 0.70, 0.62], [1.46, 1.00, 0.12, 0.77, 0.66], [1.02, 0.96, 0.12, 0.75, 0.71],
      [0.55, 0.92, 0.12, 0.76, 0.77], [0.00, 0.92, 0.12, 0.79, 0.80], [-0.60, 0.95, 0.12, 0.83, 0.83],
      [-1.24, 1.01, 0.12, 0.90, 0.86], [-1.72, 0.99, 0.13, 0.90, 0.87], [-2.02, 0.94, 0.18, 0.87, 0.86],
      [-2.12, 0.86, 0.27, 0.81, 0.81],
    ],
    cabina: [
      [1.04, 0.80, 0.70, 0.0], [0.80, 0.82, 0.64, 0.98], [0.42, 0.82, 0.62, 1.16], [0.00, 0.82, 0.63, 1.20],
      [-0.50, 0.84, 0.62, 1.18], [-0.95, 0.86, 0.55, 1.05], [-1.38, 0.87, 0.46, 0.91], [-1.50, 0.87, 0.44, 0.0],
    ],
    parabrisas: 0.42, luneta: -0.88, pilarB: [-0.28, -0.16],
    ruedas: { del: 0.31, tras: 0.33 }, ruedasX: [1.46, -1.24],
    piloto: [-0.36, 0.13, -0.38], ala: true, rejilla: 0.62, toma: [1.62, 1.92], branquia: true,
  },
  // GT de motor central (berlinetta): morro corto y bajo, cabina adelantada, caderas anchas y tomas laterales
  gtb: {
    baja: [
      [2.30, 0.72, 0.26, 0.36, 0.38], [2.25, 0.86, 0.16, 0.46, 0.46], [2.10, 0.95, 0.12, 0.56, 0.52],
      [1.85, 0.99, 0.12, 0.66, 0.56], [1.46, 1.00, 0.12, 0.72, 0.60], [1.10, 0.95, 0.12, 0.70, 0.66],
      [0.60, 0.90, 0.12, 0.72, 0.72], [0.00, 0.92, 0.12, 0.78, 0.78], [-0.60, 0.99, 0.12, 0.86, 0.84],
      [-1.24, 1.04, 0.12, 0.92, 0.88], [-1.70, 1.01, 0.13, 0.92, 0.89], [-2.00, 0.95, 0.18, 0.89, 0.88],
      [-2.08, 0.88, 0.27, 0.84, 0.84],
    ],
    cabina: [
      [1.12, 0.80, 0.68, 0.0], [0.85, 0.81, 0.62, 0.98], [0.50, 0.81, 0.60, 1.12], [0.10, 0.82, 0.60, 1.14],
      [-0.35, 0.84, 0.58, 1.12], [-0.90, 0.86, 0.50, 1.02], [-1.50, 0.88, 0.40, 0.94], [-1.70, 0.88, 0.38, 0.0],
    ],
    parabrisas: 0.52, luneta: -0.42, pilarB: [-0.14, -0.04],
    ruedas: { del: 0.31, tras: 0.34 }, ruedasX: [1.46, -1.24],
    piloto: [-0.22, 0.10, -0.38], ala: true, rejilla: 0.6, toma: [1.70, 1.98], tomaLateral: [-0.78, -0.36], branquia: false,
  },
  // GT de motor delantero largo (estilo muscle): capó largo, parabrisas recto y zaga cuadrada
  gtm: {
    baja: [
      [2.45, 0.80, 0.26, 0.50, 0.50], [2.40, 0.92, 0.16, 0.60, 0.59], [2.25, 0.99, 0.12, 0.68, 0.64],
      [1.95, 1.01, 0.12, 0.76, 0.68], [1.46, 1.02, 0.12, 0.80, 0.70], [0.95, 0.99, 0.12, 0.80, 0.76],
      [0.40, 0.96, 0.12, 0.82, 0.80], [-0.20, 0.96, 0.12, 0.84, 0.83], [-0.80, 0.99, 0.12, 0.88, 0.86],
      [-1.24, 1.03, 0.12, 0.92, 0.89], [-1.75, 1.01, 0.13, 0.93, 0.91], [-2.08, 0.97, 0.18, 0.92, 0.91],
      [-2.16, 0.90, 0.27, 0.88, 0.88],
    ],
    cabina: [
      [0.85, 0.84, 0.72, 0.0], [0.55, 0.85, 0.68, 1.06], [0.20, 0.85, 0.66, 1.20], [-0.25, 0.86, 0.66, 1.22],
      [-0.70, 0.88, 0.62, 1.17], [-1.15, 0.90, 0.52, 1.04], [-1.62, 0.92, 0.44, 0.96], [-1.75, 0.92, 0.42, 0.0],
    ],
    parabrisas: 0.22, luneta: -0.75, pilarB: [-0.42, -0.30],
    ruedas: { del: 0.31, tras: 0.33 }, ruedasX: [1.46, -1.24],
    piloto: [-0.45, 0.15, -0.38], ala: true, rejilla: 0.7, toma: [1.30, 1.95], branquia: true,
  },
  stock: {
    baja: [
      [2.56, 0.84, 0.24, 0.56, 0.57], [2.49, 0.96, 0.15, 0.66, 0.65], [2.26, 1.00, 0.12, 0.73, 0.70],
      [1.34, 1.02, 0.12, 0.80, 0.76], [0.90, 1.00, 0.12, 0.83, 0.81], [0.00, 0.99, 0.12, 0.86, 0.86],
      [-1.45, 1.02, 0.12, 0.92, 0.90], [-2.30, 1.01, 0.14, 0.94, 0.93], [-2.52, 0.96, 0.20, 0.92, 0.92],
      [-2.59, 0.88, 0.30, 0.88, 0.88],
    ],
    cabina: [
      [0.92, 0.86, 0.78, 0.0], [0.62, 0.87, 0.74, 1.06], [0.22, 0.87, 0.71, 1.28], [-0.30, 0.88, 0.71, 1.30],
      [-0.85, 0.89, 0.70, 1.28], [-1.25, 0.90, 0.64, 1.12], [-1.60, 0.91, 0.56, 0.98], [-1.72, 0.91, 0.54, 0.0],
    ],
    parabrisas: 0.24, luneta: -1.0, pilarB: [-0.42, -0.30],
    ruedas: { del: 0.30, tras: 0.30 }, ruedasX: [1.34, -1.45],
    piloto: [-0.42, 0.22, -0.38], ala: false, rejilla: 0.75, toma: null, branquia: false,
  },
};
export const ANCHO_RUEDAS = { gt: FORMAS.gt.ruedas, stock: FORMAS.stock.ruedas };
/** Carrocería de cada coche: en GT hay tres (coupé, berlinetta de motor central y muscle). */
export function formaDe(categoria, semilla = 0) {
  if (categoria !== 'gt') return categoria;
  return ['gt', 'gtb', 'gtm'][Math.abs(Math.floor(semilla)) % 3];
}

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
// curva de Catmull-Rom abierta por una lista de puntos [z, y], con n muestras
function curva(P, n) {
  const out = [], m = P.length - 1;
  for (let k = 0; k < n; k++) {
    const f = k / (n - 1) * m, i = Math.min(m - 1, Math.floor(f)), t = f - i;
    const a = P[Math.max(0, i - 1)], b = P[i], c = P[i + 1], d = P[Math.min(m, i + 2)];
    out.push([0, 1].map(q => 0.5 * (2 * b[q] + (-a[q] + c[q]) * t + (2 * a[q] - 5 * b[q] + 4 * c[q] - d[q]) * t * t + (-a[q] + 3 * b[q] - 3 * c[q] + d[q]) * t * t * t)));
  }
  return out;
}

const OSCURO = [0.035, 0.037, 0.045], CRISTAL = [0.02, 0.025, 0.035];

/** Media sección de la carrocería baja: del centro de abajo al centro de arriba (lado +z). */
function mediaBaja(w, yb, ys, yc) {
  return [
    [0, yb], [w * 0.5, yb], [w - 0.11, yb], [w - 0.035, yb + 0.03], [w - 0.005, yb + 0.12], [w + 0.004, (yb + ys) / 2],
    [w - 0.004, ys - 0.11], [w - 0.03, ys - 0.03], [w - 0.09, ys + 0.004], [w - 0.17, ys + 0.008],
    [w * 0.55, (ys + yc) / 2 + 0.004], [w * 0.22, yc + 0.006], [0, yc + 0.008],
  ];
}

// malla a partir de anillos (cada anillo: puntos [x, y, z]), sin cerrar en v
function coser(anillos, uvs, cols, tapas = false) {
  const nA = anillos.length, nP = anillos[0].length, pos = [], uv = [], col = [], idx = [];
  for (let a = 0; a < nA; a++) for (let p = 0; p < nP; p++) { pos.push(...anillos[a][p]); uv.push(...uvs[a][p]); col.push(...cols[a][p]); }
  for (let a = 0; a < nA - 1; a++) for (let p = 0; p < nP - 1; p++) {
    const i0 = a * nP + p, i1 = i0 + 1, i2 = i0 + nP, i3 = i2 + 1;
    idx.push(i0, i2, i1, i1, i2, i3);
  }
  // tapas del morro y de la cola: abanico desde el centro de cada anillo extremo
  if (tapas) for (const [a, inv] of [[0, false], [nA - 1, true]]) {
    const r = anillos[a], c = pos.length / 3;
    const cy = r.reduce((s, p) => s + p[1], 0) / r.length;
    pos.push(r[0][0], cy, 0); uv.push(uvs[a][0][0], 0.5); col.push(...cols[a][Math.floor(nP / 4)]);
    for (let p = 0; p < nP - 1; p++) { const i = a * nP + p; if (inv) idx.push(c, i + 1, i); else idx.push(c, i, i + 1); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}
function haciaFuera(g, centro) {
  // si las normales apuntan hacia dentro, se da la vuelta a los triángulos
  g.computeVertexNormals();
  const P = g.attributes.position.array, N = g.attributes.normal.array; let s = 0;
  for (let i = 0; i < P.length; i += 3) s += (P[i] - centro[0]) * N[i] + (P[i + 1] - centro[1]) * N[i + 1] + P[i + 2] * N[i + 2];
  if (s < 0) { const I = g.index.array; for (let t = 0; t < I.length; t += 3) { const x = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = x; } g.computeVertexNormals(); }
  return g;
}

function carroceriaBaja(F, ruedas, calidad) {
  const T = F.baja, xN = T[0][0], xC = T[T.length - 1][0], L = xN - xC;
  const nMedia = calidad >= 2 ? 34 : calidad >= 1 ? 24 : 16;
  const xs = [], fino = calidad >= 2 ? 0.03 : 0.055, grueso = calidad >= 2 ? 0.09 : 0.16;
  const cerca = (x) => ruedas.some(w => Math.abs(x - w.x) < w.r + 0.14) || x > xN - 0.25 || x < xC + 0.2;
  for (let x = xN; x > xC; x -= cerca(x) ? fino : grueso) xs.push(x);
  xs.push(xC);
  const anillos = [], uvs = [], cols = [];
  for (const x of xs) {
    const w = interp(T, x, 1), yb = interp(T, x, 2), ys = interp(T, x, 3), yc = interp(T, x, 4);
    const media = curva(mediaBaja(w, yb, ys, yc), nMedia);
    // v: fondo 0–0,1 · costado 0,1–0,4 (el número va en 0,25) · capó 0,4–0,5 ; el otro lado, 1 − v
    const vDe = (z, y) => (y <= yb + 0.03 && z < w - 0.04 ? 0.1 * z / w : y >= ys - 0.005 && z < w - 0.06 ? 0.4 + 0.1 * (1 - z / (w - 0.06)) : 0.1 + 0.3 * Math.min(1, Math.max(0, (y - yb) / (ys - yb))));
    const anillo = [], uv = [], col = [];
    const lado = [...media.map(p => [p[0], p[1], 1]), ...media.slice(0, -1).reverse().map(p => [p[0], p[1], -1])];
    for (const [zz, y0, sg] of lado) {
      let z = zz * sg, c = [1, 1, 1];
      const y = y0;
      // pasos de rueda: lo que tapa la rueda se mete hasta la cara interior (y se pinta oscuro)
      let xx = x, yy = y;
      for (const r of ruedas) {
        const dx = x - r.x, dy = y - r.r, ra = r.r + 0.06, zIn = Math.abs(r.z) - r.w / 2 - 0.05, d = Math.hypot(dx, dy);
        if (Math.sign(z || 1) !== Math.sign(r.z) || Math.abs(z) <= zIn) continue;
        if (d < ra) { z = Math.sign(z) * zIn; c = OSCURO; }
        // los vértices que quedan justo fuera se ponen sobre el círculo: el borde del arco sale redondo
        else if (d < ra + 0.03 && dy > -0.02) { xx = r.x + dx / d * ra; yy = r.r + dy / d * ra; }
      }
      // faldones, rejilla, difusor y tomas del capó (oscuros)
      if (y < yb + 0.065) c = OSCURO;
      if (x > xN - 0.1 && y < (ys + yb) * F.rejilla && y > yb + 0.05 && Math.abs(z) < w * 0.72) c = OSCURO;
      if (x < xC + 0.08 && y < yb + 0.2) c = OSCURO;
      anillo.push([xx, yy, z]); col.push(c);
      uv.push([(x - xC) / L, sg > 0 ? vDe(zz, y0) : 1 - vDe(zz, y0)]);
    }
    anillos.push(anillo); uvs.push(uv); cols.push(col);
  }
  return haciaFuera(coser(anillos, uvs, cols, true), [0, 0.5]);
}

function cabina(F, calidad) {
  const T = F.cabina, xA = T[0][0], xB = T[T.length - 1][0];
  const nM = calidad >= 2 ? 12 : 9;
  const xs = [], paso = calidad >= 2 ? 0.05 : 0.09;
  for (let x = xA; x > xB; x -= paso) xs.push(x);
  xs.push(xB);
  const anillos = [], uvs = [], cols = [];
  const xC = F.baja[F.baja.length - 1][0], L = F.baja[0][0] - xC;
  for (const x of xs) {
    const wb = interp(T, x, 1), wr = interp(T, x, 2), base = interp(F.baja, x, 3) - 0.02;
    const yr = Math.max(base + 0.015, interp(T, x, 3));
    const alto = yr - base;
    // media sección: del pie del costado al centro del techo, con caída hacia dentro
    const media = curva([[wb, base], [wb - 0.03, base + alto * 0.35], [wr + 0.06, base + alto * 0.8], [wr, yr - 0.03], [wr * 0.6, yr - 0.004], [0, yr]], nM);
    const anillo = [], uv = [], col = [];
    const lado = [...media.map(p => [p[0], p[1], 1]), ...media.slice(0, -1).reverse().map(p => [p[0], p[1], -1])];
    for (const [zz, y, sg] of lado) {
      const z = zz * sg;
      const techo = zz < wr * 0.93 && y > yr - 0.05;
      const marco = y < base + 0.035 || alto < 0.12;
      let cristal;
      if (x > F.parabrisas) cristal = true;                                                    // parabrisas
      else if (x < F.luneta) cristal = zz < wr * 0.85 && y > base + alto * 0.3;                // luneta; pilares C pintados
      else cristal = !techo && !(x < F.pilarB[1] && x > F.pilarB[0]);                         // ventanillas; pilar B pintado
      // pilar A: banda pintada entre el parabrisas y la ventanilla
      if (Math.abs(x - F.parabrisas) < 0.035 && !techo) cristal = false;
      if (x > F.parabrisas && zz > wr * 0.97 && y < yr - 0.03 && zz > wb - 0.1) cristal = false;
      anillo.push([x, y, z]); col.push(cristal && !marco ? CRISTAL : [1, 1, 1]);
      uv.push([(x - xC) / L, 0.5 + z * 0.108]);
    }
    anillos.push(anillo); uvs.push(uv); cols.push(col);
  }
  return haciaFuera(coser(anillos, uvs, cols), [-0.2, 0.6]);
}

/** Librea de la carrocería cerrada (u a lo largo del coche, v alrededor: 0,25 costado derecho,
 *  0,5 eje del capó y del techo, 0,75 costado izquierdo). */
export function pintarLibreaCerrada(cv, { categoria, patron = 'franjas', colores, numero = 7 }) {
  const W = cv.width, H = cv.height, x = cv.getContext('2d');
  const { base, acento, tercero } = colores;
  const F = FORMAS[categoria], x0 = F.baja[0][0], x1 = F.baja[F.baja.length - 1][0];
  const U = (xm) => (xm - x1) / (x0 - x1) * W;
  const V = (v) => (1 - v) * H;
  x.fillStyle = base; x.fillRect(0, 0, W, H);
  // costado: origen en v 0,25 (derecha) o 0,75 (izquierda, volteado para que se lea bien)
  const costado = (fn) => { for (const lado of [1, -1]) { x.save(); x.translate(0, V(lado > 0 ? 0.25 : 0.75)); if (lado < 0) { x.translate(W, 0); x.scale(-1, -1); } fn(lado); x.restore(); } };
  const bh = H * 0.05;
  switch (patron) {
    case 'lisa': break;
    case 'degradado': {
      const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, acento); g.addColorStop(0.5, base); g.addColorStop(1, base);
      x.fillStyle = g; x.fillRect(0, 0, W, H); break;
    }
    case 'flecha': case 'rayo': costado(() => {
      x.fillStyle = acento; x.beginPath();
      if (patron === 'flecha') { x.moveTo(U(-2.1), -bh * 2.2); x.lineTo(U(1.2), -bh * 0.3); x.lineTo(U(2.4), bh * 0.1); x.lineTo(U(1.2), bh * 0.5); x.lineTo(U(-2.1), bh * 2.2); }
      else { x.moveTo(U(-2.1), -bh); x.lineTo(U(-0.5), -bh); x.lineTo(U(-0.8), 0); x.lineTo(U(1.0), -bh * 0.4); x.lineTo(U(0.7), bh * 0.4); x.lineTo(U(2.4), bh * 0.1); x.lineTo(U(2.4), bh * 0.7); x.lineTo(U(-0.1), bh * 1.3); x.lineTo(U(0.2), bh * 0.3); x.lineTo(U(-2.1), bh); }
      x.closePath(); x.fill();
    }); break;
    case 'geometrico': costado(() => {
      for (let k = 0; k < 7; k++) { x.fillStyle = k % 2 ? acento : tercero; x.globalAlpha = 0.9; x.beginPath(); const a = U(-2.0 + k * 0.6); x.moveTo(a, bh * 2.4); x.lineTo(a + W * 0.07, -bh * 2.4); x.lineTo(a + W * 0.11, bh * 2.4); x.fill(); }
      x.globalAlpha = 1;
    }); break;
    case 'digital': {
      let s = 1234; const r = () => (s = (s * 16807) % 2147483647) / 2147483647, c = W / 64;
      for (let i = 0; i < W / c; i++) for (let j = 0; j < H / c; j++) if (r() < 0.22) { x.fillStyle = r() < 0.5 ? acento : tercero; x.fillRect(i * c, j * c, c * (1 + Math.floor(r() * 2)), c); }
      break;
    }
    case 'llamas': costado(() => {
      x.fillStyle = acento;
      for (let k = 0; k < 6; k++) { x.beginPath(); const y0 = (k - 2.5) * bh * 0.7; x.moveTo(U(2.45), y0 - bh * 0.4); x.quadraticCurveTo(U(0.9 - k * 0.12), y0 - bh, U(-0.4 - k * 0.25), y0); x.quadraticCurveTo(U(0.9 - k * 0.12), y0 + bh * 0.7, U(2.45), y0 + bh * 0.4); x.fill(); }
    }); break;
    default: // franjas: dos bandas por el eje (capó, techo y maletero) y un filete en los costados
      x.fillStyle = acento;
      x.fillRect(0, V(0.5) - H * 0.045, W, H * 0.03); x.fillRect(0, V(0.5) + H * 0.015, W, H * 0.03);
      costado(() => { x.fillStyle = tercero; x.fillRect(0, -bh * 2.1, W, bh * 0.35); x.fillStyle = acento; x.fillRect(0, -bh * 1.75, W, bh * 0.22); });
  }
  // números: círculo blanco en el GT; grandes y perfilados en el Stock (puertas y techo)
  const stock = categoria === 'stock', rN = H * (stock ? 0.07 : 0.055);
  const num = (cx, cy, r, rot) => {
    x.save(); x.translate(cx, cy); x.rotate(rot);
    if (!stock) { x.fillStyle = '#ffffff'; x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.fill(); x.lineWidth = r * 0.08; x.strokeStyle = '#111'; x.stroke(); }
    x.font = `italic 900 ${Math.round(r * (stock ? 1.8 : 1.25))}px system-ui, sans-serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    if (stock) { x.lineWidth = r * 0.2; x.strokeStyle = '#111'; x.lineJoin = 'round'; x.strokeText(String(numero), 0, r * 0.06); x.fillStyle = tercero; }
    else x.fillStyle = '#111';
    x.fillText(String(numero), 0, r * 0.06); x.restore();
  };
  costado(() => num(U(stock ? -0.2 : 0.0), 0, rN, 0));
  num(U(stock ? -0.35 : -0.3), V(0.5), rN * 1.15, -Math.PI / 2);
  // ── líneas de las piezas (puertas, capó, paragolpes, tapón de gasolina): dan realismo ──
  const rA = F.ruedasX;
  x.strokeStyle = 'rgba(0,0,0,.38)'; x.lineWidth = Math.max(1.5, W / 600);
  const xPuerta = [F.parabrisas + 0.12, F.pilarB[0] - 0.02];
  costado(() => {
    x.strokeRect(U(xPuerta[1]), -H * 0.125, U(xPuerta[0]) - U(xPuerta[1]), H * 0.235);                    // puerta
    x.beginPath(); x.moveTo(U(xPuerta[0] - 0.12), -H * 0.04); x.lineTo(U(xPuerta[0] - 0.24), -H * 0.04); x.stroke();   // tirador
    for (const xs of [rA[0] + 0.52, rA[1] - 0.48]) { x.beginPath(); x.moveTo(U(xs), -H * 0.13); x.lineTo(U(xs), H * 0.14); x.stroke(); }  // paragolpes
    x.beginPath(); x.arc(U(rA[1] + 0.05), -H * 0.1, H * 0.018, 0, Math.PI * 2); x.stroke();          // gasolina
  });
  const xCapo = F.cabina[0][0] + 0.05;
  for (const v of [0.41, 0.59]) { x.beginPath(); x.moveTo(U(xCapo), V(v)); x.lineTo(U(x0 - 0.18), V(v)); x.stroke(); }
  x.beginPath(); x.moveTo(U(xCapo), V(0.41)); x.lineTo(U(xCapo), V(0.59)); x.stroke();

  // ── tomas de aire dibujadas (nítidas): rejillas del capó, branquias y toma lateral ──
  const rejilla = (x0r, y0r, w, h, n, horiz = false) => {
    x.fillStyle = 'rgba(6,7,10,.92)'; x.beginPath(); x.roundRect ? x.roundRect(x0r, y0r, w, h, Math.min(w, h) * 0.25) : x.rect(x0r, y0r, w, h); x.fill();
    x.strokeStyle = 'rgba(90,95,110,.55)'; x.lineWidth = Math.max(1, W / 900);
    for (let k = 1; k < n; k++) { x.beginPath(); if (horiz) { x.moveTo(x0r + 2, y0r + h * k / n); x.lineTo(x0r + w - 2, y0r + h * k / n); } else { x.moveTo(x0r + w * k / n, y0r + 2); x.lineTo(x0r + w * k / n, y0r + h - 2); } x.stroke(); }
  };
  if (F.toma) for (const v of [0.455, 0.545]) rejilla(U(F.toma[0]), V(v) - H * 0.022, U(F.toma[1]) - U(F.toma[0]), H * 0.044, 6, true);
  costado(() => {
    if (F.branquia) { const xa = rA[0] - 0.52; for (let k = 0; k < 3; k++) rejilla(U(xa - k * 0.08), -H * 0.06, U(0.05) - U(0), H * 0.1, 1); }
    if (F.tomaLateral) { const [a, b] = F.tomaLateral; x.fillStyle = 'rgba(6,7,10,.92)'; x.beginPath(); x.moveTo(U(b), -H * 0.09); x.lineTo(U(a), -H * 0.02); x.lineTo(U(a), H * 0.06); x.lineTo(U(b), H * 0.06); x.closePath(); x.fill(); }
  });

  // ── patrocinadores: UPGAMES, UPCOINS, NEXUS IA, APEX GP, UPGAMES TV ──
  const logo = (txt, cx, cy, alto, { fondo = null, color = '#fff', rot = 0, ancho = null } = {}) => {
    x.save(); x.translate(cx, cy); x.rotate(rot);
    x.font = `italic 900 ${Math.round(alto)}px system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    const w = ancho || x.measureText(txt).width + alto * 0.7;
    if (fondo) { x.fillStyle = fondo; x.beginPath(); x.roundRect?.(-w / 2, -alto * 0.7, w, alto * 1.4, alto * 0.25); if (!x.roundRect) x.rect(-w / 2, -alto * 0.7, w, alto * 1.4); x.fill(); }
    x.fillStyle = color; x.fillText(txt, 0, alto * 0.04); x.restore();
  };
  const moneda = (cx, cy, r) => { x.fillStyle = '#ffc928'; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#b8860b'; x.lineWidth = r * 0.18; x.stroke(); x.fillStyle = '#8a5a00'; x.font = `900 ${Math.round(r * 1.2)}px system-ui`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('U', cx, cy + r * 0.05); };
  // capó: UPGAMES grande en una placa oscura
  logo('UPGAMES', U((xCapo + x0) / 2 - 0.05), V(0.5), H * 0.03, { fondo: 'rgba(8,10,16,.85)', rot: Math.PI / 2 });
  // morro: NEXUS IA
  logo('NEXUS IA', U(x0 - 0.12), V(0.5), H * 0.017, { color: '#7fe7ff', rot: Math.PI / 2 });
  // maletero: UPCOINS con su moneda
  { const cx = U(x1 + 0.35), cy = V(0.5); x.save(); x.translate(cx, cy); x.rotate(Math.PI / 2); logo('UPCOINS', 0, 0, H * 0.022, { fondo: 'rgba(8,10,16,.85)', color: '#ffc928' }); x.restore(); }
  costado(() => {
    // puerta: bajo el número, UPCOINS con su moneda
    const xp = (xPuerta[0] + xPuerta[1]) / 2;
    logo('UPCOINS', U(xp) + H * 0.012, H * 0.075, H * 0.024, { fondo: 'rgba(8,10,16,.82)', color: '#ffc928' });
    moneda(U(xp) - H * 0.06, H * 0.075, H * 0.014);
    // aleta delantera: NEXUS IA · aleta trasera: APEX GP y UPGAMES TV
    logo('NEXUS IA', U(rA[0] - 0.05), -H * 0.07, H * 0.02, { fondo: 'rgba(8,10,16,.8)', color: '#7fe7ff' });
    logo('APEX GP', U(rA[1] - 0.05), -H * 0.075, H * 0.022, { color: '#fff', fondo: '#e8202a' });
    logo('UPGAMES TV', U(rA[1] - 0.05), -H * 0.02, H * 0.015, { color: '#fff' });
    // faldón: la web
    logo('UPGAMES.GAMES', U(xp), H * 0.135, H * 0.016, { color: '#fff' });
    // paragolpes delantero y trasero
    logo('UPGAMES', U(x0 - 0.2), H * 0.06, H * 0.016, { color: tercero });
    logo('NEXUS', U(x1 + 0.2), H * 0.06, H * 0.016, { color: tercero });
  });
}

// gira una lámina para que su eje X local sea `ejeX` y su Y local `ejeY` (la normal sale de ambos)
function orientar(m, ejeX, ejeY) { m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ejeX, ejeY, ejeX.clone().cross(ejeY))); }

/** Lienzo con letras para una pegatina (parasol del parabrisas, alerón). */
function pegatina(txt, { ancho = 512, alto = 64, fondo = '#0b0c10', color = '#fff', extra = null } = {}) {
  const cv = document.createElement('canvas'); cv.width = ancho; cv.height = alto;
  const x = cv.getContext('2d');
  if (fondo) { x.fillStyle = fondo; x.fillRect(0, 0, ancho, alto); }
  x.font = `italic 900 ${Math.round(alto * 0.66)}px system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = color; x.fillText(txt, ancho / 2 - (extra ? alto * 0.4 : 0), alto * 0.54);
  if (extra) { x.fillStyle = extra; x.font = `900 ${Math.round(alto * 0.4)}px system-ui`; x.fillText('●', ancho / 2 + x.measureText(txt).width * 0.75, alto * 0.54); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/**
 * Crea la carrocería cerrada. ruedas: [{ x, z, r, w }]. Devuelve la piel pintada (cuerpo, una
 * malla sin índices para las abolladuras), un grupo con lo demás y los datos para colocar el
 * piloto, las cámaras y los espejos.
 */
export function crearCarroceria(categoria, { pintura, ruedas, calidad = 2 }) {
  const F = FORMAS[categoria];
  pintura.vertexColors = true; pintura.needsUpdate = true;
  const gBaja = carroceriaBaja(F, ruedas, calidad), gCab = cabina(F, calidad);
  // una sola malla sin índices (las abolladuras del monoplaza trabajan por triángulos)
  const g = new THREE.BufferGeometry();
  const nb = gBaja.toNonIndexed(), nc = gCab.toNonIndexed();
  for (const k of ['position', 'normal', 'uv', 'color']) {
    const a = nb.attributes[k], b = nc.attributes[k], arr = new Float32Array(a.array.length + b.array.length);
    arr.set(a.array); arr.set(b.array, a.array.length);
    g.setAttribute(k, new THREE.BufferAttribute(arr, a.itemSize));
  }
  g.computeBoundingSphere();
  const cuerpo = new THREE.Mesh(g, pintura); cuerpo.castShadow = true; cuerpo.receiveShadow = true;

  const extras = new THREE.Group();
  const negro = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.6 });
  const carbono = new THREE.MeshStandardMaterial({ color: 0x1a1b1f, roughness: 0.32, metalness: 0.35 });
  const cromo = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.18, metalness: 1 });
  const add = (geo, mat, x, y, z, sombra = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = sombra; extras.add(m); return m; };
  const T = F.baja, xN = T[0][0], xC = T[T.length - 1][0];
  const ys = (x) => interp(T, x, 3), wv = (x) => interp(T, x, 1), yb = (x) => interp(T, x, 2);

  // splitter delantero y difusor con aletas
  add(new THREE.BoxGeometry(0.42, 0.022, wv(xN - 0.2) * 1.9), carbono, xN - 0.17, yb(xN - 0.2) - 0.03, 0);
  add(new THREE.BoxGeometry(0.45, 0.025, wv(xC + 0.2) * 1.7), carbono, xC + 0.2, yb(xC + 0.2) + 0.03, 0);
  for (const z of [-0.55, -0.2, 0.2, 0.55]) add(new THREE.BoxGeometry(0.4, 0.14, 0.012), carbono, xC + 0.2, yb(xC + 0.2) + 0.1, z);
  // escapes
  for (const s of categoria !== 'stock' ? [-0.35, 0.35] : [0.62]) {
    const e = add(new THREE.CylinderGeometry(0.045, 0.05, 0.12, 14, 1, true), cromo, xC + 0.02, yb(xC) + 0.08, s);
    e.rotation.z = Math.PI / 2;
  }
  // faros (lente alargada) y pilotos LED
  const faro = new THREE.MeshStandardMaterial({ color: 0xe8f0ff, emissive: 0xd6e6ff, emissiveIntensity: 0.9, roughness: 0.08, metalness: 0.2 });
  const piloto = new THREE.MeshStandardMaterial({ color: 0x4a0000, emissive: 0xff1414, emissiveIntensity: 1.6, roughness: 0.2 });
  const esfera = new THREE.SphereGeometry(1, 16, 10);
  for (const s of [-1, 1]) {
    const xf = xN - 0.16, f = add(esfera, faro, xf, ys(xf) - 0.07, s * (wv(xf) - 0.2), false);
    f.scale.set(0.16, 0.045, 0.17); f.rotation.set(0, s * 0.45, s * 0.12);
    const xp = xC + 0.03, p = add(new THREE.BoxGeometry(0.04, 0.05, categoria !== 'stock' ? 0.5 : 0.42), piloto, xp, ys(xp) - 0.1, s * (wv(xp) - 0.33), false);
    p.rotation.y = s * 0.15;
  }
  if (categoria !== 'stock') add(new THREE.BoxGeometry(0.03, 0.022, 0.75), piloto, xC + 0.02, ys(xC) - 0.1, 0, false);   // tira LED central
  // retrovisores sobre un brazo, al pie del parabrisas
  const espejos = [];
  const cab0 = F.cabina[0][0];
  for (const s of [-1, 1]) {
    const xe = cab0 - 0.24, ye = ys(xe) + 0.12, ze = s * (interp(F.cabina, xe, 1) + 0.13);
    const carcasa = add(esfera, pintura, xe, ye, ze); carcasa.scale.set(0.09, 0.055, 0.1);
    const brazo = add(new THREE.BoxGeometry(0.05, 0.02, 0.14), negro, xe + 0.01, ye - 0.04, ze - s * 0.08); brazo.rotation.y = s * 0.2;
    espejos.push({ x: xe - 0.07, y: ye, z: ze });
  }
  // alerón trasero (GT): perfil inclinado con derivas y cuellos de cisne · spoiler (Stock)
  const techo = Math.max(...F.cabina.map(c => c[3]));
  if (F.ala) {
    const xA = xC + 0.26, yA = techo - 0.03;
    const perfil = new THREE.Shape(); perfil.moveTo(0.16, 0); perfil.quadraticCurveTo(0.05, 0.035, -0.16, 0.012); perfil.lineTo(-0.16, -0.004); perfil.quadraticCurveTo(0.05, 0.012, 0.16, 0);
    const geoAla = new THREE.ExtrudeGeometry(perfil, { depth: 1.76, bevelEnabled: false }); geoAla.translate(0, 0, -0.88);
    const ala = add(geoAla, carbono, xA, yA, 0); ala.rotation.z = -0.1;
    // pegatina encima del ala (se lee desde detrás) y en las derivas
    const sup = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.22), new THREE.MeshStandardMaterial({ map: pegatina('UPCOINS', { ancho: 512, alto: 72, color: '#ffc928', fondo: '#111216', extra: '#ffc928' }), roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 }));
    sup.position.set(xA - 0.01, yA + 0.028, 0); orientar(sup, new THREE.Vector3(0, 0, 1), new THREE.Vector3(Math.cos(0.1), -Math.sin(0.1), 0)); extras.add(sup);
    for (const s of [-1, 1]) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.14), new THREE.MeshStandardMaterial({ map: pegatina('NEXUS IA', { ancho: 256, alto: 96, color: '#7fe7ff' }), roughness: 0.4 }));
      d.position.set(xA - 0.02, yA - 0.02, s * 0.893); if (s < 0) d.rotation.y = Math.PI; extras.add(d);
    }
    for (const s of [-1, 1]) {
      add(new THREE.BoxGeometry(0.4, 0.2, 0.012), carbono, xA - 0.02, yA - 0.02, s * 0.885);
      // cuello de cisne: baja desde el ala hasta el maletero
      const h = yA - ys(xA) - 0.02;
      const c1 = add(new THREE.BoxGeometry(0.05, h, 0.018), carbono, xA + 0.08, ys(xA) + h / 2 + 0.03, s * 0.36); c1.rotation.z = -0.25;
    }
  } else {
    const xS = xC + 0.12, sp = add(new THREE.BoxGeometry(0.015, 0.2, wv(xS) * 1.82), new THREE.MeshStandardMaterial({ color: 0xdfeaff, roughness: 0.05, transparent: true, opacity: 0.45 }), xS, ys(xS) + 0.09, 0);
    sp.rotation.z = 0.32;
  }
  // parasol del parabrisas (UPGAMES) y pegatinas del alerón (UPCOINS / NEXUS IA)
  {
    const xb = F.parabrisas + 0.04, x2 = xb + 0.12;
    const y1 = interp(F.cabina, xb, 3), y2 = interp(F.cabina, x2, 3), wr = interp(F.cabina, xb, 2);
    const mat = new THREE.MeshStandardMaterial({ map: pegatina('UPGAMES', { ancho: 512, alto: 64 }), roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 });
    const banda = new THREE.Mesh(new THREE.PlaneGeometry(wr * 2.02, 0.13), mat);
    banda.position.set((xb + x2) / 2, (y1 + y2) / 2 + 0.006, 0);
    // inclinada como el parabrisas; se lee de frente
    orientar(banda, new THREE.Vector3(0, 0, -1), new THREE.Vector3(xb - x2, y1 - y2, 0).normalize());
    extras.add(banda);
  }
  // salpicadero y forro del techo (por si se mira desde dentro)
  add(new THREE.BoxGeometry(0.34, 0.12, 1.5), negro, cab0 - 0.32, ys(cab0) - 0.02, 0);
  const forro = add(new THREE.PlaneGeometry(0.8, 1.0), new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.9, side: THREE.DoubleSide }), -0.2, techo - 0.08, 0, false);
  forro.rotation.x = Math.PI / 2;

  // datos para el resto del modelo (cámaras, piloto, calor del escape, espejos)
  const forma = { piloto: F.piloto, techo, cintura: ys(cab0), cristal: [cab0, F.cabina[F.cabina.length - 1][0]], secciones: [[xN], [xC]], espejos };
  return { cuerpo, extras, forma };
}
