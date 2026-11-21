#!/usr/bin/env node
/**
 * Capturas REALES de Lurveta en producción (https://upgames.games) para el film de lanzamiento.
 *   node capturar.js            todas
 *   node capturar.js home ficha solo esas
 * Teléfono: 390×844 a 3× (1170×2532). Escritorio: 1920×1080.
 * No toca el servidor: solo lee. Las publicaciones que aún se titulan con la marca anterior
 * («UPGAMES…») se quitan de lo que ve el navegador para que no aparezcan en las tomas del producto.
 * Las vistas que piden cuenta se abren con una sesión de muestra (@lurveta, la cuenta oficial): la
 * interfaz es la real; los datos que dependen de la cuenta (saldo…) no se muestran en el film.
 */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const WEB = 'https://upgames.games', API = 'https://upgames-production.up.railway.app';
const OUT = path.join(__dirname, 'capturas');
const espera = ms => new Promise(r => setTimeout(r, ms));
const VIEJA = /UPGAMES/i;

// La portada guardada de LURVETA RACING aún lleva el arte anterior: se usa el arte oficial actual del juego
const ARTE_ACTUAL = { '6aee9550d50e6d2754da3616': WEB + '/games/monoplaza/logo.webp' };
function limpiar(d) {   // quita de cualquier respuesta las publicaciones con la marca anterior
  const ok = x => !(x && typeof x === 'object' && VIEJA.test(String(x.title || x.titulo || '')));
  if (d && typeof d === 'object' && !Array.isArray(d) && ARTE_ACTUAL[d._id]) { d.image = ARTE_ACTUAL[d._id]; if (Array.isArray(d.capturas)) d.capturas = d.capturas.filter(u => !/RACING|upgames/i.test(u)); }
  if (Array.isArray(d)) return d.filter(ok).map(limpiar);
  if (d && typeof d === 'object') { for (const k of Object.keys(d)) if (Array.isArray(d[k]) || (d[k] && typeof d[k] === 'object')) d[k] = limpiar(d[k]); }
  return d;
}

async function contexto(b, { movil = true, sesion = false, w = 390, h = 844, dpr = 3 } = {}) {
  const c = await b.newContext(movil ? { viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true, serviceWorkers: 'block', locale: 'es-CO' }
    : { viewport: { width: w, height: h }, deviceScaleFactor: dpr, serviceWorkers: 'block', locale: 'es-CO' });
  await c.addInitScript(ses => { try {
    localStorage.setItem('upgames_tutorial_done', '1'); localStorage.setItem('ug_onb_hecho', '1'); localStorage.setItem('upgames_terms_v', '8.5');
    localStorage.setItem('ug_ab_bienv', '1'); localStorage.setItem('ug_pistas', JSON.stringify({ 'guia-fab': 1 })); localStorage.setItem('ug_mus_off', '1');
    if (ses) { localStorage.setItem('token', 'muestra-de-sesion-para-capturas-0000000000'); localStorage.setItem('user_admin', 'lurveta'); }
  } catch {} }, sesion);
  await c.route(u => u.href.startsWith(API) && !/\/(nexus\/buscar)/.test(u.pathname), async r => {
    // Sesión de muestra: lo que pide cuenta no se consulta (la interfaz queda tal cual, sin datos de cuenta)
    if (sesion && r.request().headers().authorization) return r.abort();
    if (r.request().method() !== 'GET') return r.continue();
    try {
      const resp = await r.fetch(); const ct = resp.headers()['content-type'] || '';
      if (!ct.includes('json')) return r.fulfill({ response: resp });
      r.fulfill({ response: resp, body: JSON.stringify(limpiar(await resp.json())) });
    } catch (_) { r.continue().catch(() => {}); }
  });
  return c;
}
async function abrir(c, url, ms = 6500) {
  const p = await c.newPage(); p.on('pageerror', e => console.log('   (error de la página)', e.message.slice(0, 90)));
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); await espera(ms);
  await p.evaluate(() => { const s = [...document.querySelectorAll('button,a')].find(x => /^Saltar$/.test(x.textContent.trim()) && x.offsetParent); s && s.click(); });
  await p.addStyleTag({ content: '#tut-fab,.ugm,.ugg-pista,.ug-pista,[class*="pista"]{display:none!important}' }).catch(() => {});
  await espera(400);
  return p;
}
// Posiciones de los elementos clave en cada captura (en píxeles de la captura), para encuadres y resaltados del film
const MEDIDAS = (() => { try { return JSON.parse(fs.readFileSync(path.join(OUT, 'medidas.json'), 'utf8')); } catch (_) { return {}; } })();
async function medir(p, nombre, sel = {}, txt = {}) {
  const dpr = await p.evaluate(() => devicePixelRatio);
  MEDIDAS[nombre] = await p.evaluate(([sel, txt, dpr]) => {
    const caja = e => { if (!e) return null; const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(v => Math.round(v * dpr)); };
    const porTexto = (t, minW) => {
      const todos = [...document.querySelectorAll('body *')].filter(e => e.offsetParent !== null && e.children.length <= 3 && (e.textContent || '').trim().startsWith(t));
      let e = todos.sort((a, b) => a.textContent.length - b.textContent.length)[0];
      while (e && minW && e.getBoundingClientRect().width < minW && e.parentElement) e = e.parentElement;
      return e;
    };
    const o = {};
    for (const [k, q] of Object.entries(sel)) o[k] = q.endsWith('*') ? [...document.querySelectorAll(q.slice(0, -1))].filter(e => e.offsetParent !== null).map(caja) : caja(document.querySelector(q));
    for (const [k, [t, minW]] of Object.entries(txt)) o[k] = caja(porTexto(t, minW));
    return o;
  }, [sel, txt, dpr]);
  fs.writeFileSync(path.join(OUT, 'medidas.json'), JSON.stringify(MEDIDAS, null, 1));
}
const foto = async (p, nombre, op = {}) => { await p.screenshot({ path: path.join(OUT, nombre + '.png'), timeout: 180000, ...op }); console.log('  ✓', nombre); };
// Toma larga del contenido sin las piezas fijas (para desplazarla dentro del teléfono del film)
async function largo(p, nombre, alto = 2600) {
  await p.addStyleTag({ content: '#app-header,#bottom-nav{visibility:hidden!important}' });
  await p.setViewportSize({ width: 390, height: alto }); await espera(1800);
  await foto(p, nombre);
  await p.setViewportSize({ width: 390, height: 844 });
  await p.addStyleTag({ content: '#app-header,#bottom-nav{visibility:visible!important}' });
}

const TOMAS = {
  async home(b) {
    const c = await contexto(b), p = await abrir(c, WEB + '/');
    await p.evaluate(() => heroGoTo && heroGoTo(0)); await espera(900);
    await foto(p, 'm-home'); await medir(p, 'm-home', { busca: '.search-bar', cats: '#category-row', hero: '#hero-carousel', fila: '.ugx-fila' });
    await p.locator('#app-header').screenshot({ path: path.join(OUT, 'm-cabecera.png') });
    await p.locator('#bottom-nav').screenshot({ path: path.join(OUT, 'm-barra.png') });
    for (const [i, cat] of [[2, 'juegos'], [3, 'mods'], [4, 'apps'], [6, 'herramientas']]) {
      await p.tap(`#category-row .chip:nth-child(${i})`); await espera(1600); await foto(p, 'm-cat-' + cat);
    }
    await p.tap('#category-row .chip:nth-child(1)'); await espera(1500);
    await largo(p, 'm-home-largo', 3000);
    await c.close();
  },
  async nexusbusca(b) {
    const c = await contexto(b), p = await abrir(c, WEB + '/');
    const q = 'juegos de carreras para android';
    await p.tap('#buscador'); await espera(400); await foto(p, 'm-busca-0');
    for (let i = 1; i <= q.length; i++) { await p.keyboard.type(q[i - 1]); if (i % 8 === 0) await foto(p, 'm-busca-' + i); }
    await p.keyboard.press('Enter'); await espera(5000);
    await p.evaluate(() => document.activeElement?.blur()); await espera(600);
    await foto(p, 'm-busca-resultado'); await medir(p, 'm-busca-resultado', { busca: '.search-bar', input: '#buscador', banner: '.nxb-banner', tile: '#output .game-tile' });
    await c.close();
  },
  async ficha(b) {
    const c = await contexto(b), p = await abrir(c, WEB + '/?id=6aee9550d50e6d2754da3616', 8000);
    await p.waitForFunction(() => { const s = document.getElementById('detail-sheet'); return s && s.classList.contains('open') && Math.abs(s.getBoundingClientRect().top) < 2 && getComputedStyle(s).opacity === '1'; }, null, { timeout: 20000 }).catch(() => {});
    await espera(3500);
    await foto(p, 'm-ficha'); await medir(p, 'm-ficha', { bajar: '#ds-download', titulo: '#ds-title' }, { compat: ['Compatibilidad', 300] });
    const alto = await p.evaluate(() => document.querySelector('#detail-sheet .sheet-scroll')?.scrollHeight || 2400);
    await p.evaluate(() => { const s = document.querySelector('#detail-sheet .sheet-scroll'); if (s) s.scrollTop = 0; });
    await p.setViewportSize({ width: 390, height: Math.min(4200, alto + 40) }); await espera(2500);
    await foto(p, 'm-ficha-largo');
    await c.close();
  },
  async ficha2(b) {
    const c = await contexto(b), p = await abrir(c, WEB + '/?id=698c1045c3da7e6da551dc00', 8000);
    await foto(p, 'm-ficha-mod');
    await c.close();
  },
  async nexus(b) {
    const c = await contexto(b, { sesion: true }), p = await abrir(c, WEB + '/', 9000);
    await p.evaluate(() => { document.getElementById('preloader')?.remove(); nxToggle(); }); await espera(2500);
    await foto(p, 'm-nexus'); await medir(p, 'm-nexus', { orbe: '.nx-hola-orb', hola: '.nx-hola h3', sugs: '.nx-sug*', caja: '.nx-form', titulo: '.nx-name' });
    await c.close();
  },
  async puente(b) {
    const c = await contexto(b), p = await abrir(c, WEB + '/public/puente.html?id=698c1045c3da7e6da551dc00', 6000);
    await foto(p, 'm-puente'); await medir(p, 'm-puente', {}, { titulo: ['SALIENDO DE', 0], apoya: ['Tu visita apoya', 300], esperas: ['Sin esperas con Premium', 330], premium: ['Premium: sin anuncios', 300] });
    await espera(9000); await foto(p, 'm-puente-2');
    await c.close();
  },
  async perfil(b) {
    const c = await contexto(b), p = await abrir(c, WEB + '/public/perfil-publico.html?usuario=keroxenee', 7000);
    await foto(p, 'm-perfil'); await medir(p, 'm-perfil', {}, { seguir: ['Seguir', 0], mensaje: ['Mensaje', 0], colecciones: ['Colecciones', 0], nombre: ['keroxenee', 0] });
    await c.close();
  },
  async publicar(b) {
    const c = await contexto(b, { sesion: true }), p = await abrir(c, WEB + '/');
    await p.evaluate(() => switchTab('upload')); await espera(2000);
    await foto(p, 'm-publicar'); await medir(p, 'm-publicar', {}, { pregunta: ['¿Qué deseas publicar hoy?', 0], juego: ['Juego', 120], mod: ['Mod', 120], optimizacion: ['Optimización', 120], app: ['App', 120], herramienta: ['Herramienta', 120], software: ['Software', 120], video: ['Video', 120] });
    await c.close();
  },
  async economia(b) {
    const c = await contexto(b, { sesion: true }), p = await abrir(c, WEB + '/');
    await p.evaluate(() => switchTab('economia')); await espera(3000);
    await foto(p, 'm-economia');
    await p.evaluate(() => window.ecoCargarPlan && ecoCargarPlan(true)); await espera(3000);
    await foto(p, 'm-premium');
    await c.close();
  },
  async bienvenida(b) {
    const c = await contexto(b); await c.addInitScript(() => { try { localStorage.removeItem('ug_ab_bienv'); localStorage.removeItem('ug_onb_hecho'); localStorage.removeItem('upgames_terms_v'); } catch {} });
    const p = await c.newPage(); await p.goto(WEB + '/', { waitUntil: 'domcontentloaded' }); await espera(7000);
    for (let k = 0; k < 6; k++) {
      await foto(p, 'm-bienvenida-' + k);
      const sig = p.locator('button:has-text("Siguiente")').first(); if (!(await sig.isVisible().catch(() => false))) break;
      await sig.click(); await espera(1600);
    }
    await c.close();
  },
  async novedades(b) {
    const c = await contexto(b), p = await abrir(c, WEB + '/');
    await p.tap('#bottom-nav .nav-tab[data-tab="new"]'); await espera(3500);
    await foto(p, 'm-novedades');
    await c.close();
  },
  async live(b) {
    const c = await contexto(b), p = await abrir(c, WEB + '/public/live.html', 7000);
    await foto(p, 'm-live'); await medir(p, 'm-live', {}, { live: ['LIVE', 0], titulo: ['En vivo ahora', 0], sub: ['Gameplays en directo', 0] });
    await c.close();
  },
  async blog(b) {
    const c = await contexto(b, { sesion: true }), p = await abrir(c, WEB + '/public/blog.html', 7000);
    await foto(p, 'm-blog');
    const d = await contexto(b, { movil: false, w: 1920, h: 1080, dpr: 1, sesion: true }), q = await abrir(d, WEB + '/public/blog.html', 7000);
    await foto(q, 'd-blog');
    await c.close(); await d.close();
  },
  async escritorio(b) {
    const c = await contexto(b, { movil: false, w: 1920, h: 1080, dpr: 1 }), p = await abrir(c, WEB + '/');
    await p.evaluate(() => heroGoTo && heroGoTo(0)); await espera(900);
    await foto(p, 'd-home');
    await c.close();
  },
  async studio(b) {
    const c = await contexto(b, { movil: false, w: 1920, h: 1080, dpr: 1 }), p = await abrir(c, WEB + '/studio/', 9000);
    await p.keyboard.press('Escape'); await espera(400);
    await p.evaluate(() => { const d = [...document.querySelectorAll('div,section,dialog')].find(e => /Cómo se usa Lurveta Studio/.test(e.textContent) && e.querySelector('button')); d?.querySelector('button')?.click(); });
    await espera(1200);
    await foto(p, 'd-studio');
    await c.close();
  },
  async racing(b) {
    const c = await contexto(b, { movil: false, w: 1920, h: 1080, dpr: 1 }), p = await abrir(c, WEB + '/games/monoplaza/', 12000);
    await foto(p, 'd-racing');
    await c.close();
  },
  async upstar(b) {
    const c = await contexto(b, { movil: false, w: 1920, h: 1080, dpr: 1 }), p = await abrir(c, WEB + '/games/upstar/', 12000);
    await foto(p, 'd-upstar');
    await c.close();
  },
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pedidas = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(TOMAS);
  for (const k of pedidas) { console.log('▸', k); try { await TOMAS[k](b); } catch (e) { console.log('  ✗', k, e.message.split('\n')[0]); } await espera(+(process.env.PAUSA || 15000)); }   // pausa: no saturar producción
  await b.close();
  // WebP sin pérdida (mismos píxeles, la mitad de peso): es lo que usa video.html
  const { execFileSync } = require('child_process');
  for (const f of fs.readdirSync(OUT).filter(f => f.endsWith('.png'))) {
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', path.join(OUT, f), '-c:v', 'libwebp', '-lossless', '1', '-compression_level', '6', path.join(OUT, f.replace(/\.png$/, '.webp'))]);
    fs.rmSync(path.join(OUT, f));
  }
})();
