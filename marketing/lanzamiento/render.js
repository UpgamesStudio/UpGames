#!/usr/bin/env node
/**
 * Graba el film de lanzamiento cuadro a cuadro (1920×1080, 30 fps) en paralelo y le pone el sonido (audio.js).
 *   node render.js                       todo → lurveta-lanzamiento.mp4
 *   PREVIEW="8.2,14.6,40" node render.js solo esos instantes como PNG en previas/
 *   WORKERS=4 FPS=30 node render.js
 *   SOLO_AUDIO=1 node render.js          rehace el sonido sobre el video ya grabado (.sin-audio.mp4)
 * Sirve el repositorio por HTTP (el film carga módulos, el logotipo y las capturas). Necesita Playwright y ffmpeg.
 */
'use strict';
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const http = require('http'), path = require('path'), fs = require('fs'), os = require('os');
const RAIZ = path.resolve(__dirname, '..', '..');
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.otf': 'font/otf' };
const ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

function servidor() {
  return new Promise(ok => {
    const s = http.createServer((q, r) => {
      const f = path.join(RAIZ, decodeURIComponent(q.url.split('?')[0]));
      if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
      r.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
    }).listen(0, '127.0.0.1', () => ok(s));
  });
}
async function pagina(url) {
  const b = await chromium.launch({ args: ARGS }), p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.error('ERROR página:', e.message)); p.on('console', m => { if (m.type() === 'error') console.error('consola:', m.text()); });
  await p.goto(url); await p.evaluate(() => window.listo); return { b, p };
}

async function trabajador(url, a, b, dir, fps) {
  const { b: br, p } = await pagina(url);
  for (let i = a; i < b; i++) {
    await p.evaluate(t => window.render(t), i / fps);
    fs.writeFileSync(path.join(dir, String(i).padStart(5, '0') + '.jpg'), await p.screenshot({ type: 'jpeg', quality: 95 }));
    if ((i - a) % 150 === 0) console.log(`  [${a}-${b}] ${i - a}/${b - a}`);
  }
  await br.close();
}

(async () => {
  if (process.argv[2] === '--trabajador') { await trabajador(process.argv[3], +process.argv[4], +process.argv[5], process.argv[6], +process.argv[7]); return; }
  const fps = +(process.env.FPS || 30), salida = path.resolve(process.argv[2] || path.join(__dirname, 'lurveta-lanzamiento.mp4'));
  const tmp = salida.replace(/\.mp4$/, '.sin-audio.mp4');
  const srv = await servidor(), url = `http://127.0.0.1:${srv.address().port}/marketing/lanzamiento/video.html`;
  const { b, p } = await pagina(url);
  const dur = await p.evaluate(() => window.DURACION), cues = await p.evaluate(() => window.SFX);
  fs.writeFileSync(path.join(__dirname, 'sfx.json'), JSON.stringify(cues, null, 0));
  if (process.env.PREVIEW) {
    const dir = path.join(__dirname, 'previas'); fs.mkdirSync(dir, { recursive: true });
    for (const t of process.env.PREVIEW.split(',').map(Number)) { await p.evaluate(t => window.render(t), t); await p.screenshot({ path: path.join(dir, `p-${t.toFixed(2).padStart(5, '0')}.png`) }); }
    await b.close(); srv.close(); return;
  }
  await b.close();
  if (!process.env.SOLO_AUDIO) {
    const total = Math.round(dur * fps), n = +(process.env.WORKERS || Math.max(1, Math.min(4, os.cpus().length)));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lurveta-')), t0 = Date.now();
    console.log(`Grabando ${total} cuadros con ${n} procesos en ${dir}`);
    await Promise.all(Array.from({ length: n }, (_, k) => new Promise((ok, no) => {
      const a = Math.floor(total * k / n), z = Math.floor(total * (k + 1) / n);
      const h = spawn('node', [__filename, '--trabajador', url, a, z, dir, fps], { stdio: 'inherit' }); h.on('close', c => c ? no(new Error('trabajador ' + k)) : ok());
    })));
    console.log(`Cuadros listos en ${((Date.now() - t0) / 60000).toFixed(1)} min. Codificando…`);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(dir, '%05d.jpg'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(fps), tmp]);
    fs.rmSync(dir, { recursive: true, force: true });
  }
  srv.close();
  const wav = path.join(__dirname, 'sonido.wav');
  execFileSync('node', [path.join(__dirname, 'audio.js'), wav, String(dur)], { stdio: 'inherit' });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-ar', '48000', '-shortest', '-movflags', '+faststart', salida]);
  console.log('Listo:', salida);
})();
