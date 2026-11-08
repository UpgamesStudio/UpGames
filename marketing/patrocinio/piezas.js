/* Piezas visuales reutilizables por los dos videos (iconos, arte de juego,
   tarjetas, panel, red, confeti). Todas se construyen una vez y se animan
   con funciones puras del tiempo. */
'use strict';
const P = (() => {
  const { h, st, clamp, lerp, E, R } = M;
  const C = (el, p) => st(el, { c: true, ...p });

  const IC = {
    cursor: '<svg viewBox="0 0 24 24"><path d="M4 2l16 9.5-7 1.6 4.2 7.4-3 1.7-4.2-7.4L5 20z" fill="#fff" stroke="#03060C" stroke-width="1.3" stroke-linejoin="round"/></svg>',
    ojo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    cor: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-10-9.2C.3 8.6 2.3 4.5 6.2 4.5c2.2 0 3.6 1.2 4.3 2.3h3c.7-1.1 2.1-2.3 4.3-2.3 3.9 0 5.9 4.1 4.2 7.3C19.5 16.4 12 21 12 21z"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.2A8 8 0 1 1 21 12z"/></svg>',
    env: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg>',
    arroba: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="4"/><path d="M1 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1M17 4a4 4 0 0 1 0 8M23 21v-1a6 6 0 0 0-4-5.6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>',
    escudo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2l8 3v6c0 5.2-3.4 9.4-8 11-4.6-1.6-8-5.8-8-11V5z"/><path d="M8.5 12l2.5 2.5 4.5-5" stroke-width="2.4"/></svg>',
    estrella: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7.1L12 17.3 5.8 21l1.6-7.1L2 9.2l7.1-.6z"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>',
    subir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    zip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5M11 6h2M11 9h2M11 12h2M10.5 15h3v3h-3z"/></svg>',
    mando: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 8h12a4 4 0 0 1 4 4l-.6 4.5a2.5 2.5 0 0 1-4.3 1.3L14.5 15h-5l-2.6 2.8a2.5 2.5 0 0 1-4.3-1.3L2 12a4 4 0 0 1 4-4z"/><path d="M7 11v3M5.5 12.5h3"/><circle cx="16" cy="11.5" r=".9" fill="currentColor"/><circle cx="18" cy="13.5" r=".9" fill="currentColor"/></svg>',
    globo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2c3 3.2 3 16.8 0 20M12 2c-3 3.2-3 16.8 0 20"/></svg>',
    alerta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 2L1 21h22z"/><path d="M12 9v5M12 17.5v.5" stroke-width="2.6" stroke-linecap="round"/></svg>',
    reloj: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>',
    bug: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="7" y="7" width="10" height="14" rx="5"/><path d="M12 11v10M3 13h4M17 13h4M4 7l3 2M20 7l-3 2M4 20l3-2M20 20l-3-2M9 4l1.5 2M15 4l-1.5 2"/></svg>',
    luna: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    app: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
    llave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M14.7 6.3a4 4 0 0 0 5 5L22 14l-8 8-3-3 2.3-2.3-1.6-1.6L9.4 17.4 6.6 14.6l2.3-2.3-1.6-1.6L5 13 2 10l8-8 2.7 2.3z"/></svg>',
    vivo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M4.9 4.9a10 10 0 0 0 0 14.2M19.1 4.9a10 10 0 0 1 0 14.2"/></svg>',
    ia: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4"/><path d="M9 15l1.5-6h1l1.5 6M9.6 13h2.8M15.5 9v6"/></svg>',
    moneda: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1.3 1.7 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2"/></svg>',
  };
  const ic = (nombre, tam, color = 'currentColor') => `<span style="display:inline-block;width:${tam}px;height:${tam}px;color:${color};vertical-align:middle">${IC[nombre].replace('<svg ', '<svg width="100%" height="100%" ')}</span>`;

  /* Arte de un juego ficticio estilo synthwave (sol con franjas, montañas, rejilla) */
  const arte = (padre, titulo = 'NEON RUNNER') => {
    const a = h('div', 'abs', null, padre);
    a.style.cssText += 'inset:0;overflow:hidden;background:linear-gradient(180deg,#071026 0%,#1a0f3a 38%,#0b2a3a 62%,#030a14 100%)';
    a.innerHTML = `
      <div class="abs" style="left:50%;top:22%;width:300px;height:300px;margin-left:-150px;border-radius:50%;background:linear-gradient(180deg,#eaffef 0%,#39FF88 45%,#0f7a44 100%);box-shadow:0 0 80px rgba(57,255,136,.6);-webkit-mask:linear-gradient(180deg,#000 52%,transparent 52% 57%,#000 57% 64%,transparent 64% 69%,#000 69% 75%,transparent 75% 80%,#000 80% 85%,transparent 85%)"></div>
      <div class="abs" style="left:-5%;right:-5%;top:44%;height:22%;background:#06101f;clip-path:polygon(0 100%,8% 40%,18% 75%,30% 20%,42% 70%,52% 35%,63% 80%,75% 25%,88% 65%,100% 30%,100% 100%)"></div>
      <div class="abs" style="left:-5%;right:-5%;top:52%;height:16%;background:#0a1a2c;clip-path:polygon(0 100%,12% 50%,25% 85%,40% 30%,55% 75%,70% 45%,85% 80%,100% 40%,100% 100%)"></div>
      <div class="abs rej" style="left:-60%;right:-60%;top:64%;height:80%;transform-origin:50% 0;transform:perspective(260px) rotateX(62deg);background-image:linear-gradient(rgba(57,255,136,.8) 2px,transparent 2px),linear-gradient(90deg,rgba(57,255,136,.6) 2px,transparent 2px);background-size:60px 60px"></div>
      <div class="abs" style="left:0;right:0;top:63.5%;height:4px;background:#39FF88;box-shadow:0 0 22px #39FF88"></div>
      <div class="abs orb" style="left:0;right:0;bottom:7%;text-align:center;font-size:44px;color:#fff;text-shadow:0 0 16px rgba(57,255,136,.9),3px 3px 0 #0B5E31">${titulo}</div>`;
    a.rej = a.querySelector('.rej');
    a.anim = t => { a.rej.style.backgroundPosition = `0 ${(t * 120) % 60}px`; };
    return a;
  };

  /* Avatar hexagonal con iniciales */
  const COLS = ['linear-gradient(160deg,#6BFFAA,#1FAF5E)', 'linear-gradient(160deg,#F2F5F7,#8A94A6)', 'linear-gradient(160deg,#39FF88,#0B5E31)', 'linear-gradient(160deg,#C9D2DC,#4A5361)', 'linear-gradient(160deg,#9CFFC8,#2BB86A)'];
  const NOMS = ['LU', 'MX', 'KA', 'JD', 'SO', 'AR', 'VE', 'NI', 'PE', 'RO', 'TA', 'GA', 'DI', 'EL', 'BO', 'CA', 'MI', 'FE', 'IS', 'OK', 'ZE', 'YU', 'QI', 'HA'];
  const hexav = (padre, i, tam = 150) => {
    const e = h('div', 'hexav hex', NOMS[i % NOMS.length], padre);
    e.style.background = COLS[i % COLS.length];
    e.style.width = tam + 'px'; e.style.height = tam * 1.12 + 'px'; e.style.fontSize = tam * .36 + 'px';
    return e;
  };

  /* Cursor con clic (onda) */
  const cursor = padre => {
    const c = h('div', 'cursor', IC.cursor, padre);
    const o = h('div', 'onda', null, padre);
    c.mover = (x, y, clic, t) => {
      c.style.left = x - 12 + 'px'; c.style.top = y - 6 + 'px';
      const k = clic != null ? (t - clic) / .5 : -1;
      const s = k >= 0 && k < .15 ? 1 - Math.sin(k / .15 * Math.PI) * .2 : 1;
      c.style.transform = `scale(${s})`;
      if (k >= 0 && k <= 1) { o.style.display = 'block'; o.style.left = x + 'px'; o.style.top = y + 'px'; const r = lerp(10, 150, E.out(k)); o.style.width = o.style.height = r + 'px'; o.style.opacity = 1 - k; }
      else o.style.display = 'none';
    };
    return c;
  };
  // trayectoria bezier entre puntos con llegada suave
  const ruta = (t, pts) => {
    // pts: [[t, x, y], ...]
    if (t <= pts[0][0]) return pts[0].slice(1);
    for (let i = 0; i < pts.length - 1; i++) {
      const [ta, xa, ya] = pts[i], [tb, xb, yb] = pts[i + 1];
      if (t < tb) { const k = E.io((t - ta) / (tb - ta)); const cx = (xa + xb) / 2 + (yb - ya) * .25, cy = (ya + yb) / 2 - (xb - xa) * .25; const u = 1 - k; return [u * u * xa + 2 * u * k * cx + k * k * xb, u * u * ya + 2 * u * k * cy + k * k * yb]; }
    }
    return pts[pts.length - 1].slice(1);
  };

  /* Onda de choque (anillo) */
  const anillos = (padre, n = 3) => Array.from({ length: n }, () => { const o = h('div', 'onda', null, padre); o.style.borderWidth = '6px'; o.style.boxShadow = '0 0 40px rgba(57,255,136,.7), inset 0 0 40px rgba(57,255,136,.5)'; return o; });
  const choque = (os, t, a, x, y, max = 1400) => os.forEach((o, i) => {
    const k = (t - a - i * .09) / .9;
    if (k < 0 || k > 1) { o.style.display = 'none'; return; }
    o.style.display = 'block'; o.style.left = x + 'px'; o.style.top = y + 'px';
    const r = lerp(40, max, E.out(k)); o.style.width = o.style.height = r + 'px'; o.style.opacity = (1 - k) * (i ? .5 : 1);
  });

  /* Confeti/chispas */
  const chispas = (padre, n = 70) => Array.from({ length: n }, (_, i) => {
    const e = h('div', 'abs', null, padre);
    const w = 8 + R(i) * 16;
    e.style.cssText += `width:${w}px;height:${w * (R(i + 4) > .5 ? .4 : 1)}px;background:${R(i + 2) > .35 ? '#39FF88' : '#fff'};box-shadow:0 0 12px rgba(57,255,136,.8)`;
    e.i = i; return e;
  });
  const explotar = (cs, t, a, x, y, fuerza = 1) => cs.forEach(e => {
    const k = t - a, i = e.i;
    if (k < 0 || k > 2.2) { e.style.display = 'none'; return; }
    e.style.display = 'block';
    const ang = R(i + 10) * Math.PI * 2, v = (500 + R(i + 20) * 900) * fuerza;
    const dx = Math.cos(ang) * v * (1 - Math.exp(-k * 3)) / 3 * 3, dy = Math.sin(ang) * v * (1 - Math.exp(-k * 3)) / 3 * 3 + 300 * k * k;
    e.style.left = x + 'px'; e.style.top = y + 'px';
    e.style.transform = `translate(${dx}px, ${dy}px) rotate(${k * 600 * (R(i) - .5)}deg)`;
    e.style.opacity = clamp(1 - k / 2.2);
  });

  /* Gráfica de línea que se dibuja */
  const grafica = (padre, w, hh, puntos, color = '#39FF88') => {
    const d = puntos.map((p, i) => `${i ? 'L' : 'M'}${(i / (puntos.length - 1) * w).toFixed(1)} ${(hh - p * hh).toFixed(1)}`).join(' ');
    const s = h('div', 'abs', `<svg width="${w}" height="${hh}" viewBox="0 0 ${w} ${hh}" style="overflow:visible">
      <defs><linearGradient id="gr${w}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".45"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient>
      <clipPath id="cl${w}"><rect class="clip" x="0" y="-20" width="0" height="${hh + 40}"/></clipPath></defs>
      ${[.25, .5, .75].map(y => `<line x1="0" x2="${w}" y1="${hh * y}" y2="${hh * y}" stroke="rgba(255,255,255,.07)" stroke-width="2"/>`).join('')}
      <g clip-path="url(#cl${w})"><path d="${d} L${w} ${hh} L0 ${hh}Z" fill="url(#gr${w})"/><path d="${d}" fill="none" stroke="${color}" stroke-width="6" stroke-linejoin="round" style="filter:drop-shadow(0 0 10px ${color})"/></g>
      <circle class="pt" r="12" fill="#fff" stroke="${color}" stroke-width="6"/></svg>`, padre);
    const clip = s.querySelector('.clip'), pt = s.querySelector('.pt');
    s.anim = k => {
      clip.setAttribute('width', k * w);
      const f = k * (puntos.length - 1), i = Math.min(Math.floor(f), puntos.length - 2), u = f - i;
      const v = lerp(puntos[i], puntos[i + 1], u);
      pt.setAttribute('cx', k * w); pt.setAttribute('cy', hh - v * hh); pt.style.opacity = k > .01 ? 1 : 0;
    };
    return s;
  };

  /* Red de nodos (personas) conectadas a un centro */
  const red = (padre, n = 46, cx = 540, cy = 760, rad = 470) => {
    const s = h('div', 'abs', null, padre); s.style.inset = '0';
    let svg = `<svg width="1080" height="1920" style="position:absolute;left:0;top:0;overflow:visible">`;
    const nodos = [];
    for (let i = 0; i < n; i++) {
      const a = i * 2.39996, r = rad * Math.sqrt((i + 1) / n) * (.75 + R(i) * .3);
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 1.05;
      nodos.push({ x, y, r: 7 + R(i + 5) * 10 });
      svg += `<line class="ln" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(57,255,136,.35)" stroke-width="2"/>`;
    }
    nodos.forEach((p, i) => { svg += `<circle class="pul" r="5" fill="#fff"/><circle class="nd" cx="${p.x}" cy="${p.y}" r="${p.r}" fill="${R(i + 8) > .4 ? '#39FF88' : '#F2F5F7'}" style="filter:drop-shadow(0 0 8px rgba(57,255,136,.9))"/>`; });
    svg += '</svg>';
    s.innerHTML = svg;
    const lns = [...s.querySelectorAll('.ln')], nds = [...s.querySelectorAll('.nd')], puls = [...s.querySelectorAll('.pul')];
    s.anim = (t, a) => {
      nodos.forEach((p, i) => {
        const k = clamp((t - a - i * .025) / .4);
        const e = E.back(k);
        nds[i].setAttribute('r', Math.max(0, p.r * e)); lns[i].style.opacity = k;
        lns[i].setAttribute('x2', lerp(cx, p.x, E.out(k))); lns[i].setAttribute('y2', lerp(cy, p.y, E.out(k)));
        const u = ((t - a) * .9 + R(i)) % 1;
        puls[i].setAttribute('cx', lerp(p.x, cx, u)); puls[i].setAttribute('cy', lerp(p.y, cy, u)); puls[i].style.opacity = k * Math.sin(u * Math.PI);
      });
    };
    return s;
  };

  /* Titular de dos estados (aparece / se va) */
  const titular = (padre, str, cls, y, opts = {}) => {
    const o = M.texto(padre, str, 'tit ' + cls);
    o.el.classList.add('c'); o.el.style.top = y + 'px';
    o.anim = (t, a, salida = Infinity, extra = {}) => { M.letras(o, t, a, { salida, ...opts, ...extra }); o.el.style.display = t < a - .05 || t > salida + 1 ? 'none' : 'block'; };
    return o;
  };

  return { C, IC, ic, arte, hexav, cursor, ruta, anillos, choque, chispas, explotar, grafica, red, titular };
})();
