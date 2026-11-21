/**
 * «Modelo» de Nexus para la demo del tutorial, con la API de Groq (POST /chat/completions).
 * Por decisión del dueño de Lurveta, las respuestas las escribió Claude siguiendo AL PIE DE LA LETRA los
 * prompts reales de Nexus (modulos/blogs/escritor.js) con la entrada que teclea el usuario del tutorial.
 * Todo lo demás es el código real: llm.json → armarLanding / validación → editor → página pública.
 * Las respuestas están en nexus/*.json. Se elige cuál según el prompt de sistema que manda el servidor.
 */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const R = n => fs.readFileSync(path.join(__dirname, 'nexus', n + '.json'), 'utf8');
const CUAL = [[/Diseñas landing pages/, 'landing'], [/editor de textos de Lurveta Blogs/, 'texto'], [/especialista SEO/, 'seo'], [/director de arte/, 'colores']];
module.exports = puerto => http.createServer((q, r) => {
  if (q.method === 'GET') { r.writeHead(200, { 'Content-Type': 'application/json' }); return r.end('{"data":[{"id":"nexus-demo"}]}'); }
  let b = ''; q.on('data', d => b += d); q.on('end', () => {
    let sistema = ''; try { sistema = JSON.parse(b).messages?.[0]?.content || ''; } catch (_) {}
    const hit = CUAL.find(([re]) => re.test(sistema));
    const contenido = hit ? R(hit[1]) : '{}';
    setTimeout(() => {   // un modelo real tarda un poco
      r.writeHead(200, { 'Content-Type': 'application/json' });
      r.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: contenido } }] }));
    }, 900);
  });
}).listen(puerto, '127.0.0.1');
