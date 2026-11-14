/**
 * Utilidades de las pruebas «reales»: servidor estático de public/, carga de Playwright y del
 * navegador (con el proxy del entorno si lo hay) y un contador de resultados.
 */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), { execSync } = require('child_process');

const PUBLIC = path.join(__dirname, '..', '..', 'public');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

/** Sirve public/ en un puerto libre. → { url, cerrar } */
function servir() {
  return new Promise(ok => {
    const srv = http.createServer((req, res) => {
      let f = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      f = path.join(PUBLIC, path.normalize(f).replace(/^(\.\.[/\\])+/, ''));
      if (!f.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
      fs.stat(f, (e, st) => {
        if (!e && st.isDirectory()) f = path.join(f, 'index.html');
        fs.readFile(f, (err, d) => { if (err) { res.writeHead(404); return res.end('no'); } res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
      });
    });
    srv.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${srv.address().port}`, cerrar: () => srv.close() }));
  });
}

/** Un módulo instalado en test/real, en el proyecto o globalmente (en la nube de Claude Playwright viene global). */
function requerir(nombre) {
  try { return require(nombre); } catch (_) {}
  try { return require(path.join(execSync('npm root -g').toString().trim(), nombre)); } catch (_) {}
  throw new Error(`Falta «${nombre}». Instálalo con: cd test/real && npm install`);
}

async function navegador() {
  const { chromium } = requerir('playwright');
  const px = process.env.HTTPS_PROXY || process.env.https_proxy;
  const opciones = px ? { proxy: { server: px, bypass: 'localhost,127.0.0.1' } } : {};
  if (process.env.CHROMIUM_PATH) opciones.executablePath = process.env.CHROMIUM_PATH;   // navegador ya instalado (otra versión de Playwright)
  return chromium.launch(opciones);
}

function contador(titulo) {
  let ok = 0, mal = 0;
  console.log(`\n${titulo}`);
  return {
    seccion: s => console.log(`\n${s}`),
    prueba(nombre, cond, detalle = '') { cond ? ok++ : mal++; console.log(`  ${cond ? '✓' : '✗'} ${nombre}${!cond && detalle ? `\n      → ${String(detalle).slice(0, 400)}` : ''}`); return !!cond; },
    fin() { console.log(`\n${ok} bien · ${mal} mal`); return mal; },
  };
}

module.exports = { servir, requerir, navegador, contador, PUBLIC };
