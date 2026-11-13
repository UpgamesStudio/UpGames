/**
 * Sonido del video de UpGames Blogs: TODO sintetizado aquí (sin archivos de música).
 * Distinto al video SaaS: aquel usa una pista electrónica y efectos de «sistema»; este es cálido
 * y acústico (marimba, almohadillas suaves, campanitas) y la música va creciendo con las escenas:
 *   0–3,7 s  almohadilla sola · 3,7 s entra el arpegio · 10,3 s bajo · 15,7 s bombo suave y hi-hat
 *   31,3 s   cierre en acorde mayor que se apaga.
 * Los efectos los pide cada escena con sfx(t, nombre, ganancia, nota).
 */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');

const SR = 44100, BPM = 96, BEAT = 60 / BPM;
let semilla = 11; const ruido = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 1073741823.5 - 1; };
const env = (t, a, d) => t < 0 ? 0 : t < a ? t / a : Math.exp(-(t - a) / d);
const nota = m => 440 * Math.pow(2, (m - 69) / 12);          // número MIDI → Hz
const PENTA = [69, 72, 74, 76, 79, 81, 84, 86];                 // La menor pentatónica (A4…D6)

// Compases de 4 tiempos: Am9 · Fmaj7 · Cmaj7 · G6
const ACORDES = [[57, 60, 64, 67, 71], [53, 57, 60, 64, 69], [48, 55, 59, 64, 67], [55, 59, 62, 64, 71]];
const RAIZ = [33, 29, 36, 31];

/** Efectos: devuelven la muestra en t (s) desde el inicio del efecto. */
const EFECTOS = {
  nota: { dur: 1.6, f: (t, st, p = 0) => { const f = nota(PENTA[p % PENTA.length]); return (Math.sin(2 * Math.PI * f * t) + .35 * Math.sin(2 * Math.PI * f * 4 * t) * env(t, .001, .05)) * env(t, .004, .45) * .5; } },
  pop: { dur: .25, f: t => Math.sin(2 * Math.PI * (480 + 700 * Math.exp(-t * 28)) * t) * env(t, .003, .05) * .6 },
  pop2: { dur: .25, f: t => Math.sin(2 * Math.PI * (330 + 520 * Math.exp(-t * 26)) * t) * env(t, .003, .06) * .65 },
  clic: { dur: .08, f: t => (ruido() * .4 + Math.sin(2 * Math.PI * 1800 * t)) * env(t, .001, .012) * .7 },
  tick: { dur: .1, f: t => Math.sin(2 * Math.PI * 1500 * t) * env(t, .001, .02) * .45 },
  teclas: { dur: .7, f: t => { const paso = (t * 11) % 1; return (ruido() * .35 + Math.sin(2 * Math.PI * 1300 * t) * .4) * Math.exp(-paso * 30) * .45; } },
  whoosh: { dur: .8, f: (t, st) => { const k = t / .8, a = Math.sin(Math.PI * k); st.lp = (st.lp || 0) + (ruido() - (st.lp || 0)) * (.015 + .2 * a); return st.lp * a * .55; } },
  swell: { dur: 1.6, f: (t, st) => { const k = t / 1.6; st.lp = (st.lp || 0) + (ruido() - (st.lp || 0)) * (.01 + .3 * k); return (st.lp * .5 + Math.sin(2 * Math.PI * nota(69) * t) * .3 + Math.sin(2 * Math.PI * nota(76) * t) * .2) * Math.sin(Math.PI * Math.min(1, k)) * k * .7; } },
  sello: { dur: .6, f: t => Math.sin(2 * Math.PI * (70 + 120 * Math.exp(-t * 22)) * t) * env(t, .002, .14) * .9 + ruido() * env(t, .001, .02) * .3 },
  campana: { dur: 2.2, f: t => (Math.sin(2 * Math.PI * 1318.5 * t) + .5 * Math.sin(2 * Math.PI * 1975.5 * t) + .3 * Math.sin(2 * Math.PI * 3136 * t)) * env(t, .003, .5) * .26 },
  notif: { dur: 1.4, f: t => { const a = t < .16 ? Math.sin(2 * Math.PI * 1318.5 * t) * env(t, .003, .12) : 0, b = t >= .16 ? Math.sin(2 * Math.PI * 1760 * (t - .16)) * env(t - .16, .003, .5) : 0; return (a + b) * .4; } },
  brillo: { dur: .9, f: t => { let v = 0; for (let k = 0; k < 6; k++) { const tt = t - k * .07; if (tt > 0) v += Math.sin(2 * Math.PI * nota(88 + [0, 4, 7, 12, 16, 19][k]) * tt) * env(tt, .002, .12); } return v * .2; } },
  contador: { dur: 1.4, f: t => { const k = t / 1.4, paso = (t * (8 + 22 * Math.sin(Math.PI * k))) % 1; return Math.sin(2 * Math.PI * (700 + 500 * k) * t) * Math.exp(-paso * 16) * .18 * Math.sin(Math.PI * Math.min(1, k * 1.1 + .05)); } },
};

/** Música: se construye por tiempos para que crezca con las escenas. */
function musica(L, R, dur) {
  const n = L.length, add = (t0, d, fn, g, pan) => { const i0 = Math.round(t0 * SR), m = Math.round(d * SR); for (let i = 0; i < m && i0 + i < n; i++) { const v = fn(i / SR) * g; L[i0 + i] += v * (1 - pan) * 1.5; R[i0 + i] += v * pan * 1.5; } };
  const compases = Math.ceil(dur / (BEAT * 4)) + 1;
  for (let c = 0; c < compases; c++) {
    const t0 = c * BEAT * 4, ac = ACORDES[c % 4], fin = t0 >= 31.3;
    // Almohadilla: tres sinusoides desafinadas por nota, entrada lenta
    ac.forEach((m, k) => { const f = nota(m); add(t0, BEAT * 4 + .6, t => { const e = Math.min(1, t / .5) * Math.min(1, (BEAT * 4 + .6 - t) / .6); return (Math.sin(2 * Math.PI * f * t) + .6 * Math.sin(2 * Math.PI * f * 1.003 * t) + .5 * Math.sin(2 * Math.PI * f * .997 * t + k)) * e; }, .035, .3 + (k % 3) * .2); });
    // Arpegio de marimba: de la escena 2 en adelante (en el cierre solo lo esencial)
    if (t0 >= 3.7 && !(fin && t0 > 33.5)) for (let i = 0; i < 8; i++) {
      const t = t0 + i * BEAT / 2, p = [0, 2, 4, 2, 3, 1, 4, 2][i], m = ac[p % ac.length] + 12, f = nota(m);
      if (t < 3.7 || t > dur - .5) continue;
      add(t, .9, tt => (Math.sin(2 * Math.PI * f * tt) + .3 * Math.sin(2 * Math.PI * f * 4 * tt) * env(tt, .001, .04)) * env(tt, .003, .22), (i % 2 ? .05 : .075), .25 + (i % 4) * .15);
    }
    // Bajo: de la escena 3
    if (t0 >= 10.3 && !fin) [0, 2].forEach(b => { const f = nota(RAIZ[c % 4]); add(t0 + b * BEAT, BEAT * 1.8, t => Math.sin(2 * Math.PI * f * t) * env(t, .01, .5) , .2, .5); });
    // Bombo suave y hi-hat: de la escena 4
    if (t0 >= 15.7 && !fin) for (let b = 0; b < 4; b++) {
      if (b % 2 === 0) add(t0 + b * BEAT, .35, t => Math.sin(2 * Math.PI * (48 + 70 * Math.exp(-t * 28)) * t) * env(t, .002, .11), .32, .5);
      add(t0 + b * BEAT + BEAT / 2, .08, t => ruido() * env(t, .001, .016), .06, .6);
    }
    // Cierre: acorde de La mayor que se apaga
    if (t0 >= 33.4 && t0 < 34) [57, 61, 64, 69, 73].forEach(m => add(t0, 3, t => { const f = nota(m); return Math.sin(2 * Math.PI * f * t) * env(t, .01, 1.1); }, .06, .5));
  }
}

function sintetizar(dur, cues, salida) {
  const n = Math.ceil((dur + 2) * SR), L = new Float32Array(n), R = new Float32Array(n);
  musica(L, R, dur);
  cues.forEach((c, k) => {
    const e = EFECTOS[c.n]; if (!e) return;
    const i0 = Math.round(c.t * SR), m = Math.round(e.dur * SR), st = {}, pan = ((k * 37) % 7) / 6 * .4 + .3;
    for (let i = 0; i < m && i0 + i < n; i++) { const v = e.f(i / SR, st, c.p) * (c.g ?? 1); L[i0 + i] += v * (1 - pan) * 1.5; R[i0 + i] += v * pan * 1.5; }
  });
  // Eco corto (cola de sala) y salida a 16 bits
  const eco = (A, ms, g) => { const d = Math.round(ms / 1000 * SR); for (let i = n - 1; i >= d; i--) A[i] += A[i - d] * g; };
  [[L, 97, .22], [L, 211, .12], [R, 113, .22], [R, 233, .12]].forEach(([A, ms, g]) => eco(A, ms, g));
  const fadeIni = Math.round(.4 * SR), fadeFin = Math.round(2.2 * SR), fin = Math.round(dur * SR);
  const pcm = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    const g = Math.min(1, i / fadeIni) * (i > fin - fadeFin ? Math.max(0, (fin - i) / fadeFin) : 1);
    pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.tanh(L[i] * g) * 32767)) | 0, i * 4);
    pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.tanh(R[i] * g) * 32767)) | 0, i * 4 + 2);
  }
  const cab = Buffer.alloc(44);
  cab.write('RIFF', 0); cab.writeUInt32LE(36 + pcm.length, 4); cab.write('WAVEfmt ', 8); cab.writeUInt32LE(16, 16); cab.writeUInt16LE(1, 20); cab.writeUInt16LE(2, 22);
  cab.writeUInt32LE(SR, 24); cab.writeUInt32LE(SR * 4, 28); cab.writeUInt16LE(4, 32); cab.writeUInt16LE(16, 34); cab.write('data', 36); cab.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(salida, Buffer.concat([cab, pcm]));
}

const ffmpeg = args => new Promise((ok, no) => { const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' }); p.on('close', c => c ? no(new Error('ffmpeg ' + c)) : ok()); });

async function mezclar(dur, cues, video, salida) {
  const wav = salida.replace(/\.mp4$/, '.audio.wav');
  sintetizar(dur, cues, wav);
  await ffmpeg(['-i', video, '-i', wav, '-filter_complex', '[1:a]loudnorm=I=-15:TP=-1.5:LRA=9,aresample=48000[a]',
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-t', String(dur), '-movflags', '+faststart', salida]);
  fs.unlinkSync(wav);
}

module.exports = { mezclar, sintetizar };
