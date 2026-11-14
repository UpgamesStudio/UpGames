#!/usr/bin/env node
/**
 * Captura pantallas REALES de UpGames para el video «Todo UpGames»: la biblioteca, el carrusel, la ficha,
 * el feed de videos, NEXUS, un perfil, UpGames Blogs… con el catálogo y las imágenes reales de producción
 * (solo lecturas) y en un móvil (412×915 a 2×). Las guarda en img/. Uso: node capturar.js [nombre…]
 */
'use strict';
const path = require('path'), fs = require('fs');
const { servir, navegador } = require('../../test/real/util');
const API = 'https://upgames-production.up.railway.app';
const OUT = path.join(__dirname, 'img');
const espera = ms => new Promise(r => setTimeout(r, ms));
const solo = process.argv.slice(2);
const quiere = n => !solo.length || solo.includes(n);

(async () => {
  const web = await servir(), b = await navegador();
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ignoreHTTPSErrors: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('ug_bienv_marca', 'ses:' + 'x'); localStorage.setItem('upgames_terms_v', '8.0'); localStorage.setItem('ug_guia_visto', '1'); localStorage.setItem('ug_tutorial_visto', '1'); localStorage.setItem('ug_pistas', JSON.stringify({ 'guia-fab': 1, guia: 1, descargar: 1, nexus: 1, publicar: 1, favorito: 1, buscar: 1 })); } catch (_) {} });
  const mock = new Map();   // ruta (regex) → respuesta JSON simulada
  await ctx.route('**/*', async r => {
    const u = r.request().url(), m = r.request().method();
    if (u.startsWith(web.url) || /res\.cloudinary|fonts\.g|unpkg|ytimg|youtube/.test(u)) return r.continue();
    for (const [re, fn] of mock) if (re.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(typeof fn === 'function' ? fn(u, m) : fn) });
    if (u.startsWith(API) && m === 'GET' && !/\/(m|errores|auth|monedas|notificaciones|nexus|guia)\b/.test(u)) {
      try { const resp = await r.fetch({ headers: { ...r.request().headers(), origin: 'https://upgames.games', referer: 'https://upgames.games/public/biblioteca.html' } }); return r.fulfill({ status: resp.status(), body: await resp.body(), contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } }); } catch (_) { return r.abort(); }
    }
    return r.fulfill({ status: 200, body: '[]', contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } });
  });
  const foto = (p, n) =>  p.screenshot({ path: path.join(OUT, n + '.jpg'), type: 'jpeg', quality: 92 }).then(() => console.log('  ✓', n));
  const abrirBiblio = async () => { const p = await ctx.newPage(); await p.goto(`${web.url}/biblioteca.html`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => document.querySelectorAll('#output .game-tile').length > 3, null, { timeout: 40000 }); await espera(2500);
    await p.addStyleTag({ content: '.ug-terminos-aviso,#ug-bienvenida,.ug-guia-pista,.ug-pista{display:none!important}' }).catch(() => {}); return p; };
  const quitarRuido = p => p.evaluate(() => { document.querySelectorAll('.ug-terminos-aviso,.ug-isla,[id^="ug-bienv"],.ug-pista,.ug-guia-pista,[class*="pista"],[class*="guia-globo"]').forEach(e => e.remove()); });

  let p;
  if (['home', 'carrusel', 'ficha', 'feed', 'nexus'].some(quiere)) {
    p = await abrirBiblio(); await quitarRuido(p);
    if (quiere('home')) { await p.evaluate(() => scrollTo({ top: 0, behavior: 'instant' })); await espera(600); await foto(p, 'home'); }
    if (quiere('carrusel')) {
      await p.evaluate(() => document.querySelector('.ugc')?.scrollIntoView({ block: 'center', behavior: 'instant' })); await espera(2500);
      await p.evaluate(() => document.querySelector('.ugc-dots [data-dot="2"]')?.click()); await espera(1800); await foto(p, 'carrusel');
    }
    if (quiere('ficha')) {
      await p.evaluate(() => { const it = todosLosItems.find(i => i.title === 'Resident evil revelations 2 mod') || todosLosItems.find(i => i.category === 'Mod'); openDetail(it); }); await espera(2500); await quitarRuido(p);
      await foto(p, 'ficha'); await p.evaluate(() => closeDetail()); await espera(700);
    }
    if (quiere('feed')) {
      await p.evaluate(() => window.UGVideos.abrir()); await espera(4500); await foto(p, 'feed'); await p.evaluate(() => window.UGVideos.cerrar()); await espera(800);
    }
    if (quiere('nexus')) {
      mock.set(/\/nexus\/cuota/, { ok: true, premium: false, restantesHoy: 9, gratisDia: 10, creditos: 0 });
      mock.set(/\/nexus\/historial/, { ok: true, historial: [] });
      mock.set(/\/nexus\/chat/, { ok: true, texto: 'Para tu celular de **4 GB de RAM** te recomiendo estos tres, ordenados por rendimiento:', items: [], acciones: [] });
      await p.evaluate(() => { window.ugPedirSesion = () => true; nxToggle(); }); await espera(1200);
      await p.evaluate(() => { NX.msgs = [{ rol: 'user', texto: 'Juegos de carreras que corran bien en 4 GB de RAM' }, { rol: 'assistant', texto: 'Encontré **3 juegos de carreras** que corren fluido en 4 GB de RAM. Los ordené por rendimiento real que reportó la comunidad:', items: todosLosItems.filter(i => /nfs|f1|formula|forza|racing|gta/i.test(i.title) && !/mp4|webm/.test(i.image)).slice(0, 3).map(i => ({ id: i._id, titulo: i.title, imagen: i.image, categoria: i.category, descargas: i.descargasEfectivas || 0, autor: i.usuario })), acciones: [] }]; nxPintar(); }); await espera(1500);
      await foto(p, 'nexus');
    }
    await p.close();
  }
  if (quiere('perfil')) {
    p = await ctx.newPage(); await p.goto(`${web.url}/perfil-publico.html?usuario=keroxenee`, { waitUntil: 'domcontentloaded' }); await espera(6500); await foto(p, 'perfil'); await p.close();
  }
  if (quiere('live')) {
    p = await ctx.newPage(); await p.goto(`${web.url}/live.html`, { waitUntil: 'domcontentloaded' }); await espera(5000); await foto(p, 'live'); await p.close();
  }
  if (quiere('blog')) {
    // 1) Páginas públicas del blog, generadas por el render REAL (modulos/blogs/render.js) con datos reales del catálogo
    const R = require('../../modulos/blogs/render'), items = JSON.parse(fs.readFileSync('/tmp/items.json', 'utf8'));
    const it = items.find(i => i.title === 'Resident evil revelations 2 mod'), it2 = items.find(i => /Formula 1/.test(i.title));
    const juegos = { [it._id]: { title: it.title, image: it.image, usuario: it.usuario }, [it2._id]: { title: it2.title, image: it2.image, usuario: it2.usuario } };
    const base = { usuario: 'kale_ab', titulo: 'Kale · Mods y trucos', descripcion: 'Reseñas, guías y noticias de mods para móvil', direccion: 'kale-mods', ajustes: { acento: '' }, tema: 'neon' };
    const ctxB = tema => ({ blog: { ...base, tema }, base: '/b/kale-mods', origen: 'https://upgames-production.up.railway.app', appUrl: 'https://upgames.games', paginas: [{ titulo: 'Sobre mí', slug: 'sobre-mi' }], autor: { usuario: 'kale_ab', avatar: '', bio: 'Pruebo mods en gama media' }, populares: [], nube: ['android', 'mods', 'guías'], juegos, sinMarca: tema !== 'neon' });
    const entrada = { _id: 'a'.repeat(24), titulo: 'Reseña: Resident Evil Revelations 2 en gama media', slug: 'resena', tipo: 'entrada', publicadaEn: new Date(), etiquetas: ['android', 'reseña'], portada: it.image, bloques: [
      { tipo: 'texto', texto: 'Lo probé en un celular de **4 GB de RAM** y corre mejor de lo que esperaba. Esto fue lo que encontré.', grande: true },
      { tipo: 'titulo', texto: 'Lo mejor' }, { tipo: 'texto', texto: '- Corre fluido a 30 FPS\n- La instalación toma 5 minutos\n- Los controles táctiles son cómodos' },
      { tipo: 'ficha', titulo: 'Ficha', filas: [{ k: 'Género', v: 'Terror' }, { k: 'Plataforma', v: 'Android' }, { k: 'Peso', v: '1,2 GB' }] },
      { tipo: 'aviso', estilo: 'exito', texto: '**Nota final: 8/10.** Recomendado si te gusta el terror.' }, { tipo: 'descarga', id: it._id }] };
    const lista = [0, 1, 2].map(i => ({ titulo: ['Reseña: Resident Evil Revelations 2', 'Guía: Formula 1 2014 en Android', 'Top 5 mods de carreras'][i], slug: 's' + i, portada: [it.image, it2.image, it.image][i], resumen: 'Lo probé en gama media y esto fue lo que pasó.', bloques: [], etiquetas: ['android'], publicadaEn: new Date() }));
    for (const [tema, tipo] of [['neon', 'entrada'], ['cristal', 'inicio'], ['lienzo', 'inicio']]) {
      const html = tipo === 'entrada' ? R.entrada(ctxB(tema), entrada) : R.inicio(ctxB(tema), { entradas: lista, pagina: 1, hayMas: false, etiqueta: '' });
      const q = await ctx.newPage(); await q.setContent(html.replace(/<iframe[^>]*comentarios[^>]*><\/iframe>/g, ''), { waitUntil: 'load' }); await q.addStyleTag({ content: '.pixel{display:none}' }); await espera(2500);
      await foto(q, 'blog-' + tema); await q.close();
    }
    // 2) Editor por bloques REAL (API simulada)
    const H = { success: true };
    mock.set(/\/blogs\/temas/, { success: true, temas: [{ id: 'neon', nombre: 'Neón', descripcion: '', colores: { bg: '#05080F', tarjeta: '#0B1019', txt: '#fff', acento: '#39FF88' } }], fuentes: [], fondos: [], cpm: 0.3 });
    mock.set(/\/blogs\/mios/, { success: true, blogs: [{ id: 'b1', titulo: 'Kale · Mods y trucos', direccion: 'kale-mods', url: 'https://upgames.games/b/kale-mods/', ajustes: {}, tema: 'neon', entradas: 3, estado: 'activo', visibilidad: 'publico' }], maximo: 3, premium: true });
    mock.set(/\/items\/[a-f0-9]{24}$/, it);
    const e = await ctx.newPage(); await e.addInitScript(() => { localStorage.setItem('token', 'x'.repeat(48)); localStorage.setItem('user_admin', 'kale_ab'); });
    await e.goto(`${web.url}/blog.html?juego=${it._id}`, { waitUntil: 'domcontentloaded' }); await espera(3500);
    await e.evaluate(() => { document.querySelector('#hoja')?.click(); }); await espera(600);
    await e.evaluate(() => { const t = document.querySelector('#titulo'); if (t) { t.value = 'Reseña: Resident Evil Revelations 2 en gama media'; t.dispatchEvent(new Event('input')); } const r = document.querySelector('.rico'); if (r) r.textContent = 'Lo probé en un celular de 4 GB de RAM y corre mejor de lo que esperaba.'; }); await espera(800);
    await foto(e, 'editor'); await e.close();
  }
  await b.close(); web.cerrar();
})().catch(e => { console.error('FALLO', e); process.exit(1); });
