/**
 * Audio de los videos de patrocinio:
 *   1. Sintetiza los efectos (whoosh, golpes, glitch, clics, campanas…) en los
 *      instantes que cada escena registró con M.sfx() — sin archivos externos.
 *   2. Mezcla con ffmpeg: locución (voz_video.mp3) + música de public/audio
 *      (Infraction, sin copyright) que baja sola cuando habla la voz + efectos.
 *   3. Normaliza a −14 LUFS (redes sociales) en dos pasadas.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const SR = 48000;
const RAIZ = path.join(__dirname, '..', '..');
const VIDEOS = {
  // voz: tramo del archivo de locución · música: pista y segundo de inicio
  1: { vozDesde: 0, vozHasta: 43.0, musica: 'if-you-open-up.mp3', musDesde: 116.25 },
  2: { vozDesde: 43.0, vozHasta: 85.71, musica: 'dead-network.mp3', musDesde: 152.25 },
};
const VOZ = process.env.VOZ || path.join(__dirname, 'voz_video.mp3');

/* ── Síntesis ── */
let semilla = 12345;
const rnd = () => (semilla = (semilla * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const ruido = () => rnd() * 2 - 1;
const TAU = Math.PI * 2;
const lpK = fc => 1 - Math.exp(-TAU * Math.min(fc, SR * .45) / SR);

// cada generador devuelve [L, R]
const buf = s => [new Float32Array(Math.ceil(s * SR)), new Float32Array(Math.ceil(s * SR))];
const mono = (d, f, pan = () => 0) => {
  const [L, R] = buf(d);
  for (let i = 0; i < L.length; i++) { const t = i / SR, v = f(t, i), p = pan(t); L[i] = v * Math.cos((p + 1) * Math.PI / 4); R[i] = v * Math.sin((p + 1) * Math.PI / 4); }
  return [L, R];
};
const sat = x => Math.tanh(x);

const ruidoFiltrado = (d, fcF, envF, panF, hp = .3) => {
  let a = 0, b = 0;
  return mono(d, t => { const fc = fcF(t); a += lpK(fc) * (ruido() - a); b += lpK(fc * hp) * (a - b); return (a - b) * envF(t) * 2.2; }, panF);
};
const whoosh = (d, f0 = 300, f1 = 3800, g = 1) => ruidoFiltrado(d,
  t => { const k = t / d; return k < .6 ? f0 + (f1 - f0) * (k / .6) ** 2 : f1 - (f1 - f0 * 2) * ((k - .6) / .4); },
  t => { const k = t / d; return g * (k < .6 ? (k / .6) ** 2 : (1 - (k - .6) / .4) ** 1.5); },
  t => -0.7 + 1.4 * t / d);
const tono = (d, fF, envF, forma = 'sin') => {
  let fase = 0;
  return mono(d, t => {
    fase += TAU * fF(t) / SR;
    const s = forma === 'sq' ? Math.sign(Math.sin(fase)) * .5 : forma === 'tri' ? Math.asin(Math.sin(fase)) * .64 : Math.sin(fase);
    return s * envF(t);
  });
};
const sumar = (...bs) => {
  const n = Math.max(...bs.map(b => b[0].length));
  const [L, R] = [new Float32Array(n), new Float32Array(n)];
  for (const [l, r] of bs) for (let i = 0; i < l.length; i++) { L[i] += l[i]; R[i] += r[i]; }
  return [L, R];
};
const retrasar = (b, s) => { const off = Math.round(s * SR); const [L, R] = buf(b[0].length / SR + s); L.set(b[0], off); R.set(b[1], off); return [L, R]; };
const ganancia = (b, g) => { b[0].forEach((v, i) => { b[0][i] = v * g; b[1][i] *= g; }); return b; };
const campana = (f, d = .7, g = .35) => tono(d, () => f, t => g * Math.exp(-t * 6) * Math.min(1, t * 400));
const campana2 = (f, d = .8, g = .3) => sumar(campana(f, d, g), campana(f * 2.01, d, g * .35), campana(f * 3.02, d * .6, g * .12));

const GEN = {
  whoosh: () => whoosh(.75),
  swish: () => whoosh(.32, 900, 6000, .8),
  zoom: () => sumar(whoosh(.9, 200, 3000), tono(.9, t => 180 + 900 * (t / .9) ** 2, t => .18 * (t / .9) ** 2 * (1 - (t / .9) ** 8))),
  riser: () => { const d = 1.45; return sumar(ruidoFiltrado(d, t => 400 + 9000 * (t / d) ** 2.2, t => .9 * (t / d) ** 2.5 * Math.min(1, (d - t) * 60), t => Math.sin(t * 9) * .4, .5), tono(d, t => 140 + 1100 * (t / d) ** 2, t => .2 * (t / d) ** 2 * Math.min(1, (d - t) * 60), 'tri')); },
  riser_corto: () => { const d = .95; return sumar(ruidoFiltrado(d, t => 600 + 8000 * (t / d) ** 2, t => .7 * (t / d) ** 2.5 * Math.min(1, (d - t) * 60), () => 0, .5), tono(d, t => 220 + 900 * (t / d) ** 2, t => .15 * (t / d) ** 2 * Math.min(1, (d - t) * 60), 'tri')); },
  boom: () => {
    let a = 0;
    const sub = tono(2.4, t => 30 + 60 * Math.exp(-t * 2.5), t => sat(1.6 * Math.exp(-t * 1.9)) * .95);
    const cuerpo = tono(.4, t => 120 * Math.exp(-t * 4) + 50, t => .6 * Math.exp(-t * 12));
    const golpe = mono(.25, t => { a += lpK(2500) * (ruido() - a); return a * 1.6 * Math.exp(-t * 28); });
    return sumar(sub, cuerpo, golpe);
  },
  boom_suave: () => ganancia(GEN.boom(), .55),
  impacto: () => { let a = 0; return sumar(tono(.9, t => 40 + 70 * Math.exp(-t * 7), t => sat(1.3 * Math.exp(-t * 5)) * .8), mono(.2, t => { a += lpK(1800) * (ruido() - a); return a * 1.4 * Math.exp(-t * 22); })); },
  sello: () => { let a = 0, b = 0; return sumar(tono(.3, t => 150 * Math.exp(-t * 6) + 60, t => .8 * Math.exp(-t * 16)), mono(.08, t => { a += lpK(3000) * (ruido() - a); b += lpK(900) * (a - b); return (a - b) * 2.4 * Math.exp(-t * 50); })); },
  glitch: () => {
    let v = 0, cnt = 0, f = 300, fase = 0;
    return mono(.28, t => {
      if (cnt-- <= 0) { cnt = 40 + rnd() * 900; v = ruido(); f = 80 + rnd() * 1800; }
      fase += TAU * f / SR;
      const s = rnd() > .5 ? Math.sign(Math.sin(fase)) : v;
      return Math.round(s * 6) / 6 * .32 * (1 - t / .28) * (Math.sin(t * 90) > -.3 ? 1 : 0);
    }, () => ruido() * .3);
  },
  decode: () => { const bs = []; for (let i = 0; i < 18; i++) { const f = 1400 + rnd() * 2200; bs.push(retrasar(tono(.03, () => f, t => .1 * (1 - t / .03), 'sq'), i * .035)); } return sumar(...bs); },
  tecla: () => { let a = 0; return sumar(mono(.012, t => { a += lpK(5000) * (ruido() - a); return (ruido() - a) * .5 * Math.exp(-t * 400); }), tono(.02, () => 1900 + rnd() * 600, t => .07 * Math.exp(-t * 300))); },
  click: () => sumar(tono(.03, () => 2100, t => .35 * Math.exp(-t * 180)), tono(.06, t => 700 - 3000 * t, t => .35 * Math.exp(-t * 70))),
  pop: () => tono(.07, t => 500 + 9000 * t, t => .3 * Math.sin(Math.PI * t / .07)),
  error: () => sumar(tono(.12, () => 233, t => .16 * Math.min(1, (0.12 - t) * 80), 'sq'), retrasar(tono(.16, () => 185, t => .16 * Math.min(1, (0.16 - t) * 80), 'sq'), .12)),
  notif_mala: () => sumar(campana2(659, .5, .22), retrasar(campana2(523, .7, .22), .14)),
  exito: () => sumar(...[880, 1109, 1319, 1760].map((f, i) => retrasar(campana2(f, .9, .2), i * .07))),
  brillo: () => { const bs = []; for (let i = 0; i < 26; i++) { const f = 2200 + rnd() * 6500; bs.push(retrasar(tono(1.3, () => f, t => .045 * Math.exp(-t * 3.2) * Math.min(1, t * 200)), rnd() * .35)); } return sumar(...bs); },
  foco: () => sumar(GEN.sello(), tono(1.2, t => 58 + Math.sin(t * 600) * 2, t => .22 * Math.min(1, t * 6) * Math.exp(-t * 1.6)), ganancia(whoosh(.6, 150, 1200), .5)),
  contador: () => { const bs = []; let t = 0; for (let i = 0; i < 34; i++) { bs.push(retrasar(tono(.015, () => 2800 + i * 25, u => .11 * Math.exp(-u * 300)), t)); t += .018 + .05 * (i / 34) ** 3; } return sumar(...bs); },
  carga: () => tono(.85, t => 300 + 1000 * (t / .85) ** 1.5, t => .14 * (1 + .5 * Math.sin(t * 70)) * Math.min(1, t * 20) * Math.min(1, (0.85 - t) * 30), 'tri'),
  tachar: () => ruidoFiltrado(.32, t => 1500 + 5000 * t, t => .9 * Math.sin(Math.PI * t / .32), t => -0.5 + 3 * t, .5),
  moneda: () => sumar(campana2(1976, .25, .2), retrasar(campana2(2637, .9, .22), .08)),
  enviar: () => sumar(ganancia(whoosh(.3, 1200, 6000), .6), retrasar(GEN.pop(), .22)),
  recibir: () => sumar(campana2(1046, .6, .2), retrasar(campana2(1568, .8, .2), .1)),
  escribiendo: () => { const bs = []; for (let i = 0; i < 7; i++) bs.push(retrasar(GEN.tecla(), i * .1 + rnd() * .03)); return sumar(...bs); },
  zumbido: () => tono(3.6, () => 100, t => .05 * Math.min(1, t * 2) * Math.min(1, (3.6 - t) * 2) * (Math.sin(t * 23) > .8 ? .3 : 1), 'tri'),
  alarma: () => sumar(...[0, 1, 2, 3].map(i => retrasar(tono(.22, () => i % 2 ? 660 : 880, t => .13 * Math.min(1, t * 80) * Math.min(1, (.22 - t) * 80), 'sq'), i * .23))),
  latido: () => sumar(tono(.25, t => 55 + 30 * Math.exp(-t * 20), t => .9 * Math.exp(-t * 14)), retrasar(tono(.25, t => 50 + 25 * Math.exp(-t * 20), t => .6 * Math.exp(-t * 14)), .2)),
  roto: () => { const bs = [GEN.impacto()]; for (let i = 0; i < 40; i++) { const f = 2500 + rnd() * 6000; bs.push(retrasar(ruidoFiltrado(.05, () => f, t => .35 * Math.exp(-t * 90), () => ruido() * .8, .6), rnd() * .45)); } return sumar(...bs); },
  nivel: () => sumar(...[523, 659, 784, 1047, 1319, 1568].map((f, i) => retrasar(tono(.12, () => f, t => .1 * Math.min(1, (.12 - t) * 60), 'sq'), i * .06))),
  ventilador: () => ruidoFiltrado(2.2, () => 500, t => .12 * Math.min(1, t * 3) * Math.min(1, (2.2 - t) * 3), () => 0, .4),
};

const sintetizarPista = (cues, dur) => {
  const n = Math.ceil(dur * SR) + SR * 3;
  const L = new Float32Array(n), R = new Float32Array(n);
  const cache = {};
  for (const c of cues) {
    if (!GEN[c.s]) { console.warn('efecto desconocido:', c.s); continue; }
    semilla = 777 + Math.round(c.t * 1000);  // variación determinista por instante
    const [l, r] = c.s === 'tecla' || c.s === 'pop' || c.s === 'glitch' ? GEN[c.s]() : (cache[c.s] ||= GEN[c.s]());
    const off = Math.round(c.t * SR);
    for (let i = 0; i < l.length && off + i < n; i++) { L[off + i] += l[i] * c.g; R[off + i] += r[i] * c.g; }
  }
  // WAV float32 estéreo
  const datos = Buffer.alloc(n * 8);
  for (let i = 0; i < n; i++) { datos.writeFloatLE(L[i], i * 8); datos.writeFloatLE(R[i], i * 8 + 4); }
  const cab = Buffer.alloc(44);
  cab.write('RIFF', 0); cab.writeUInt32LE(36 + datos.length, 4); cab.write('WAVE', 8); cab.write('fmt ', 12);
  cab.writeUInt32LE(16, 16); cab.writeUInt16LE(3, 20); cab.writeUInt16LE(2, 22); cab.writeUInt32LE(SR, 24);
  cab.writeUInt32LE(SR * 8, 28); cab.writeUInt16LE(8, 32); cab.writeUInt16LE(32, 34); cab.write('data', 36); cab.writeUInt32LE(datos.length, 40);
  return Buffer.concat([cab, datos]);
};

const mezclar = async (n, dur, cues, videoMudo, salida) => {
  const v = VIDEOS[n];
  const sfxWav = salida.replace(/\.mp4$/, '.sfx.wav');
  fs.writeFileSync(sfxWav, sintetizarPista(cues, dur));
  const musica = path.join(RAIZ, 'public', 'audio', v.musica);
  const fadeOut = (dur - 1.6).toFixed(2);
  const grafo = [
    `[0:a]atrim=${v.vozDesde}:${v.vozHasta},asetpts=PTS-STARTPTS,aresample=${SR},highpass=f=85,equalizer=f=220:t=q:w=1:g=-2,equalizer=f=3200:t=q:w=1.2:g=2.5,acompressor=threshold=-20dB:ratio=3:attack=4:release=140:makeup=3dB,volume=1.25,aformat=channel_layouts=stereo,asplit=2[voz][llave]`,
    `[1:a]atrim=${v.musDesde}:${v.musDesde + dur},asetpts=PTS-STARTPTS,aresample=${SR},volume=0.62,afade=t=in:d=0.4,afade=t=out:st=${fadeOut}:d=1.6[mus]`,
    `[mus][llave]sidechaincompress=threshold=0.035:ratio=5:attack=15:release=380:makeup=1[musb]`,
    `[2:a]aresample=${SR},aecho=0.8:0.55:45|95:0.22|0.12,highpass=f=30[fx]`,
    `[voz][musb][fx]amix=inputs=3:normalize=0:weights=1.0 1.0 0.75:duration=longest,atrim=0:${dur}[mix]`,
  ].join(';');
  const base = ['-y', '-loglevel', 'error', '-i', VOZ, '-i', musica, '-i', sfxWav];
  // pasada 1: medir sonoridad
  const med = spawnSync('ffmpeg', ['-hide_banner', '-y', ...base.slice(3), '-filter_complex', grafo + ';[mix]loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json[o]', '-map', '[o]', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = (med.stderr || '').match(/\{[^{}]*"input_i"[^{}]*\}/);
  const j = m ? JSON.parse(m[0]) : null;
  const ln = j ? `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true` : 'loudnorm=I=-14:TP=-1.5:LRA=11';
  execFileSync('ffmpeg', [...base, '-i', videoMudo, '-filter_complex', grafo + `;[mix]${ln},alimiter=limit=0.89,aresample=${SR}[o]`,
    '-map', '3:v', '-map', '[o]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-maxrate', '24M', '-bufsize', '48M', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', '-shortest', salida], { stdio: 'inherit' });
  fs.unlinkSync(sfxWav);
};

module.exports = { mezclar, GEN, VIDEOS };

/* Solo remezclar el audio de un video ya grabado (sin volver a grabar cuadros):
 *   node audio.js 1   → rehace el audio de upgames-patrocinio-1.mp4 */
if (require.main === module) {
  (async () => {
    const n = process.argv[2] || '1';
    const { chromium } = require('playwright');
    const b = await chromium.launch();
    const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
    await p.goto('file://' + path.join(__dirname, `video${n}.html`));
    await p.evaluate(() => window.listo);
    const cues = await p.evaluate(() => window.SFX), dur = await p.evaluate(() => window.DURACION);
    await b.close();
    const final = path.join(__dirname, `upgames-patrocinio-${n}.mp4`), viejo = final.replace(/\.mp4$/, '.previo.mp4');
    fs.renameSync(final, viejo);
    await mezclar(+n, dur, cues, viejo, final);
    fs.unlinkSync(viejo);
    console.log('Audio remezclado:', final);
  })();
}
