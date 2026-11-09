/* ═══════════════════════════════════════════════════════════════
   UpGames · Intro «Entrar a la red»
   ───────────────────────────────────────────────────────────────
   Animación en tiempo real (Canvas 2D con proyección 3D propia y
   resplandor por reducción de resolución). render(t) es una función
   pura del tiempo: en la web sigue al reloj del audio y en
   marketing/intro/render.js se graba cuadro a cuadro.
   Se adapta a horizontal y vertical.

   Guion (voz en 8 frases, separadas por tramos de animación):
     0.5   logo · se apaga y parpadea · arranque del sistema
     8.0   «Bienvenido a UpGames»
    10.3   la red se enciende: rejilla, muros de luz
    16.2   «Estás a punto de entrar a un nuevo mundo digital»  → portal
    24.5   túnel de datos (la música sube)
    30.33  CAÍDA: ciudad de luz
    37.6   «Explora, crea, publica»
    43.0   «La decisión es tuya»  → tres caminos
    47.8   «Un mundo lleno de posibilidades»  → anillo de tarjetas
    52.6   «Crea tu comunidad»  → red de personas
    56.3   «Obtén tu primera monetización…»  → UpCoins
    60.4   ascenso
    64.5   «Esto es UpGames»  → logo en el golpe 65.45
═══════════════════════════════════════════════════════════════ */
'use strict';
(function () {
  const Q = new URLSearchParams(location.search);
  const RENDER = Q.has('render');
  const DUR = 71.5;
  const BEAT0 = 30.334, BEAT = 0.48766;                 // rejilla de la música (123 BPM)
  const beat = n => BEAT0 + n * BEAT;

  /* ── Voz: archivo de cada frase y momento en que empieza (s) ── */
  const VOCES = [
    { f: 1, at: 8.0 }, { f: 2, at: 15.942 }, { f: 3, at: 37.30 }, { f: 4, at: 42.953 },
    { f: 5, at: 47.753 }, { f: 6, at: 52.479 }, { f: 7, at: 56.105 }, { f: 8, at: 64.229 },
  ];

  /* ── Utilidades ── */
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const E = {
    out: k => 1 - Math.pow(1 - k, 3), out5: k => 1 - Math.pow(1 - k, 5), in: k => k * k * k, in2: k => k * k,
    io: k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2,
    sine: k => -(Math.cos(Math.PI * k) - 1) / 2,
    back: k => { const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); },
    spr: k => k >= 1 ? 1 : 1 - Math.exp(-6.5 * k) * Math.cos(k * 13),
  };
  const en = (t, a, d, e = E.out) => e(clamp((t - a) / d));
  const win = (t, a, b, fi = .4, fo = .4) => Math.min(clamp((t - a) / fi), clamp((b - t) / fo));
  const R = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const fmt = n => Math.round(n).toLocaleString('es-CO');

  /* ── Lienzos ── */
  const $ = s => document.querySelector(s);
  const cv = $('#cv'), ctx = cv.getContext('2d');
  const sc = document.createElement('canvas'), s3 = sc.getContext('2d');      // escena (luces)
  const b1 = document.createElement('canvas'), bx1 = b1.getContext('2d');     // resplandor 1/4
  const b2 = document.createElement('canvas'), bx2 = b2.getContext('2d');     // resplandor 1/12
  let W = 1920, H = 1080, U = 1, F = 1000, PORT = false, DPR = 1, calidad = 1;
  const grano = document.createElement('canvas');
  const medir = () => {
    if (RENDER) { W = +(Q.get('w') || 1920); H = +(Q.get('h') || 1080); DPR = 1; }
    else { DPR = Math.min(window.devicePixelRatio || 1, 1.5) * calidad; W = Math.round(innerWidth * DPR); H = Math.round(innerHeight * DPR); }
    cv.width = sc.width = W; cv.height = sc.height = H;
    b1.width = Math.ceil(W / 4); b1.height = Math.ceil(H / 4);
    b2.width = Math.ceil(W / 12); b2.height = Math.ceil(H / 12);
    U = Math.min(W, H) / 1080;
    PORT = H > W;
    F = Math.min(W, H * 1.25) * .9;
    const cssU = RENDER ? U : Math.min(innerWidth, innerHeight) / 1080;
    document.documentElement.style.setProperty('--u', cssU + 'px');
    document.documentElement.classList.toggle('port', PORT);
    grano.width = 256; grano.height = 256;
    const g = grano.getContext('2d'), id = g.createImageData(256, 256);
    for (let i = 0; i < id.data.length; i += 4) { const v = R(i * .37) * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    g.putImageData(id, 0, 0);
  };

  /* ── Cámara y proyección ── */
  const cam = { x: 0, y: 2, z: 0, yaw: 0, pitch: 0, roll: 0, sx: 0, sy: 0 };
  let cy_, sy_, cp_, sp_, cr_, sr_;
  const ponerCam = c => {
    Object.assign(cam, { yaw: 0, pitch: 0, roll: 0 }, c);
    cy_ = Math.cos(cam.yaw); sy_ = Math.sin(cam.yaw); cp_ = Math.cos(cam.pitch); sp_ = Math.sin(cam.pitch); cr_ = Math.cos(cam.roll); sr_ = Math.sin(cam.roll);
  };
  // mundo → cámara (x derecha, y arriba, z adelante)
  const vista = (x, y, z) => {
    x -= cam.x; y -= cam.y; z -= cam.z;
    const x1 = x * cy_ - z * sy_, z1 = x * sy_ + z * cy_;
    const y2 = y * cp_ - z1 * sp_, z2 = y * sp_ + z1 * cp_;
    return [x1 * cr_ - y2 * sr_, x1 * sr_ + y2 * cr_, z2];
  };
  const pant = v => [W / 2 + v[0] * F / v[2] + cam.sx, H / 2 - v[1] * F / v[2] + cam.sy];
  const NEAR = .15;
  const proy = (x, y, z) => { const v = vista(x, y, z); return v[2] < NEAR ? null : [...pant(v), v[2]]; };

  /* ── Dibujo con luz (aditivo) ── */
  const G = '57,255,136', BL = '235,255,244', MENTA = '120,255,214', GR = '138,148,166';
  let alfaMundo = 1;
  const linea = (a, b, col, al, ancho = 2) => {
    let A = vista(...a), B = vista(...b);
    if (A[2] < NEAR && B[2] < NEAR) return;
    if (A[2] < NEAR) { const k = (NEAR - A[2]) / (B[2] - A[2]); A = A.map((v, i) => v + (B[i] - v) * k); }
    if (B[2] < NEAR) { const k = (NEAR - B[2]) / (A[2] - B[2]); B = B.map((v, i) => v + (A[i] - v) * k); }
    const p = pant(A), q = pant(B);
    s3.strokeStyle = `rgba(${col},${al * alfaMundo})`; s3.lineWidth = ancho * U;
    s3.beginPath(); s3.moveTo(p[0], p[1]); s3.lineTo(q[0], q[1]); s3.stroke();
  };
  const poli = (pts, col, al) => {
    const vs = pts.map(p => vista(...p));
    if (vs.some(v => v[2] < NEAR)) return;
    s3.fillStyle = `rgba(${col},${al * alfaMundo})`; s3.beginPath();
    vs.forEach((v, i) => { const p = pant(v); i ? s3.lineTo(p[0], p[1]) : s3.moveTo(p[0], p[1]); });
    s3.closePath(); s3.fill();
  };
  const punto = (p3, r, col, al) => {
    const p = proy(...p3); if (!p) return null;
    const rr = Math.min(Math.max(.8, r * F / p[2]), 22 * U);
    s3.fillStyle = `rgba(${col},${al * alfaMundo})`; s3.beginPath(); s3.arc(p[0], p[1], rr, 0, 6.2832); s3.fill();
    return p;
  };
  const circulo3 = (c, r, col, al, ancho, eje = 'z', n = 64, desde = 0, hasta = 1, rot = 0) => {
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const a = rot + (desde + (hasta - desde) * i / n) * 6.2832;
      const p = eje === 'z' ? [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r, c[2]] : [c[0] + Math.cos(a) * r, c[1], c[2] + Math.sin(a) * r];
      if (prev) linea(prev, p, col, al, ancho);
      prev = p;
    }
  };

  /* ── Rejilla del suelo: cada línea en un solo trazo con niebla en degradado ── */
  const lineaG = (a, b, alA, alB, col, ancho) => {
    let A = vista(...a), B = vista(...b);
    if (A[2] < NEAR && B[2] < NEAR) return;
    if (A[2] < NEAR) { const k = (NEAR - A[2]) / (B[2] - A[2]); A = A.map((v, i) => v + (B[i] - v) * k); alA = lerp(alA, alB, k); }
    if (B[2] < NEAR) { const k = (NEAR - B[2]) / (A[2] - B[2]); B = B.map((v, i) => v + (A[i] - v) * k); alB = lerp(alB, alA, k); }
    const p = pant(A), q = pant(B);
    if (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) < .5) return;
    const g = s3.createLinearGradient(p[0], p[1], q[0], q[1]);
    g.addColorStop(0, `rgba(${col},${alA * alfaMundo})`); g.addColorStop(1, `rgba(${col},${alB * alfaMundo})`);
    s3.strokeStyle = g; s3.lineWidth = ancho * U;
    s3.beginPath(); s3.moveTo(p[0], p[1]); s3.lineTo(q[0], q[1]); s3.stroke();
  };
  const rejilla = ({ paso = 4, alcance = 140, al = .5, y = 0, col = G, onda = null, anchoL = 1.6 }) => {
    const x0 = Math.round(cam.x / paso) * paso, z0 = Math.round(cam.z / paso) * paso;
    const n = Math.ceil(alcance / paso);
    const niebla = d => { const f = clamp(1 - d / alcance); return f * f; };
    // tramo [u0,u1] de una recta recortado por la onda de encendido (círculo)
    const cuerda = (fijo, centroFijo, centroVar, u0, u1) => {
      if (!onda) return [u0, u1];
      const dd = fijo - centroFijo; const r2 = onda.r * onda.r - dd * dd;
      if (r2 <= 0) return null;
      const h = Math.sqrt(r2); return [Math.max(u0, centroVar - h), Math.min(u1, centroVar + h)];
    };
    for (let i = -n; i <= n; i++) {
      // líneas a lo largo de z (se alejan)
      const x = x0 + i * paso, fx = niebla(Math.abs(x - cam.x));
      if (fx > .01) {
        const c = cuerda(x, onda ? onda.x : 0, onda ? onda.z : 0, cam.z - 30, cam.z + alcance);
        if (c && c[1] > c[0]) {
          const za = Math.max(c[0], cam.z - 30), zb = c[1];
          const fa = niebla(Math.abs(za - cam.z)), fb = niebla(Math.abs(zb - cam.z));
          lineaG([x, y, za], [x, y, zb], al * fx * fa, al * fx * fb, col, anchoL);
        }
      }
      // líneas a lo largo de x (cruzan); de su punto más cercano hacia cada lado
      const z = z0 + i * paso, fz = niebla(Math.abs(z - cam.z));
      if (fz > .01) {
        const c = cuerda(z, onda ? onda.z : 0, onda ? onda.x : 0, cam.x - alcance, cam.x + alcance);
        if (c && c[1] > c[0]) {
          const xm = clamp(cam.x, c[0], c[1]);
          const fm = niebla(Math.abs(xm - cam.x));
          if (c[0] < xm) lineaG([xm, y, z], [c[0], y, z], al * fz * fm, al * fz * niebla(Math.abs(c[0] - cam.x)), col, anchoL);
          if (c[1] > xm) lineaG([xm, y, z], [c[1], y, z], al * fz * fm, al * fz * niebla(Math.abs(c[1] - cam.x)), col, anchoL);
        }
      }
    }
  };

  /* ── Muros de luz que corren por la rejilla ── */
  const muro = (ruta, t0, vel, largo, alto, col, al = 1, t) => {
    // ruta: [[x,z], ...] tramos rectos; la cabeza avanza vel u/s desde t0
    const s = (t - t0) * vel; if (s <= 0) return;
    const segs = []; let acc = 0;
    for (let i = 0; i < ruta.length - 1; i++) { const a = ruta[i], b = ruta[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); segs.push({ a, b, L, s0: acc }); acc += L; }
    const cab = Math.min(s, acc), cola = Math.max(0, cab - largo);
    const en_ = d => { for (const g of segs) if (d <= g.s0 + g.L) { const k = (d - g.s0) / g.L; return [lerp(g.a[0], g.b[0], k), lerp(g.a[1], g.b[1], k)]; } const l = segs[segs.length - 1]; return l.b; };
    const pts = [en_(cola)];
    for (const g of segs) if (g.s0 > cola && g.s0 < cab) pts.push(g.a);
    pts.push(en_(cab));
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      poli([[a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], alto, b[1]], [a[0], alto, a[1]]], col, .09 * al);
      linea([a[0], alto, a[1]], [b[0], alto, b[1]], col, .95 * al, 3);
      linea([a[0], 0, a[1]], [b[0], 0, b[1]], col, .5 * al, 2);
      linea([a[0], -alto * .6, a[1]], [b[0], -alto * .6, b[1]], col, .12 * al, 6);   // reflejo
    }
    if (s < acc + largo) { const h = pts[pts.length - 1]; punto([h[0], alto * .5, h[1]], .35, BL, al); punto([h[0], alto * .5, h[1]], .9, col, .35 * al); }
  };

  /* ── Ciudad de luz ── */
  const TORRES = [];
  for (let gx = -7; gx <= 7; gx++) for (let gz = 0; gz < 34; gz++) {
    if (Math.abs(gx) < 1) continue;
    const i = gx * 100 + gz;
    if (R(i + 3) < .18) continue;
    const w = 2.5 + R(i) * 3.5, d = 2.5 + R(i + 1) * 3.5;
    const lejos = Math.abs(gx) / 7;
    TORRES.push({ x: gx * 9 + (R(i + 2) - .5) * 2, z: gz * 9, w, d, h: (5 + Math.pow(R(i + 4), 2) * 38) * (.55 + lejos * .9), b: Math.floor(R(i + 5) * 4), v: R(i + 6) });
  }
  const LARGO_CIUDAD = 34 * 9;
  const ciudad = (t, al, { pulso = 0, reflejo = true } = {}) => {
    const zc = cam.z;
    for (const T of TORRES) {
      let z = T.z + Math.floor((zc - T.z + 20) / LARGO_CIUDAD + 1) * LARGO_CIUDAD - LARGO_CIUDAD;
      while (z < zc - 20) z += LARGO_CIUDAD;
      const dist = z - zc; if (dist > 260) continue;
      const f = clamp(1 - dist / 260) * al;
      if (f < .02) continue;
      const x0 = T.x - T.w / 2, x1 = T.x + T.w / 2, z0 = z - T.d / 2, z1 = z + T.d / 2, h = T.h;
      const col = T.v > .8 ? BL : T.v > .65 ? MENTA : G;
      const brillo = f * (.55 + pulso * .45 * (T.v > .5 ? 1 : .4));
      const caja = (y0, y1, a, ancho) => {
        [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].forEach(([x, zz]) => linea([x, y0, zz], [x, y1, zz], col, a, ancho));
        [y0, y1].forEach(y => { linea([x0, y, z0], [x1, y, z0], col, a, ancho); linea([x1, y, z0], [x1, y, z1], col, a, ancho); linea([x1, y, z1], [x0, y, z1], col, a, ancho); linea([x0, y, z1], [x0, y, z0], col, a, ancho); });
      };
      caja(0, h, brillo * .8, 1.6);
      for (let k = 1; k <= T.b; k++) { const y = h * k / (T.b + 1); linea([x0, y, z0], [x1, y, z0], col, brillo * .35, 1.2); linea([x0, y, z1], [x0, y, z0], col, brillo * .35, 1.2); }
      linea([x0, h, z0], [x1, h, z1], col, brillo * .25 * pulso, 1);
      if (reflejo) caja(0, -h * .7, brillo * .1, 1.2);
    }
  };

  /* ── Iconos (trazos SVG en 24×24) ── */
  const ICON = {
    mando: 'M6 8h12a4 4 0 0 1 4 4l-.6 4.5a2.5 2.5 0 0 1-4.3 1.3L14.5 15h-5l-2.6 2.8a2.5 2.5 0 0 1-4.3-1.3L2 12a4 4 0 0 1 4-4zM7 11v3M5.5 12.5h3',
    app: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    llave: 'M14.7 6.3a4 4 0 0 0 5 5L22 14l-8 8-3-3 2.3-2.3-1.6-1.6L9.4 17.4 6.6 14.6l2.3-2.3-1.6-1.6L5 13 2 10l8-8 2.7 2.3z',
    vivo: 'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2',
    video: 'M3 5h13v14H3zM16 10l5-3v10l-5-3',
    ia: 'M5 5h14v14H5zM9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4M9 15l1.5-6h1l1.5 6M9.6 13h2.8M15.5 9v6',
    moneda: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zM15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2',
    users: 'M9 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM1 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1M17 4a4 4 0 0 1 0 8M23 21v-1a6 6 0 0 0-4-5.6',
    globo: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zM2 12h20M12 2c3 3.2 3 16.8 0 20M12 2c-3 3.2-3 16.8 0 20',
    musica: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
    trofeo: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3',
    chat: 'M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.2A8 8 0 1 1 21 12z',
  };
  const P2D = {}; for (const k in ICON) P2D[k] = new Path2D(ICON[k]);

  /* Tarjeta holográfica (siempre de frente a la cámara) */
  const tarjeta = (c, tam, icono, txt, al, resalte = 0) => {
    const p = proy(...c); if (!p) return;
    const s = F / p[2] * tam / 24;           // px por unidad del icono
    if (s < .2) return;
    const w = 24 * s * 1.15, h = 24 * s * 1.45, x = p[0] - w / 2, y = p[1] - h / 2;
    const a = al * alfaMundo * clamp(1.4 - p[2] / 90);
    s3.save();
    s3.fillStyle = `rgba(7,16,31,${.55 * a})`; s3.fillRect(x, y, w, h);
    s3.strokeStyle = `rgba(${G},${(.6 + resalte * .4) * a})`; s3.lineWidth = Math.max(1, s * .12);
    s3.strokeRect(x, y, w, h);
    s3.fillStyle = `rgba(${G},${.9 * a})`; const c3 = s * 2.2; s3.fillRect(x, y, c3, s * .25); s3.fillRect(x, y, s * .25, c3); s3.fillRect(x + w - c3, y + h - s * .25, c3, s * .25); s3.fillRect(x + w - s * .25, y + h - c3, s * .25, c3);
    s3.translate(p[0] - 12 * s * .7, y + h * .16); s3.scale(s * .7, s * .7);
    s3.strokeStyle = `rgba(${BL},${a})`; s3.lineWidth = 1.8; s3.lineJoin = 'round'; s3.lineCap = 'round'; s3.stroke(P2D[icono]);
    s3.restore();
    s3.fillStyle = `rgba(${BL},${a})`; s3.font = `800 ${Math.max(6, s * 2.6)}px Orbitron, sans-serif`; s3.textAlign = 'center'; s3.textBaseline = 'middle';
    s3.fillText(txt, p[0], y + h * .82);
  };

  /* ── Efectos de sonido (render.js los mezcla) ── */
  const SFX = [];
  const sfx = (t, s, g = 1) => SFX.push({ t: +t.toFixed(3), s, g });
  const golpes = [], destellos = [];
  const golpe = (t, f = 1, s = 'impacto') => { golpes.push({ t, f }); destellos.push({ t, f: .6 * f }); if (s) sfx(t, s, f); };
  const glitches = [];
  const glitch = (t, d = .25, f = 1, son = true) => { glitches.push({ t, d, f }); if (son) sfx(t, 'glitch', .45 * f); };

  /* ════════════ Línea de tiempo de efectos ════════════ */
  golpe(.5, 1.4, 'boom'); sfx(.5, 'brillo', .6);
  [3.7, 4.05, 4.3, 4.75, 5.1, 5.35].forEach((t, i) => { glitch(t, .12, .6, false); sfx(t, 'chispa', .5 - i * .05); });
  sfx(5.55, 'apagado', .8);
  for (let i = 0; i < 22; i++) sfx(6.25 + i * .045, 'tecla', .3);
  for (let i = 0; i < 18; i++) sfx(7.05 + i * .04, 'tecla', .25);
  sfx(7.75, 'click', .6);
  sfx(7.95, 'linea', .8); sfx(8.0, 'boom_suave', .5);
  sfx(10.3, 'encendido', .9); sfx(12.0, 'paso_luz', .5); sfx(13.3, 'paso_luz', .45); sfx(14.6, 'paso_luz', .5);
  sfx(16.2, 'portal', .7); sfx(17.8, 'brillo', .35);
  sfx(19.5, 'zoom', .6); sfx(22.0, 'paso_luz', .5); sfx(23.0, 'paso_luz', .5);
  sfx(24.45, 'whoosh', .9); sfx(24.5, 'impacto', .5);
  sfx(26.4, 'riser_largo', 1);
  golpe(BEAT0, 1.8, 'boom'); sfx(BEAT0, 'impacto', .9); sfx(BEAT0 + .05, 'brillo', .6);
  sfx(31.2, 'paso_luz', .5); sfx(33.0, 'paso_luz', .5); sfx(35.2, 'paso_luz', .5);
  golpe(37.6, .6, 'sello'); golpe(38.74, .6, 'sello'); golpe(39.66, .8, 'sello'); sfx(39.7, 'rayo', .8);
  sfx(42.6, 'whoosh', .6); sfx(43.25, 'portal', .4); sfx(43.93, 'click', .8); sfx(44.0, 'exito', .4); sfx(45.0, 'zoom', .8);
  golpe(47.5, 1, 'impacto'); for (let i = 0; i < 10; i++) sfx(47.75 + i * .09, 'pop', .25); sfx(49.15, 'brillo', .5);
  sfx(52.35, 'whoosh', .6); for (let i = 0; i < 14; i++) sfx(52.8 + i * .1, 'pop', .18); sfx(53.06, 'exito', .4);
  sfx(56.05, 'whoosh', .5); sfx(56.8, 'moneda', .5); sfx(57.23, 'contador', .6); for (let i = 0; i < 8; i++) sfx(57.4 + i * .23, 'moneda', .22); sfx(59.56, 'exito', .5);
  sfx(60.4, 'riser_corto', .9); sfx(61.6, 'zoom', .7);
  sfx(63.6, 'whoosh', .8); sfx(64.1, 'apagado', .4);
  golpe(beat(72), 2, 'boom'); sfx(beat(72), 'impacto', 1); sfx(beat(72) + .05, 'brillo', .7); sfx(66.6, 'decode', .4); sfx(67.4, 'exito', .4);

  /* ════════════ Escenas 3D ════════════ */
  // Cámara de la red: avanza despacio y acelera hacia el portal (z = 202)
  const PZ = 202;
  const zRed = t => { const d = t - 10.3; if (d < 9.2) return 3 * d; const e = d - 9.2; return 27.6 + 3 * e + 1.2 * e * e * e; };
  const RUTAS = [
    { r: [[-90, 40], [26, 40], [26, 160]], t0: 10.9, v: 30, col: G },
    { r: [[80, 70], [-12, 70], [-12, 12], [-80, 12]], t0: 11.7, v: 32, col: BL },
    { r: [[7, 220], [7, 30], [70, 30]], t0: 12.7, v: 40, col: MENTA },
    { r: [[-130, 100], [-22, 100], [-22, 200]], t0: 13.7, v: 36, col: G },
    { r: [[-4, 280], [-4, 46], [-90, 46]], t0: 14.8, v: 44, col: BL },
    { r: [[-8, 60], [-8, 240]], t0: 19.4, v: 60, col: BL },
    { r: [[8, 70], [8, 250]], t0: 19.8, v: 62, col: G },
  ];

  const escenaRed = (t, al) => {
    const z = zRed(t), ac = clamp((t - 19.5) / 5.1);
    ponerCam({ x: Math.sin(t * .3) * .8 * (1 - ac), y: lerp(2.4, 4, E.io(ac)), z, yaw: Math.sin(t * .25) * .05 * (1 - ac), pitch: lerp(-.1, 0, ac), roll: Math.sin(t * .4) * .02 + ac * ac * .25 });
    alfaMundo = al;
    rejilla({ paso: 4, alcance: 150, al: .55, onda: { x: 0, z: 8, r: (t - 10.3) * 38 } });
    // horizonte
    for (const m of RUTAS) muro(m.r, m.t0, m.v, 38, 1.7, m.col, 1, t);
    // portal
    const pa = en(t, 16.2, 1.2) ;
    if (pa > 0) {
      const c = [0, 4, PZ];
      for (let k = 0; k < 5; k++) circulo3(c, 9 + k * 1.6, k % 2 ? BL : G, pa * (.9 - k * .14), 3 - k * .4, 'z', 72, 0, k % 2 ? .82 : .9, t * (k % 2 ? -.5 : .4) + k);
      circulo3(c, 7.6, G, pa * .5, 8, 'z', 72);
      for (let k = 0; k < 24; k++) { const a = k / 24 * 6.283 + t * .2; linea([c[0] + Math.cos(a) * 11, c[1] + Math.sin(a) * 11, PZ], [c[0] + Math.cos(a) * 13.5, c[1] + Math.sin(a) * 13.5, PZ], G, pa * .6, 2); }
      linea([-200, 4, PZ + 2], [200, 4, PZ + 2], G, pa * .25, 2);
    }
  };

  // Túnel de datos
  const zTun = t => { const d = t - 24.4; return 40 * d + 9 * d * d + 2.2 * d * d * d; };
  const escenaTunel = (t, al) => {
    const z = zTun(t), d = t - 24.4;
    ponerCam({ x: 0, y: 0, z, roll: d * d * .05 + Math.sin(t * 2) * .03 });
    alfaMundo = al;
    const vel = 40 + 18 * d + 6.6 * d * d;
    const k0 = Math.floor(z / 6);
    for (let k = k0; k < k0 + 34; k++) {
      const zz = k * 6, f = clamp(1 - (zz - z) / 200);
      const n = 6, r = 6;
      for (let i = 0; i < n; i++) {
        const a = i / n * 6.283 + k * .12, b = (i + 1) / n * 6.283 + k * .12;
        if (R(k * 7 + i) < .22) continue;
        linea([Math.cos(a) * r, Math.sin(a) * r, zz], [Math.cos(b) * r, Math.sin(b) * r, zz], k % 4 === 0 ? BL : G, f * .85, k % 4 === 0 ? 3 : 1.6);
      }
      if (k % 2 === 0) for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + k * .12; linea([Math.cos(a) * r, Math.sin(a) * r, zz], [Math.cos(a) * r, Math.sin(a) * r, zz + 6], G, f * .3, 1.2); }
    }
    // estelas de datos (más largas cuanto más rápido)
    const est = clamp(vel / 300) * 14 + 1;
    for (let i = 0; i < 70; i++) {
      const a = R(i) * 6.283, r = 1.8 + R(i + 1) * 3.8;
      const zz = z + ((R(i + 2) * 200 - (t * (60 + R(i + 3) * 60))) % 200 + 200) % 200 + 2;
      linea([Math.cos(a) * r, Math.sin(a) * r, zz], [Math.cos(a) * r, Math.sin(a) * r, zz + est], R(i + 5) > .5 ? BL : G, .8 * clamp(1 - (zz - z) / 200), 2);
    }
    // luz al final del túnel
    const lf = en(t, 28.6, 1.7, E.in2);
    punto([0, 0, z + 120], 6 + lf * 40, BL, .2 + lf * .8);
  };

  // Vuelo por la ciudad (tras la caída)
  const escenaCiudad = (t, al) => {
    const d = t - BEAT0;
    const z = d < 7 ? 26 * d : 182 + (d - 7) * 12;
    const caida = en(t, BEAT0, 1.2, E.out5);
    ponerCam({ x: Math.sin(d * .35) * 3, y: lerp(30, 7, caida) + Math.sin(d * .5) * .8, z, yaw: Math.sin(d * .3) * .07, pitch: lerp(-.5, -.06, caida), roll: Math.sin(d * .35 + .5) * -.06 });
    alfaMundo = al;
    // pulso con los golpes de bombo
    const nb = Math.floor((t - BEAT0) / BEAT); const kb = (t - beat(nb)) / BEAT;
    const pulso = Math.exp(-kb * 5);
    rejilla({ paso: 5, alcance: 160, al: .35 + pulso * .15 });
    ciudad(t, 1, { pulso });
    // avenida: muros de luz que nos acompañan
    for (let i = 0; i < 6; i++) {
      const x = [-4.5, 4.5, -2, 2, -6, 6][i], v = 40 + i * 6, t0 = BEAT0 + [0, .3, 1.5, 2.2, 3.4, 4.6][i];
      muro([[x, -20], [x, 2000]], t0, v, 40, 1.2, i % 2 ? BL : G, 1, t);
    }
    // haz de «publica»
    const pk = en(t, 39.66, .5, E.out5), pf = 1 - en(t, 41.2, 1.2);
    if (pk > 0) {
      const hz = 182 + (39.66 - BEAT0 - 7) * 12 + 70;
      linea([0, 0, hz], [0, 400 * pk, hz], BL, .9 * pf, 10); linea([0, 0, hz], [0, 400 * pk, hz], G, .5 * pf, 34);
      circulo3([0, .2, hz], 4 + pk * 10, G, pf * .8, 3, 'y');
    }
  };

  // Plaza: «la decisión es tuya» — tres caminos
  const escenaPlaza = (t, al) => {
    const d = t - 42.6, corre = en(t, 45.0, 2.6, E.in2);
    ponerCam({ x: 0, y: lerp(lerp(9, 3.2, en(t, 42.6, 1.6, E.io)), 1.8, corre), z: lerp(-18, -10, en(t, 42.6, 2.2, E.io)) + corre * 160, pitch: lerp(-.35, -.08, en(t, 42.6, 1.8, E.io)), yaw: Math.sin(d * .4) * .04 });
    alfaMundo = al;
    rejilla({ paso: 4, alcance: 120, al: .4 });
    const ab = en(t, 43.25, .7, E.out);
    const elige = en(t, 43.93, .3);
    const CAM = [[-1, 'JUGAR'], [0, 'CREAR'], [1, 'GANAR']];
    CAM.forEach(([dir, txt], i) => {
      const yo = dir === 0;
      const a = yo ? 1 : 1 - elige * .75;
      const col = yo && elige > 0 ? BL : G;
      const L = 140 * ab;
      const fin = [dir * L * .45, L];
      poli([[0, 0, 0], [fin[0], 0, fin[1]], [fin[0], 1, fin[1]], [0, 1, 0]], col, .14 * a);
      linea([0, 1, 0], [fin[0], 1, fin[1]], col, a, 3); linea([0, 0, 0], [fin[0], 0, fin[1]], col, .6 * a, 2);
      linea([0, -.6, 0], [fin[0], -.6, fin[1]], col, .12 * a, 6);
      const p = proy(dir * 15, 3.2, 32); etiquetas[i] = p ? { x: p[0], y: p[1], s: F / p[2], a: ab * a * (1 - corre), txt, yo, elige } : null;
    });
    // nodo del usuario
    const pul = 1 + Math.sin(t * 6) * .15;
    punto([0, .5, 0], .22 * pul, BL, 1); punto([0, .5, 0], .6 * pul, G, .3);
    if (t > 44.9) [[-2.5, G], [2.5, BL], [-5, MENTA], [5, G]].forEach(([x, col], i) => muro([[x, -10], [x, 400]], 44.9 + i * .12, 95, 60, 1.1, col, 1, t));
    for (let k = 0; k < 3; k++) { const ka = ((t - 43.93) * 1.4 + k / 3) % 1; if (t > 43.93) circulo3([0, .05, 0], ka * 9, G, (1 - ka) * .8, 2, 'y'); }
  };
  let etiquetas = [];

  // Anillo de posibilidades
  const CARTAS = [['mando', 'JUEGOS'], ['app', 'APPS'], ['llave', 'MODS'], ['vivo', 'EN VIVO'], ['video', 'VIDEOS'], ['ia', 'NEXUS IA'], ['moneda', 'UPCOINS'], ['users', 'GRUPOS'], ['trofeo', 'RANKING'], ['chat', 'CHAT'], ['musica', 'MÚSICA'], ['globo', 'COMUNIDAD']];
  const escenaCartas = (t, al) => {
    const d = t - 47.4;
    const ka = en(t, 47.4, 5.2, E.io);
    ponerCam({ x: Math.sin(d * .12) * 6, y: lerp(6, 12, ka), z: lerp(-40, -50, ka), yaw: -Math.sin(d * .12) * .1, pitch: lerp(-.03, -.17, ka) });
    alfaMundo = al;
    rejilla({ paso: 4, alcance: 90, al: .35 });
    circulo3([0, .05, 0], 18, G, .6, 2, 'y', 96, 0, 1, t * .1);
    circulo3([0, .05, 0], 18.6, BL, .35, 1.2, 'y', 96, 0, .7, -t * .2);
    CARTAS.forEach(([ic, txt], i) => {
      const a = i / CARTAS.length * 6.283 - d * .12;
      const k = en(t, 47.6 + i * .09, .6, E.back);
      const r = 18 * lerp(.2, 1, k), y = 4 + Math.sin(t * 1.3 + i) * .8 + (i % 2) * 2.2;
      tarjeta([Math.cos(a) * r, y + 1.5, Math.sin(a) * r], 3.8, ic, txt, clamp((t - 47.6 - i * .09) * 4) * (Math.sin(a) < .2 ? 1 : .55), 0);
      linea([Math.cos(a) * r, 0, Math.sin(a) * r], [Math.cos(a) * r, y - 2.6, Math.sin(a) * r], G, .35 * k, 1.2);
    });
    // segundo anillo, lejano
    for (let i = 0; i < 24; i++) { const a = i / 24 * 6.283 + d * .05; punto([Math.cos(a) * 48, 12 + Math.sin(i) * 4, Math.sin(a) * 48], .5, i % 3 ? G : BL, .7); }
  };

  // Comunidad: constelación de personas
  const NODOS = Array.from({ length: 70 }, (_, i) => { const u = R(i) * 2 - 1, a = R(i + 50) * 6.283, r = 7 + R(i + 9) * 4; return [Math.sqrt(1 - u * u) * Math.cos(a) * r, u * r * .8, Math.sqrt(1 - u * u) * Math.sin(a) * r]; });
  const escenaRed2 = (t, al, centro = [0, 5, 30], aparece = 52.6) => {
    alfaMundo = al;
    const k = en(t, aparece, 1.6, E.out);
    NODOS.forEach((n, i) => {
      const a = t * .15, x = n[0] * Math.cos(a) - n[2] * Math.sin(a), z = n[0] * Math.sin(a) + n[2] * Math.cos(a);
      const p = [centro[0] + x * k, centro[1] + n[1] * k, centro[2] + z * k];
      const ki = clamp((t - aparece - i * .02) * 3);
      if (ki <= 0) return;
      linea(centro, p, G, .28 * ki, 1.2);
      const u = ((t - aparece) * .8 + R(i)) % 1;
      punto([lerp(p[0], centro[0], u), lerp(p[1], centro[1], u), lerp(p[2], centro[2], u)], .12, BL, .9 * ki * Math.sin(u * 3.14));
      punto(p, .16, i % 3 ? G : BL, ki); punto(p, .45, G, .12 * ki);
      if (i % 4 === 0) { const q = NODOS[(i + 7) % NODOS.length]; const xq = q[0] * Math.cos(a) - q[2] * Math.sin(a), zq = q[0] * Math.sin(a) + q[2] * Math.cos(a); linea(p, [centro[0] + xq * k, centro[1] + q[1] * k, centro[2] + zq * k], MENTA, .2 * ki, 1); }
    });
    punto(centro, .45, BL, k); punto(centro, 1.3, G, .22 * k);
  };
  const escenaComunidad = (t, al) => {
    const d = t - 52.3, a = d * .18;
    ponerCam({ x: Math.sin(a) * -22, y: 6, z: 30 - Math.cos(a) * 22, yaw: a, pitch: -.02 });
    alfaMundo = al;
    rejilla({ paso: 4, alcance: 90, al: .3 });
    escenaRed2(t, al);
  };

  // UpCoins
  const escenaMonedas = (t, al) => {
    const d = t - 56.0;
    const a = d * .2;
    ponerCam({ x: Math.sin(a) * 16, y: lerp(4, 7, en(t, 56, 4, E.io)), z: 25 - Math.cos(a) * 16, yaw: -a, pitch: -.12 });
    alfaMundo = al;
    rejilla({ paso: 4, alcance: 90, al: .32 });
    const c = [0, 0, 25];
    // plataforma
    for (let k = 0; k < 4; k++) circulo3([0, .05 + k * .02, 25], 3 + k * 1.3, k % 2 ? BL : G, .8 - k * .15, 2.4 - k * .3, 'y', 72, 0, k % 2 ? .75 : 1, t * (k % 2 ? -.6 : .4));
    linea([0, 0, 25], [0, 40, 25], G, .25 + .15 * Math.sin(t * 8), 16); linea([0, 0, 25], [0, 40, 25], BL, .6, 3);
    // monedas que caen en espiral y se juntan
    for (let i = 0; i < 46; i++) {
      const t0 = 56.6 + R(i) * 3.4, k = t - t0;
      if (k < 0 || k > 2.4) continue;
      const ang = R(i + 3) * 6.283 + k * 3, r = lerp(9, 0, E.in2(clamp(k / 2.2)));
      const y = lerp(18, 1, E.io(clamp(k / 2.2)));
      const p = proy(c[0] + Math.cos(ang) * r, y, c[2] + Math.sin(ang) * r); if (!p) continue;
      const s = F / p[2] * .8, gir = Math.cos(t * 6 + i);
      s3.save(); s3.translate(p[0], p[1]); s3.scale(Math.max(.15, Math.abs(gir)), 1);
      s3.beginPath(); for (let j = 0; j < 6; j++) { const aa = j / 6 * 6.283 + .5236; s3.lineTo(Math.cos(aa) * s, Math.sin(aa) * s); } s3.closePath();
      s3.fillStyle = `rgba(${G},${.35 * al})`; s3.fill(); s3.strokeStyle = `rgba(${BL},${.95 * al})`; s3.lineWidth = Math.max(1, s * .12); s3.stroke();
      if (Math.abs(gir) > .5) { s3.fillStyle = `rgba(${BL},${al})`; s3.font = `900 ${s * .8}px Orbitron`; s3.textAlign = 'center'; s3.textBaseline = 'middle'; s3.fillText('UC', 0, s * .05); }
      s3.restore();
    }
    // «…empieza a crear tu comunidad»: la red rodea la plataforma
    if (t > 58.3) escenaRed2(t, al * en(t, 58.3, .8), [0, 6, 25], 58.4);
  };

  // Ascenso final sobre la ciudad
  const escenaAscenso = (t, al) => {
    const d = t - 60.4, k = en(t, 60.4, 3.8, E.in2);
    ponerCam({ x: 0, y: 8 + d * 6 + k * 260, z: 400 + d * 14, pitch: lerp(-.25, -1.45, E.io(clamp(d / 3.6))), roll: d * .12 });
    alfaMundo = al;
    rejilla({ paso: 5, alcance: 220, al: .35 });
    const nb = Math.floor((t - BEAT0) / BEAT), kb = (t - beat(nb)) / BEAT;
    ciudad(t, 1, { pulso: Math.exp(-kb * 5), reflejo: false });
  };

  // Final: rejilla bajo el logo
  const escenaFinal = (t, al) => {
    const k = en(t, beat(72), 1.6, E.out5);
    ponerCam({ x: 0, y: lerp(14, 3, k), z: (t - 64) * 2.4, pitch: lerp(-.6, -.04, k) });
    alfaMundo = al;
    rejilla({ paso: 4, alcance: 160, al: .5, onda: { x: 0, z: 30, r: (t - beat(72)) * 60 } });
    for (let i = 0; i < 4; i++) muro([[[-30, 30, -60, 60][i], 400], [[-30, 30, -60, 60][i], -50]], beat(72) + i * .25, 70, 50, 1, i % 2 ? BL : G, 1, t);
  };

  /* ════════════ Capa 2D: logo, destellos, transiciones ════════════ */
  const flare = (x, y, ancho, al, col = BL) => {
    if (al <= .01) return;
    const g = ctx.createLinearGradient(x - ancho / 2, 0, x + ancho / 2, 0);
    g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(.5, `rgba(${col},${al})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - ancho / 2, y - 2 * U, ancho, 4 * U);
  };
  const anillo2d = (x, y, r, al, ancho = 4) => { if (al <= 0) return; ctx.strokeStyle = `rgba(${G},${al})`; ctx.lineWidth = ancho * U; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.stroke(); };

  /* ── DOM ── */
  const dom = {};
  const textoLetras = (el, str) => { el.innerHTML = ''; el._l = []; for (const ch of str) { if (ch === '\n') { el.appendChild(document.createElement('br')); continue; } const s = document.createElement('span'); s.className = 'l'; s.textContent = ch === ' ' ? ' ' : ch; el.appendChild(s); el._l.push(s); } };
  const animLetras = (el, t, a, b, { stag = .035, dur = .7, modo = 'blur' } = {}) => {
    const vis = t > a - .1 && t < b + .8; el.style.display = vis ? 'block' : 'none'; if (!vis) return;
    const n = el._l.length;
    el._l.forEach((l, i) => {
      const k = clamp((t - a - i * stag) / dur), ko = clamp((t - b - (n - i) * stag * .3) / .5);
      const e = E.out5(k);
      const parp = k > 0 && k < .35 && R(i + Math.floor(t * 40)) > .5 ? .2 : 1;
      if (modo === 'tron') { l.style.opacity = e * (1 - ko) * parp; l.style.transform = `translateY(${(1 - e) * 20 - ko * 20}px) scaleX(${lerp(2.2, 1, e)})`; l.style.filter = `blur(${(1 - e) * 10 + ko * 12}px)`; }
      else { l.style.opacity = e * (1 - ko); l.style.transform = `translateY(${(1 - e) * 40 - ko * 30}px)`; l.style.filter = `blur(${(1 - e) * 14 + ko * 12}px)`; }
    });
  };
  const TITULOS = [];
  const titulo = (txt, a, b, cls = '', opts = {}) => TITULOS.push({ txt, a, b, cls, opts });
  titulo('BIENVENIDO A', 8.0, 10.2, 't-fino');
  titulo('UN NUEVO\nMUNDO DIGITAL', 17.75, 19.6, 't-gran', { modo: 'tron' });
  titulo('LA DECISIÓN\nES TUYA', 43.0, 46.6, 't-gran', { modo: 'tron' });
  titulo('UN MUNDO LLENO DE\nPOSIBILIDADES', 47.95, 51.6, 't-gran', { modo: 'tron', stag: .025 });
  titulo('CREA TU\nCOMUNIDAD', 52.75, 55.6, 't-gran', { modo: 'tron' });
  titulo('TU PRIMERA\nMONETIZACIÓN', 56.75, 58.25, 't-gran', { modo: 'tron' });
  titulo('EMPIEZA A CREAR\nTU COMUNIDAD', 58.45, 60.6, 't-gran', { modo: 'tron', stag: .025 });
  titulo('ESTO ES', 64.45, 65.3, 't-fino');

  const montarDom = () => {
    const capa = $('#capa');
    dom.logo = $('#logo');
    dom.boot = $('#boot');
    dom.hud = $('#hud'); dom.tc = $('#tc'); dom.pct = $('#pct'); dom.pctN = $('#pctN'); dom.pctArc = $('#pctArc');
    dom.flash = $('#flash'); dom.negro = $('#negro');
    dom.titulos = TITULOS.map(T => { const e = document.createElement('div'); e.className = 'tit ' + T.cls; textoLetras(e, T.txt); capa.appendChild(e); return e; });
    dom.ecp = ['EXPLORA', 'CREA', 'PUBLICA'].map((w, i) => { const e = document.createElement('div'); e.className = 'ecp'; e.innerHTML = `<svg viewBox="0 0 24 24"><path d="${[ICON.globo, 'M12 2l9 5v10l-9 5-9-5V7zM12 22V12M21 7l-9 5-9-5', 'M12 19V5M5 12l7-7 7 7M4 21h16'][i]}"/></svg><b>${w}</b>`; capa.appendChild(e); return e; });
    dom.etq = [0, 1, 2].map(() => { const e = document.createElement('div'); e.className = 'etq3'; capa.appendChild(e); return e; });
    dom.cnt = $('#contador');
    dom.url = $('#url'); dom.lema = $('#lema'); dom.entrar = $('#entrar');
  };

  const BOOT = ['> UPGAMES.NET  ·  INICIANDO ENLACE', '> SINCRONIZANDO IDENTIDAD ........ OK', '> ACCESO CONCEDIDO'];

  const actualizarDom = t => {
    // Logo inicial: golpe, brillo y fallo de energía
    let lo = 0, ls = 1, lb = 0, lx = 0, ly = 0, lw = PORT ? .82 : .5, gl = 0;
    if (t < 6) {
      const k = en(t, .5, .6, E.out5);
      lo = t < .5 ? 0 : 1; ls = lerp(1.25, 1, k) + Math.sin(t * 2) * .004; lb = (1 - k) * 18;
      // parpadeo de tubo de neón
      if (t > 3.6) {
        const fr = Math.floor(t * 30), p = clamp((t - 3.6) / 1.9);
        lo = R(fr * 3.1) > p * 1.05 ? (R(fr) > .5 ? 1 : .7) : (R(fr + 5) > .7 ? .25 : 0);
        gl = lo > 0 ? R(fr + 2) : 0;
        if (t > 5.5) lo = 0;
      }
    } else if (t > 9.0 && t < 10.7) {
      const k = en(t, 9.05, .5, E.out5);
      lo = k * (1 - en(t, 10.15, .5)); ls = lerp(1.15, 1, k); lb = (1 - k) * 12 + en(t, 10.15, .5) * 10; ly = PORT ? .07 : .1; lw = PORT ? .6 : .3;
    } else if (t > beat(72) - .05) {
      const k = en(t, beat(72), .55, E.out5);
      lo = 1; ls = lerp(2.2, 1, k) + Math.sin(t * 2.2) * .006; lb = (1 - k) * 22; ly = PORT ? -.06 : -.05; lw = PORT ? .82 : .46;
      gl = t < beat(72) + .25 ? 1 - (t - beat(72)) * 4 : 0;
    }
    const L = dom.logo;
    L.style.opacity = lo; L.style.width = lw * 100 + 'vw';
    if (!PORT && lw * W > H * 1.4) L.style.width = (H * 1.4 / W * 100) + 'vw';
    L.style.transform = `translate(-50%,-50%) translate(${lx * 100}vw, ${ly * 100}vh) scale(${ls}) translateX(${gl * (R(Math.floor(t * 60)) - .5) * 40 * U}px)`;
    L.style.filter = `blur(${lb}px) drop-shadow(0 0 ${30 * U}px rgba(57,255,136,.55))` + (gl > .3 ? ` drop-shadow(${8 * gl * U}px 0 0 rgba(255,40,90,.6)) drop-shadow(${-8 * gl * U}px 0 0 rgba(40,255,230,.6))` : '');

    // texto de arranque
    const bo = t > 6.1 && t < 8.0;
    dom.boot.style.display = bo ? 'block' : 'none';
    if (bo) {
      const lineas = [[6.2, 1.0], [7.0, .75], [7.75, .2]];
      dom.boot.innerHTML = BOOT.map((s, i) => { const [a, d] = lineas[i]; if (t < a) return ''; const n = Math.floor(clamp((t - a) / d) * s.length); return `<div${i === 2 ? ' class="ok"' : ''}>${s.slice(0, n)}${t < a + d + .3 && Math.floor(t * 4) % 2 ? '▌' : ''}</div>`; }).join('');
      dom.boot.style.opacity = 1 - en(t, 7.85, .15);
    }

    // títulos
    TITULOS.forEach((T, i) => animLetras(dom.titulos[i], t, T.a, T.b, T.opts));

    // EXPLORA · CREA · PUBLICA
    const tiempos = [37.6, 38.74, 39.66];
    dom.ecp.forEach((e, i) => {
      const a = tiempos[i], k = en(t, a, .45, E.spr), sal = en(t, 41.6, .5, E.in);
      const vis = t > a - .05 && t < 42.2; e.style.display = vis ? 'flex' : 'none'; if (!vis) return;
      const desp = PORT ? `translate(-50%, ${(i - 1) * 165 * (Math.min(innerWidth, innerHeight) / 1080 || U)}px)` : `translate(${(i - 1) * 118 - 50}%, 0)`;
      e.style.transform = `${desp} scale(${lerp(1.7, 1, k) * (1 - sal * .2)})`;
      e.style.opacity = clamp((t - a) * 6) * (1 - sal);
      e.style.filter = `blur(${(1 - clamp((t - a) * 5)) * 12 + sal * 10}px)`;
      e.classList.toggle('on', t > a && t < a + .35);
    });

    // etiquetas de los caminos
    dom.etq.forEach((e, i) => {
      const q = etiquetas[i];
      const vis = t > 43 && t < 47.6 && q && q.a > .02; e.style.display = vis ? 'block' : 'none'; if (!vis) return;
      e.textContent = q.txt; e.style.left = q.x / DPR + 'px'; e.style.top = q.y / DPR + 'px';
      e.style.opacity = q.a; e.style.fontSize = Math.max(12, q.s * 2.4 / DPR) + 'px';
      e.classList.toggle('yo', q.yo && q.elige > 0);
    });

    // contadores
    let c = '';
    if (t > 53.0 && t < 55.9) c = `<span>+${fmt(en(t, 53.06, 2, E.out) * 1280)}</span> MIEMBROS`;
    if (t > 57.2 && t < 60.4) c = `<span>${fmt(en(t, 57.23, 2.3, E.out) * 12500)}</span> UC`;
    dom.cnt.innerHTML = c; dom.cnt.style.opacity = c ? 1 : 0;

    // porcentaje de conexión en el túnel
    const pv = t > 19.6 && t < 30.4;
    dom.pct.style.display = pv ? 'block' : 'none';
    if (pv) { const p = clamp((t - 19.6) / (BEAT0 - .15 - 19.6)); const pe = Math.pow(p, 1.6); dom.pctN.textContent = Math.floor(pe * 100) + '%'; dom.pctArc.style.strokeDashoffset = 1 - pe; dom.pct.style.opacity = en(t, 19.6, .5) * (1 - en(t, 30.0, .25)); }

    // cierre
    const fk = en(t, 66.5, .8, E.out5);
    dom.url.style.opacity = fk; dom.url.style.transform = `translate(-50%,0) translateY(${(1 - fk) * 20}px)`;
    const lk = en(t, 67.2, .8, E.out5);
    dom.lema.style.opacity = lk; dom.lema.style.letterSpacing = lerp(.9, PORT ? .14 : .42, lk) + 'em';
    if (dom.entrar) { const ek = en(t, 67.9, .6, E.back); dom.entrar.style.opacity = clamp((t - 67.9) * 4); dom.entrar.style.transform = `translate(-50%,0) scale(${ek})`; dom.entrar.style.pointerEvents = t > 67.9 ? 'auto' : 'none'; }

    // HUD
    dom.hud.style.opacity = t > 8.2 && t < 64.2 ? .9 * en(t, 8.2, 1) * (1 - en(t, 63.6, .5)) : 0;
    dom.tc.textContent = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}:${String(Math.floor((t % 1) * 60)).padStart(2, '0')}`;

    // destello y fundido final
    let fl = 0;
    for (const d of destellos) { const k = t - d.t; if (k >= 0 && k < .6) fl = Math.max(fl, d.f * Math.exp(-k * 9)); }
    fl = Math.max(fl, en(t, 29.55, .78, E.in2) * (t < BEAT0 + .05 ? 1 : 0));   // blanco al salir del túnel
    fl = Math.max(fl, t > 47.25 && t < 47.6 ? en(t, 47.25, .25, E.in2) : 0);
    dom.flash.style.opacity = fl;
    dom.negro.style.opacity = en(t, DUR - 1.2, 1.1, E.in2);
  };

  /* ════════════ Render ════════════ */
  const escenas = [
    { a: 9.9, b: 25.0, f: escenaRed, fi: 1.0, fo: .35 },
    { a: 24.4, b: BEAT0 + .02, f: escenaTunel, fi: .25, fo: .01 },
    { a: BEAT0, b: 42.9, f: escenaCiudad, fi: .01, fo: .4 },
    { a: 42.55, b: 47.55, f: escenaPlaza, fi: .35, fo: .05 },
    { a: 47.45, b: 52.6, f: escenaCartas, fi: .05, fo: .45 },
    { a: 52.3, b: 56.3, f: escenaComunidad, fi: .5, fo: .4 },
    { a: 56.0, b: 60.7, f: escenaMonedas, fi: .4, fo: .3 },
    { a: 60.4, b: 64.35, f: escenaAscenso, fi: .3, fo: .4 },
    { a: beat(72) - .02, b: DUR, f: escenaFinal, fi: .02, fo: .01 },
  ];

  const render = t => {
    // sacudida de cámara
    let sx = 0, sy = 0;
    for (const g of golpes) { const k = t - g.t; if (k < 0 || k > .7) continue; const a = g.f * Math.exp(-k * 8) * 22 * U; sx += Math.sin(k * 87 + g.t) * a; sy += Math.cos(k * 71 + g.t * 2) * a; }
    s3.globalCompositeOperation = 'source-over'; s3.clearRect(0, 0, W, H);
    s3.globalCompositeOperation = 'lighter'; s3.lineCap = 'butt';
    for (const e of escenas) {
      if (t < e.a || t > e.b) continue;
      const al = win(t, e.a, e.b, e.fi, e.fo);
      if (al <= 0) continue;
      e.f(t, al);
      cam.sx = sx; cam.sy = sy;
    }
    // composición: fondo + resplandor + escena nítida
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#020409'; ctx.fillRect(0, 0, W, H);
    // halo del horizonte
    const hz = ctx.createRadialGradient(W / 2, H * .55, 0, W / 2, H * .55, Math.max(W, H) * .7);
    const glowAmb = t < 9 ? 0 : t < 10.5 ? (t - 9) / 1.5 : 1;
    hz.addColorStop(0, `rgba(20,90,70,${.28 * glowAmb})`); hz.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hz; ctx.fillRect(0, 0, W, H);
    bx1.globalCompositeOperation = 'copy'; bx1.drawImage(sc, 0, 0, b1.width, b1.height);
    bx2.globalCompositeOperation = 'copy'; bx2.drawImage(b1, 0, 0, b2.width, b2.height);
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = .9; ctx.drawImage(b2, 0, 0, W, H); ctx.drawImage(b2, 0, 0, W, H);
    ctx.globalAlpha = .85; ctx.drawImage(b1, 0, 0, W, H);
    ctx.globalAlpha = 1; ctx.drawImage(sc, 0, 0);

    // 2D: logo inicial (onda, destello anamórfico), línea de «Bienvenido», luces convergentes
    const cx = W / 2 + sx, cyc = H / 2 + sy;
    if (t > .5 && t < 3.7) { const k = t - .5; flare(cx, cyc, W * 1.6 * E.out(clamp(k / .6)), .9 * Math.exp(-k * .7)); for (let i = 0; i < 3; i++) { const kk = (k - i * .1) / 1.1; if (kk > 0 && kk < 1) anillo2d(cx, cyc, lerp(40, Math.max(W, H) * .8, E.out(kk)) * 1, (1 - kk) * .8, 5); } }
    if (t > 3.6 && t < 5.6) { const fr = Math.floor(t * 30); if (R(fr * 7) > .55) flare(cx, cyc, W * .9, .35 * R(fr)); }
    if (t > 7.95 && t < 10.6) {
      const k = en(t, 7.95, .35, E.out5), ab = en(t, 8.6, 1.4, E.io), sal = en(t, 10.0, .6);
      const ancho = W * k, alto = H * .5 * ab;
      ctx.fillStyle = `rgba(${BL},${.95 * (1 - sal)})`; ctx.fillRect(cx - ancho / 2, cyc - 1.5 * U, ancho, 3 * U);
      flare(cx, cyc, ancho * 1.2, .6 * (1 - sal));
      if (ab > 0) { ctx.strokeStyle = `rgba(${G},${.8 * (1 - sal)})`; ctx.lineWidth = 2 * U; ctx.beginPath(); ctx.moveTo(cx - ancho / 2, cyc - alto); ctx.lineTo(cx + ancho / 2, cyc - alto); ctx.moveTo(cx - ancho / 2, cyc + alto); ctx.lineTo(cx + ancho / 2, cyc + alto); ctx.stroke(); }
    }
    if (t > 63.4 && t < beat(72) + .1) {   // líneas que convergen al centro
      const k = clamp((t - 63.4) / (beat(72) - 63.4));
      for (let i = 0; i < 40; i++) {
        const a = R(i) * 6.283, r0 = Math.max(W, H) * (1.1 - ((k * 1.6 + R(i + 3)) % 1) * .9), r1 = r0 + Math.max(W, H) * (.08 + k * .25);
        ctx.strokeStyle = `rgba(${i % 3 ? G : BL},${.7 * k})`; ctx.lineWidth = 2 * U;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r0, cyc + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cyc + Math.sin(a) * r1); ctx.stroke();
      }
      punto2d(cx, cyc, (8 + k * 40) * U, k);
    }
    if (t > beat(72) - .05) { const k = t - beat(72); for (let i = 0; i < 3; i++) { const kk = (k - i * .1) / 1.2; if (kk > 0 && kk < 1) anillo2d(cx, cyc - H * .05, lerp(60, Math.max(W, H), E.out(kk)), (1 - kk) * .9, 6); } flare(cx, cyc - H * .05, W * 1.8, .9 * Math.exp(-Math.max(0, k) * 1.2) + .12); }
    // glitch: franjas
    for (const g of glitches) { const k = (t - g.t) / g.d; if (k < 0 || k > 1) continue; const fr = Math.floor(t * 60); for (let i = 0; i < 6; i++) { if (R(i + fr * 13) > .7) continue; ctx.fillStyle = `rgba(${R(i + fr) > .5 ? G : BL},${.2 * g.f})`; ctx.fillRect(0, R(i * 3 + fr) * H, W, (4 + R(i * 5 + fr) * 40) * U); } }
    // grano
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = .08;
    const fr = Math.floor(t * 30), ox = Math.floor(R(fr) * 256), oy = Math.floor(R(fr + 7) * 256);
    ctx.fillStyle = ctx.createPattern(grano, 'repeat'); ctx.save(); ctx.translate(-ox, -oy); ctx.fillRect(ox, oy, W, H); ctx.restore();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    actualizarDom(t);
  };
  const punto2d = (x, y, r, al) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3); g.addColorStop(0, `rgba(${BL},${al})`); g.addColorStop(.3, `rgba(${G},${al * .6})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6); };

  // la sacudida se aplica a la proyección de todas las escenas del cuadro
  const _render = render;
  const renderConSacudida = t => {
    let sx = 0, sy = 0;
    for (const g of golpes) { const k = t - g.t; if (k < 0 || k > .7) continue; const a = g.f * Math.exp(-k * 8) * 22 * U; sx += Math.sin(k * 87 + g.t) * a; sy += Math.cos(k * 71 + g.t * 2) * a; }
    cam.sx = sx; cam.sy = sy;
    _render(t);
  };
  window.INTRO = { DUR, VOCES, SFX, BEAT0, BEAT, render: renderConSacudida, medir, montarDom, ajustarCalidad: c => { calidad = c; medir(); } };
})();
