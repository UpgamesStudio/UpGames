#!/usr/bin/env node
/**
 * Une y minifica las hojas de estilo de la biblioteca en public/upgames-app.css.
 *
 * Antes la portada pedía 6 hojas (~400 KB) que bloqueaban la primera pintura.
 * Ahora es UNA sola, sin comentarios ni espacios de más, en el MISMO orden (la
 * cascada y el diseño no cambian). Las fuentes siguen siendo los archivos de
 * siempre: edítalos a ellos y vuelve a correr este script (la acción
 * .github/workflows/css.yml lo hace sola al subir cambios a main).
 *
 *   node scripts/unir-css.js          → escribe el paquete y actualiza biblioteca.html
 *   node scripts/unir-css.js --check  → falla si el paquete no está al día
 */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const PUB = path.join(__dirname, '..', 'public');
const FUENTES = ['biblioteca.css', 'upgames-glass.css', 'upgames-estilo.css', 'upgames-cyber.css', 'upgames-videos.css', 'upgames-ux.css', 'upgames-neo.css', 'upgames-hero.css'];
const SALIDA = path.join(PUB, 'upgames-app.css');
const HTML = path.join(PUB, 'biblioteca.html');

/** Minificador conservador: respeta cadenas y url(); solo quita comentarios y espacios sobrantes. */
function minificar(css) {
  let out = '', i = 0;
  const n = css.length;
  while (i < n) {
    const c = css[i];
    if (c === '/' && css[i + 1] === '*') {            // comentario
      const fin = css.indexOf('*/', i + 2);
      i = fin < 0 ? n : fin + 2;
      out += ' ';
      continue;
    }
    if (c === '"' || c === "'") {                      // cadena: tal cual
      let j = i + 1;
      while (j < n && css[j] !== c) { if (css[j] === '\\') j++; j++; }
      out += css.slice(i, j + 1); i = j + 1;
      continue;
    }
    out += c; i++;
  }
  // Fuera de las cadenas ya no hay comentarios. Espacios: se protegen las cadenas otra vez.
  const partes = out.split(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/);
  return partes.map((p, k) => (k % 2 ? p : p
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};,])\s*/g, '$1')
    .replace(/;}/g, '}')
    .replace(/\s*!important/g, '!important')
  )).join('').trim() + '\n';
}

const unido = FUENTES.map(f => `/* ${f} */\n` + fs.readFileSync(path.join(PUB, f), 'utf8')).join('\n');
const min = minificar(unido);
const hash = crypto.createHash('sha1').update(min).digest('hex').slice(0, 10);
const linea = `<link rel="stylesheet" href="upgames-app.css?v=${hash}">`;

const html = fs.readFileSync(HTML, 'utf8');
const re = /<!-- css:inicio -->[\s\S]*?<!-- css:fin -->/;
if (!re.test(html)) { console.error('biblioteca.html no tiene los marcadores <!-- css:inicio --> / <!-- css:fin -->'); process.exit(1); }
const htmlNuevo = html.replace(re, `<!-- css:inicio -->\n<!-- Paquete de: ${FUENTES.join(', ')} (scripts/unir-css.js) -->\n${linea}\n<!-- css:fin -->`);

if (process.argv.includes('--check')) {
  const actual = fs.existsSync(SALIDA) ? fs.readFileSync(SALIDA, 'utf8') : '';
  if (actual !== min || html !== htmlNuevo) { console.error('upgames-app.css no está al día: corre node scripts/unir-css.js'); process.exit(1); }
  console.log('CSS al día'); process.exit(0);
}
fs.writeFileSync(SALIDA, min);
if (html !== htmlNuevo) fs.writeFileSync(HTML, htmlNuevo);
const kb = b => (b / 1024).toFixed(0) + ' KB';
console.log(`upgames-app.css: ${kb(Buffer.byteLength(unido))} → ${kb(Buffer.byteLength(min))} (${FUENTES.length} archivos → 1) · v=${hash}`);
