#!/usr/bin/env node
/**
 * Graba la intro (public/intro/index.html) cuadro a cuadro.
 *   node render.js h        → upgames-intro-16x9.mp4 (1920×1080, 60 fps, con audio)
 *   node render.js v        → upgames-intro-9x16.mp4 (1080×1920)
 *   PREVIEW="0.6,8.5,31" node render.js h   → PNG de esos instantes
 * El audio es public/intro/intro-audio.mp3 (lo genera mezcla.js).
 */
'use strict';
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

(async () => {
  const f = process.argv[2] || 'h';
  const [w, h] = f === 'v' ? [1080, 1920] : [1920, 1080];
  const fps = +(process.env.FPS || 60);
  const salida = path.join(__dirname, `upgames-intro-${f === 'v' ? '9x16' : '16x9'}.mp4`);
  const pag = path.join(__dirname, '..', '..', 'public', 'intro', 'index.html');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.error('ERROR página:', e.message));
  await p.goto(`file://${pag}?render&w=${w}&h=${h}`);
  await p.evaluate(() => window.listo);
  const dur = await p.evaluate(() => window.DURACION);
  if (process.env.PREVIEW) {
    const dir = process.env.PREVIEW_DIR || __dirname;
    for (const t of process.env.PREVIEW.split(',').map(Number)) {
      await p.evaluate(t => window.render(t), t);
      await p.screenshot({ path: path.join(dir, `prev-${f}-${t.toFixed(2).padStart(5, '0')}.png`) });
    }
    await b.close(); return;
  }
  const mudo = salida.replace(/\.mp4$/, '.mudo.mp4');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', String(fps), mudo], { stdio: ['pipe', 'inherit', 'inherit'] });
  const total = Math.round(dur * fps), t0 = Date.now();
  for (let i = 0; i < total; i++) {
    await p.evaluate(t => window.render(t), i / fps);
    const img = await p.screenshot({ type: 'jpeg', quality: 93 });
    if (!ff.stdin.write(img)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 600 === 0) console.log(`intro ${f}: ${i}/${total} cuadros · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await b.close();
  const audio = path.join(__dirname, 'intro-mezcla.wav');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mudo, '-i', audio, '-map', '0:v', '-map', '1:a',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-maxrate', f === 'v' ? '22M' : '26M', '-bufsize', '50M', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', '-shortest', salida], { stdio: 'inherit' });
  fs.unlinkSync(mudo);
  console.log('Listo:', salida);
})();
