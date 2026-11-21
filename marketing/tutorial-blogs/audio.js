#!/usr/bin/env node
/**
 * Sonido del tutorial: música original sintetizada (sin muestras ni licencias), efectos de interfaz y la locución.
 *   node audio.js salida.wav [duracion]
 * Lee sfx.json (clics, teclas y transiciones que pide video.html; render.js lo escribe) y narracion.wav (narracion.py).
 * La música se agacha bajo la voz (sidechain) y nunca compite con ella; la mezcla final queda a −14 LUFS.
 * Forma: Do mayor tranquilo, 96 BPM (1 compás = 2,5 s): Cmaj7–Am7–Fmaj7–G6. Entra suave, suma pulso desde el paso 1,
 * se queda en el pad durante el cierre y resuelve en Do con el lema.
 */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const SR = 48000, TAU = Math.PI * 2;
const salida = path.resolve(process.argv[2] || path.join(__dirname, 'sonido.wav'));
const T = JSON.parse(fs.readFileSync(path.join(__dirname, 'tiempos.json'), 'utf8'));
const DUR = +(process.argv[3] || T.duracion), N = Math.ceil((DUR + 1) * SR);
const CUES = JSON.parse(fs.readFileSync(path.join(__dirname, 'sfx.json'), 'utf8'));
const ini = id => T.segmentos.find(s => s.id === id).inicio;

let semilla = 7; const rnd = () => (semilla = (semilla * 16807) % 2147483647) / 2147483647, ruido = () => rnd() * 2 - 1;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const MUS = [new Float32Array(N), new Float32Array(N)], FX = [new Float32Array(N), new Float32Array(N)];
const sumar = (b, i, l, r = l) => { if (i >= 0 && i < N) { b[0][i] += l; b[1][i] += r; } };
const lp1 = () => { let y = 0; return (x, a) => (y += (x - y) * a); };

// ── Música ──
const COMPAS = 2.5, ACORDES = [[48, 55, 59, 64, 67], [45, 52, 55, 60, 64], [41, 48, 52, 57, 60], [43, 50, 55, 59, 64]];
const tCierre = ini('cierre') - .35, tPulso = ini('nombre') - .35, tFinPulso = tCierre - .6;
const acorde = t => t >= tCierre ? [48, 55, 60, 64, 67, 72] : ACORDES[Math.floor(t / COMPAS) % 4];
// Pad: senos desafinados con un poco de 2.º armónico; volumen que respira con el compás
const fasePad = new Float64Array(16 * 2);
for (let i = 0; i < N; i++) {
  const t = i / SR, notas = acorde(t), ent = Math.min(1, t / 2.5) * (t > DUR - 2.4 ? Math.max(0, (DUR - t) / 2.4) : 1);
  let l = 0, r = 0;
  notas.forEach((m, k) => {
    const f = mtof(m + 12);
    fasePad[k * 2] += f * 1.002 / SR; fasePad[k * 2 + 1] += f * .998 / SR;
    const a = Math.sin(TAU * fasePad[k * 2]) + .18 * Math.sin(TAU * 2 * fasePad[k * 2]), b = Math.sin(TAU * fasePad[k * 2 + 1]) + .18 * Math.sin(TAU * 2 * fasePad[k * 2 + 1]);
    const p = k / (notas.length - 1); l += a * (1 - p * .6); r += b * (.4 + p * .6);
  });
  const g = .022 * ent * (.85 + .15 * Math.sin(TAU * t / COMPAS));
  sumar(MUS, i, l * g, r * g);
}
// Pulsación suave (marimba sintética) en corcheas sobre el acorde
function nota(t, m, g, dur = .5, pan = 0) {
  const f = mtof(m), i0 = Math.round(t * SR), n = Math.round(dur * SR), gl = 1 - Math.max(0, pan), gr = 1 + Math.min(0, pan);
  for (let j = 0; j < n; j++) { const s = j / SR, e = Math.min(1, j / 96) * Math.exp(-s / (dur / 5)), v = (Math.sin(TAU * f * s) + .3 * Math.sin(TAU * f * 4 * s) * Math.exp(-s / .03)) * e * g; sumar(MUS, i0 + j, v * gl, v * gr); }
}
const PATRON = [0, 2, 4, 2, 1, 3, 4, 3];
for (let t = tPulso, k = 0; t < tFinPulso; t += COMPAS / 8, k++) { const a = acorde(t); nota(t, a[PATRON[k % 8] % a.length] + 24, k % 4 === 0 ? .05 : .034, .55, (k % 2 ? .35 : -.35)); }
// Ritmo muy ligero: bombo suave en 1 y 3, charles cerrado en contratiempo
for (let t = ini('nexus1') - .35; t < tFinPulso; t += COMPAS / 4) {
  const i0 = Math.round(t * SR); let fase = 0;
  for (let j = 0; j < .25 * SR; j++) { const s = j / SR; fase += (48 + 70 * Math.exp(-s * 30)) / SR; sumar(MUS, i0 + j, Math.sin(TAU * fase) * Math.exp(-s / .12) * .09); }
  const h = lp1(), i1 = Math.round((t + COMPAS / 8) * SR);
  for (let j = 0; j < .05 * SR; j++) { const x = ruido(), v = (x - h(x, .5)) * Math.exp(-j / SR / .012) * .02; sumar(MUS, i1 + j, v * .8, v); }
}
// Cierre: acorde de Do y motivo de tres notas con el lema
[0, .85, 1.7].forEach((o, k) => nota(ini('cierre') + o, [72, 76, 79][k], .06, 2.4, [-.3, 0, .3][k]));
nota(ini('cierre') + 3.0, 84, .05, 3.2);

// ── Efectos ──
function campana(t, m, g, dur = .8, pan = 0) {
  const f = mtof(m), i0 = Math.round(t * SR), gl = 1 - Math.max(0, pan), gr = 1 + Math.min(0, pan);
  for (let j = 0; j < dur * SR; j++) { const s = j / SR, e = Math.min(1, j / 48) * Math.exp(-s / (dur / 4)), v = Math.sin(TAU * f * s + 1.4 * Math.sin(TAU * f * 3 * s) * Math.exp(-s / .15)) * e * g; sumar(FX, i0 + j, v * gl, v * gr); }
}
function soplo(t, dur, g, sube = true) {   // ruido filtrado que barre
  const i0 = Math.round(t * SR), n = Math.round(dur * SR), f = lp1();
  for (let j = 0; j < n; j++) { const k = j / n, env = Math.sin(Math.PI * k), a = sube ? .02 + .25 * k : .27 - .25 * k; sumar(FX, i0 + j, f(ruido(), a) * env * g); }
}
function tic(t, g, f = 2600, d = .012) { const i0 = Math.round(t * SR); for (let j = 0; j < d * 6 * SR; j++) { const s = j / SR; sumar(FX, i0 + j, (Math.sin(TAU * f * s) * .6 + ruido() * .4) * Math.exp(-s / d) * g); } }
const EF = {
  clic: (t, g) => { tic(t, .16 * g, 3200, .006); tic(t + .004, .08 * g, 1400, .01); },
  tecla: (t, g) => tic(t, .07 * g * (.7 + .6 * rnd()), 1800 + 900 * rnd(), .004),
  ok: (t, g) => { campana(t, 84, .07 * g); campana(t + .09, 91, .06 * g); },
  exito: (t, g) => { [79, 84, 88, 91].forEach((m, k) => campana(t + k * .07, m, .06 * g, 1.2, (k - 1.5) * .25)); },
  swoosh: (t, g) => soplo(t - .25, .55, .22 * g),
  aparece: (t, g) => { soplo(t - .15, .35, .12 * g); campana(t + .05, 88, .04 * g, 1.0); },
  entrada: (t, g) => soplo(t - .3, .8, .12 * g),
  abre: (t, g) => soplo(t, .3, .14 * g),
  borra: (t, g) => soplo(t, .35, .2 * g, false),
  lista: (t, g) => { for (let k = 0; k < 5; k++) campana(t + k * .11, 86 + (k % 2) * 3, .035 * g, .4); },
  nexus: (t, g) => { [84, 88, 91, 95].forEach((m, k) => campana(t + k * .05, m, .035 * g, 1.1, (k - 1.5) * .3)); },
  magia: (t, g) => { soplo(t - .3, .7, .12 * g); [91, 95, 98, 103, 98].forEach((m, k) => campana(t + k * .06, m, .03 * g, 1.3, (k - 2) * .25)); },
  pensando: (t, g) => { for (let k = 0; k < 4; k++) campana(t + k * .3, 79, .025 * g, .35); },
  final: (t, g) => soplo(t - .4, 1.2, .14 * g),
};
for (const c of CUES) (EF[c.tipo] || (() => console.warn('efecto sin sonido:', c.tipo)))(c.t, c.g);

// ── Mezcla con ffmpeg: música agachada bajo la voz + efectos + locución, −14 LUFS ──
function wav(ruta, [L, R]) {
  const b = Buffer.alloc(44 + N * 4); b.write('RIFF', 0); b.writeUInt32LE(36 + N * 4, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(N * 4, 40);
  for (let i = 0; i < N; i++) { b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), 44 + i * 4); b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), 46 + i * 4); }
  fs.writeFileSync(ruta, b);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tutorial-audio-')), mus = path.join(tmp, 'musica.wav'), fx = path.join(tmp, 'fx.wav');
wav(mus, MUS); wav(fx, FX);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mus, '-i', fx, '-i', path.join(__dirname, 'narracion.wav'), '-filter_complex',
  '[2:a]aresample=48000,pan=stereo|c0=c0|c1=c0,asplit=2[voz][sc];' +
  '[0:a][sc]sidechaincompress=threshold=0.02:ratio=8:attack=40:release=450:makeup=1[musb];' +
  '[voz][musb][1:a]amix=inputs=3:normalize=0:weights=1 1 1,loudnorm=I=-14:TP=-1.5:LRA=9,aresample=48000,alimiter=limit=0.84:level=false,atrim=0:' + DUR.toFixed(3) + '[sal]',
  '-map', '[sal]', '-ar', '48000', '-c:a', 'pcm_s16le', salida]);
fs.rmSync(tmp, { recursive: true, force: true });
console.log('Sonido:', salida);
