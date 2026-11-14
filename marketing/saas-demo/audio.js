/**
 * Sonido del video SaaS Studio: SOLO efectos, sin música. Todo se sintetiza aquí en el instante
 * que la escena pide con sfx(t, nombre, ganancia, tono). Cada cue: { t, n, g?, f? } (f = multiplicador de tono).
 */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');

const SR = 44100;
let semilla = 11; const ruido = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 1073741823.5 - 1; };
const env = (t, a, d) => t < 0 ? 0 : t < a ? t / a : Math.exp(-(t - a) / d);
const sen = (f, t) => Math.sin(2 * Math.PI * f * t);
// ruido filtrado (paso bajo de un polo) guardado en el estado del efecto
const lp = (st, k, x) => (st.l = (st.l || 0) + (x - (st.l || 0)) * k);

/** f(t, st, p): muestra en el instante t (s) desde el inicio del efecto; p = tono. */
const EFECTOS = {
  clic:    { dur: .09, f: (t, s, p) => (ruido() * .35 + sen(1900 * p, t) * .8) * env(t, .0008, .011) * .9 },                  // botón del ratón hacia abajo
  suelta:  { dur: .07, f: (t, s, p) => (ruido() * .25 + sen(1300 * p, t) * .6) * env(t, .0008, .008) * .55 },                  // botón hacia arriba
  tecla:   { dur: .07, f: (t, s, p) => (ruido() * .55 + sen(2600 * p, t) * .45) * env(t, .0005, .007) * .8 },                  // pulsación de tecla
  tick:    { dur: .08, f: (t, s, p) => sen(1500 * p, t) * env(t, .001, .014) * .7 + sen(3000 * p, t) * env(t, .001, .008) * .25 },
  toggle:  { dur: .16, f: (t, s, p) => sen((600 + 700 * (1 - Math.exp(-t * 60))) * p, t) * env(t, .002, .035) * .75 },
  pop:     { dur: .22, f: (t, s, p) => sen((480 + 820 * Math.exp(-t * 28)) * p, t) * env(t, .003, .05) * .8 },
  roce:    { dur: .45, f: (t, s, p) => lp(s, .06 + .1 * Math.sin(Math.PI * t / .45), ruido()) * Math.sin(Math.PI * t / .45) * .5 },    // arrastre: fricción suave
  soltar:  { dur: .5, f: (t, s, p) => sen(78 * p, t) * env(t, .002, .09) * 1.0 + ruido() * env(t, .001, .02) * .35 },             // soltar el archivo: golpe sordo
  abrir:   { dur: .3, f: (t, s, p) => lp(s, .03 + .3 * Math.sin(Math.PI * t / .3), ruido()) * Math.sin(Math.PI * t / .3) * .55 },   // despliegue de menú
  elegir:  { dur: .18, f: (t, s, p) => (sen(1100 * p, t) + .5 * sen(1650 * p, t)) * env(t, .002, .03) * .55 },
  whoosh:  { dur: .8, f: (t, s, p) => lp(s, .015 + .3 * Math.sin(Math.PI * t / .8), ruido()) * Math.sin(Math.PI * t / .8) * .9 },
  golpe:   { dur: 1.2, f: (t, s, p) => (sen((46 + 40 * Math.exp(-t * 14)) * p, t)) * env(t, .003, .28) * 1.0 + ruido() * env(t, .001, .03) * .25 },
  exito:   { dur: 1.1, f: (t, s, p) => [0, .09, .18].reduce((a, d, i) => a + (t >= d ? (sen(784 * [1, 1.26, 1.5][i] * p, t - d) + .4 * sen(1568 * [1, 1.26, 1.5][i] * p, t - d)) * env(t - d, .004, .26) : 0), 0) * .28 },
  notif:   { dur: .9, f: (t, s, p) => [0, .13].reduce((a, d, i) => a + (t >= d ? (sen([1046.5, 1568][i] * p, t - d) + .3 * sen([2093, 3136][i] * p, t - d)) * env(t - d, .003, .2) : 0), 0) * .3 },
  moneda:  { dur: .6, f: (t, s, p) => (t < .06 ? sen(1976 * p, t) : sen(2637 * p, t)) * env(t, .002, .16) * .4 + sen(5274 * p, t) * env(t, .002, .05) * .12 },
  desliza: { dur: .12, f: (t, s, p) => (sen(900 * p, t) * .5 + ruido() * .3) * env(t, .002, .02) * .55 },
  contador:{ dur: 1.4, f: (t, s, p) => { const k = t / 1.4, paso = (t * (14 + 14 * k)) % 1; return sen((1000 + 600 * k) * p, t) * Math.exp(-paso * 16) * .26 * Math.sin(Math.PI * Math.min(1, k * 1.1 + .05)); } },
  giro:    { dur: .5, f: (t, s, p) => lp(s, .08, ruido()) * Math.sin(Math.PI * t / .5) * .25 },
};

function sintetizar(dur, cues, salida) {
  const n = Math.ceil((dur + 2) * SR), L = new Float32Array(n), Rr = new Float32Array(n);
  cues.forEach((c, k) => {
    const e = EFECTOS[c.n]; if (!e) { console.warn('sfx desconocido:', c.n); return; }
    const i0 = Math.round(c.t * SR), m = Math.round(e.dur * SR), st = {}, pan = ((k * 37) % 7) / 6 * .3 + .35;   // paneo suave y estable
    for (let i = 0; i < m && i0 + i < n; i++) { const v = e.f(i / SR, st, c.f || 1) * (c.g ?? 1); L[i0 + i] += v * (1 - pan) * 1.5; Rr[i0 + i] += v * pan * 1.5; }
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
  // sin música: efectos con un poco de sala (eco corto). Se normaliza por tramos (dynaudnorm) y no con loudnorm: son sonidos
  // sueltos separados por silencio y loudnorm exige tanta ganancia que se desborda; así cada clic se oye al mismo nivel.
  await ffmpeg(['-i', video, '-i', wav, '-filter_complex',
    `[1:a]aecho=0.85:0.5:42|71:0.2|0.12,highpass=f=40,dynaudnorm=f=250:g=9:p=0.8:m=6,afade=t=out:st=${dur - .8}:d=0.8,aresample=48000,alimiter=limit=0.85:level=disabled:attack=2:release=60[a]`,
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-t', String(dur), '-movflags', '+faststart', salida]);
  fs.unlinkSync(wav);
}

module.exports = { mezclar, sintetizar, EFECTOS };
