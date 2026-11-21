#!/usr/bin/env node
/**
 * Entorno de demostración del tutorial de Lurveta Blogs: el servidor REAL (index.js) con una base de datos
 * temporal en memoria. No toca producción. Crea la cuenta de ejemplo (correo verificado) y sirve la web
 * (public/, index.html…) desde el repositorio para que el navegador use la interfaz real.
 *
 *   node servidor.js        API en http://127.0.0.1:10091 · web en http://127.0.0.1:10092
 * Escribe demo.json con el token de la cuenta de ejemplo. Ctrl+C para cerrar.
 * Nexus (IA): las respuestas del modelo las sirve nexus-modelo.js con la API de Groq (ver ese archivo).
 */
'use strict';
const path = require('path'), fs = require('fs'), http = require('http');
const { spawn } = require('child_process');
const REPO = path.join(__dirname, '..', '..');
const req = m => require(path.join(REPO, 'test/real/node_modules', m));
const { MongoMemoryServer } = req('mongodb-memory-server');
const mongoose = require(REPO + '/node_modules/mongoose'), jwt = require(REPO + '/node_modules/jsonwebtoken'), bcrypt = require(REPO + '/node_modules/bcryptjs');
const SECRET = 'demo-tutorial-blogs-secreto-largo-0123456789abcdef', API = 10091, WEB = 10092, NEXUS = 10093;
const USUARIO = 'devindie';
const espera = ms => new Promise(r => setTimeout(r, ms));
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };

(async () => {
  require('./nexus-modelo')(NEXUS);
  const m = await MongoMemoryServer.create(), uri = m.getUri('lurveta');
  const env = { ...process.env, MONGODB_URI: uri, JWT_SECRET: SECRET, PORT: String(API), NODE_ENV: 'development', APP_URL: 'https://lurveta.com',
    RAILWAY_PUBLIC_DOMAIN: 'lurveta.com', CORS_ORIGINS: `http://127.0.0.1:${WEB}`, GROQ_API_KEY: 'gsk_demo-nexus-local', GROQ_API_URL: `http://127.0.0.1:${NEXUS}` };   // Nexus de la demo (nexus-modelo.js)
  const srv = spawn('node', ['index.js'], { cwd: REPO, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => { log += d; }); srv.stderr.on('data', d => { log += d; });
  for (let i = 0; i < 80; i++) { try { await fetch(`http://127.0.0.1:${API}/blogs/temas`); break; } catch (_) { await espera(500); } }
  await mongoose.connect(uri);
  const db = mongoose.connection.db, hash = await bcrypt.hash('demo', 4);
  await db.collection('usuarios').insertOne({ usuario: USUARIO, email: `${USUARIO}@demo.test`, password: hash, emailVerificado: true, listaSeguidores: [], seguidos: [], saldo: 0, createdAt: new Date() });
  const token = jwt.sign({ usuario: USUARIO, email: `${USUARIO}@demo.test`, sv: 0 }, SECRET, { expiresIn: '12h' });
  fs.writeFileSync(path.join(__dirname, 'demo.json'), JSON.stringify({ api: `http://127.0.0.1:${WEB}`, web: `http://127.0.0.1:${WEB}`, usuario: USUARIO, token }, null, 1));

  // La web estática del repositorio (como la sirve producción): /, /public/…, /b/… va a la API
  // Un solo origen, como en producción: los archivos del repositorio y, todo lo demás, la API real (proxy inverso)
  const aApi = async (q, r) => {
    const cuerpo = await new Promise(ok => { const t = []; q.on('data', d => t.push(d)); q.on('end', () => ok(Buffer.concat(t))); });
    const h = { ...q.headers }; delete h.host; delete h['content-length'];
    const x = await fetch(`http://127.0.0.1:${API}${q.url}`, { method: q.method, headers: h, body: ['GET', 'HEAD'].includes(q.method) ? undefined : cuerpo, redirect: 'manual' }).catch(() => null);
    if (!x) { r.writeHead(502); return r.end(); }
    const sal = {}; x.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(k)) sal[k] = v; });
    r.writeHead(x.status, sal); r.end(Buffer.from(await x.arrayBuffer()));
  };
  http.createServer(async (q, r) => {
    const u = q.url.split('?')[0];
    let f = path.join(REPO, decodeURIComponent(u === '/' ? '/index.html' : u));
    if (f.endsWith('/')) f += 'index.html';
    if (q.method === 'GET' && f.startsWith(REPO) && !/^\/b\//.test(u) && fs.existsSync(f) && !fs.statSync(f).isDirectory()) {
      r.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); return fs.createReadStream(f).pipe(r);
    }
    aApi(q, r);
  }).listen(WEB, '127.0.0.1');
  console.log(`Listo · API http://127.0.0.1:${API} · web http://127.0.0.1:${WEB} · cuenta @${USUARIO}`);
  process.on('SIGINT', async () => { srv.kill(); await m.stop(); process.exit(0); });
  process.on('SIGTERM', async () => { srv.kill(); await m.stop(); process.exit(0); });
  srv.on('exit', c => { console.log('index.js terminó', c, log.slice(-2000)); process.exit(1); });
})();
