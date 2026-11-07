// Carrocerías cerradas (GT y Stock Car): una sola piel de secciones superelípticas cosidas a lo
// largo del coche, con los pasos de rueda abiertos (los vértices de la piel que caen sobre cada
// rueda se meten hacia dentro y forman el arco), cristales tintados, luces, alerón, splitter,
// retrovisores y un salpicadero para la cámara de cabina. Ejes como el monoplaza: +X delante,
// +Y arriba, +Z a la derecha, origen bajo el CG a nivel del suelo.
import * as THREE from 'three';

// Secciones: [x, semiancho, techo, suelo, forma arriba, forma abajo]
const FORMAS = {
  gt: {
    secciones: [
      [2.46, 0.70, 0.50, 0.30, 2.2, 2.4], [2.40, 0.86, 0.58, 0.25, 2.6, 2.6], [2.22, 0.96, 0.66, 0.22, 3.0, 3.0],
      [1.92, 1.00, 0.74, 0.21, 3.6, 3.4], [1.46, 1.00, 0.80, 0.21, 3.8, 3.6], [1.05, 0.98, 0.86, 0.21, 3.6, 3.6],
      [0.70, 0.95, 1.02, 0.21, 2.6, 3.6], [0.35, 0.93, 1.16, 0.21, 2.3, 3.6], [0.00, 0.93, 1.20, 0.21, 2.3, 3.6],
      [-0.50, 0.95, 1.18, 0.21, 2.3, 3.6], [-0.95, 0.99, 1.04, 0.21, 2.6, 3.6], [-1.24, 1.01, 0.94, 0.21, 3.4, 3.6],
      [-1.70, 1.00, 0.90, 0.22, 3.6, 3.4], [-2.05, 0.96, 0.88, 0.27, 3.2, 3.0], [-2.16, 0.86, 0.82, 0.35, 2.6, 2.6],
    ],
    cintura: 0.88, cristal: [1.02, -1.02], techoX: [0.38, -0.62],            // altura de la línea de cintura y tramo acristalado (x)
    ruedas: { del: 0.31, tras: 0.33 },
    piloto: [-0.36, 0.13, -0.38], volante: [0.12, 0.80, -0.38],
    ala: true, techo: 1.20,
  },
  stock: {
    secciones: [
      [2.54, 0.80, 0.56, 0.24, 3.0, 3.0], [2.44, 0.94, 0.66, 0.20, 3.6, 3.4], [2.15, 1.00, 0.74, 0.19, 4.4, 4.0],
      [1.70, 1.02, 0.80, 0.19, 4.8, 4.2], [1.30, 1.02, 0.84, 0.19, 4.8, 4.2], [0.95, 1.01, 0.90, 0.19, 4.6, 4.2],
      [0.55, 0.98, 1.10, 0.19, 3.0, 4.2], [0.15, 0.95, 1.28, 0.19, 2.8, 4.2], [-0.30, 0.95, 1.30, 0.19, 2.8, 4.2],
      [-0.80, 0.97, 1.26, 0.19, 2.8, 4.2], [-1.30, 1.01, 1.04, 0.19, 3.6, 4.2], [-1.70, 1.03, 0.98, 0.19, 4.6, 4.2],
      [-2.20, 1.02, 0.97, 0.20, 4.6, 4.0], [-2.48, 0.98, 0.96, 0.24, 4.0, 3.6], [-2.56, 0.88, 0.92, 0.32, 3.0, 3.0],
    ],
    cintura: 0.96, cristal: [0.98, -1.34], techoX: [0.22, -0.92],
    ruedas: { del: 0.30, tras: 0.30 },
    piloto: [-0.42, 0.22, -0.38], volante: [0.04, 0.88, -0.38],
    ala: false, techo: 1.30,
  },
};
export const ANCHO_RUEDAS = { gt: FORMAS.gt.ruedas, stock: FORMAS.stock.ruedas };
export const AJUSTE_PILOTO = { gt: FORMAS.gt, stock: FORMAS.stock };

const lerp = (a, b, t) => a + (b - a) * t;
function seccionEn(S, x) {
  if (x >= S[0][0]) return S[0];
  for (let k = 0; k < S.length - 1; k++) {
    const a = S[k], b = S[k + 1];
    if (x <= a[0] && x >= b[0]) { const t = (a[0] - x) / (a[0] - b[0]); return a.map((v, i) => lerp(v, b[i], t)); }
  }
  return S[S.length - 1];
}

/**
 * Piel de la carrocería. ruedas: [{ x, z, r, w }]. Devuelve una geometría sin índices (para las
 * abolladuras del monoplaza), con uv para la librea y color por vértice (cristales oscuros).
 */
function piel(F, ruedas, calidad) {
  const S = F.secciones, x0 = S[0][0], x1 = S[S.length - 1][0], L = x0 - x1;
  const segs = calidad >= 2 ? 56 : calidad >= 1 ? 44 : 32;
  // más secciones sobre las ruedas (el arco tiene que salir redondo)
  const xs = [];
  const fino = calidad >= 2 ? 0.035 : 0.06, grueso = calidad >= 2 ? 0.12 : 0.2;
  const cercaRueda = (x) => ruedas.some(w => Math.abs(x - w.x) < w.r + 0.12);
  for (let x = x0; x > x1; x -= cercaRueda(x) ? fino : grueso) xs.push(x);
  xs.push(x1);
  const pos = [], uv = [], col = [];
  for (const x of xs) {
    const [, w, yt, yb, n, nb] = seccionEn(S, x);
    const yc = (yt + yb) / 2, h = (yt - yb) / 2;
    for (let j = 0; j < segs; j++) {
      const v = j / segs, t = v * Math.PI * 2 - Math.PI / 2;     // v = 0 abajo, 0,25 derecha, 0,5 techo, 0,75 izquierda
      const c = Math.cos(t), sn = Math.sin(t), e = sn >= 0 ? n : nb;
      let y = yc + h * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / e);
      let z = w * Math.sign(c) * Math.pow(Math.abs(c), 2 / e);
      // paso de rueda: lo que cae sobre la rueda (vista de lado) se mete hasta la cara interior
      for (const r of ruedas) {
        const dx = x - r.x, dy = y - r.r, ra = r.r + 0.055;
        const zIn = Math.abs(r.z) - r.w / 2 - 0.05;
        if (dx * dx + dy * dy < ra * ra && Math.sign(z) === Math.sign(r.z) && Math.abs(z) > zIn) z = Math.sign(z) * zIn;
      }
      // el fondo plano no baja del suelo del coche
      y = Math.max(y, yb);
      pos.push(x, y, z);
      uv.push((x - x1) / L, v);
      const techo = x < F.techoX[0] && x > F.techoX[1] && sn > 0.55;          // el techo va pintado
      const cristal = x < F.cristal[0] && x > F.cristal[1] && y > F.cintura && Math.abs(z) < w * 0.985 && !techo;
      col.push(...(cristal ? [0.05, 0.06, 0.08] : [1, 1, 1]));
    }
  }
  const idx = [];
  for (let k = 0; k < xs.length - 1; k++) for (let j = 0; j < segs; j++) {
    const a = k * segs + j, b = k * segs + (j + 1) % segs, c = (k + 1) * segs + j, d = (k + 1) * segs + (j + 1) % segs;
    // costura de la textura: el último cuadrado de cada anillo repite la columna v = 1
    idx.push(a, b, c, b, d, c);
  }
  // tapas del morro y la cola
  for (const [k, inv] of [[0, false], [xs.length - 1, true]]) {
    const ci = pos.length / 3, [, , yt, yb] = seccionEn(S, xs[k]);
    pos.push(xs[k], (yt + yb) / 2, 0); uv.push(k ? 0 : 1, 0.5); col.push(1, 1, 1);
    for (let j = 0; j < segs; j++) { const a = k * segs + j, b = k * segs + (j + 1) % segs; if (inv) idx.push(ci, a, b); else idx.push(ci, b, a); }
  }
  let g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  g = g.toNonIndexed();
  // la columna de la costura (v ≈ 1 → 0): los triángulos que cruzan llevan v = 1
  const U = g.attributes.uv.array;
  for (let t = 0; t < U.length; t += 6) {
    const vs = [U[t + 1], U[t + 3], U[t + 5]];
    if (Math.max(...vs) - Math.min(...vs) > 0.5) for (let q = 0; q < 3; q++) if (U[t + q * 2 + 1] < 0.5) U[t + q * 2 + 1] += 1;
  }
  // caras hacia fuera: si el volumen sale negativo, se da la vuelta a los triángulos
  const P = g.attributes.position.array; let vol = 0;
  for (let t = 0; t < P.length; t += 9) vol += P[t] * (P[t + 4] * P[t + 8] - P[t + 5] * P[t + 7]) - P[t + 1] * (P[t + 3] * P[t + 8] - P[t + 5] * P[t + 6]) + P[t + 2] * (P[t + 3] * P[t + 7] - P[t + 4] * P[t + 6]);
  if (vol < 0) {
    for (const nombre of ['position', 'normal', 'uv', 'color']) {
      const a = g.attributes[nombre], n = a.itemSize, A = a.array;
      for (let t = 0; t < a.count; t += 3) for (let q = 0; q < n; q++) { const i1 = (t + 1) * n + q, i2 = (t + 2) * n + q; const tmp = A[i1]; A[i1] = A[i2]; A[i2] = tmp; }
    }
  }
  g.computeVertexNormals();     // (sin índices: normales por cara suavizadas abajo)
  suavizarNormales(g);
  return g;
}

// normales suaves en una geometría sin índices: se promedian las de los vértices que coinciden
function suavizarNormales(g) {
  const P = g.attributes.position.array, N = g.attributes.normal.array, mapa = new Map();
  const clave = (i) => `${Math.round(P[i] * 1000)},${Math.round(P[i + 1] * 1000)},${Math.round(P[i + 2] * 1000)}`;
  for (let i = 0; i < P.length; i += 3) {
    const k = clave(i); let s = mapa.get(k);
    if (!s) mapa.set(k, s = [0, 0, 0]);
    s[0] += N[i]; s[1] += N[i + 1]; s[2] += N[i + 2];
  }
  for (let i = 0; i < P.length; i += 3) {
    const s = mapa.get(clave(i)), l = Math.hypot(s[0], s[1], s[2]) || 1;
    N[i] = s[0] / l; N[i + 1] = s[1] / l; N[i + 2] = s[2] / l;
  }
  g.attributes.normal.needsUpdate = true;
}

/** Librea de la carrocería cerrada: el lienzo es el desarrollo de la piel (u a lo largo, v alrededor). */
export function pintarLibreaCerrada(cv, { categoria, patron = 'franjas', colores, numero = 7 }) {
  const W = cv.width, H = cv.height, x = cv.getContext('2d');
  const { base, acento, tercero } = colores;
  const F = FORMAS[categoria], S = F.secciones, x0 = S[0][0], x1 = S[S.length - 1][0];
  const U = (xm) => (xm - x1) / (x0 - x1) * W;          // metros del coche → píxel horizontal
  const V = (v) => (1 - v) * H;                           // v de la piel → píxel vertical (flipY)
  x.fillStyle = base; x.fillRect(0, 0, W, H);
  // dibujo en los dos costados: f(lado) con lado = +1 (derecha, v 0,25) y −1 (izquierda, v 0,75)
  const costado = (fn) => { for (const lado of [1, -1]) { x.save(); x.translate(0, V(lado > 0 ? 0.25 : 0.75)); if (lado < 0) { x.translate(W, 0); x.scale(-1, -1); } fn(lado); x.restore(); } };
  const bandaH = H * 0.06;
  switch (patron) {
    case 'lisa': break;
    case 'degradado': {
      const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, acento); g.addColorStop(0.55, base); g.addColorStop(1, base);
      x.fillStyle = g; x.fillRect(0, 0, W, H); break;
    }
    case 'flecha': case 'rayo': costado(() => {
      x.fillStyle = acento; x.beginPath();
      if (patron === 'flecha') { x.moveTo(U(-2.2), -bandaH * 1.6); x.lineTo(U(1.6), -bandaH * 0.2); x.lineTo(U(2.3), 0); x.lineTo(U(1.6), bandaH * 0.2); x.lineTo(U(-2.2), bandaH * 1.6); }
      else { x.moveTo(U(-2.2), -bandaH); x.lineTo(U(-0.6), -bandaH); x.lineTo(U(-0.9), 0); x.lineTo(U(0.9), -bandaH * 0.4); x.lineTo(U(0.6), bandaH * 0.4); x.lineTo(U(2.3), bandaH * 0.1); x.lineTo(U(2.3), bandaH * 0.6); x.lineTo(U(-0.2), bandaH * 1.2); x.lineTo(U(0.1), bandaH * 0.3); x.lineTo(U(-2.2), bandaH); }
      x.closePath(); x.fill();
    }); break;
    case 'geometrico': costado(() => {
      for (let k = 0; k < 7; k++) { x.fillStyle = k % 2 ? acento : tercero; x.globalAlpha = 0.85; x.beginPath(); const a = U(-2.2 + k * 0.62); x.moveTo(a, bandaH * 1.8); x.lineTo(a + W * 0.08, -bandaH * 1.8); x.lineTo(a + W * 0.12, bandaH * 1.8); x.fill(); }
      x.globalAlpha = 1;
    }); break;
    case 'digital': {
      let s = 1234; const r = () => (s = (s * 16807) % 2147483647) / 2147483647, c = W / 64;
      for (let i = 0; i < W / c; i++) for (let j = 0; j < H / c; j++) if (r() < 0.22) { x.fillStyle = r() < 0.5 ? acento : tercero; x.fillRect(i * c, j * c, c * (1 + Math.floor(r() * 2)), c); }
      break;
    }
    case 'llamas': costado(() => {
      x.fillStyle = acento;
      for (let k = 0; k < 6; k++) { x.beginPath(); const y0 = (k - 2.5) * bandaH * 0.55; x.moveTo(U(2.4), y0 - bandaH * 0.35); x.quadraticCurveTo(U(0.9 - k * 0.12), y0 - bandaH * 0.9, U(-0.4 - k * 0.25), y0); x.quadraticCurveTo(U(0.9 - k * 0.12), y0 + bandaH * 0.6, U(2.4), y0 + bandaH * 0.35); x.fill(); }
    }); break;
    default: // franjas: dos bandas por el centro (capó, techo, maletero) y una por los costados
      x.fillStyle = acento;
      x.fillRect(0, V(0.5) - H * 0.05, W, H * 0.035); x.fillRect(0, V(0.5) + H * 0.015, W, H * 0.035);
      costado(() => { x.fillStyle = tercero; x.fillRect(0, -bandaH * 0.9, W, bandaH * 0.35); x.fillStyle = acento; x.fillRect(0, -bandaH * 0.45, W, bandaH * 0.25); });
  }
  // números: en las puertas (círculo blanco en el GT, gigantes en el Stock) y en el techo
  const stock = categoria === 'stock', xp = stock ? -0.05 : 0.05, rN = H * (stock ? 0.06 : 0.06);
  const num = (cx, cy, r, rot) => {
    x.save(); x.translate(cx, cy); x.rotate(rot);
    if (!stock) { x.fillStyle = '#ffffff'; x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.fill(); x.lineWidth = r * 0.08; x.strokeStyle = '#111'; x.stroke(); }
    x.fillStyle = stock ? tercero : '#111'; x.font = `900 ${Math.round(r * (stock ? 1.7 : 1.25))}px system-ui, sans-serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    if (stock) { x.lineWidth = r * 0.16; x.strokeStyle = '#111'; x.strokeText(String(numero), 0, r * 0.06); }
    x.fillText(String(numero), 0, r * 0.06); x.restore();
  };
  costado(() => num(U(xp), -H * 0.005, rN, 0));
  num(U(stock ? -0.3 : -0.25), V(0.5), rN * 1.1, -Math.PI / 2);
  // patrocinador del parabrisas y del capó
  x.fillStyle = '#ffffff'; x.font = `800 ${Math.round(H * 0.022)}px system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.save(); x.translate(U(1.6), V(0.5)); x.rotate(Math.PI / 2); x.fillText('UPGAMES', 0, 0); x.restore();
}

/**
 * Crea la carrocería cerrada. ruedas: [{ x, z, r, w }] (las del coche). Devuelve la piel
 * (malla de pintura) y un grupo con todo lo demás.
 */
export function crearCarroceria(categoria, { pintura, ruedas, calidad = 2 }) {
  const F = FORMAS[categoria];
  const geo = piel(F, ruedas, calidad);
  const mat = pintura.clone ? pintura : pintura;
  mat.vertexColors = true; mat.needsUpdate = true;
  const cuerpo = new THREE.Mesh(geo, mat); cuerpo.castShadow = true; cuerpo.receiveShadow = true;
  const extras = new THREE.Group();
  const negro = new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.55 });
  const carbono = new THREE.MeshStandardMaterial({ color: 0x1b1c20, roughness: 0.35, metalness: 0.3 });
  const caja = (sx, sy, sz, x, y, z, m = negro) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); b.position.set(x, y, z); b.castShadow = true; extras.add(b); return b; };
  const S = F.secciones, xN = S[0][0], xC = S[S.length - 1][0];
  // splitter delantero y difusor
  caja(0.30, 0.025, 1.8, xN - 0.12, seccionEn(S, xN - 0.12)[3] - 0.03, 0, carbono);
  caja(0.4, 0.05, 1.6, xC + 0.22, seccionEn(S, xC + 0.22)[3] - 0.02, 0, carbono);
  // faros y pilotos (emisivos)
  const faro = new THREE.MeshStandardMaterial({ color: 0xdfe8ff, emissive: 0xcfe0ff, emissiveIntensity: 0.6, roughness: 0.2 });
  const piloto = new THREE.MeshStandardMaterial({ color: 0x3a0000, emissive: 0xff1a1a, emissiveIntensity: 1.2, roughness: 0.3 });
  const sF = seccionEn(S, xN - 0.12), sC = seccionEn(S, xC + 0.04);
  for (const lado of [-1, 1]) {
    const f = caja(0.05, 0.07, 0.32, xN - 0.13, sF[2] - 0.08, lado * (sF[1] - 0.24), faro); f.rotation.y = lado * 0.5; f.castShadow = false;
    const p = caja(0.04, 0.07, 0.36, xC + 0.02, sC[2] - 0.08, lado * (sC[1] - 0.24), piloto); p.castShadow = false;
    // retrovisores
    const yE = F.cintura + 0.06;
    caja(0.12, 0.08, 0.16, F.cristal[0] - 0.22, yE, lado * (seccionEn(S, F.cristal[0] - 0.22)[1] + 0.07), negro);
  }
  // alerón trasero (GT) o spoiler sobre el maletero (Stock)
  if (F.ala) {
    const yA = F.techo - 0.02, xA = xC + 0.22;
    const ala = caja(0.30, 0.03, 1.74, xA, yA, 0, carbono); ala.rotation.z = 0.12;
    for (const lado of [-1, 1]) { caja(0.34, 0.24, 0.015, xA, yA - 0.02, lado * 0.88, carbono); caja(0.06, yA - 0.85, 0.03, xA + 0.04, (yA + 0.85) / 2, lado * 0.42, carbono); }
  } else {
    const sp = caja(0.02, 0.2, 1.84, xC + 0.12, S[S.length - 2][2] + 0.1, 0, new THREE.MeshStandardMaterial({ color: 0xd8e6ff, roughness: 0.15, transparent: true, opacity: 0.55 }));
    sp.rotation.z = 0.35;
  }
  // salpicadero, pilares y forro del techo (la cámara de cabina va dentro)
  const ix = F.cristal[0] - 0.4;
  caja(0.36, 0.12, 1.5, ix, F.cintura - 0.04, 0, negro);
  const forro = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.0), new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.9, side: THREE.DoubleSide }));
  forro.rotation.x = Math.PI / 2; forro.position.set((F.techoX[0] + F.techoX[1]) / 2, F.techo - 0.09, 0); extras.add(forro);
  return { cuerpo, extras, forma: F };
}
