#!/usr/bin/env node
/**
 * UpGames Blogs de extremo a extremo: el servidor REAL (index.js) contra MongoDB real (en memoria).
 * Crea cuentas, blogs, entradas, comentarios y comprueba Premium, avisos a seguidores, el bloque
 * de descarga, la CSP del marco de comentarios y que el botón «Comprar» ya no existe.
 * Uso: node test/real/blogs.js   (necesita: cd test/real && npm install)
 */
'use strict';
const { requerir } = require('./util');
const { MongoMemoryServer } = requerir('mongodb-memory-server');
const { spawn } = require('child_process'); const path = require('path');
const REPO = path.join(__dirname, '..', '..');
const mongoose = require(REPO + '/node_modules/mongoose'); const jwt = require(REPO + '/node_modules/jsonwebtoken'); const bcrypt = require(REPO + '/node_modules/bcryptjs');
const SECRET = 'e2e-secreto-largo-para-pruebas-0123456789abcdef', PORT = 10077, A = `http://127.0.0.1:${PORT}`;
let ok = 0, mal = 0; const prueba = (n, c, extra = '') => { c ? ok++ : mal++; console.log(`${c ? '  ✓' : '  ✗'} ${n}${!c && extra ? ' → ' + extra : ''}`); };
const espera = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const m = await MongoMemoryServer.create(); const uri = m.getUri('upgames');
  const srv = spawn('node', ['index.js'], { cwd: REPO, env: { ...process.env, MONGODB_URI: uri, JWT_SECRET: SECRET, PORT: String(PORT), NODE_ENV: 'development', GROQ_API_KEY: '', APP_URL: 'https://upgames.games', HTTPS_PROXY: '', HTTP_PROXY: '' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
  for (let i = 0; i < 60; i++) { try { await fetch(A + '/blogs/temas'); break; } catch (_) { await espera(500); } }
  await mongoose.connect(uri); const db = mongoose.connection.db;
  const hash = await bcrypt.hash('x', 4);
  const mkU = (u, extra = {}) => db.collection('usuarios').insertOne({ usuario: u, email: `${u}@t.test`, password: hash, emailVerificado: true, listaSeguidores: [], seguidos: [], saldo: 0, createdAt: new Date(), ...extra });
  await mkU('kale', { listaSeguidores: ['lena', 'kio'] }); await mkU('lena'); await mkU('kio'); await mkU('vip', { planHasta: new Date(Date.now() + 864e6) });
  const tok = u => jwt.sign({ usuario: u, email: `${u}@t.test`, sv: 0 }, SECRET, { expiresIn: '1h' });
  const api = async (ruta, { m = 'GET', u, body } = {}) => { const r = await fetch(A + ruta, { method: m, headers: { 'Content-Type': 'application/json', ...(u ? { Authorization: `Bearer ${tok(u)}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); let d; const t = await r.text(); try { d = JSON.parse(t); } catch (_) { d = t; } return { s: r.status, d }; };
  const juego = (await db.collection('juegos').insertOne({ title: 'Mod de prueba', usuario: 'leo', status: 'aprobado', category: 'Mod', image: 'https://res.cloudinary.com/x/image/upload/a.jpg', link: 'https://x.test', description: 'Mejora el rendimiento', createdAt: new Date() })).insertedId.toString();

  console.log('Blog y Premium');
  let r = await api('/blogs', { m: 'POST', u: 'kale', body: { titulo: 'Blog de Kale', direccion: 'kale-mods', tema: 'neon' } });
  prueba('crear blog', r.d.success, JSON.stringify(r.d)); const blog = r.d.blog;
  r = await api(`/blogs/${blog.id}`, { m: 'PUT', u: 'kale', body: { tema: 'cristal' } });
  prueba('tema Premium rechazado sin Premium (403)', r.s === 403 && r.d.code === 'PREMIUM', `${r.s} ${JSON.stringify(r.d)}`);
  r = await api('/blogs', { m: 'POST', u: 'kale', body: { titulo: 'Otro', direccion: 'kale-dos', tema: 'cristal' } });
  prueba('crear con tema Premium sin Premium (403)', r.s === 403, `${r.s}`);
  r = await api('/blogs', { m: 'POST', u: 'vip', body: { titulo: 'Blog VIP', direccion: 'vip-blog', tema: 'cristal' } });
  prueba('Premium sí puede usar Cristal', r.d.success && r.d.blog.tema === 'cristal', JSON.stringify(r.d));
  r = await api('/blogs/mios', { u: 'vip' }); prueba('Premium: máximo 10 blogs', r.d.maximo === 10 && r.d.premium === true, JSON.stringify(r.d).slice(0, 120));
  r = await api('/blogs/mios', { u: 'kale' }); prueba('Gratis: máximo 3 blogs', r.d.maximo === 3 && r.d.premium === false);

  console.log('Entrada con descarga y aviso a seguidores');
  r = await api(`/blogs/${blog.id}/entradas`, { m: 'POST', u: 'kale', body: { tipo: 'entrada', titulo: 'Reseña del mod', estado: 'publicada', bloques: [{ tipo: 'texto', texto: 'Una reseña larga del mod para probar que todo funciona bien en el blog.' }, { tipo: 'descarga', id: juego }, { tipo: 'juego', id: juego }] } });
  prueba('publicar entrada', r.d.success, JSON.stringify(r.d).slice(0, 200)); const ent = r.d.entrada;
  await espera(1500);
  const notifs = await db.collection('notificaciones').find({ tipo: 'nueva_entrada' }).toArray();
  prueba('aviso a los 2 seguidores', notifs.length === 2 && notifs.every(n => /^http/.test(n.itemId)), JSON.stringify(notifs.map(n => [n.destinatario, n.itemId])));
  await api(`/blogs/${blog.id}/entradas/${ent.id}`, { m: 'PUT', u: 'kale', body: { titulo: 'Reseña del mod (v2)', estado: 'publicada', bloques: [{ tipo: 'texto', texto: 'Texto editado y más largo para que pase la revisión del contenido.' }] } });
  await espera(1200);
  prueba('editar no vuelve a avisar', (await db.collection('notificaciones').countDocuments({ tipo: 'nueva_entrada' })) === 2);
  const pag = await fetch(`${A}/b/kale-mods/e/${ent.slug}`); const html = await pag.text(); const csp = pag.headers.get('content-security-policy') || '';
  await api(`/blogs/${blog.id}/entradas/${ent.id}`, { m: 'PUT', u: 'kale', body: { titulo: 'Reseña del mod', estado: 'publicada', bloques: [{ tipo: 'texto', texto: 'Una reseña larga del mod para probar que todo funciona bien en el blog.' }, { tipo: 'descarga', id: juego }] } });
  const html2 = await (await fetch(`${A}/b/kale-mods/e/${ent.slug}?x=1`)).text();
  prueba('página de la entrada responde 200', pag.status === 200, pag.status);
  prueba('marco de comentarios en la página', html.includes('/public/blog-comentarios.html?e=' + ent.id), html.slice(0, 100));
  prueba('CSP permite el marco de UpGames', /frame-src[^;]*https:\/\/upgames\.games/.test(csp), csp);
  prueba('bloque Descarga → página puente', /puente\.html\?id=/.test(html2), '');
  prueba('«Hecho con UpGames» en blog gratis', html.includes('Hecho con'));
  const vipHtml = await (await fetch(`${A}/b/vip-blog/`)).text();
  prueba('Premium: sin «Hecho con UpGames» y con tema Cristal', !vipHtml.includes('Hecho con') && vipHtml.includes('#7C5CFF'));

  console.log('Comentarios');
  r = await api(`/blogs/comentarios/${ent.id}`, { m: 'POST', u: 'lena', body: { texto: '¡Corre perfecto en mi celular!' } });
  prueba('comentar con sesión', r.s === 201, JSON.stringify(r.d)); const cid = r.d.comentario?.id;
  r = await api(`/blogs/comentarios/${ent.id}`, { m: 'POST', body: { texto: 'anónimo' } }); prueba('sin sesión no comenta (401)', r.s === 401);
  r = await api(`/blogs/comentarios/${ent.id}`, { m: 'POST', u: 'lena', body: { texto: 'mira https://bit.ly/abc' } }); prueba('enlace acortado rechazado', r.s === 400, JSON.stringify(r.d));
  r = await api(`/blogs/comentarios/${ent.id}`); prueba('listar comentarios', r.d.comentarios?.length === 1 && r.d.dueno === 'kale', JSON.stringify(r.d));
  await espera(500);
  prueba('el dueño recibe la notificación', (await db.collection('notificaciones').countDocuments({ destinatario: 'kale', tipo: 'comentario' })) === 1);
  r = await api(`/blogs/comentarios/${ent.id}/${cid}`, { m: 'DELETE', u: 'kio' }); prueba('otro usuario no puede borrarlo', r.d.success === false);
  r = await api(`/blogs/comentarios/${ent.id}/${cid}`, { m: 'DELETE', u: 'kale' }); prueba('el dueño del blog sí lo borra', r.d.success === true);

  console.log('Nexus escritor');
  r = await api('/blogs/nexus/escribir', { m: 'POST', u: 'kale', body: { juegoId: juego } });
  prueba('sin clave de IA responde 503 con mensaje claro', r.s === 503 && /plantilla/.test(r.d.error), `${r.s} ${JSON.stringify(r.d)}`);

  console.log('Ficha: sin botón Comprar');
  r = await api('/items/detect-game', { m: 'POST', body: { title: 'GTA V mod' } }); prueba('detect-game ya no envía purchaseLink', r.d.detected && !('purchaseLink' in r.d), JSON.stringify(r.d));
  r = await api(`/items/buy-intent/${juego}`, { m: 'POST', body: {} }); prueba('buy-intent eliminado (404)', r.s === 404, r.s);

  console.log(`\n${ok} bien · ${mal} mal`);
  if (mal) console.log(log.split('\n').filter(l => /error|Error/.test(l)).slice(-10).join('\n'));
  srv.kill(); await mongoose.disconnect(); await m.stop(); process.exit(mal ? 1 : 0);
})().catch(e => { console.error('FALLO', e); process.exit(1); });
