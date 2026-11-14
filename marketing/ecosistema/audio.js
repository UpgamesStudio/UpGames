/**
 * Sonido del video «Todo UpGames»: la pista del usuario (Darksynth · «Chants Of Concrete») + efectos limpios sintetizados aquí.
 * El ritmo de la pista es de 100 BPM y su caída cae en el segundo 38,45; el video arranca en el 24,05 para que la caída
 * coincida con el segundo 14,4 del video (cada tiempo = 0,6 s). Los efectos son cortos y «de cristal» (campanitas,
 * pops y barridos suaves, sin ruido áspero) y se mezclan por debajo de la música.
 * La pista NO va en el repositorio: pon el MP3 en musica/pista.mp3 o indica MUSICA=/ruta/a/la/pista.mp3.
 */
'use strict';
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs');

const SR = 44100;
const MUSICA = process.env.MUSICA || path.join(__dirname, 'musica', 'pista.mp3');
const CAIDA_PISTA = 38.45, CAIDA_VIDEO = 14.4;
let semilla = 5; const ruido = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 1073741823.5 - 1; };
const env = (t, a, d) => t < 0 ? 0 : t < a ? t / a : Math.exp(-(t - a) / d);
const nota = m => 440 * Math.pow(2, (m - 69) / 12);
const PENTA = [69, 72, 74, 76, 79, 81, 84, 88];   // La menor pentatónica
const TAU = 2 * Math.PI;

/** Cada efecto devuelve la muestra en t (s) desde su inicio. `st` guarda el estado de los filtros. */
const EFECTOS = {
  tick: { dur: .12, f: t => Math.sin(TAU * 2600 * t) * env(t, .001, .018) * .5 },
  type: { dur: .08, f: (t, st) => { st.l = (st.l || 0) + (ruido() - (st.l || 0)) * .5; return (st.l * .6 + Math.sin(TAU * 3200 * t) * .3) * env(t, .0008, .01) * .35; } },
  tap: { dur: .2, f: t => (Math.sin(TAU * (180 * Math.exp(-t * 20) + 90) * t) * env(t, .001, .05) * .8 + ruido() * env(t, .0005, .004) * .2) },
  pop: { dur: .22, f: t => Math.sin(TAU * (900 * Math.exp(-t * 26) + 320) * t) * env(t, .002, .05) * .55 },
  glass: { dur: 1.8, f: (t, st, p = 0) => { const f = nota(PENTA[p % PENTA.length]); return (Math.sin(TAU * f * t) + .5 * Math.sin(TAU * f * 2.76 * t) * env(t, .002, .25) + .3 * Math.sin(TAU * f * 5.4 * t) * env(t, .001, .1)) * env(t, .004, .45) * .3; } },
  coin: { dur: .6, f: t => (t < .08 ? Math.sin(TAU * 1318.5 * t) : Math.sin(TAU * 1975.5 * (t - .08))) * (t < .08 ? env(t, .002, .05) : env(t - .08, .002, .22)) * .32 },
  notif: { dur: 1.2, f: t => (t < .14 ? Math.sin(TAU * 1318.5 * t) * env(t, .003, .1) : Math.sin(TAU * 1760 * (t - .14)) * env(t - .14, .003, .45)) * .34 },
  swish: { dur: .45, f: (t, st) => { const k = t / .45, a = Math.sin(Math.PI * k) ** 2, c = .08 + .3 * k; st.l = (st.l || 0) + (ruido() - (st.l || 0)) * c; st.h = (st.h || 0) + (st.l - (st.h || 0)) * .02; return (st.l - st.h) * a * .5; } },
  whoosh: { dur: .8, f: (t, st) => { const k = t / .8, a = Math.sin(Math.PI * k) ** 1.5, c = .02 + .22 * Math.sin(Math.PI * k); st.l = (st.l || 0) + (ruido() - (st.l || 0)) * c; st.h = (st.h || 0) + (st.l - (st.h || 0)) * .015; return (st.l - st.h) * a * .85; } },
  sweep: { dur: 4.9, f: (t, st) => { const k = t / 4.8; st.ph = (st.ph || 0) + TAU * (220 + 2400 * k * k * k) / SR; st.l = (st.l || 0) + (ruido() - (st.l || 0)) * (.03 + .4 * k * k); st.h = (st.h || 0) + (st.l - (st.h || 0)) * .01;
    const g = Math.pow(k, 2.2) * (t > 4.8 ? Math.max(0, 1 - (t - 4.8) / .1) : 1); return ((st.l - st.h) * .55 + Math.sin(st.ph) * .12) * g; } },
  boom: { dur: 2.2, f: (t, st) => { st.l = (st.l || 0) + (ruido() - (st.l || 0)) * .05; return Math.sin(TAU * (42 + 70 * Math.exp(-t * 11)) * t) * env(t, .002, .5) * 1.0 + st.l * env(t, .001, .12) * .8 + Math.sin(TAU * 110 * t) * env(t, .002, .12) * .35; } },
  brillo: { dur: .9, f: t => { let v = 0; for (let k = 0; k < 5; k++) { const tt = t - k * .06; if (tt > 0) v += Math.sin(TAU * nota(88 + [0, 4, 7, 12, 16][k]) * tt) * env(tt, .002, .1); } return v * .18; } },
};

function sintetizar(dur, cues, salida) {
  const n = Math.ceil((dur + 3) * SR), L = new Float32Array(n), R = new Float32Array(n);
  cues.forEach((c, k) => {
    const e = EFECTOS[c.n]; if (!e) { console.warn('efecto desconocido', c.n); return; }
    const i0 = Math.round(c.t * SR), m = Math.round(e.dur * SR), st = {}, pan = .5 + (((k * 37) % 9) / 8 - .5) * .4;
    for (let i = 0; i < m && i0 + i < n; i++) { const v = e.f(i / SR, st, c.p) * (c.g ?? 1); L[i0 + i] += v * (1 - pan) * 1.6; R[i0 + i] += v * pan * 1.6; }
  });
  // cola de sala suave (varios ecos cortos) para que los cristales «respiren»
  const eco = (A, ms, g) => { const d = Math.round(ms / 1000 * SR); for (let i = n - 1; i >= d; i--) A[i] += A[i - d] * g; };
  [[L, 83, .2], [L, 167, .13], [L, 251, .08], [R, 97, .2], [R, 181, .13], [R, 277, .08]].forEach(([A, ms, g]) => eco(A, ms, g));
  const pcm = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) { pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.tanh(L[i]) * 32767)) | 0, i * 4); pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.tanh(R[i]) * 32767)) | 0, i * 4 + 2); }
  const cab = Buffer.alloc(44);
  cab.write('RIFF', 0); cab.writeUInt32LE(36 + pcm.length, 4); cab.write('WAVEfmt ', 8); cab.writeUInt32LE(16, 16); cab.writeUInt16LE(1, 20); cab.writeUInt16LE(2, 22);
  cab.writeUInt32LE(SR, 24); cab.writeUInt32LE(SR * 4, 28); cab.writeUInt16LE(4, 32); cab.writeUInt16LE(16, 34); cab.write('data', 36); cab.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(salida, Buffer.concat([cab, pcm]));
}

const ffmpeg = args => new Promise((ok, no) => { const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' }); p.on('close', c => c ? no(new Error('ffmpeg ' + c)) : ok()); });

async function mezclar(dur, cues, video, salida) {
  if (!fs.existsSync(MUSICA)) throw new Error(`Falta la pista de música: ${MUSICA}. Copia tu MP3 ahí o usa MUSICA=/ruta/pista.mp3`);
  const wav = salida.replace(/\.mp4$/, '.sfx.wav');
  sintetizar(dur, cues, wav);
  const ini = (CAIDA_PISTA - CAIDA_VIDEO).toFixed(2);
  await ffmpeg(['-i', video, '-ss', ini, '-t', String(dur), '-i', MUSICA, '-i', wav, '-filter_complex',
    `[1:a]afade=t=in:d=0.7,afade=t=out:st=${(dur - 2.6).toFixed(2)}:d=2.6,volume=0.82[m];` +
    `[2:a]volume=0.95[s];[m][s]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95,loudnorm=I=-14:TP=-1.5:LRA=9,aresample=48000[a]`,
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-t', String(dur), '-movflags', '+faststart', salida]);
  fs.unlinkSync(wav);
}

module.exports = { mezclar, sintetizar };
