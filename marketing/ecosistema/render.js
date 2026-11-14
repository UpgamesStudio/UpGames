#!/usr/bin/env node
/**
 * Graba el video «Todo UpGames» cuadro a cuadro (1920×1080, 60 fps) en paralelo y le mezcla la música y los efectos.
 *   node render.js [salida.mp4]            graba todo (≈ 8 min con 4 núcleos)
 *   FPS=30 WORKERS=2 node render.js        otra cadencia / otros procesos
 *   PREVIEW="2,14.6,40" node render.js     solo esos instantes como PNG (prev-XX.XX.png)
 *   SOLO_AUDIO=1 CONSERVAR=1 node render.js  rehace el audio (necesita el .sin-audio.mp4)
 * Necesita Playwright (Chromium) y ffmpeg. Las capturas de img/ las genera capturar.js.
 */
'use strict';
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs'), os = require('os');
const { mezclar } = require('./audio');
const URL_VIDEO = 'file://' + path.join(__dirname, 'video.html');

async function trabajador(a, b, dir, fps) {
  const br = await chromium.launch(), p = await br.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.error('ERROR página:', e.message));
  await p.goto(URL_VIDEO); await p.evaluate(() => window.listo);
  for (let i = a; i < b; i++) {
    await p.evaluate(t => window.render(t), i / fps);
    fs.writeFileSync(path.join(dir, String(i).padStart(5, '0') + '.jpg'), await p.screenshot({ type: 'jpeg', quality: 94 }));
    if ((i - a) % 200 === 0) console.log(`  [${a}-${b}] ${i - a}/${b - a}`);
  }
  await br.close();
}

(async () => {
  if (process.argv[2] === '--trabajador') { await trabajador(+process.argv[3], +process.argv[4], process.argv[5], +process.argv[6]); return; }
  const fps = +(process.env.FPS || 60), salida = path.resolve(process.argv[2] || path.join(__dirname, 'upgames-ecosistema.mp4'));
  const tmp = salida.replace(/\.mp4$/, '.sin-audio.mp4');
  const br = await chromium.launch(), p = await br.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => console.error('ERROR página:', e.message));
  await p.goto(URL_VIDEO); await p.evaluate(() => window.listo);
  const dur = await p.evaluate(() => window.DURACION), cues = await p.evaluate(() => window.SFX);
  if (process.env.PREVIEW) {
    const dir = process.env.PREVIEW_DIR || __dirname;
    for (const t of process.env.PREVIEW.split(',').map(Number)) { await p.evaluate(t => window.render(t), t); await p.screenshot({ path: path.join(dir, `prev-${t.toFixed(2).padStart(5, '0')}.png`) }); }
    await br.close(); return;
  }
  await br.close();
  if (!process.env.SOLO_AUDIO) {
    const total = Math.round(dur * fps), n = +(process.env.WORKERS || Math.max(1, Math.min(4, os.cpus().length)));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecosistema-')), t0 = Date.now();
    console.log(`Grabando ${total} cuadros con ${n} procesos en ${dir}`);
    await Promise.all(Array.from({ length: n }, (_, k) => new Promise((ok, no) => {
      const a = Math.floor(total * k / n), b = Math.floor(total * (k + 1) / n);
      const h = spawn('node', [__filename, '--trabajador', a, b, dir, fps], { stdio: 'inherit' }); h.on('close', c => c ? no(new Error('trabajador ' + k)) : ok());
    })));
    console.log(`Cuadros listos en ${((Date.now() - t0) / 1000).toFixed(0)} s; codificando…`);
    await new Promise((ok, no) => { const f = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(dir, '%05d.jpg'), '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(fps), tmp], { stdio: 'inherit' }); f.on('close', c => c ? no(new Error('ffmpeg')) : ok()); });
    fs.rmSync(dir, { recursive: true, force: true });
  }
  await mezclar(dur, cues, tmp, salida);
  if (!process.env.CONSERVAR) fs.unlinkSync(tmp);
  console.log('Listo:', salida);
})().catch(e => { console.error(e); process.exit(1); });
