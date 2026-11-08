#!/usr/bin/env node
/**
 * Audio de la intro:
 *   1. Corta la locución (voz-intro.mp3) en sus 8 frases, la hace un 5 % más
 *      pausada y coloca cada frase en el momento que marca INTRO.VOCES.
 *   2. Música (musica-intro.mp3, sin copyright) desde 0 s: su caída cae en 30,33 s,
 *      justo al salir del túnel; baja sola cuando habla la voz.
 *   3. Efectos sintetizados en los instantes de INTRO.SFX.
 *   4. Normaliza a −14 LUFS → intro-mezcla.wav (para los MP4) y
 *      public/intro/intro-audio.mp3 (el que suena en la web).
 *   node mezcla.js
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { spawnSync, execFileSync } = require('child_process');
const { chromium } = require('playwright');
const A = require('../patrocinio/audio.js');
const { tono, whoosh, ruidoFiltrado, sumar, retrasar, ganancia, campana2, mono, ruido, rnd, lpK, sat } = A.util;
const SR = A.SR;

// Cortes de la locución (s, en los silencios entre frases)
const CORTES = [0, 2.215, 5.715, 8.855, 10.415, 12.645, 14.115, 18.365, 20.61];
const TEMPO = 0.95;

/* ── Efectos nuevos de la intro ── */
Object.assign(A.GEN, {
  chispa: () => { const bs = []; for (let i = 0; i < 14; i++) { const t0 = rnd() * .12; bs.push(retrasar(ruidoFiltrado(.02, () => 3000 + rnd() * 5000, t => .5 * Math.exp(-t * 200), () => ruido() * .6, .7), t0)); } bs.push(tono(.15, () => 120, t => .12 * Math.exp(-t * 20), 'sq')); return sumar(...bs); },
  apagado: () => sumar(tono(1.3, t => 220 * Math.exp(-t * 2.2) + 30, t => .32 * Math.exp(-t * 1.6), 'tri'), tono(1.3, t => 55 * Math.exp(-t * 1.2) + 20, t => .5 * Math.exp(-t * 2)), ganancia(ruidoFiltrado(.5, t => 4000 * Math.exp(-t * 6) + 200, t => .3 * Math.exp(-t * 6), () => 0, .3), 1)),
  linea: () => sumar(tono(1.4, t => 2600 * Math.exp(-t * 3) + 700, t => .14 * Math.exp(-t * 2.2) * Math.min(1, t * 200), 'sin'), tono(1.4, t => 5200 * Math.exp(-t * 3) + 1400, t => .05 * Math.exp(-t * 3)), ganancia(whoosh(.5, 2000, 9000), .4)),
  encendido: () => { const d = 2.6; return sumar(tono(d, t => 40 + 70 * (t / d), t => .45 * Math.min(1, t * 3) * Math.exp(-Math.max(0, t - 1.6) * 2), 'tri'), tono(d, t => 80 + 140 * (t / d), t => .12 * Math.min(1, t) * Math.exp(-Math.max(0, t - 1.6) * 2), 'sq'), retrasar(A.GEN.impacto(), 0), ganancia(ruidoFiltrado(d, t => 300 + 4000 * (t / d), t => .25 * (t / d) * Math.exp(-Math.max(0, t - 2) * 6), () => 0, .4), 1)); },
  paso_luz: () => { const d = 1.6; let fase = 0, fase2 = 0; return mono(d, t => { const k = t / d; const f = 160 * Math.pow(2, -(k - .5) * 1.4); fase += 6.2832 * f / SR; fase2 += 6.2832 * f * 2.01 / SR; const env = Math.exp(-Math.pow((k - .5) / .2, 2)); return (Math.sign(Math.sin(fase)) * .25 + Math.sin(fase2) * .3) * env * .55; }, t => -1 + 2 * t / d); },
  portal: () => { const d = 3.2; return sumar(tono(d, () => 55, t => .35 * Math.sin(Math.PI * t / d), 'sin'), tono(d, () => 110.5, t => .12 * Math.sin(Math.PI * t / d) * (1 + .5 * Math.sin(t * 7)), 'tri'), tono(d, () => 1650, t => .025 * Math.sin(Math.PI * t / d) * (1 + Math.sin(t * 13)))); },
  riser_largo: () => { const d = 3.93; return sumar(ruidoFiltrado(d, t => 300 + 11000 * (t / d) ** 2.4, t => .85 * (t / d) ** 2.6 * Math.min(1, (d - t) * 80), t => Math.sin(t * 6) * .5, .5), tono(d, t => 90 + 900 * (t / d) ** 2.2, t => .22 * (t / d) ** 2 * Math.min(1, (d - t) * 80), 'tri'), tono(d, t => 45 + 30 * (t / d), t => .25 * (t / d) * Math.min(1, (d - t) * 80))); },
  rayo: () => sumar(tono(.9, t => 300 + 2400 * Math.min(1, t * 3), t => .16 * Math.exp(-t * 2.5), 'sq'), ganancia(whoosh(.7, 800, 9000), .7), retrasar(campana2(1568, 1.2, .14), .05)),
});

(async () => {
  const pag = path.join(__dirname, '..', '..', 'public', 'intro', 'index.html');
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 640, height: 360 } });
  await p.goto(`file://${pag}?render&w=640&h=360`);
  await p.evaluate(() => window.listo);
  const { cues, voces, dur } = await p.evaluate(() => ({ cues: window.SFX, voces: window.VOCES, dur: window.DURACION }));
  await b.close();

  const sfx = path.join(__dirname, 'sfx.wav');
  fs.writeFileSync(sfx, A.sintetizarPista(cues, dur));
  const voz = path.join(__dirname, 'voz-intro.mp3'), mus = path.join(__dirname, 'musica-intro.mp3');
  const n = voces.length;
  const clips = voces.map((v, i) => `[c${i}]atrim=${CORTES[v.f - 1]}:${CORTES[v.f]},asetpts=PTS-STARTPTS,afade=t=in:d=0.01,afade=t=out:st=${(CORTES[v.f] - CORTES[v.f - 1] - .03).toFixed(3)}:d=0.03,atempo=${TEMPO},adelay=${Math.round(v.at * 1000)}:all=1[v${i}]`);
  const grafo = [
    `[0:a]aresample=${SR},asplit=${n}${voces.map((_, i) => `[c${i}]`).join('')}`,
    ...clips,
    `${voces.map((_, i) => `[v${i}]`).join('')}amix=inputs=${n}:normalize=0:duration=longest,highpass=f=75,equalizer=f=140:t=q:w=1:g=2,equalizer=f=3000:t=q:w=1.2:g=2.5,acompressor=threshold=-20dB:ratio=3:attack=4:release=150:makeup=4dB,volume=2.4,alimiter=limit=0.95:attack=2:release=40,aformat=channel_layouts=stereo,asplit=2[vseca][llave]`,
    `[vseca]aecho=0.85:0.6:70|130|210:0.22|0.15|0.09[voz]`,
    `[1:a]atrim=0:${dur},asetpts=PTS-STARTPTS,aresample=${SR},volume=0.42,afade=t=out:st=${(dur - 3).toFixed(2)}:d=2.8[mus]`,
    `[mus][llave]sidechaincompress=threshold=0.05:ratio=3.5:attack=15:release=420:makeup=1[musb]`,
    `[2:a]aresample=${SR},aecho=0.8:0.55:50|110:0.25|0.14,highpass=f=28[fx]`,
    `[voz][musb][fx]amix=inputs=3:normalize=0:weights=1 1 0.8:duration=longest,atrim=0:${dur}[mix]`,
  ].join(';');
  const ent = ['-i', voz, '-i', mus, '-i', sfx];
  const med = spawnSync('ffmpeg', ['-hide_banner', '-y', ...ent, '-filter_complex', grafo + ';[mix]loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json[o]', '-map', '[o]', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = (med.stderr || '').match(/\{[^{}]*"input_i"[^{}]*\}/);
  if (!m) { console.error(med.stderr.slice(-2000)); process.exit(1); }
  const j = JSON.parse(m[0]);
  const ln = `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
  const wav = path.join(__dirname, 'intro-mezcla.wav');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...ent, '-filter_complex', grafo + `;[mix]${ln},alimiter=limit=0.89,aresample=${SR}[o]`, '-map', '[o]', '-c:a', 'pcm_s16le', wav], { stdio: 'inherit' });
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '192k', path.join(__dirname, '..', '..', 'public', 'intro', 'intro-audio.mp3')], { stdio: 'inherit' });
  fs.unlinkSync(sfx);
  console.log('Listo: intro-mezcla.wav y public/intro/intro-audio.mp3 ·', cues.length, 'efectos ·', n, 'frases');
})();
