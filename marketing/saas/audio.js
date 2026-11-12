/**
 * Sonido del video SaaS: música de public/audio (Infraction, sin copyright) + efectos
 * sintetizados aquí mismo en el instante en que cada escena los pide con sfx().
 * La caída de la música coincide con la aparición del logo (4,7 s).
 */
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const SR = 44100;
const MUSICA = path.join(__dirname, '..', '..', 'public', 'audio', 'if-you-open-up.mp3');
const CAIDA_MUSICA = 124.25;   // segundo de la pista donde cae el ritmo
const CAIDA_VIDEO = 4.72;      // segundo del video donde aparece el logo

// ruido determinista
let semilla = 7; const ruido = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 1073741823.5 - 1; };
const env = (t, a, d) => t < 0 ? 0 : t < a ? t / a : Math.exp(-(t - a) / d);

/** Cada efecto devuelve su muestra en el instante t (s) desde que empieza; null = terminó. */
const EFECTOS = {
  whoosh: { dur: .7, f: (t, st) => { const k = t / .7; st.lp = (st.lp || 0) + (ruido() - (st.lp || 0)) * (.02 + .35 * Math.sin(Math.PI * k)); return st.lp * Math.sin(Math.PI * k) * .9; } },
  impacto: { dur: 1.4, f: t => Math.sin(2 * Math.PI * (38 * t + 46 * (1 - Math.exp(-t * 9)) / 9)) * env(t, .004, .34) * 1.1 + ruido() * env(t, .002, .05) * .5 },
  grave: { dur: .9, f: t => Math.sin(2 * Math.PI * 52 * t) * env(t, .01, .22) * .9 },
  riser: { dur: 1.2, f: (t, st) => { const k = t / 1.2; st.ph = (st.ph || 0) + 2 * Math.PI * (180 + 1500 * k * k) / SR; st.lp = (st.lp || 0) + (ruido() - (st.lp || 0)) * (.05 + .5 * k); return (Math.sin(st.ph) * .25 + st.lp * .7) * k * k; } },
  pop: { dur: .2, f: t => Math.sin(2 * Math.PI * (520 + 900 * Math.exp(-t * 30)) * t) * env(t, .003, .04) * .7 },
  clic: { dur: .08, f: t => (ruido() * .5 + Math.sin(2 * Math.PI * 2400 * t)) * env(t, .001, .012) * .8 },
  campana: { dur: 1.3, f: t => (Math.sin(2 * Math.PI * 1318.5 * t) + .6 * Math.sin(2 * Math.PI * 1975.5 * t) + .35 * Math.sin(2 * Math.PI * 2637 * t)) * env(t, .003, .32) * .32 },
  tachar: { dur: .35, f: (t, st) => { st.lp = (st.lp || 0) + (ruido() - (st.lp || 0)) * .6; return st.lp * env(t, .02, .1) * .8; } },
  contador: { dur: 2.0, f: t => { const k = t / 2, paso = (t * (10 + 26 * Math.sin(Math.PI * k))) % 1; return Math.sin(2 * Math.PI * (900 + 700 * k) * t) * Math.exp(-paso * 14) * .28 * Math.sin(Math.PI * Math.min(1, k * 1.2 + .1)); } },
  teclas: { dur: 1.0, f: t => { const paso = (t * 13) % 1; return (ruido() * .5 + Math.sin(2 * Math.PI * 1700 * t) * .5) * Math.exp(-paso * 26) * .5; } },
};

function sintetizar(dur, cues, salida) {
  const n = Math.ceil((dur + 2) * SR), L = new Float32Array(n), Rr = new Float32Array(n);
  cues.forEach((c, k) => {
    const e = EFECTOS[c.n]; if (!e) return;
    const i0 = Math.round(c.t * SR), m = Math.round(e.dur * SR), st = {}, pan = ((k * 37) % 7) / 6 * .5 + .25;
    for (let i = 0; i < m && i0 + i < n; i++) { const v = e.f(i / SR, st) * (c.g ?? 1); L[i0 + i] += v * (1 - pan) * 1.4; Rr[i0 + i] += v * pan * 1.4; }
  });
  const pcm = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) { pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.tanh(L[i]) * 32767)) | 0, i * 4); pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.tanh(Rr[i]) * 32767)) | 0, i * 4 + 2); }
  const cab = Buffer.alloc(44);
  cab.write('RIFF', 0); cab.writeUInt32LE(36 + pcm.length, 4); cab.write('WAVEfmt ', 8); cab.writeUInt32LE(16, 16); cab.writeUInt16LE(1, 20); cab.writeUInt16LE(2, 22);
  cab.writeUInt32LE(SR, 24); cab.writeUInt32LE(SR * 4, 28); cab.writeUInt16LE(4, 32); cab.writeUInt16LE(16, 34); cab.write('data', 36); cab.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(salida, Buffer.concat([cab, pcm]));
}

const ffmpeg = args => new Promise((ok, no) => { const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' }); p.on('close', c => c ? no(new Error('ffmpeg ' + c)) : ok()); });

async function mezclar(dur, cues, video, salida) {
  const wav = salida.replace(/\.mp4$/, '.sfx.wav');
  sintetizar(dur, cues, wav);
  const ini = (CAIDA_MUSICA - CAIDA_VIDEO).toFixed(2);
  await ffmpeg(['-i', video, '-ss', ini, '-t', String(dur), '-i', MUSICA, '-i', wav, '-filter_complex',
    // música: casi en silencio hasta la caída, luego plena; efectos con un poco de eco; todo a −14 LUFS
    `[1:a]volume='if(lt(t,${CAIDA_VIDEO - .25}),0.28,0.8)':eval=frame,afade=t=in:d=0.6,afade=t=out:st=${dur - 1.8}:d=1.8[m];` +
    `[2:a]aecho=0.8:0.6:38:0.22,volume=1.0[s];[m][s]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]`,
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-t', String(dur), '-movflags', '+faststart', salida]);
  fs.unlinkSync(wav);
}

module.exports = { mezclar };
