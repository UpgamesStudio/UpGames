#!/usr/bin/env node
/**
 * Graba un video de patrocinio cuadro a cuadro y le mezcla voz, música y efectos.
 *   node render.js 1            → upgames-patrocinio-1.mp4 (60 fps, con audio)
 *   node render.js 2            → upgames-patrocinio-2.mp4
 *   PREVIEW="1,8.2,12" node render.js 1   → solo esos instantes como PNG
 *   FPS=30 node render.js 1     → otra cadencia
 * Necesita Playwright (Chromium) y ffmpeg. La mezcla de audio está en audio.js.
 */
'use strict';
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { mezclar } = require('./audio');

(async () => {
  const n = process.argv[2] || '1';
  const fps = +(process.env.FPS || 60);
  const salida = process.argv[3] || path.join(__dirname, `upgames-patrocinio-${n}.mp4`);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.error('ERROR página:', e.message));
  p.on('console', m => { if (m.type() === 'error') console.error('consola:', m.text()); });
  await p.goto('file://' + path.join(__dirname, `video${n}.html`));
  await p.evaluate(() => window.listo);
  const dur = await p.evaluate(() => window.DURACION);
  if (process.env.PREVIEW) {
    const dir = process.env.PREVIEW_DIR || __dirname;
    for (const t of process.env.PREVIEW.split(',').map(Number)) {
      await p.evaluate(t => window.render(t), t);
      await p.screenshot({ path: path.join(dir, `prev${n}-${t.toFixed(2).padStart(5, '0')}.png`) });
    }
    await b.close(); return;
  }
  const cues = await p.evaluate(() => window.SFX);
  const tmp = salida.replace(/\.mp4$/, '.sin-audio.mp4');
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '15', '-pix_fmt', 'yuv420p', '-r', String(fps), tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
  const total = Math.round(dur * fps), t0 = Date.now();
  for (let i = 0; i < total; i++) {
    await p.evaluate(t => window.render(t), i / fps);
    const img = await p.screenshot({ type: 'jpeg', quality: 94 });
    if (!ff.stdin.write(img)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 300 === 0) console.log(`video ${n}: ${i}/${total} cuadros · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await b.close();
  await mezclar(+n, dur, cues, tmp, salida);
  fs.unlinkSync(tmp);
  console.log('Listo:', salida);
})();
