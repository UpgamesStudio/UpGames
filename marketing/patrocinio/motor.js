/* UpGames · Patrocinio — motor común de animación.
   Todo se calcula en render(t): cada fotograma es exacto y reproducible,
   así render.js puede grabarlo cuadro a cuadro. Los videos definen:
     M.escena(desde, hasta, construir(raiz), actualizar(t, raiz))
     M.fondoKeys([...])  estado del fondo (verde, rejilla, velocidad…) en el tiempo
     M.subtitulos([[palabra, inicio], …])
     M.sfx(t, nombre, ganancia)  efectos de sonido (render.js los mezcla)
     M.golpe(t, fuerza)  sacudida + destello; M.glitch(t, dur, fuerza)
*/
'use strict';
const M = (() => {
  const W = 1080, H = 1920;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const E = {
    lin: k => k,
    out: k => 1 - Math.pow(1 - k, 3),
    out5: k => 1 - Math.pow(1 - k, 5),
    expo: k => k >= 1 ? 1 : 1 - Math.pow(2, -10 * k),
    in: k => k * k * k,
    io: k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2,
    sine: k => -(Math.cos(Math.PI * k) - 1) / 2,
    back: k => { const c = 1.7, c3 = c + 1; return 1 + c3 * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); },
    // resorte amortiguado (rebote suave tipo UI moderna)
    spr: k => k >= 1 ? 1 : 1 - Math.exp(-6.5 * k) * Math.cos(k * 13),
  };
  // progreso 0..1 de una animación que empieza en a y dura d
  const en = (t, a, d, e = E.out) => e(clamp((t - a) / d));
  // ventana: entra en a (fi s), sale en b (fo s)
  const win = (t, a, b, fi = .3, fo = .3) => Math.min(clamp((t - a) / fi), clamp((b - t) / fo));
  // aleatorio determinista
  const R = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const fmt = n => Math.round(n).toLocaleString('es-CO');

  const h = (tag, cls, html, padre) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    if (padre) padre.appendChild(e);
    return e;
  };
  // estilo por transformaciones: o, x, y, s, sx, sy, r, rx, ry, z, b (desenfoque), f (filtro extra)
  const st = (el, p) => {
    if (p.o != null) el.style.opacity = p.o;
    const tr = [];
    if (p.x != null || p.y != null) tr.push(`translate(${p.x || 0}px, ${p.y || 0}px)`);
    if (p.z) tr.push(`translateZ(${p.z}px)`);
    if (p.rx) tr.push(`rotateX(${p.rx}deg)`);
    if (p.ry) tr.push(`rotateY(${p.ry}deg)`);
    if (p.r) tr.push(`rotate(${p.r}deg)`);
    if (p.s != null) tr.push(`scale(${p.s})`);
    if (p.sx != null || p.sy != null) tr.push(`scale(${p.sx ?? 1}, ${p.sy ?? 1})`);
    if (p.c) tr.unshift('translate(-50%, -50%)');
    el.style.transform = tr.join(' ');
    if (p.b != null || p.f != null) el.style.filter = (p.b > .05 ? `blur(${p.b}px) ` : '') + (p.f || '');
  };
  const pos = (el, x, y, w, hh) => { el.style.left = x + 'px'; el.style.top = y + 'px'; if (w != null) el.style.width = w + 'px'; if (hh != null) el.style.height = hh + 'px'; return el; };

  /* ── Texto cinético: letras separadas ── */
  const texto = (padre, str, cls) => {
    const el = h('div', cls, null, padre);
    const letras = [];
    str.split('\n').forEach((linea, li) => {
      if (li) h('br', null, null, el);
      for (const ch of linea) letras.push(h('span', 'l', ch === ' ' ? ' ' : ch, el));
    });
    return { el, letras };
  };
  // modos: 'sube' (desde abajo con desenfoque), 'zoom' (desde grande), 'blur', 'cae'
  const letras = (obj, t, a, { stag = .028, dur = .55, modo = 'sube', salida = Infinity, sdur = .3 } = {}) => {
    const n = obj.letras.length;
    obj.letras.forEach((l, i) => {
      const k = clamp((t - a - i * stag) / dur);
      const ko = clamp((t - salida - (n - i) * stag * .4) / sdur);
      let p;
      if (modo === 'zoom') { const e = E.out5(k); p = { o: e * (1 - ko), s: lerp(2.6, 1, e) * (1 + ko * .4), b: (1 - e) * 18 + ko * 14 }; }
      else if (modo === 'cae') { const e = E.spr(k); p = { o: clamp(k * 3) * (1 - ko), y: lerp(-120, 0, e) - ko * 60, b: ko * 12 }; }
      else if (modo === 'blur') { const e = E.out(k); p = { o: e * (1 - ko), b: (1 - e) * 22 + ko * 16, s: lerp(1.15, 1, e) }; }
      else { const e = E.out5(k); p = { o: e * (1 - ko), y: lerp(90, 0, e) - ko * 70, b: (1 - e) * 10 + ko * 12, r: (1 - e) * 6 }; }
      st(l, p);
    });
  };
  // "descifrado": caracteres aleatorios que se resuelven al texto final
  const GLIFOS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@$<>/\\[]{}=+*';
  const decode = (el, final, t, a, dur = .7) => {
    const k = clamp((t - a) / dur);
    if (t < a) { el.textContent = ''; return; }
    const fr = Math.floor(t * 30);
    let s = '';
    for (let i = 0; i < final.length; i++) {
      const c = final[i];
      if (c === ' ' || i / final.length < k * 1.15 - .15) s += c;
      else if (i / final.length < k * 1.15 + .12) s += GLIFOS[Math.floor(R(i * 7 + fr) * GLIFOS.length)];
    }
    el.textContent = s;
  };

  /* ── Escenas ── */
  const escenas = [];
  let mundo;
  const escena = (a, b, construir, actualizar) => escenas.push({ a, b, construir, actualizar });

  /* ── Efectos globales ── */
  const golpes = [], glitches = [], destellos = [], barridos = [];
  const SFX = [];
  const sfx = (t, s, g = 1) => SFX.push({ t: +t.toFixed(3), s, g });
  const golpe = (t, f = 1, sonido = 'impacto') => { golpes.push({ t, f }); destellos.push({ t, f: .55 * f }); if (sonido) sfx(t, sonido, .9 * f); };
  const glitch = (t, d = .25, f = 1, sonido = true) => { glitches.push({ t, d, f }); if (sonido) sfx(t, 'glitch', .55 * f); };
  const barrido = (t, sonido = true) => { barridos.push(t); if (sonido) sfx(t, 'swish', .5); };
  let BEATS = [];
  const ritmo = b => { BEATS = b; };

  /* ── Fondo: rejilla 3D, partículas y resplandor ── */
  let fk = [];
  const fondoKeys = k => { fk = k.sort((a, b) => a.t - b.t); };
  const FONDO0 = { verde: 0, rejilla: .6, vel: 1, glow: .5, hor: 1150, techo: 0, part: .6, rojo: 0 };
  const fondoEn = t => {
    if (!fk.length) return FONDO0;
    if (t <= fk[0].t) return { ...FONDO0, ...fk[0] };
    for (let i = 0; i < fk.length - 1; i++) {
      const A = { ...FONDO0, ...fk[i] }, B = { ...FONDO0, ...fk[i + 1] };
      if (t < B.t) {
        // B.d: la transición ocupa los últimos d segundos antes de B.t
        const d = Math.min(B.d ?? (B.t - A.t), B.t - A.t) || 1e-3;
        const k = E.io(clamp((t - (B.t - d)) / d));
        const o = {};
        for (const key in FONDO0) o[key] = lerp(A[key], B[key], k);
        return o;
      }
    }
    return { ...FONDO0, ...fk[fk.length - 1] };
  };
  // posición de la cámara = integral de la velocidad (precalculada)
  let camZ = [];
  const PASO = 1 / 120;
  const prepCam = dur => {
    camZ = [0];
    for (let i = 1; i <= Math.ceil(dur / PASO) + 2; i++) camZ.push(camZ[i - 1] + fondoEn(i * PASO).vel * 260 * PASO);
  };
  const camEn = t => { const i = clamp(t / PASO, 0, camZ.length - 2), i0 = Math.floor(i); return lerp(camZ[i0], camZ[i0 + 1], i - i0); };

  let ctx, fxc, grano;
  const PART = Array.from({ length: 280 }, (_, i) => ({ x: (R(i) - .5) * 3400, y: (R(i + 999) - .5) * 4200, z: R(i + 555) * 3000, s: .6 + R(i + 77) * 1.8 }));
  const mezcla = (a, b, k) => a.map((v, i) => Math.round(lerp(v, b[i], k)));

  const fondo = t => {
    const p = fondoEn(t), cz = camEn(t);
    const G = [57, 255, 136], GR = [138, 148, 166], RJ = [255, 70, 90];
    let col = mezcla(GR, G, p.verde); col = mezcla(col, RJ, p.rojo);
    const rgba = a => `rgba(${col[0]},${col[1]},${col[2]},${a})`;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#03060C'; ctx.fillRect(0, 0, W, H);
    // resplandores ambientales que respiran
    const g1 = ctx.createRadialGradient(W * (.78 + .08 * Math.sin(t * .4)), 220, 0, W * .78, 220, 1100);
    g1.addColorStop(0, rgba(.20 * p.glow)); g1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
    const g2 = ctx.createRadialGradient(W * .1, H * .55 + 120 * Math.sin(t * .3), 0, W * .1, H * .55, 900);
    g2.addColorStop(0, `rgba(30,60,120,${.35 * p.glow})`); g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
    const g3 = ctx.createRadialGradient(W / 2, p.hor, 0, W / 2, p.hor, 900);
    g3.addColorStop(0, rgba(.28 * p.glow * p.rejilla)); g3.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g3; ctx.fillRect(0, 0, W, H);

    ctx.globalCompositeOperation = 'lighter';
    // rejilla del suelo (y techo opcional)
    const f = 900, camH = 420;
    const dibRej = (sig, alfa) => {
      if (alfa <= .01) return;
      const hor = p.hor;
      ctx.lineWidth = 2;
      const off = cz % 120;
      for (let k = 0; k < 46; k++) {
        const z = 40 + k * 120 - off;
        if (z < 30) continue;
        const y = hor + sig * camH * f / z;
        const a = alfa * clamp(1 - z / 5400) * clamp((z - 30) / 120);
        if (y < -10 || y > H + 10) continue;
        ctx.strokeStyle = rgba(.55 * a); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      for (let i = -24; i <= 24; i++) {
        const x = i * 140;
        const z1 = 60, z2 = 5400;
        const y1 = hor + sig * camH * f / z1, y2 = hor + sig * camH * f / z2;
        const gr = ctx.createLinearGradient(0, y1, 0, y2);
        gr.addColorStop(0, rgba(.0)); gr.addColorStop(.15, rgba(.45 * alfa)); gr.addColorStop(1, rgba(0));
        ctx.strokeStyle = gr; ctx.beginPath(); ctx.moveTo(W / 2 + x * f / z1, y1); ctx.lineTo(W / 2 + x * f / z2, y2); ctx.stroke();
      }
      // línea del horizonte
      const lh = ctx.createLinearGradient(0, 0, W, 0);
      lh.addColorStop(0, rgba(0)); lh.addColorStop(.5, rgba(.9 * alfa)); lh.addColorStop(1, rgba(0));
      ctx.fillStyle = lh; ctx.fillRect(0, hor - 2, W, 4);
    };
    dibRej(1, p.rejilla);
    dibRej(-1, p.rejilla * p.techo);

    // partículas que vienen hacia la cámara (estelas al acelerar)
    if (p.part > .01) {
      const est = clamp((p.vel - 1) / 6) * 1;
      for (let i = 0; i < PART.length; i++) {
        const q = PART[i];
        let z = (q.z - cz * 1.2) % 3000; if (z < 0) z += 3000; z += 40;
        const sx = W / 2 + q.x * 600 / z, sy = H * .45 + q.y * 600 / z;
        if (sx < -50 || sx > W + 50 || sy < -50 || sy > H + 50) continue;
        const a = p.part * clamp(1 - z / 3000) * clamp((z - 40) / 200);
        const r = q.s * 600 / z * 1.4;
        const blanco = R(i + 3) > .6;
        ctx.fillStyle = blanco ? `rgba(255,255,255,${a * .8})` : rgba(a);
        if (est > .05) {
          const z2 = z + 260 * est * p.vel / 3;
          const sx2 = W / 2 + q.x * 600 / z2, sy2 = H * .45 + q.y * 600 / z2;
          ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = Math.max(1, r);
          ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx2, sy2); ctx.stroke();
        } else {
          ctx.beginPath(); ctx.arc(sx, sy, Math.max(.6, r), 0, 6.283); ctx.fill();
        }
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  };

  /* ── Capa de efectos encima: grano, glitch, destello ── */
  const efectos = t => {
    fxc.clearRect(0, 0, W, H);
    // grano de película
    const fr = Math.floor(t * 30);
    fxc.globalAlpha = .07;
    fxc.drawImage(grano, -Math.floor(R(fr) * 256), -Math.floor(R(fr + 9) * 256));
    fxc.globalAlpha = 1;
    // franjas de glitch
    for (const g of glitches) {
      const k = (t - g.t) / g.d;
      if (k < 0 || k > 1) continue;
      const f2 = Math.floor(t * 60);
      for (let i = 0; i < 9; i++) {
        if (R(i + f2 * 13) > .6 * g.f + .2) continue;
        const y = R(i * 3 + f2) * H, hh = 6 + R(i * 5 + f2) * 70;
        fxc.fillStyle = R(i + f2 * 2) > .5 ? `rgba(57,255,136,${.25 * g.f})` : `rgba(255,255,255,${.18 * g.f})`;
        fxc.fillRect((R(i + f2 * 7) - .5) * 200, y, W, hh);
      }
    }
  };

  /* ── Subtítulos tipo karaoke ── */
  let subsEl, grupos = [];
  const subtitulos = (pal, corr = {}) => {
    // agrupa en frases cortas: corte por puntuación, pausa o 3-4 palabras
    const ws = pal.map(([w, s], i) => ({ w: corr[w] ?? w, s, e: i < pal.length - 1 ? Math.min(pal[i + 1][1], s + 1.2) : s + .9 }));
    let g = [];
    ws.forEach((x, i) => {
      g.push(x);
      const txt = g.map(y => y.w).join(' ');
      const sig = ws[i + 1];
      if (!sig || /[.,?!:]$/.test(x.w) || g.length >= 4 || txt.length > 20 || sig.s - x.e > .35) { grupos.push(g); g = []; }
    });
    grupos.forEach((g2, i) => { g2.a = g2[0].s - .06; g2.b = grupos[i + 1] ? Math.min(grupos[i + 1][0].s - .06, g2[g2.length - 1].e + .5) : g2[g2.length - 1].e + .6; });
  };
  const subs = t => {
    if (!subsEl) return;
    const g = grupos.find(x => t >= x.a && t < x.b);
    if (subsEl._g !== g) {
      subsEl.innerHTML = '';
      subsEl._g = g;
      if (g) {
        const lin = h('div', 'lin', null, subsEl);
        g.forEach(x => { x.el = h('span', 'w', x.w.replace(/[¿?¡!,.]/g, m => m), lin); });
      }
    }
    if (!g) return;
    g.forEach(x => {
      const k = clamp((t - x.s + .04) / .22);
      const e = E.back(k);
      x.el.style.opacity = clamp(k * 2.5);
      x.el.style.transform = `translateY(${(1 - e) * 26}px) scale(${lerp(.7, 1, e)})`;
      x.el.classList.toggle('on', t >= x.s - .02 && t < x.e);
    });
    const ko = clamp((g.b - t) / .12);
    subsEl.style.opacity = ko;
  };

  /* ── Render ── */
  let hud = {};
  const render = t => {
    fondo(t);
    // cámara: sacudidas por golpes + pulso al ritmo
    let sx = 0, sy = 0, esc = 1, rot = 0;
    for (const g of golpes) {
      const k = t - g.t;
      if (k < 0 || k > .6) continue;
      const a = g.f * Math.exp(-k * 9) * 26;
      sx += Math.sin(k * 90 + g.t) * a; sy += Math.cos(k * 77 + g.t * 3) * a; rot += Math.sin(k * 60) * a * .02;
      esc += Math.exp(-k * 7) * .04 * g.f;
    }
    let pulso = 0;
    for (const b of BEATS) { const k = t - b; if (k >= 0 && k < .4) pulso = Math.max(pulso, Math.exp(-k * 10)); }
    esc += pulso * .006;
    let gl = 0;
    for (const g of glitches) { const k = (t - g.t) / g.d; if (k >= 0 && k <= 1) gl = Math.max(gl, g.f * (1 - k * .5)); }
    if (gl > 0) { const f2 = Math.floor(t * 60); sx += (R(f2) - .5) * 40 * gl; }
    mundo.style.transform = `translate(${sx}px, ${sy}px) rotate(${rot}deg) scale(${esc})`;
    mundo.style.filter = gl > 0 ? `drop-shadow(${10 * gl}px 0 0 rgba(255,40,90,.55)) drop-shadow(${-10 * gl}px 0 0 rgba(40,255,230,.55))` : '';
    // destello blanco
    let fl = 0;
    for (const d of destellos) { const k = t - d.t; if (k >= 0 && k < .5) fl = Math.max(fl, d.f * Math.exp(-k * 10)); }
    hud.flash.style.opacity = fl;
    // barrido de luz
    let bo = 0, by = 0;
    for (const b of barridos) { const k = (t - b) / .5; if (k >= 0 && k <= 1) { bo = Math.sin(k * Math.PI); by = lerp(-20, H + 20, E.io(k)); } }
    hud.barrido.style.opacity = bo; hud.barrido.style.top = by + 'px';

    for (const s of escenas) {
      const on = t >= s.a && t < s.b;
      if (on !== s.on) { s.raiz.style.display = on ? 'block' : 'none'; s.on = on; }
      if (on) s.actualizar(t, s.raiz);
    }
    subs(t);
    if (hud.act) hud.act(t);
    efectos(t);
  };

  const iniciar = ({ duracion, etiqueta = 'UPGAMES // PATROCINIO' }) => {
    const stage = document.getElementById('stage');
    stage.innerHTML = `<canvas id="bg" width="${W}" height="${H}"></canvas><div id="mundo"></div><canvas id="fx" width="${W}" height="${H}"></canvas>
      <div id="subs"></div>
      <div id="hud"><div class="esq tl"></div><div class="esq tr"></div><div class="esq bl"></div><div class="esq br"></div>
        <div class="lab">${etiqueta} · <b id="tc">00:00</b></div><div class="rec"><i></i>LIVE</div><img class="marca" src="logo.png"></div>
      <div id="flash"></div><div id="barrido"></div><div id="scan"></div><div id="vigneta"></div>`;
    ctx = document.getElementById('bg').getContext('2d');
    fxc = document.getElementById('fx').getContext('2d');
    mundo = document.getElementById('mundo');
    subsEl = document.getElementById('subs');
    hud = { flash: document.getElementById('flash'), barrido: document.getElementById('barrido'), tc: document.getElementById('tc'), el: document.getElementById('hud'), marca: document.querySelector('#hud .marca'), rec: document.querySelector('#hud .rec i') };
    // textura de grano
    grano = document.createElement('canvas'); grano.width = W + 256; grano.height = H + 256;
    const gc = grano.getContext('2d'), id = gc.createImageData(grano.width, grano.height);
    for (let i = 0; i < id.data.length; i += 4) { const v = R(i * .25) * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
    gc.putImageData(id, 0, 0);
    for (const s of escenas) { s.raiz = h('div', 'capa', null, mundo); s.construir(s.raiz); s.on = false; }
    prepCam(duracion);
    window.DURACION = duracion;
    window.SFX = SFX;
    window.render = render;
    hud.act = t => {
      const s = Math.floor(t);
      hud.tc.textContent = `00:${String(s).padStart(2, '0')}:${String(Math.floor((t % 1) * 60)).padStart(2, '0')}`;
      hud.rec.style.opacity = Math.floor(t * 2) % 2 ? .25 : 1;
    };
    window.listo = (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => new Promise(r => {
      const img = hud.marca; if (img.complete) r(); else img.onload = r;
    })).then(() => {
      // precarga de imágenes de las escenas
      return Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
    }).then(() => {
      const q = new URLSearchParams(location.search);
      if (q.has('play')) {
        const t0 = performance.now() - (+q.get('play') || 0) * 1000;
        const loop = () => { const t = (performance.now() - t0) / 1000; render(t % duracion); requestAnimationFrame(loop); };
        loop();
      } else render(+(q.get('t') || 0));
    });
  };

  return { W, H, clamp, lerp, E, en, win, R, fmt, h, st, pos, texto, letras, decode, escena, golpe, glitch, barrido, sfx, ritmo, fondoKeys, subtitulos, iniciar, get hud() { return hud; } };
})();
