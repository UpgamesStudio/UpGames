#!/usr/bin/env node
/**
 * Prueba la biblioteca en un navegador real con el CATÁLOGO REAL de producción e imágenes reales de Cloudinary.
 * Atrapa lo que las pruebas con datos inventados no ven (como el recorte inválido de Cloudinary o el carrusel
 * que abría otra publicación). Uso: node test/real/portada.js   (API=https://… para otro servidor)
 */
'use strict';
const { servir, navegador, contador } = require('./util');
const API = (process.env.API || 'https://upgames-production.up.railway.app').replace(/\/+$/, '');
const espera = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const C = contador('Portada y ficha con el catálogo real');
  const web = await servir(), b = await navegador();
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  const errores = [], imgsMal = new Set();
  p.on('pageerror', e => errores.push(e.message));
  p.on('response', r => { if (/res\.cloudinary\.com\/.+\/image\/upload\//.test(r.url()) && r.status() >= 400) imgsMal.add(`${r.status()} ${r.url()}`); });
  // El catálogo y las fichas vienen de producción; el resto de la API (sesión, notificaciones…) se responde vacío
  await ctx.route('**/*', async r => {
    const u = r.request().url();
    if (u.startsWith(web.url) || /res\.cloudinary|fonts\.g|unpkg|ytimg|youtube/.test(u)) return r.continue();
    if (process.env.DEPURAR && u.startsWith(API)) console.log('    API', r.request().method(), u);
    if (u.startsWith(API) && r.request().method() === 'GET' && !/\/(m|errores)\//.test(u)) {   // toda lectura va a producción (catálogo, fichas, reseñas…)
      try { const h = { ...r.request().headers(), origin: 'https://upgames.games', referer: 'https://upgames.games/public/biblioteca.html' };   // producción solo acepta su propio origen
        const resp = await r.fetch({ headers: h }); return r.fulfill({ status: resp.status(), body: await resp.body(), contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } }); } catch (e) { console.log('    (no se pudo pedir ' + u + ': ' + e.message.split('\n')[0] + ')'); return r.abort(); }
    }
    return r.fulfill({ status: 200, body: '[]', contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
  });

  await p.goto(`${web.url}/biblioteca.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => document.querySelectorAll('#output .game-tile').length > 3, null, { timeout: 30000 }).catch(() => {});
  const n = await p.evaluate(() => typeof todosLosItems !== 'undefined' ? todosLosItems.length : 0);
  if (!C.prueba('el catálogo real cargó', n > 3, `publicaciones: ${n}`)) { await b.close(); web.cerrar(); process.exit(1); }
  await espera(1500);

  C.seccion('Carrusel «Recomendados para ti»');
  const hayCar = await p.$('.ugc');
  if (C.prueba('aparece', !!hayCar)) {
    await p.locator('.ugc').scrollIntoViewIfNeeded(); await espera(2500);
    // Recorre todas las tarjetas para que carguen sus portadas
    const total = await p.evaluate(() => document.querySelectorAll('.ugc-card').length);
    for (let i = 0; i < total; i++) { await p.evaluate(i => document.querySelector(`.ugc-dots [data-dot="${i}"]`).click(), i); await espera(350); }
    await espera(1200);
    const img = await p.evaluate(() => [...document.querySelectorAll('.ugc-card-bg')].map(i => ({ ok: i.complete && i.naturalWidth > 0 && /res\.cloudinary|^https:/.test(i.currentSrc) && !/UG_PH|placeholder|data:/.test(i.currentSrc), src: i.currentSrc })));
    C.prueba(`todas las portadas cargan (${img.filter(x => x.ok).length}/${img.length})`, img.every(x => x.ok), img.filter(x => !x.ok).map(x => x.src).join(' · '));
    for (let k = 0; k < 3; k++) {
      await espera(600);
      const t = await p.evaluate(() => document.querySelector('.ugc-card[data-pos="centro"] .ugc-card-t').textContent);
      await p.locator('.ugc-card[data-pos="centro"] [data-ver]').click(); await espera(1000);
      const f = await p.evaluate(() => document.getElementById('ds-title').textContent);
      C.prueba(`«Ver más» abre la misma publicación (${t.slice(0, 30)})`, t.trim() === f.trim() || f.includes(t.trim()), `tarjeta «${t}» → ficha «${f}»`);
      await p.goBack(); await espera(600);
      await p.evaluate(() => document.querySelector('.ugc-dots [data-dot].on').nextElementSibling?.click());
    }
  }

  C.seccion('Carrusel principal');
  await p.evaluate(() => { for (let i = 0; i < 3; i++) render(todosLosItems); });   // repintados, como al filtrar
  await espera(800); await p.evaluate(() => scrollTo(0, 0)); await espera(300);
  const deslizar = () => p.evaluate(() => { const el = document.getElementById('hero-carousel'), r = el.getBoundingClientRect(), y = r.top + r.height / 2;
    const ev = (t, x) => new TouchEvent(t, { bubbles: true, touches: t === 'touchend' ? [] : [new Touch({ identifier: 1, target: el, clientX: x, clientY: y })], changedTouches: [new Touch({ identifier: 1, target: el, clientX: x, clientY: y })] });
    el.dispatchEvent(ev('touchstart', r.left + r.width * .8)); el.dispatchEvent(ev('touchend', r.left + r.width * .2)); });
  for (let k = 0; k < 2; k++) {
    const a = await p.evaluate(() => heroIdx); await deslizar(); await espera(700);
    const d = await p.evaluate(() => heroIdx), largo = await p.evaluate(() => heroItems.length);
    C.prueba('un deslizamiento avanza una sola entrada', (a + 1) % largo === d, `${a} → ${d}`);
    const vis = await p.evaluate(() => heroItems[heroIdx].title);
    await p.locator('#hero-carousel').tap(); await espera(900);
    const f = await p.evaluate(() => document.getElementById('detail-sheet').classList.contains('open') ? document.getElementById('ds-title').textContent : '(cerrada)');
    C.prueba('tocar abre la entrada que se ve', f.trim() === vis.trim() || f === '(cerrada)', `se ve «${vis}» → abre «${f}»`);
    if (f !== '(cerrada)') { await p.goBack(); await espera(600); }
  }

  C.seccion('Carrusel principal: diseño y filas retiradas');
  const dis = await p.evaluate(() => { const c = document.getElementById('hero-carousel'), d = [...c.querySelectorAll('.hero-dot')], sl = [...c.querySelectorAll('.hero-slide')];
    return { barras: d.length, activas: d.filter(x => x.classList.contains('active')).length, enMarcha: !!d.find(x => x.classList.contains('active')) && getComputedStyle(d.find(x => x.classList.contains('active')), '::after').animationName,
      slides: sl.length, conCta: sl.every(x => x.querySelector('.hero-cta') && x.querySelector('.hero-top .hero-badge')), enfocadas: sl.filter(x => x.classList.contains('is-on')).length, alto: c.getBoundingClientRect().height, ancho: c.getBoundingClientRect().width }; });
  C.prueba('una barra de progreso por entrada y solo una activa, con su animación', dis.barras === dis.slides && dis.activas === 1 && dis.enMarcha === 'heroLlena', JSON.stringify(dis));
  C.prueba('cada entrada trae su puesto y el botón «Ver ahora»', dis.conCta, JSON.stringify(dis));
  C.prueba('solo la portada que se ve tiene el zoom', dis.enfocadas === 1, String(dis.enfocadas));
  C.prueba('la tarjeta es alta (se ve la portada, no una franja)', dis.alto / dis.ancho > .7, `${Math.round(dis.alto)}×${Math.round(dis.ancho)}`);
  const fade = await p.evaluate(() => { const i = document.querySelector('#hero-carousel .hero-slide img'), c = document.getElementById('hero-carousel'), cs = getComputedStyle(i), cc = getComputedStyle(c);
    return { mascara: cs.maskImage || cs.webkitMaskImage, borde: cc.borderTopWidth, sombra: cc.boxShadow }; });
  C.prueba('los bordes de la portada se desvanecen (máscara horizontal) y sin marco', /linear-gradient/.test(fade.mascara) && fade.borde === '0px' && fade.sombra === 'none', JSON.stringify(fade));
  const filasTit = await p.evaluate(() => [...document.querySelectorAll('.ugx-fila h2, .section-title')].map(e => e.textContent.trim()).join(' | '));
  C.prueba('ya no hay fila «Continúa donde lo dejaste»', !/contin[uú]a donde/i.test(filasTit), filasTit);
  C.prueba('ya no hay fila «Para Android»', !/para android/i.test(filasTit), filasTit);

  C.seccion('Ficha de la publicación');
  const item = await p.evaluate(() => { const it = todosLosItems.find(i => i.category !== 'Video' && i.image); openDetail(it); return { id: it._id, t: it.title }; });
  await espera(1500);
  const ficha = await p.evaluate(() => ({ titulo: document.getElementById('ds-title').textContent, dl: document.getElementById('ds-download').getAttribute('href') || '', panel: !!document.querySelector('#ds-tienda .dst-panel #ds-download'), val: document.getElementById('dst-val')?.textContent || '', url: location.search }));
  C.prueba('muestra el título correcto', ficha.titulo === item.t, ficha.titulo);
  C.prueba('«Obtener link» va a la página puente de esa publicación', ficha.dl.startsWith(`puente.html?id=${item.id}`), ficha.dl);
  C.prueba('panel de cristal con el botón de descarga', ficha.panel);
  C.prueba('valoración o datos reales', ficha.val.trim().length > 3, ficha.val);
  C.prueba('sin botón «Comprar»', !(await p.$('#ds-buy-btn, .sheet-buy-btn, #buy-modal-overlay')));
  C.prueba('la URL lleva ?id= (se puede compartir)', ficha.url.includes(`id=${item.id}`), ficha.url);
  await p.goBack(); await espera(700);
  const tras = await p.evaluate(() => ({ abierta: document.getElementById('detail-sheet').classList.contains('open'), url: location.href }));
  C.prueba('«atrás» cierra la ficha sin salir de la biblioteca', !tras.abierta && /biblioteca\.html/.test(tras.url) && !/id=/.test(tras.url), JSON.stringify(tras));
  await p.goForward(); await espera(900);
  C.prueba('«adelante» la vuelve a abrir', await p.evaluate(() => document.getElementById('detail-sheet').classList.contains('open')));
  await p.evaluate(() => closeDetail()); await espera(600);
  C.prueba('cerrar con la X limpia la URL', await p.evaluate(() => !location.search.includes('id=')));

  C.seccion('Enlace compartido');
  const p2 = await ctx.newPage(); p2.on('pageerror', e => errores.push(e.message));
  await p2.goto(`${web.url}/biblioteca.html?id=${item.id}`, { waitUntil: 'domcontentloaded' });
  await p2.waitForFunction(() => document.getElementById('detail-sheet')?.classList.contains('open'), null, { timeout: 25000 }).catch(() => {});
  const abre = await p2.evaluate(() => ({ url: location.href, hoja: !!document.getElementById('detail-sheet'), abierta: !!document.getElementById('detail-sheet')?.classList.contains('open'), titulo: document.getElementById('ds-title')?.textContent || '' }));
  C.prueba('abre directo la ficha', abre.abierta && !!abre.titulo, JSON.stringify(abre));
  await p2.goBack(); await espera(700);
  C.prueba('«atrás» deja el catálogo detrás (no sale de UpGames)', await p2.evaluate(() => !document.getElementById('detail-sheet').classList.contains('open') && /biblioteca\.html/.test(location.href)));
  await p2.close();

  C.seccion('El inicio recuerda dónde ibas');
  await p.evaluate(() => scrollTo({ top: Math.min(1400, document.documentElement.scrollHeight - innerHeight - 50), behavior: 'instant' })); await espera(500);
  const y0 = await p.evaluate(() => scrollY);
  await p.evaluate(() => switchTab('favs')); await espera(300);
  await p.evaluate(() => switchTab('main')); await espera(400);
  const y1 = await p.evaluate(() => scrollY);
  C.prueba('al volver de otra pestaña', Math.abs(y1 - y0) < 60, `antes ${y0} · después ${y1}`);
  await p.evaluate(() => scrollTo({ top: Math.min(1200, document.documentElement.scrollHeight - innerHeight - 80), behavior: 'instant' })); await espera(600);
  const yR = await p.evaluate(() => scrollY);
  await p.reload({ waitUntil: 'domcontentloaded' }); await espera(7000);
  const y2 = await p.evaluate(() => scrollY);
  C.prueba('al recargar o volver de otra página', Math.abs(y2 - yR) < 80, `antes ${yR} · después ${y2}`);

  C.seccion('Salud general');
  C.prueba('sin imágenes rotas de Cloudinary (4xx/5xx)', imgsMal.size === 0, [...imgsMal].slice(0, 3).join('\n'));
  C.prueba('sin errores de JavaScript', errores.length === 0, errores.slice(0, 3).join('\n'));

  await b.close(); web.cerrar();
  process.exit(C.fin() ? 1 : 0);
})().catch(e => { console.error('FALLO', e); process.exit(1); });
