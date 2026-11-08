#!/usr/bin/env node
/**
 * Une las partes de public/js/ (en orden por nombre: 00-base.js, 01-tarjetas.js…) en
 * public/script.js, el archivo que carga la biblioteca.
 *
 * script.js tenía más de 6.000 líneas: ahora se edita por partes pequeñas y temáticas,
 * y el navegador sigue recibiendo un solo archivo con el MISMO código y en el mismo
 * orden (las partes comparten variables globales como antes). No edites script.js a
 * mano: edita la parte y corre este script (la acción .github/workflows/css.yml lo hace
 * sola al subir cambios a main).
 *
 *   node scripts/unir-js.js           → escribe script.js y actualiza su ?v= en biblioteca.html
 *   node scripts/unir-js.js --check   → falla si script.js no está al día
 */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const PUB = path.join(__dirname, '..', 'public');
const DIR = path.join(PUB, 'js');
const SALIDA = path.join(PUB, 'script.js');
const HTML = path.join(PUB, 'biblioteca.html');

const partes = fs.readdirSync(DIR).filter(f => /^\d{2}-[\w-]+\.js$/.test(f)).sort();
if (!partes.length) { console.error('No hay partes en public/js/'); process.exit(1); }
const codigo = partes.map(f => fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\n$/, '')).join('\n');   // cada parte termina en un salto de línea propio
const hash = crypto.createHash('sha1').update(codigo).digest('hex').slice(0, 10);
const html = fs.readFileSync(HTML, 'utf8');
const htmlNuevo = html.replace(/<script src="script\.js\?v=[^"]*"><\/script>/, `<script src="script.js?v=${hash}"></script>`);

if (process.argv.includes('--check')) {
  const actual = fs.existsSync(SALIDA) ? fs.readFileSync(SALIDA, 'utf8') : '';
  if (actual !== codigo || html !== htmlNuevo) { console.error('script.js no está al día: corre node scripts/unir-js.js'); process.exit(1); }
  console.log(`script.js al día (${partes.length} partes)`); process.exit(0);
}
fs.writeFileSync(SALIDA, codigo);
if (html !== htmlNuevo) fs.writeFileSync(HTML, htmlNuevo);
console.log(`script.js: ${partes.length} partes · ${codigo.split('\n').length - 1} líneas · v=${hash}`);
