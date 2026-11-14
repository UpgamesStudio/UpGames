#!/usr/bin/env node
/**
" * Captura pantallas de la interfaz REAL de UpGames para el video «Todo UpGames»: la biblioteca, el carrusel, la ficha,
 * el feed de videos, NEXUS, un perfil, UpGames Blogs… con el catálogo y las imágenes reales de producción
 * (solo lecturas) y en un móvil (412×915 a 2×). Las guarda en img/. Uso: node capturar.js [nombre…]
 */
'use strict';
const path = require('path'), fs = require('fs');
const { servir, navegador } = require('../../test/real/util');
const API = 'https://upgames-production.up.railway.app';
const DEMO = 'https://demo.upgames.test';   // portadas propias (portadas.js): no se muestran imágenes ni nombres de juegos comerciales
const hex = n => n.toString(16).padStart(24, '0');
const FICHA = [  // id, título, categoría, usuario, descargas, reseñas, días
  ['neon-drift', 'Neon Drift', 'Juego', 'nova_dev', 18420, [4.7, 128], 3], ['void-harvest', 'Void Harvest · mod de rendimiento', 'Mod', 'kale_ab', 9310, [4.4, 61], 5], ['emberfall', 'Emberfall', 'Juego', 'pixelforge', 5120, [4.2, 33], 9],
  ['skyblade', 'Skyblade', 'Juego', 'nova_dev', 7740, [4.6, 52], 12], ['echo-garden', 'Echo Garden', 'Juego', 'lumen_labs', 3980, [4.8, 40], 2], ['crypt-signal', 'Crypt Signal · optimizado para 4 GB', 'Optimizacion', 'kale_ab', 2210, null, 20],
  ['pixel-tide', 'Pixel Tide', 'Juego', 'pixelforge', 1530, [4.1, 12], 1], ['iron-orbit', 'Iron Orbit', 'Apps', 'lumen_labs', 6660, [4.5, 47], 15], ['lumen', 'Lumen · editor de luces', 'Apps', 'lumen_labs', 4120, [4.9, 71], 30],
  ['turbo-circuit', 'Turbo Circuit', 'Juego', 'nova_dev', 11890, [4.5, 96], 4], ['ashen-vale', 'Ashen Vale · pack de texturas', 'Mod', 'kale_ab', 2840, [4.0, 9], 22], ['starlorn', 'Starlorn · gameplay', 'Video', 'nova_dev', 940, null, 6], ['emberfall', 'Emberfall · tráiler', 'Video', 'pixelforge', 2210, null, 7], ['lumen', 'Lumen · tutorial de luces', 'Video', 'lumen_labs', 1560, null, 8]];
const CATALOGO = FICHA.map(([img, titulo, cat, usuario, d, r, dias], i) => ({ _id: hex(i + 1), title: titulo, usuario, category: cat, status: 'aprobado', linkStatus: 'online', reportes: 0, link: cat === 'Video' ? `${DEMO}/v/${img}.mp4` : 'https://example.com/demo', image: `${DEMO}/portadas/${img}.jpg`,
  description: 'Proyecto de demostración creado para este video. ' + (cat === 'Mod' ? 'Mejora el rendimiento en celulares de gama media. Contraseña del archivo: demo.' : 'Una experiencia ligera para tu móvil.'),
  descargasEfectivas: d, descargasSemana: Math.round(d / 40), likesCount: Math.round(d / 90), vistas: d * 3, createdAt: new Date(Date.now() - dias * 864e5).toISOString(), updatedAt: new Date(Date.now() - Math.min(dias, 2) * 864e5).toISOString(),
  scoreRecomendacion: 100 - i, ...(r ? { resenas: { promedio: r[0], n: r[1] } } : {}), ...(cat === 'Video' ? { videoType: 'Gameplay' } : {}), tags: [], extraData: {} }));
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
    if (u.startsWith(web.url) || /fonts\.g|unpkg|ytimg|youtube/.test(u)) return r.continue();
    if (u.startsWith(DEMO) && /\.mp4/.test(u)) return r.abort();
    if (u.startsWith(DEMO)) { const f = path.join(__dirname, new URL(u).pathname); return fs.existsSync(f) ? r.fulfill({ body: fs.readFileSync(f), contentType: 'image/jpeg' }) : r.abort(); }
    for (const [re, fn] of mock) if (re.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(typeof fn === 'function' ? fn(u, m) : fn) });
    if (u.startsWith(API) && m === 'GET') {   // todo el contenido que se ve es de demostración: ninguna lectura va a producción
      const id = (u.match(/\/items\/([a-f0-9]{24})(\?|$)/) || [])[1];
      const j = v => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(v) });
      if (/\/items(\?.*)?$/.test(u)) return j(CATALOGO);
      if (id) return j(CATALOGO.find(i => i._id === id) || {});
      if (/\/items\/user\//.test(u)) return j(CATALOGO.filter(i => i.usuario === decodeURIComponent(u.split('/items/user/')[1].split('?')[0])));
      if (/\/usuarios\/perfil-publico\//.test(u)) return j({ success: true, usuario: { usuario: 'nova_dev', isVerificado: true, verificadoNivel: 2, avatar: `${DEMO}/portadas/avatar.jpg`, bio: 'Estudio indie · juegos ligeros para móvil', fecha: new Date(Date.now() - 300 * 864e5).toISOString(), socialLinks: [], banner: `${DEMO}/portadas/banner.jpg`, estilo: { insignias: ['ins_fundador'], marco: 'marco_oro', color: 'color_oro', fondo: 'fondo_atardecer', tarjeta: 'tj_carbono' }, coleccion: { total: 3, insignias: ['ins_fundador'] }, premium: true, publicaciones: 3, seguidores: 1280, siguiendo: 14 } });
      return j([]);
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
      await p.evaluate(() => { const it = todosLosItems.find(i => i.title === 'Neon Drift'); openDetail(it); }); await espera(2500); await quitarRuido(p);
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
      await p.evaluate(() => { NX.msgs = [{ rol: 'user', texto: 'Juegos de carreras que corran bien en 4 GB de RAM' }, { rol: 'assistant', texto: 'Encontré **3 juegos de carreras** que corren fluido en 4 GB de RAM. Los ordené por rendimiento real que reportó la comunidad:', items: todosLosItems.filter(i => /neon drift|turbo circuit|skyblade/i.test(i.title)).slice(0, 3).map(i => ({ id: i._id, titulo: i.title, imagen: i.image, categoria: i.category, descargas: i.descargasEfectivas || 0, autor: i.usuario })), acciones: [] }]; nxPintar(); }); await espera(1500);
      await foto(p, 'nexus');
    }
    await p.close();
  }
  if (quiere('perfil')) {
    p = await ctx.newPage(); await p.goto(`${web.url}/perfil-publico.html?usuario=nova_dev`, { waitUntil: 'domcontentloaded' }); await espera(6500); await foto(p, 'perfil'); await p.close();
  }
  if (quiere('live')) {
    p = await ctx.newPage(); await p.goto(`${web.url}/live.html`, { waitUntil: 'domcontentloaded' }); await espera(5000); await foto(p, 'live'); await p.close();
  }
  if (quiere('blog')) {
    // 1) Páginas públicas del blog, generadas por el render REAL (modulos/blogs/render.js) con datos reales del catálogo
    const R = require('../../modulos/blogs/render'), items = CATALOGO;
    const it = items.find(i => i.title === 'Neon Drift'), it2 = items.find(i => i.title === 'Turbo Circuit');
    const juegos = { [it._id]: { title: it.title, image: it.image, usuario: it.usuario }, [it2._id]: { title: it2.title, image: it2.image, usuario: it2.usuario } };
    const base = { usuario: 'kale_ab', titulo: 'Kale · Mods y trucos', descripcion: 'Reseñas, guías y noticias de mods para móvil', direccion: 'kale-mods', ajustes: { acento: '' }, tema: 'neon' };
    const ctxB = tema => ({ blog: { ...base, tema }, base: '/b/kale-mods', origen: 'https://upgames-production.up.railway.app', appUrl: 'https://upgames.games', paginas: [{ titulo: 'Sobre mí', slug: 'sobre-mi' }], autor: { usuario: 'kale_ab', avatar: '', bio: 'Pruebo mods en gama media' }, populares: [], nube: ['android', 'mods', 'guías'], juegos, sinMarca: tema !== 'neon' });
    const entrada = { _id: 'a'.repeat(24), titulo: 'Reseña: Neon Drift en gama media', slug: 'resena', tipo: 'entrada', publicadaEn: new Date(), etiquetas: ['android', 'reseña'], portada: it.image, bloques: [
      { tipo: 'texto', texto: 'Lo probé en un celular de **4 GB de RAM** y corre mejor de lo que esperaba. Esto fue lo que encontré.', grande: true },
      { tipo: 'titulo', texto: 'Lo mejor' }, { tipo: 'texto', texto: '- Corre fluido a 30 FPS\n- La instalación toma 5 minutos\n- Los controles táctiles son cómodos' },
      { tipo: 'ficha', titulo: 'Ficha', filas: [{ k: 'Género', v: 'Carreras' }, { k: 'Plataforma', v: 'Android' }, { k: 'Peso', v: '1,2 GB' }] },
      { tipo: 'aviso', estilo: 'exito', texto: '**Nota final: 8/10.** Recomendado si te gustan las carreras arcade.' }, { tipo: 'descarga', id: it._id }] };
    const lista = [0, 1, 2].map(i => ({ titulo: ['Reseña: Neon Drift', 'Guía: Turbo Circuit en Android', 'Top 5 mods de carreras'][i], slug: 's' + i, portada: [it.image, it2.image, it.image][i], resumen: 'Lo probé en gama media y esto fue lo que pasó.', bloques: [], etiquetas: ['android'], publicadaEn: new Date() }));
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
    await e.evaluate(() => { const t = document.querySelector('#titulo'); if (t) { t.value = 'Reseña: Neon Drift en gama media'; t.dispatchEvent(new Event('input')); } const r = document.querySelector('.rico'); if (r) r.textContent = 'Lo probé en un celular de 4 GB de RAM y corre mejor de lo que esperaba.'; }); await espera(800);
    await e.addStyleTag({ content: '.b-juego > input{display:none!important}' }); await foto(e, 'editor'); await e.close();
  }
  await b.close(); web.cerrar();
})().catch(e => { console.error('FALLO', e); process.exit(1); });
