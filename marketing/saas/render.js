#!/usr/bin/env node
/**
 * Graba el video SaaS de UpGames cuadro a cuadro (1920×1080) y le mezcla música y efectos.
 *   node render.js                     → upgames-saas.mp4 (60 fps, con audio)
 *   FPS=30 node render.js              → otra cadencia
 *   PREVIEW="2,6.5,13" node render.js  → solo esos instantes como PNG (prev-XX.XX.png)
 *   SOLO_AUDIO=1 node render.js        → rehace el audio de un video ya grabado
 * Necesita Playwright (Chromium) y ffmpeg. El sonido está en audio.js.
 */
'use strict';
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { mezclar } = require('./audio');

(async () => {
  const fps = +(process.env.FPS || 60);
  const salida = process.argv[2] || path.join(__dirname, 'upgames-saas.mp4');
  const tmp = salida.replace(/\.mp4$/, '.sin-audio.mp4');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  p.on('pageerror', e => console.error('ERROR página:', e.message));
  await p.goto('file://' + path.join(__dirname, 'video.html'));
  await p.evaluate(() => window.listo);
  const dur = await p.evaluate(() => window.DURACION);
  const cues = await p.evaluate(() => window.SFX);
  if (process.env.PREVIEW) {
    const dir = process.env.PREVIEW_DIR || __dirname;
    for (const t of process.env.PREVIEW.split(',').map(Number)) {
      await p.evaluate(t => window.render(t), t);
      await p.screenshot({ path: path.join(dir, `prev-${t.toFixed(2).padStart(5, '0')}.png`) });
    }
    await b.close(); return;
  }
  if (!process.env.SOLO_AUDIO) {
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(fps), tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
    const total = Math.round(dur * fps), t0 = Date.now();
    for (let i = 0; i < total; i++) {
      await p.evaluate(t => window.render(t), i / fps);
      const img = await p.screenshot({ type: 'jpeg', quality: 95 });
      if (!ff.stdin.write(img)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 300 === 0) console.log(`${i}/${total} cuadros · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  }
  await b.close();
  await mezclar(dur, cues, tmp, salida);
  if (!process.env.CONSERVAR) fs.unlinkSync(tmp);
  console.log('Listo:', salida);
})();
