/* ═══════════════════════════════════════════════════════════════
   UpGames · Experiencia de la portada y de la ficha
   ───────────────────────────────────────────────────────────────
   • Filas en la portada: "Más descargados esta semana", "Nuevos"
     y "Para Android" (scroll horizontal), antes del catálogo completo.
   • Guía de instalación: la escribe QUIEN PUBLICA (texto paso a paso
     y/o un video tutorial suyo ya publicado en UpGames). UpGames no la
     redacta: solo la muestra en la ficha bajo "Cómo instalarlo".
   • La altura real de la cabecera se publica en --hdr-h (en móvil el
     buscador baja a su propia fila y la cabecera crece).
   Se carga ANTES de script.js: todo lo de script.js se usa en diferido.
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const API = 'https://upgames-production.up.railway.app';
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ls = k => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  const DIA = 864e5;

  // ── Altura real de la cabecera → --hdr-h (barras pegajosas debajo de ella) ──
  function vigilarCabecera() {
    const h = document.getElementById('app-header'); if (!h) return;
    const poner = () => document.documentElement.style.setProperty('--hdr-h', Math.round(h.getBoundingClientRect().height) + 'px');
    poner();
    if (window.ResizeObserver) new ResizeObserver(poner).observe(h); else addEventListener('resize', poner);
  }

  // ── Filas de la portada ──
  const esAndroid = i => {
    const ex = i.extraData || {};
    if (/android/i.test(`${ex.plataforma || ''} ${ex.so || ''}`)) return true;
    return /\b(android|apk|obb|winlator|gamehub|m[óo]vil|mobile)\b/i.test(`${i.title} ${(i.tags || []).join(' ')}`);
  };
  function fila(titulo, sub, items, clase, min = 3) {
    if (typeof createTile !== 'function' || items.length < min) return null;
    const sec = document.createElement('section');
    sec.className = 'ugx-fila' + (clase ? ' ' + clase : '');
    sec.setAttribute('aria-label', titulo);
    sec.innerHTML = `<div class="ugx-fila-h"><h2>${titulo}</h2>${sub ? `<small>${esc(sub)}</small>` : ''}</div><div class="ugx-fila-track" role="list"></div>`;
    const track = sec.querySelector('.ugx-fila-track');
    items.forEach(it => { const t = createTile(it, false); t.setAttribute('role', 'listitem'); track.appendChild(t); });
    return sec;
  }
  // ── Nexus ordena el feed para cada usuario (fórmula en upgames-ranking.js) ──
  // Elecciones del usuario en este teléfono: abrió (v), descargó (d) o guardó (f).
  const ELEC = 'ug_elecciones';
  const leerElec = () => { try { const e = JSON.parse(localStorage.getItem(ELEC) || '[]'); return Array.isArray(e) ? e : []; } catch (_) { return []; } };
  function elegir(it, k) {
    if (!it || !it._id) return;
    const e = { id: it._id, cat: String(it.category || '').toLowerCase(), u: String(it.usuario || '').toLowerCase(), k, t: Date.now() };
    const g = window.UGRank?.juegoDe(it); if (g) e.g = g;
    const gs = window.UGRank?.generos(it); if (gs?.length) e.gs = gs;   // géneros: carreras, terror…
    try { localStorage.setItem(ELEC, JSON.stringify([...leerElec(), e].slice(-300))); } catch (_) {}
  }
  const buscarItem = id => (typeof currentItem !== 'undefined' && currentItem?._id === id) ? currentItem
    : (typeof todosLosItems !== 'undefined' ? todosLosItems.find(i => i._id === id) : null);
  // Gustos aprendidos por Nexus en el servidor (con cuenta): se piden una vez por sesión
  let gustosSrv = null;
  try { gustosSrv = JSON.parse(sessionStorage.getItem('ug_gustos_srv') || 'null'); } catch (_) {}
  (async () => {
    const t = ls('token'); if (!t || gustosSrv) return;
    try {
      const r = await fetch(`${API}/nexus/gustos`, { headers: { Authorization: `Bearer ${t}` } });
      const d = await r.json();
      if (d?.ok) { gustosSrv = d.categorias || {}; sessionStorage.setItem('ug_gustos_srv', JSON.stringify(gustosSrv)); }
    } catch (_) {}
  })();
  let perfilActual = null;
  /** Ordena el catálogo con la fórmula de Nexus y el perfil de este usuario. */
  function ordenar(lista) {
    if (!window.UGRank || !Array.isArray(lista) || lista.length < 2) return lista;
    let desc; try { desc = new Set(JSON.parse(localStorage.getItem('ug_descargadas') || '[]')); } catch (_) { desc = new Set(); }
    perfilActual = window.UGRank.perfil(leerElec(), gustosSrv);
    try { return window.UGRank.ordenar(lista, { perfil: perfilActual, yaDescargadas: desc }); } catch (_) { return lista; }
  }
  const personalizado = () => !!perfilActual && !perfilActual.vacio;
  /** Perfil actual (para el feed de videos). */
  const perfil = () => (window.UGRank ? window.UGRank.perfil(leerElec(), gustosSrv) : null);

  // ── Me gusta (distinto de guardar): estado local + servidor ──
  // ug_megusta: ids con me gusta en este teléfono; ug_megusta_inv: los dados sin cuenta (se suben al entrar)
  const leerIds = k => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (_) { return []; } };
  const guardarIds = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v.slice(-2000))); } catch (_) {} };
  const meGusta = id => leerIds('ug_megusta').includes(id);
  async function darMeGusta(it, quiere) {
    const id = it._id, t = ls('token');
    let ids = leerIds('ug_megusta').filter(x => x !== id);
    if (quiere) { ids.push(id); elegir(it, 'l'); }
    guardarIds('ug_megusta', ids);
    it.meGustaCount = Math.max(0, (it.meGustaCount || 0) + (quiere ? 1 : -1));
    if (!t) {
      let inv = leerIds('ug_megusta_inv').filter(x => x !== id); if (quiere) inv.push(id); guardarIds('ug_megusta_inv', inv);
      if (quiere && inv.length >= 3 && !ls('ug_mg_aviso')) { try { localStorage.setItem('ug_mg_aviso', '1'); } catch (_) {} setTimeout(() => window.ugPedirSesion?.(`no perder tus ${inv.length} me gusta`), 700); }
      return { megusta: quiere, n: it.meGustaCount };
    }
    try {
      const r = await fetch(`${API}/items/${id}/megusta`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify({ megusta: quiere }) });
      const d = await r.json();
      if (d?.success) { it.meGustaCount = d.n; return { megusta: d.megusta, n: d.n }; }
    } catch (_) {}
    return { megusta: quiere, n: it.meGustaCount };
  }
  // Al entrar con cuenta: subir los me gusta dados sin cuenta y traer los propios (otros dispositivos)
  (async () => {
    const t = ls('token'); if (!t) return;
    const inv = leerIds('ug_megusta_inv');
    if (inv.length) {
      try { const r = await fetch(`${API}/megusta/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify({ ids: inv }) }); if (r.ok) localStorage.removeItem('ug_megusta_inv'); } catch (_) {}
    }
    if (sessionStorage.getItem('ug_mg_ok')) return;
    try { const d = await (await fetch(`${API}/megusta/mios`, { headers: { Authorization: `Bearer ${t}` } })).json(); if (d?.success) { guardarIds('ug_megusta', d.ids); sessionStorage.setItem('ug_mg_ok', '1'); } } catch (_) {}
  })();

  // ── Historial: "Continúa donde lo dejaste" (solo en este teléfono, sin cuenta) ──
  const HIST = 'ug_historial';
  const leerHist = () => { try { const h = JSON.parse(localStorage.getItem(HIST) || '[]'); return Array.isArray(h) ? h : []; } catch (_) { return []; } };
  function guardarEnHistorial(it) {
    if (!it || !it._id) return;
    const ex = it.extraData || {};
    const min = { _id: it._id, title: it.title, image: it.image, category: it.category, usuario: it.usuario, linkStatus: it.linkStatus,
      descargasEfectivas: it.descargasEfectivas || 0, likesCount: it.likesCount || 0, vistas: it.vistas || 0, createdAt: it.createdAt, updatedAt: it.updatedAt,
      videoType: it.videoType, link: it.category === 'Video' ? it.link : undefined,
      extraData: { plataforma: ex.plataforma, so: ex.so, size: ex.size, version: ex.version, 'juego-base': ex['juego-base'], duracion: ex.duracion }, t: Date.now() };
    const h = [min, ...leerHist().filter(x => x._id !== it._id)].slice(0, 24);
    try { localStorage.setItem(HIST, JSON.stringify(h)); } catch (_) {}
  }
  addEventListener('ug:detalle', e => { const it = buscarItem(e.detail); guardarEnHistorial(it); elegir(it, 'v'); });
  function filaHistorial() {
    const h = leerHist(); if (!h.length) return null;
    const frescos = typeof todosLosItems !== 'undefined' ? new Map(todosLosItems.map(i => [i._id, i])) : new Map();
    let desc; try { desc = new Set(JSON.parse(localStorage.getItem('ug_descargadas') || '[]')); } catch (_) { desc = new Set(); }
    const items = h.map(x => frescos.get(x._id) || x).filter(i => i.linkStatus !== 'caido').slice(0, 12);
    const sec = fila('⏯ Continúa donde lo dejaste', null, items, 'ugx-fila--hist', 1);
    if (!sec) return null;
    sec.querySelectorAll('.game-tile').forEach(t => { if (desc.has(t.dataset.id)) t.classList.add('ugx-descargado'); });
    const borrar = document.createElement('button');
    borrar.type = 'button'; borrar.className = 'ugx-fila-borrar'; borrar.textContent = 'Borrar';
    borrar.setAttribute('aria-label', 'Borrar historial de este teléfono');
    borrar.onclick = () => { try { localStorage.removeItem(HIST); } catch (_) {} sec.remove(); };
    sec.querySelector('.ugx-fila-h').appendChild(borrar);
    return sec;
  }

  // Al cerrar una ficha, la fila del historial se actualiza sin repintar el catálogo
  addEventListener('ug:detalle-cerrado', () => {
    const out = document.getElementById('output'); if (!out || !out.querySelector('.ugx-fila')) return;
    const nueva = filaHistorial(); if (!nueva) return;
    const vieja = out.querySelector('.ugx-fila--hist');
    if (vieja) vieja.replaceWith(nueva); else out.querySelector('.ugx-fila')?.before(nueva);
    window.UGX?.estilizarTiles?.(nueva);
  });

  // ── Blogs de los creadores: lo último publicado en UpGames Blogs (se pide una vez por visita) ──
  let blogsRecientes = null, blogsPedido = null;
  const miniBlog = u => String(u || '').replace(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(?!.*\/(?:w_|c_))/, '$1f_auto,q_auto,w_480,c_limit/');
  function filaBlogs() {
    if (!blogsRecientes || blogsRecientes.length < 2) return null;
    const sec = document.createElement('section');
    sec.className = 'ugx-fila ugx-fila--blogs';
    sec.setAttribute('aria-label', 'Del blog de los creadores');
    sec.innerHTML = `<div class="ugx-fila-h"><h2>✍️ Del blog de los creadores</h2><small>Guías, reseñas y noticias</small><a class="ugx-fila-borrar" href="./blog.html">Crea el tuyo</a></div><div class="ugx-fila-track" role="list">`
      + blogsRecientes.map(e => `<a class="ugx-blog" role="listitem" href="${esc(e.url)}" target="_blank" rel="noopener">
          <span class="ugx-blog-img"${/^https:\/\//.test(e.portada || '') ? ` style="background-image:url('${esc(miniBlog(e.portada))}')"` : ''}>${e.portada ? '' : '✍️'}</span>
          <b>${esc(e.titulo)}</b><small>${esc(e.blog)} · @${esc(e.usuario)}</small></a>`).join('') + '</div>';
    return sec;
  }
  function pedirBlogs() {
    if (blogsPedido) return;
    blogsPedido = fetch(`${API}/blogs/recientes`).then(r => r.ok ? r.json() : null).then(d => {
      blogsRecientes = d?.success && Array.isArray(d.entradas) ? d.entradas.filter(e => /^https:\/\//.test(e.url || '')) : [];
      // Si la portada ya está pintada, la fila entra al final de las demás sin repintar el catálogo
      const out = document.getElementById('output'), ult = out && [...out.querySelectorAll('.ugx-fila')].pop();
      const sec = ult && !out.querySelector('.ugx-fila--blogs') ? filaBlogs() : null;
      if (sec) ult.after(sec);
    }).catch(() => { blogsRecientes = []; });
  }


  // ── Carrusel «Recomendados para ti» ──
  // Tres entradas a la vez: la del centro crece y muestra sus acciones; las de los lados se ven
  // atenuadas y se desvanecen hacia los bordes. Cada tarjeta es una «ficha» de cristal:
  // portada a sangre, título grande, valoración real, precio («Gratis») y dos acciones.
  const nfK = n => { n = +n || 0; return n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace('.0', '') + 'K' : String(n); };
  const matiz = id => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
  function portadaCarrusel(it) {
    let src = it.image || '';
    try {
      if (typeof isYouTubeUrl === 'function' && isYouTubeUrl(src)) src = getYouTubeThumbnail(src);
      else if (typeof ugEsVideoArchivo === 'function' && ugEsVideoArchivo(src)) src = (typeof ugVideoThumb === 'function' && ugVideoThumb(src)) || '';
    } catch (_) {}
    return typeof cldOpt === 'function' ? cldOpt(src, 'c_fill,g_auto,ar_3:4.4,w_640,q_auto,f_auto') : src;
  }
  function valoracion(it) {
    const r = it.resenas;
    if (r && r.n) { const p = +r.promedio || 0; return { txt: p >= 4.2 ? 'Muy positivas' : p >= 3.5 ? 'Mayormente positivas' : 'Opiniones mixtas', sub: `★ ${p.toFixed(1).replace('.', ',')} · ${nfK(r.n)} reseña${r.n === 1 ? '' : 's'}`, cls: p >= 3.5 ? '' : ' mixta' }; }
    const d = it.descargasEfectivas || 0;
    return { txt: Date.now() - new Date(it.createdAt || 0) < 30 * DIA ? 'Recién llegado' : 'Elegido para ti', sub: d ? `${nfK(d)} descargas` : 'Sé de los primeros en probarlo', cls: '' };
  }
  function filaCarrusel(items) {
    if (items.length < 4 || typeof openDetail !== 'function') return null;
    const n = items.length, reducir = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sec = document.createElement('section');
    sec.className = 'ugc';
    sec.setAttribute('aria-roledescription', 'carrusel'); sec.setAttribute('aria-label', 'Recomendados para ti');
    const fav = id => typeof favIds !== 'undefined' && favIds.includes(id);
    sec.innerHTML = `<div class="ugc-h"><span class="ugc-eyebrow">Recomendados para ti</span><h2>Elegidos por Nexus</h2></div>
      <div class="ugc-vp" tabindex="0" aria-live="off">${items.map((it, i) => {
        const v = valoracion(it), cat = it.category || 'General';
        return `<article class="ugc-card" data-i="${i}" style="--h:${matiz(it._id)}" aria-label="${esc(it.title)}">
          <img class="ugc-card-bg" src="${esc(portadaCarrusel(it))}" alt="" loading="${i < 3 ? 'eager' : 'lazy'}" decoding="async" draggable="false" onerror="this.onerror=null;this.src=window.UG_PH||''">
          <div class="ugc-card-tint"></div>
          <div class="ugc-card-top"><span class="ugc-chip">${esc(cat)}</span></div>
          <div class="ugc-card-main">
            <h3 class="ugc-card-t">${esc((it.serieInfo?.base || it.title || '').slice(0, 70))}</h3>
            <p class="ugc-card-by">@${esc(it.usuario || '')}</p>
            <div class="ugc-card-panel">
              <div class="ugc-card-val${v.cls}"><b>${esc(v.txt)}</b><small>${esc(v.sub)}</small></div>
              <div class="ugc-card-precio"><strong>Gratis</strong><small>Sin cuenta ni tarjeta</small></div>
              <div class="ugc-card-acc">
                <button type="button" class="ugc-btn ugc-btn--pri" data-ver tabindex="-1">Ver más</button>
                <button type="button" class="ugc-btn ugc-btn--vidrio${fav(it._id) ? ' on' : ''}" data-fav aria-label="Guardar en favoritos" tabindex="-1"><ion-icon name="${fav(it._id) ? 'heart' : 'heart-outline'}"></ion-icon></button>
              </div>
            </div>
          </div>
        </article>`; }).join('')}</div>
      <div class="ugc-dots" role="tablist">${items.map((_, i) => `<button type="button" role="tab" aria-label="Entrada ${i + 1}" data-dot="${i}"></button>`).join('')}</div>`;

    // El tinte de cada ficha toma el color dominante de su portada (si el servidor de la imagen lo permite)
    const tonoDe = (card, src) => {
      try {
        const im = new Image(); im.crossOrigin = 'anonymous';
        im.onload = () => { try {
          const c = document.createElement('canvas'); c.width = c.height = 8; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, 8, 8);
          const d = x.getImageData(0, 0, 8, 8).data; let r = 0, g = 0, b = 0, w = 0;
          for (let i = 0; i < d.length; i += 4) { const k = 1 + (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2])) / 40; r += d[i] * k; g += d[i + 1] * k; b += d[i + 2] * k; w += k; }
          r /= w; g /= w; b /= w; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx - mn < 14) return;   // casi gris: se queda el tinte base
          const h = mx === r ? ((g - b) / (mx - mn) + 6) % 6 : mx === g ? (b - r) / (mx - mn) + 2 : (r - g) / (mx - mn) + 4;
          card.style.setProperty('--h', Math.round(h * 60));
        } catch (_) {} };
        im.src = src;
      } catch (_) {}
    };
    const idle = window.requestIdleCallback || (f => setTimeout(f, 300));
    idle(() => sec.querySelectorAll('.ugc-card').forEach((c, i) => { const src = portadaCarrusel(items[i]); if (/^https:/.test(src)) tonoDe(c, src); }));

    const vp = sec.querySelector('.ugc-vp'), cards = [...sec.querySelectorAll('.ugc-card')], dots = [...sec.querySelectorAll('[data-dot]')];
    let idx = 0, timer = null, arrastre = null, visible = true, quieto = false;
    // Distancia circular: la entrada anterior a la primera es la última (carrusel sin fin)
    const dist = i => { let d = (i - idx) % n; if (d > n / 2) d -= n; if (d < -n / 2) d += n; return d; };
    function pintar() {
      cards.forEach((c, i) => {
        const d = dist(i);
        c.style.setProperty('--d', d);
        c.dataset.pos = d === 0 ? 'centro' : Math.abs(d) === 1 ? 'lado' : 'lejos';
        c.setAttribute('aria-hidden', d === 0 ? 'false' : 'true');
        c.querySelectorAll('button').forEach(b => { b.tabIndex = d === 0 ? 0 : -1; });
      });
      dots.forEach((b, i) => { b.classList.toggle('on', i === idx); b.setAttribute('aria-selected', i === idx); });
    }
    const ir = i => { idx = (i + n) % n; pintar(); };
    pintar();
    const arrancar = () => { clearTimeout(timer); if (reducir) return; timer = setTimeout(() => { if (!sec.isConnected) return; if (!document.hidden && visible && !quieto) ir(idx + 1); arrancar(); }, 5200); };
    if ('IntersectionObserver' in window) new IntersectionObserver(e => { visible = e[0].isIntersecting; }, { threshold: .4 }).observe(sec);
    arrancar();

    // Toque: izquierda/derecha cambian de entrada; tocar una lateral la trae al centro
    vp.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; arrastre = { x: e.clientX, y: e.clientY, mov: false }; quieto = true; });
    vp.addEventListener('pointermove', e => { if (arrastre && Math.abs(e.clientX - arrastre.x) > 8) arrastre.mov = true; });
    const soltar = e => {
      if (!arrastre) return; const dx = e.clientX - arrastre.x, a = arrastre; arrastre = null;
      setTimeout(() => { quieto = false; }, 4000);
      if (a.mov && Math.abs(dx) > 36) { ir(idx + (dx < 0 ? 1 : -1)); a.mov = 'hecho'; vp._swipe = Date.now(); }
    };
    vp.addEventListener('pointerup', soltar); vp.addEventListener('pointercancel', () => { arrastre = null; quieto = false; });
    vp.addEventListener('mouseenter', () => { quieto = true; }); vp.addEventListener('mouseleave', () => { quieto = false; });
    vp.addEventListener('focusin', () => { quieto = true; }); vp.addEventListener('focusout', () => { quieto = false; });
    vp.addEventListener('keydown', e => { if (e.key === 'ArrowRight') { ir(idx + 1); e.preventDefault(); } else if (e.key === 'ArrowLeft') { ir(idx - 1); e.preventDefault(); } });
    vp.addEventListener('click', e => {
      if (vp._swipe && Date.now() - vp._swipe < 350) return;
      const c = e.target.closest('.ugc-card'); if (!c) return;
      const i = +c.dataset.i, it = items[i];
      if (i !== idx) return ir(i);
      const f = e.target.closest('[data-fav]');
      if (f) { e.stopPropagation(); if (typeof window.fav === 'function') window.fav(it._id); const on = !f.classList.contains('on'); f.classList.toggle('on', on); f.querySelector('ion-icon')?.setAttribute('name', on ? 'heart' : 'heart-outline'); return; }
      elegir(it, 'v'); openDetail(it);
    });
    sec.querySelector('.ugc-dots').addEventListener('click', e => { const b = e.target.closest('[data-dot]'); if (b) { ir(+b.dataset.dot); quieto = true; setTimeout(() => { quieto = false; }, 4000); } });
    return sec;
  }

  /** Agrega las filas a `frag` (antes del catálogo). Devuelve cuántas se agregaron. */
  function filas(frag, lista) {
    const hist = filaHistorial();
    if (hist) frag.appendChild(hist);
    const base = lista.filter(i => i.category !== 'Video');
    if (base.length < 8) return hist ? 1 : 0;
    const top = [...base].filter(i => (i.descargasSemana || 0) > 0).sort((a, b) => b.descargasSemana - a.descargasSemana).slice(0, 12);
    const hayTopSemana = top.length >= 3;
    const masDesc = hayTopSemana ? top : [...base].filter(i => i.descargasEfectivas > 0).sort((a, b) => b.descargasEfectivas - a.descargasEfectivas).slice(0, 12);
    const nuevos = [...base].filter(i => i.createdAt && Date.now() - new Date(i.createdAt) < 45 * DIA)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 12);
    const android = base.filter(esAndroid).sort((a, b) => (b.descargasSemana || 0) - (a.descargasSemana || 0) || (b.descargasEfectivas || 0) - (a.descargasEfectivas || 0)).slice(0, 12);
    // Recomendados: lo que Nexus ya puso arriba en el orden de este usuario, sin repetir lo de las filas de arriba
    const yaEnFilas = new Set([...masDesc, ...nuevos].map(i => i._id));
    const conPortada = base.filter(i => i.image && !/\.(mp4|webm|mov)(\?|$)/i.test(i.image));
    const recom = conPortada.filter(i => !yaEnFilas.has(i._id)).slice(0, 9);
    const recomFinal = recom.length >= 4 ? recom : conPortada.slice(0, 9);
    const secs = [
      fila(hayTopSemana ? '🔥 Más descargados esta semana' : '🔥 Más descargados', hayTopSemana ? 'Lo que más baja la comunidad estos 7 días' : 'Lo favorito de la comunidad', masDesc, 'ugx-fila--top'),
      fila('🆕 Nuevos', 'Recién publicados', nuevos),
      filaCarrusel(recomFinal),   // dos filas por debajo del carrusel principal, para que no compitan
      fila('📱 Para Android', 'Juegos, mods y apps para tu móvil', android),
      filaBlogs(),
    ].filter(Boolean);
    pedirBlogs();
    secs.forEach(s => frag.appendChild(s));
    if (secs.length || hist) requestAnimationFrame(() => window.UGX?.estilizarTiles?.(document.getElementById('output')));
    return secs.length + (hist ? 1 : 0);
  }

  // ── Guía de instalación: formulario (publicar y editar) ──
  let misVideos = null;
  async function cargarMisVideos() {
    if (misVideos) return misVideos;
    const u = ls('user_admin'), t = ls('token');
    if (!u || !t) return [];
    try {
      const r = await fetch(`${API}/items/user/${encodeURIComponent(u)}`, { headers: { Authorization: `Bearer ${t}` } });
      const d = await r.json();
      misVideos = (Array.isArray(d) ? d : []).filter(i => i.category === 'Video' && i.status !== 'rechazado')
        .map(i => ({ id: i._id, t: i.title || 'Video' }));
    } catch (_) { misVideos = []; }
    return misVideos;
  }
  function pintarFormulario(zona) {
    const p = zona.dataset.guia;
    zona.innerHTML = `
      <div class="ugx-gf-h"><ion-icon name="construct-outline"></ion-icon><b>Guía de instalación</b><small>opcional · la escribes tú</small></div>
      <p class="ugx-gf-ayuda">Quienes descargan se pierden al instalar (Winlator, GameHub, OBB, parches…). Explícalo con tus palabras o enlaza un video tuyo ya publicado en UpGames.</p>
      <label class="pf-label" for="${p}-tutorial">Video tutorial (tuyo, publicado en UpGames)</label>
      <select id="${p}-tutorial" class="pf-input ugx-gf-sel"><option value="">— Sin video tutorial —</option></select>
      <small class="ugx-gf-nota" id="${p}-tutorial-nota"></small>
      <label class="pf-label" for="${p}-guia" style="margin-top:12px">Pasos de instalación</label>
      <textarea id="${p}-guia" class="pf-textarea ugx-gf-txt" maxlength="3000" rows="5" placeholder="1. Descarga e instala Winlator 9.0&#10;2. Copia la carpeta del juego en Download/Winlator&#10;3. En Winlator crea un contenedor con Box64 = Performance&#10;4. Abre el .exe y en Ajustes pon 30 FPS"></textarea>
      <small class="ugx-gf-n" id="${p}-guia-n">0 / 3000</small>`;
    const ta = zona.querySelector('textarea'), n = zona.querySelector('.ugx-gf-n');
    ta.addEventListener('input', () => { n.textContent = `${ta.value.length} / 3000`; });
    llenarVideos(p);
  }
  async function llenarVideos(p, elegido) {
    const sel = document.getElementById(`${p}-tutorial`); if (!sel) return;
    const vids = await cargarMisVideos();
    const actual = elegido ?? sel.value;
    sel.innerHTML = '<option value="">— Sin video tutorial —</option>' + vids.map(v => `<option value="${esc(v.id)}">${esc(v.t.slice(0, 70))}</option>`).join('');
    if (actual && !vids.some(v => v.id === actual)) sel.insertAdjacentHTML('beforeend', `<option value="${esc(actual)}">Video elegido antes</option>`);
    sel.value = actual || '';
    const nota = document.getElementById(`${p}-tutorial-nota`);
    if (nota) nota.textContent = vids.length ? '' : 'Aún no tienes videos publicados. Sube uno en la categoría Video y luego elígelo aquí.';
  }
  function leerGuia(p) {
    const ta = document.getElementById(`${p}-guia`), sel = document.getElementById(`${p}-tutorial`);
    if (!ta && !sel) return {};
    return { guiaInstalacion: (ta?.value || '').trim(), tutorialId: sel?.value || '' };
  }
  function ponerGuia(p, item) {
    misVideos = null;   // pudo publicar un video nuevo desde la última vez
    const ta = document.getElementById(`${p}-guia`);
    if (ta) { ta.value = item?.guiaInstalacion || ''; ta.dispatchEvent(new Event('input')); }
    llenarVideos(p, item?.tutorialId || '');
  }
  function limpiarGuia(p) { ponerGuia(p, null); }

  // ── Guía de instalación: ficha del contenido ──
  let pedido = 0;
  async function guiaDetalle(item) {
    const caja = document.getElementById('ds-guia'); if (!caja) return;
    const n = ++pedido;
    caja.hidden = true; caja.innerHTML = '';
    if (!item || item.category === 'Video' || !(item.tieneGuia || item.guiaInstalacion || item.tutorialId)) return;
    let guia = item.guiaInstalacion, tut = item.tutorialId;
    if (guia === undefined && item.tieneGuia) {
      try { const r = await fetch(`${API}/items/${item._id}`); if (r.ok) { const d = await r.json(); guia = d.guiaInstalacion || ''; tut = d.tutorialId || tut; item.guiaInstalacion = guia; } } catch (_) {}
    }
    if (n !== pedido || (!guia && !tut)) return;
    const todos = typeof todosLosItems !== 'undefined' ? todosLosItems : [];
    let video = tut ? todos.find(i => i._id === tut) : null;
    if (tut && !video) { try { const r = await fetch(`${API}/items/${tut}`); if (r.ok) video = await r.json(); } catch (_) {} }
    if (n !== pedido) return;
    if (video && (video.category !== 'Video' || video.usuario !== item.usuario)) video = null;
    const pasos = guia ? esc(guia).replace(/\n/g, '<br>') : '';
    const mini = video ? (typeof cldOpt === 'function' ? cldOpt(video.image || '', 'c_fill,g_auto,w_320,h_180,q_auto,f_auto') : video.image) : '';
    caja.innerHTML = `
      <details class="ugx-guia" open>
        <summary><ion-icon name="construct-outline"></ion-icon><b>Cómo instalarlo</b><small>guía de @${esc(item.usuario)}</small></summary>
        ${video ? `<button type="button" class="ugx-guia-vid" data-id="${esc(video._id)}">
            <span class="ugx-guia-mini">${mini ? `<img src="${esc(mini)}" alt="" loading="lazy" decoding="async">` : ''}<ion-icon name="play-circle"></ion-icon></span>
            <span><small>Video tutorial</small><b>${esc(video.title || 'Ver tutorial')}</b></span></button>` : ''}
        ${pasos ? `<div class="ugx-guia-txt">${pasos}</div>` : ''}
      </details>`;
    caja.hidden = false;
    const b = caja.querySelector('.ugx-guia-vid');
    if (b) b.onclick = () => { if (typeof closeDetail === 'function') closeDetail(); setTimeout(() => typeof openDetail === 'function' && openDetail(video), 320); };
  }

  // Descargas y favoritos también son elecciones (se envuelven las funciones de script.js)
  function engancharElecciones() {
    if (typeof window.marcarDescargada === 'function' && !window.marcarDescargada._ug) {
      const orig = window.marcarDescargada;
      window.marcarDescargada = function (id) { elegir(buscarItem(id), 'd'); return orig.apply(this, arguments); };
      window.marcarDescargada._ug = true;
    }
    if (typeof window.fav === 'function' && !window.fav._ug) {
      const orig = window.fav;
      window.fav = function (id) {
        let antes; try { antes = JSON.parse(localStorage.getItem('favoritos') || '[]').includes(id); } catch (_) { antes = false; }
        if (!antes) elegir(buscarItem(id), 'f');
        return orig.apply(this, arguments);
      };
      window.fav._ug = true;
    }
  }

  function iniciar() {
    vigilarCabecera();
    engancharElecciones();
    document.querySelectorAll('.ugx-guia-form').forEach(pintarFormulario);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();

  window.UGUX = { filas, guiaDetalle, leerGuia, ponerGuia, limpiarGuia, ordenar, personalizado, perfil, meGusta, darMeGusta };
})();
