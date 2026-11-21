#!/usr/bin/env node
/**
 * Graba el flujo REAL de Lurveta Blogs en el entorno de demostración (servidor.js debe estar corriendo):
 * crear el blog, landing con Nexus, editar, tema y paleta de Nexus, revisar, SEO, publicar, usar como inicio,
 * primera entrada con «Mejorar redacción», y el sitio publicado. Capturas a 2× en capturas/ y las posiciones
 * de los elementos (px de la captura) en capturas/medidas.json.
 *   node grabar.js
 */
'use strict';
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const D = require('./demo.json');
const OUT = path.join(__dirname, 'capturas'); fs.mkdirSync(OUT, { recursive: true });
const M = {};
const espera = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch();
  const c = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'es-CO' });
  await c.addInitScript(([t, u]) => { localStorage.setItem('token', t); localStorage.setItem('user_admin', u); }, [D.token, D.usuario]);
  const p = await c.newPage(); p.on('pageerror', e => console.log('  (error de la página)', e.message));
  let n = 0;
  async function foto(nombre, sel = {}, opc = {}) {
    await espera(opc.espera ?? 650);
    const id = String(++n).padStart(2, '0') + '-' + nombre;
    await p.screenshot({ path: path.join(OUT, id + '.png'), fullPage: !!opc.completa });
    M[id] = await p.evaluate(sel => {
      const caja = e => { if (!e) return null; const r = e.getBoundingClientRect(); return [r.x, r.y + scrollY * 0, r.width, r.height].map(v => Math.round(v * 2)); };
      const porTexto = t => { const l = [...document.querySelectorAll('body *')].filter(e => e.offsetParent && e.children.length <= 4 && (e.textContent || '').trim().startsWith(t)); return l.sort((a, b) => a.textContent.length - b.textContent.length)[0]; };
      const o = {}; for (const [k, q] of Object.entries(sel)) o[k] = caja(q.startsWith('=') ? porTexto(q.slice(1)) : document.querySelector(q)); return o;
    }, sel);
    fs.writeFileSync(path.join(OUT, 'medidas.json'), JSON.stringify(M, null, 1));
    console.log('  ✓', id);
  }
  const escribir = async (sel, texto, cada = 0) => { await p.click(sel); await p.fill(sel, ''); await p.type(sel, texto, { delay: cada }); };

  // ── 1. Crear el blog ──
  await p.goto(`${D.web}/public/blog.html?api=${encodeURIComponent(D.api)}`); await espera(2500);
  await foto('asistente', { nombre: 'input[name=titulo]', dir: 'input[name=direccion]', desc: 'input[name=descripcion]', temas: '.temas', form: 'form.asistente' });
  await escribir('input[name=titulo]', 'Diario de un dev indie', 25); await espera(900);
  await foto('nombre', { nombre: 'input[name=titulo]', dir: 'input[name=direccion]', nota: '#dir-nota' });
  await escribir('input[name=descripcion]', 'Cómo hago mi primer videojuego, paso a paso', 15);
  await foto('descripcion', { desc: 'input[name=descripcion]' });
  await p.click('[data-tema="gamer"]'); await p.locator('[data-tema="gamer"]').scrollIntoViewIfNeeded();
  await foto('tema', { gamer: '[data-tema="gamer"]', temas: '.temas' });
  await p.check('input[name=acepto]'); await p.locator('button[type=submit]').scrollIntoViewIfNeeded();
  await foto('acepto', { acepto: 'label.acepto', crear: 'button[type=submit]' });
  await p.click('button[type=submit]'); await espera(1800);
  await foto('panel', { nav: '.nav', paginas: '.nav [data-v="paginas"]', url: '.barra .quien small', ver: '.barra a.btn' }, { espera: 300 });

  // ── 2. Página de inicio con Nexus ──
  await p.click('.nav [data-v="paginas"]'); await espera(1200);
  await foto('paginas', { nueva: '#nueva' });
  await p.click('#nueva'); await espera(700);
  await foto('como-empezar', { nexus: '[data-p="nexus"]', hoja: '#hoja .opciones' });
  await p.click('[data-p="nexus"]'); await espera(1200);
  await foto('nexus-vacio', { idea: '#nl-idea', obj: '#nl-obj', wa: '#nl-wa', ok: '#nl-ok' });
  await escribir('#nl-idea', 'Soy desarrollador indie y estoy creando mi primer videojuego de plataformas en pixel art. Comparto devlogs semanales y lo que aprendo para otros devs que empiezan.', 4);
  await p.selectOption('#nl-obj', { label: 'Conocer mi trabajo (portafolio)' });
  await foto('nexus-lleno', { idea: '#nl-idea', obj: '#nl-obj', ok: '#nl-ok' });
  await p.click('#nl-ok'); await espera(350);
  await foto('nexus-pensando', { ok: '#nl-ok' }, { espera: 50 });
  await espera(2600);
  await foto('landing', { titulo: '#titulo', heroe: '.b-heroe', columnas: '.b-columnas' }, { espera: 200 });
  await espera(3500);
  await foto('landing-completa', { heroe: '.b-heroe', columnas: '.b-columnas', testimonios: '.b-testimonios', faq: '.b-faq', cta: '.b-cta' }, { completa: true });
  // vista previa en vivo (la página tal como la verá el visitante)
  await p.click('text=Vista previa'); await espera(2500);
  await foto('previa-landing', { celular: '=Celular', computador: '=Computador' });
  await p.click('text=Computador'); await espera(2500);
  await foto('previa-computador', {});
  await p.click('text=Seguir editando'); await espera(800);

  // ── 3. Editar: quitar los testimonios (aún no hay opiniones reales) y completar los [corchetes] ──
  await p.locator('.b-testimonios').scrollIntoViewIfNeeded(); await espera(400);
  await foto('testimonios', { testimonios: '.b-testimonios', borrar: '.b-testimonios [aria-label="Borrar bloque"]' });
  await p.click('.b-testimonios input, .b-testimonios textarea'); await espera(400);   // al tocar el bloque aparece su barra
  await foto('testimonios-activo', { testimonios: '.b-testimonios', borrar: '.b-testimonios [aria-label="Borrar bloque"]' });
  await p.click('.b-testimonios [aria-label="Borrar bloque"]'); await espera(500);
  const conf = await p.$('#hoja button.rojo, #hoja [data-si]'); if (conf) { await conf.click(); await espera(500); }
  await p.locator('.b-faq').scrollIntoViewIfNeeded(); await espera(400);
  await foto('faq-antes', { faq: '.b-faq' });
  const resp = await p.$$('.b-faq textarea');
  for (const t of resp) {
    const v = await t.inputValue();
    if (v.includes('[fecha estimada]')) { await t.fill(''); await t.type('Todavía está en desarrollo. La fecha la anuncio aquí primero.', { delay: 8 }); }
    if (v.includes('[Plataformas previstas]')) { await t.fill(''); await t.type('PC y Android. Cada avance lo cuento en el devlog.', { delay: 8 }); }
  }
  await foto('faq-despues', { faq: '.b-faq' });
  // enlaces de los botones: llevan al devlog del propio blog
  const enlaces = await p.$$('input[placeholder^="Enlace del botón"]');
  for (const e of enlaces) { await e.fill('https://lurveta.com/b/diario-de-un-dev-indie/'); }
  await p.locator('.b-heroe').scrollIntoViewIfNeeded(); await espera(300);
  await foto('enlace-boton', { heroe: '.b-heroe', enlace: '.b-heroe input[placeholder^="Enlace del botón"]' });

  // ── 4. Nexus revisa y prepara el SEO; publicar ──
  await p.click('#nexus'); await espera(800);
  await foto('menu-nexus', { menu: '#hoja .hoja-cont, #hoja > div', revisar: '=Revisar mi página', seo: '=Título, resumen y etiquetas' });
  await p.click('text=Revisar mi página'); await espera(900);
  await foto('revision', { lista: '.revision' });
  await p.click('#hoja [data-cerrar]').catch(() => {}); await espera(500);
  await p.click('#nexus'); await espera(700); await p.click('text=Título, resumen y etiquetas'); await espera(400);
  await foto('seo-pensando', {}, { espera: 50 });
  await espera(2200);
  await foto('seo', { tit: '#s-tit', res: '#s-res', usar: '#hoja [data-si]' });
  await p.click('#hoja [data-si]'); await espera(800);
  await p.click('#publicar'); await espera(900);
  const igual = await p.$('#hoja button:has-text("Publicar igual")'); if (igual) { await igual.click(); await espera(900); }
  await foto('publicada', { dialogo: '#hoja > div', url: '=https://lurveta.com/b/', copiar: '=Copiar enlace', verla: '=Verla', inicio: '=✦ Usar esta landing' });
  await p.click('text=Usar esta landing como inicio'); await espera(1200);
  await foto('inicio-ok', {});
  const vl = await p.$('#hoja button:has-text("Volver a la lista")'); if (vl) await vl.click(); else { const x = await p.$('#salir'); if (x) await x.click(); }
  await espera(1200);
  await p.click('.nav [data-v="ajustes"]'); await espera(1500);
  await p.locator('text=www.misitio.com').first().scrollIntoViewIfNeeded().catch(() => {});
  await foto('dominio', { dominio: 'input[placeholder="www.misitio.com"]' });

  // ── 6. Tema y paleta de Nexus ──
  await p.click('.nav [data-v="tema"]'); await espera(1500);
  await foto('tema-vista', {});
  await p.locator('#kit-nx').scrollIntoViewIfNeeded();
  await foto('kit', { kitnx: '#kit-nx', acento: '#acento', vista: '#kit-vista' });
  await p.click('#kit-nx'); await espera(700);
  await escribir('#nc-idea', 'Blog de un desarrollador indie: juego de plataformas en pixel art, retro, creativo y cercano.', 6);
  await foto('colores-idea', { idea: '#nc-idea', ok: '#nc-ok' });
  await p.click('#nc-ok'); await espera(2400);
  await foto('paletas', { paletas: '.paletas' });
  await p.click('.paletas [data-p="0"]'); await espera(900);
  await foto('kit-nuevo', { acento: '#acento', vista: '#kit-vista', ok: '#kit-ok' });
  await p.click('#kit-ok'); await espera(1200);
  await foto('kit-guardado', { vista: '#kit-vista' });

  // ── 7. Primera entrada: borrador rápido y «Mejorar redacción» ──
  await p.click('.nav [data-v="entradas"]'); await espera(1200);
  await p.click('#nueva'); await espera(700);
  await p.click('[data-p="blanco"]'); await espera(1200);
  await escribir('#titulo', 'Devlog #1: el primer nivel', 20);
  const txt = (await p.$$('#bloques textarea, #bloques [contenteditable="true"]'))[0];
  await txt.click(); await p.keyboard.type('esta semana termine el primer nivel del juego. me costo mucho que el salto se sintiera bien, lo probe muchas veces hasta que quedo. ahora sigo con los enemigos', { delay: 6 });
  await foto('entrada-borrador', { titulo: '#titulo', texto: '#bloques .bloque', nx: '#bloques .bloque .herr button.nx' });
  await espera(300);
  await p.click('#bloques .bloque .herr button.nx'); await espera(700);
  await foto('modos-texto', { tipos: '#hoja .tipos', mejorar: '[data-modo="mejorar"]' });
  await p.click('[data-modo="mejorar"]'); await espera(250);
  await foto('texto-pensando', {}, { espera: 50 });
  await espera(1800);
  await foto('texto-propuesta', { propuesta: '.propuesta', usar: '[data-usar]' });
  await p.click('[data-usar]'); await espera(800);
  await foto('texto-usado', { texto: '#bloques .bloque' });
  await p.click('#publicar'); await espera(900);
  const igual2 = await p.$('#hoja button:has-text("Publicar igual")'); if (igual2) { await igual2.click(); await espera(900); }
  await foto('entrada-publicada', { dialogo: '#hoja > div' });

  // ── 8. El sitio publicado y las estadísticas ──
  const vl2 = await p.$('#hoja button:has-text("Volver a la lista")'); if (vl2) await vl2.click(); else await p.click('#salir');
  await espera(1200);
  await p.click('.nav [data-v="estadisticas"]'); await espera(1500);
  await foto('estadisticas', {});
  const sitio = await c.newPage(); await sitio.goto(`${D.web}/b/diario-de-un-dev-indie/`); await espera(3000);
  await sitio.screenshot({ path: path.join(OUT, '90-sitio.png') }); await sitio.screenshot({ path: path.join(OUT, '91-sitio-completo.png'), fullPage: true });
  const ent = await sitio.$('a[href*="/e/"]'); if (ent) { await ent.click(); await espera(2500); await sitio.screenshot({ path: path.join(OUT, '92-entrada.png') }); }
  const mov = await c.newPage(); await mov.setViewportSize({ width: 390, height: 844 }); await mov.goto(`${D.web}/b/diario-de-un-dev-indie/`); await espera(2500);
  await mov.screenshot({ path: path.join(OUT, '93-sitio-movil.png') });
  console.log('  ✓ sitio publicado');
  await b.close();
})();
