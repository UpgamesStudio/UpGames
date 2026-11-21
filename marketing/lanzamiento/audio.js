#!/usr/bin/env node
/**
 * Música original y diseño sonoro del film de lanzamiento de Lurveta (síntesis, sin muestras ni licencias).
 *   node audio.js salida.wav [duracion]     escribe el WAV (48 kHz, estéreo) normalizado a −14 LUFS
 * Lee sfx.json (los cortes de sonido que pide cada escena de video.html; render.js lo escribe).
 *
 * Forma (120 BPM, 1 compás = 2 s):
 *   0–8    ACTO I: drone en re menor, textura digital, tres golpes sobre las palabras, subida → silencio (7,75)
 *   8      golpe + MOTIVO de Lurveta (re–la–mi: campanas FM); 8–16 crece: pulso de bajo, arpegio que se abre
 *   16–60  ACTO II: groove a medio tiempo, Rem–Si♭–Fa–Do; cada capítulo suma una capa; platillo en cada cambio
 *   60–63,5 se va la batería, subida final → SILENCIO (63,5–64)
 *   64     golpe final + motivo completo en RE MAYOR (la marca nueva resuelve la tensión); Re–La–Sol–Re y cola
 */
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const SR = 48000, TAU = Math.PI * 2;
const salida = process.argv[2] || path.join(__dirname, 'sonido.wav');
const DUR = +(process.argv[3] || 80) + 2;
const N = Math.ceil(DUR * SR);
const CUES = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'sfx.json'), 'utf8')); } catch (_) { return []; } })();

// ── utilidades ──
let semilla = 20261120; const rnd = () => { semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };
const ruido = () => rnd() * 2 - 1;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const bus = () => ({ L: new Float32Array(N), R: new Float32Array(N) });
const MUS = bus(), PAD = bus(), BAJO = bus(), BAT = bus(), FX = bus(), ENVIO = bus();   // ENVIO = envío a la reverb
function sumar(b, i, l, r) { if (i >= 0 && i < N) { b.L[i] += l; b.R[i] += r; } }
const panG = p => [Math.cos((p + 1) * Math.PI / 4), Math.sin((p + 1) * Math.PI / 4)];

// Tablas de onda limitadas en banda (sierra) por nota: sin aliasing
const TABLAS = new Map();
function tablaSierra(f) {
  const k = Math.round(Math.log2(f) * 4); if (TABLAS.has(k)) return TABLAS.get(k);
  const n = 2048, t = new Float32Array(n + 1), h = Math.max(1, Math.floor(18000 / f));
  for (let i = 0; i <= n; i++) { let v = 0; for (let j = 1; j <= h; j++) v += Math.sin(TAU * j * i / n) / j * (1 - j / (h + 1)); t[i] = v * .55; }
  TABLAS.set(k, t); return t;
}
const leer = (t, fase) => { const x = (fase - Math.floor(fase)) * 2048, i = x | 0; return t[i] + (t[i + 1] - t[i]) * (x - i); };

// Filtro de estado variable (pasa bajos resonante)
function svf() { let lp = 0, bp = 0; return (x, fc, q = .7) => { const f = 2 * Math.sin(Math.PI * Math.min(fc, SR / 6) / SR); const hp = x - lp - bp / q; bp += f * hp; lp += f * bp; return lp; }; }
const unPolo = () => { let y = 0; return (x, a) => (y += (x - y) * a); };

// ── armonía ──
// Acordes (MIDI) por tramo [inicio, fin, notas, bajo]
const D = 62, F = 65, A = 69, Bb = 70, C5 = 72, E5 = 64, G = 67, Fs = 66;
const PROG = [];
PROG.push([0, 8, [50, 57, 62, 65], 38]);                       // Rem (drone)
PROG.push([8, 12, [50, 57, 62, 65, 69], 38]);
PROG.push([12, 14, [46, 53, 58, 62, 65], 34]);                 // Si♭
PROG.push([14, 16, [48, 55, 60, 64, 67], 36]);                 // Do
for (let t = 16; t < 60; t += 8) {
  PROG.push([t, t + 2, [50, 57, 62, 65, 69], 38]);             // Rem
  PROG.push([t + 2, t + 4, [46, 53, 58, 62, 65], 34]);         // Si♭
  PROG.push([t + 4, t + 6, [41, 53, 57, 60, 65], 41]);         // Fa
  PROG.push([t + 6, t + 8, [48, 55, 60, 64, 67], 36]);         // Do
}
PROG.push([60, 64, [46, 53, 58, 62, 65, 69], 34]);              // Si♭ (suspensión antes del silencio)
PROG.push([64, 68, [50, 57, 62, 66, 69, 74], 38]);              // RE MAYOR
PROG.push([68, 72, [45, 57, 61, 64, 69, 73], 33]);              // La
PROG.push([72, 76, [43, 55, 59, 62, 67, 71], 31]);              // Sol
PROG.push([76, 82, [50, 57, 62, 66, 69, 74], 38]);              // Re
const acordeEn = t => PROG.find(p => t >= p[0] && t < p[1]) || PROG[PROG.length - 1];

// Silencios estratégicos (la música se apaga del todo)
const SILENCIOS = [[7.75, 8.0], [63.5, 64.0]];
const enSilencio = t => SILENCIOS.some(([a, b]) => t >= a - .015 && t < b);
// Ganancia de los silencios con fundidos de 20 ms (para que el corte no chasquee)
const gSilencio = t => { let g = 1; for (const [a, b] of SILENCIOS) { if (t >= a - .02 && t < b) g = Math.min(g, t < a ? (a - t) / .02 : t > b - .02 ? (t - (b - .02)) / .02 : 0); } return Math.max(0, g); };

// ── instrumentos ──
// Pad: dos sierras desafinadas por nota, filtro lento, ataque y caída suaves
function pad(t0, t1, notas, g, fcFn, ancho = .7) {
  const a = .9, rel = 1.6;
  notas.forEach((m, k) => {
    const f = mtof(m), tb = tablaSierra(f), filt = [svf(), svf()], p = (k / Math.max(1, notas.length - 1)) * 2 - 1;
    const [gl, gr] = panG(p * ancho);
    let f1 = rnd(), f2 = rnd();
    const i0 = Math.floor(t0 * SR), i1 = Math.floor((t1 + rel) * SR);
    for (let i = i0; i < i1; i++) {
      const t = i / SR, e = Math.min(1, (t - t0) / a) * (t > t1 ? Math.exp(-(t - t1) / (rel / 3)) : 1);
      f1 += f * 1.0035 / SR; f2 += f * .9965 / SR;
      const fc = fcFn(t);
      const l = filt[0](leer(tb, f1), fc, .8), r = filt[1](leer(tb, f2), fc, .8);
      sumar(PAD, i, l * e * g * gl, r * e * g * gr);
    }
  });
}
// Pulso de bajo: sub senoidal + un poco de sierra filtrada, en corcheas
function bajo(t0, t1, g, corcheas = true) {
  const filt = svf();
  let fase = 0, tb = null, fAnt = 0;
  for (let i = Math.floor(t0 * SR); i < Math.floor(t1 * SR); i++) {
    const t = i / SR, m = acordeEn(t)[3], f = mtof(m); if (f !== fAnt) { tb = tablaSierra(f * 2); fAnt = f; }
    fase += f / SR;
    const pos = corcheas ? ((t * 4) % 1) : 0, env = corcheas ? Math.exp(-pos * 2.4) * .85 + .15 : 1;
    const v = Math.sin(TAU * fase) * .9 + filt(leer(tb, fase * 2), 380, .9) * .35;
    sumar(BAJO, i, v * env * g, v * env * g);
  }
}
// Arpegio de semicorcheas sobre las notas del acorde, filtro que se abre según fcFn
function arpegio(t0, t1, g, fcFn, patron = [0, 2, 1, 3, 2, 4, 3, 1]) {
  const paso = .125, filt = [svf(), svf()];
  for (let tn = t0; tn < t1 - 1e-6; tn += paso) {
    const k = Math.round((tn - t0) / paso), notas = acordeEn(tn)[2].slice(1).map(m => m + 12);
    const m = notas[patron[k % patron.length] % notas.length], f = mtof(m), tb = tablaSierra(f);
    const i0 = Math.round(tn * SR), largo = Math.round(.22 * SR), acento = k % 4 === 0 ? 1 : .72;
    let fase = 0;
    for (let j = 0; j < largo; j++) {
      const t = (i0 + j) / SR, e = Math.min(1, j / (.002 * SR)) * Math.exp(-j / (.11 * SR));
      fase += f / SR; const v = leer(tb, fase) * e * acento * g;
      const fc = fcFn(t) * (.6 + .8 * e);
      const s = filt[0](v, fc, 1.4);
      sumar(MUS, i0 + j, s * .8, s * .8); sumar(ENVIO, i0 + j, s * .25, s * .25);
    }
  }
}
// Campana FM (motivo, melodía)
function campana(t, m, g, dur = 2.6, pan = 0, ratio = 3.5, indice = 2.2, envio = .5) {
  const f = mtof(m), i0 = Math.round(t * SR), n = Math.round(dur * SR), [gl, gr] = panG(pan);
  for (let j = 0; j < n; j++) {
    const s = j / SR, e = Math.min(1, j / (.003 * SR)) * Math.exp(-s / (dur / 4));
    const mod = Math.sin(TAU * f * ratio * s) * indice * Math.exp(-s / .35);
    const v = (Math.sin(TAU * f * s + mod) + .25 * Math.sin(TAU * f * 2 * s) * Math.exp(-s / .5)) * e * g;
    sumar(MUS, i0 + j, v * gl, v * gr); sumar(ENVIO, i0 + j, v * envio * gl, v * envio * gr);
  }
}
// Batería
function bombo(t, g = 1) {
  const i0 = Math.round(t * SR); let fase = 0;
  for (let j = 0; j < .5 * SR; j++) { const s = j / SR, f = 46 + 110 * Math.exp(-s * 28); fase += f / SR;
    const v = (Math.tanh(Math.sin(TAU * fase) * 1.6) * Math.exp(-s / .22) + ruido() * Math.exp(-s / .003) * .25) * g; sumar(BAT, i0 + j, v, v); }
}
function caja(t, g = 1) {
  const i0 = Math.round(t * SR), hp = unPolo(), lp = unPolo();
  for (let j = 0; j < .45 * SR; j++) { const s = j / SR, n = ruido(), h = n - hp(n, .08);
    const v = (lp(h, .45) * Math.exp(-s / .14) * .9 + Math.sin(TAU * 185 * s) * Math.exp(-s / .05) * .5) * g;
    sumar(BAT, i0 + j, v, v); sumar(ENVIO, i0 + j, v * .25, v * .25); }
}
function palmas(t, g = 1) { for (let k = 0; k < 3; k++) { const i0 = Math.round((t + k * .011) * SR), hp = unPolo(); for (let j = 0; j < (k === 2 ? .25 : .02) * SR; j++) { const n = ruido(), v = (n - hp(n, .2)) * Math.exp(-j / SR / (k === 2 ? .09 : .006)) * g * .6; sumar(BAT, i0 + j, v * .9, v); sumar(ENVIO, i0 + j, v * .3, v * .3); } } }
function charles(t, g = 1, abierto = false) {
  const i0 = Math.round(t * SR), hp = unPolo(), d = abierto ? .2 : .035, pan = (rnd() - .5) * .5, [gl, gr] = panG(pan);
  for (let j = 0; j < d * 5 * SR; j++) { const n = ruido(), v = (n - hp(n, .55)) * Math.exp(-j / SR / d) * g * .45; sumar(BAT, i0 + j, v * gl, v * gr); }
}
function platillo(t, g = 1) {
  const i0 = Math.round(t * SR), hp = unPolo(), hp2 = unPolo();
  for (let j = 0; j < 2.6 * SR; j++) { const s = j / SR, n = ruido(), h = n - hp(n, .35); const v = (h - hp2(h, .02) * .3) * Math.exp(-s / .7) * g * .38;
    sumar(BAT, i0 + j, v * (1 + .2 * Math.sin(s * 9)), v * (1 - .2 * Math.sin(s * 9))); sumar(ENVIO, i0 + j, v * .3, v * .3); }
}
function reverso(tFin, dur, g = 1) {   // platillo al revés que desemboca en tFin
  const i1 = Math.round(tFin * SR), n = Math.round(dur * SR), hp = unPolo();
  for (let j = 0; j < n; j++) { const s = j / n, x = ruido(), v = (x - hp(x, .3)) * Math.pow(s, 2.5) * g * .4; sumar(BAT, i1 - n + j, v, v); }
}

// ── arreglo ──
const fcIntro = t => 320 + 220 * Math.sin(t * .4);
pad(0, 8.0, [38, 50, 57, 62], .085, t => fcIntro(t) * .8, .4);                                   // drone del Acto I (re y la)
for (const [a, b, notas] of PROG.filter(p => p[0] >= 8 && p[0] < 60)) pad(a, b, notas, .085, t => t < 16 ? 500 + 900 * (t - 8) / 8 : 1500 + 500 * Math.sin(t * .35), .8);
pad(60, 63.5, PROG.find(p => p[0] === 60)[2], .11, t => 1400 + 3000 * Math.pow((t - 60) / 3.5, 2), .9);
for (const [a, b, notas] of PROG.filter(p => p[0] >= 64)) pad(a, b, notas, .11, t => 2600 + 600 * Math.sin(t * .5), 1);

bajo(8.5, 16, .32); bajo(16, 60, .42); bajo(60, 63.5, .38, false); bajo(64, 80, .34);
arpegio(8.5, 16, .17, t => 280 + 2600 * Math.pow((t - 8.5) / 7.5, 2));
arpegio(16, 60, .14, t => t < 28 ? 2200 : t < 48 ? 2600 + 600 * Math.sin(t) : 3800);
arpegio(60, 63.4, .12, t => 3500 - 2600 * ((t - 60) / 3.4));
arpegio(66, 77, .085, t => 1800 + 400 * Math.sin(t * .6), [0, 2, 4, 2, 1, 3, 4, 3]);

// Batería a medio tiempo: bombo en corcheas 1, 4 y 7 · caja/palmas en el tiempo 3 · charles en semicorcheas
const BOMBOS = [];
for (let c = 16; c < 60; c += 2) {
  const cap = c < 28 ? 1 : c < 38 ? 2 : c < 48 ? 3 : 4;
  [0, .75, 1.5].forEach(o => { bombo(c + o, o ? .85 : 1); BOMBOS.push(c + o); });
  if (cap >= 3 && (c / 2) % 2 === 1) { bombo(c + 1.75, .6); BOMBOS.push(c + 1.75); }
  caja(c + 1.0, .7); palmas(c + 1.0, cap >= 3 ? .75 : .5);
  for (let k = 0; k < 16; k++) { const tt = c + k * .125; if (cap === 1 && k % 2) continue; charles(tt, (k % 4 === 2 ? .55 : .3) * (cap >= 3 ? 1.1 : 1)); }
  if (cap === 4) [.25, .75, 1.25, 1.75].forEach(o => charles(c + o, .35, true));
}
for (let k = 0; k < 8; k++) charles(12 + k * .5, .25);                              // los charles entran en el 12
for (let k = 0; k < 16; k++) charles(14 + k * .125, .2 + k * .012);
for (let k = 0; k < 8; k++) caja(15 + k * .125, .18 + k * .06);                      // redoble hacia la caída
for (let k = 0; k < 24; k++) caja(62 + k * (1.5 / 24) * (1 - k / 60), .12 + k * .02); // redoble de la subida final
[16, 28, 38, 48].forEach(t => platillo(t, t === 16 ? 1 : .8));
[16, 28, 38, 48].forEach(t => reverso(t, 1.2, .9));
reverso(64, 2.2, 1.1);

// Motivo de Lurveta: re–la–mi (campanas FM), a la izquierda y a la derecha como los dos trazos de la V
function motivo(t, g = 1, completo = true) {
  campana(t, 74, .32 * g, 3.4, -.45); campana(t + .16, 81, .28 * g, 3.4, .45); campana(t + .32, 88, .22 * g, 4.2, 0);
  if (completo) { campana(t + .32, 76, .12 * g, 5, -.2, 2, 1.2, .9); campana(t + .32, 69, .12 * g, 5, .2, 2, 1.2, .9); }
}
// Melodía de los capítulos 2 y 4 (re menor pentatónica, escasa)
const FRASE = [[0, 74], [.5, 77], [1.0, 79], [1.5, 81], [3.0, 79], [3.5, 77], [4.0, 74], [6.0, 72], [6.5, 74]];
for (const base of [28, 36, 48, 56]) for (const [o, m] of FRASE) if (base + o < 60) campana(base + o, m, .12, 1.6, (m % 2 ? -.3 : .3), 2, 1.4, .45);

// ── efectos sincronizados con la imagen ──
function proximoGolpe(t) { const c = CUES.find(x => x.t > t + .05 && /impacto|caida|silencio/.test(x.tipo)); return c ? c.t : t + 1.5; }
const EF = {
  zumbido(t, g) { const i0 = Math.round(t * SR), lp = unPolo(); for (let j = 0; j < 3 * SR; j++) { const s = j / SR, parp = .6 + .4 * Math.sin(s * 37) * Math.sin(s * 13);
    const v = (Math.sin(TAU * 50 * s) * .5 + Math.sin(TAU * 100 * s) * .3 + Math.sin(TAU * 150 * s) * .2 + lp(ruido(), .05) * .4) * Math.min(1, s / .4) * Math.exp(-s / 1.6) * parp * g * .22; sumar(FX, i0 + j, v, v); } },
  chispa(t, g) { const i0 = Math.round(t * SR); for (let j = 0; j < .08 * SR; j++) { const v = ruido() * (rnd() > .7 ? 1 : .1) * Math.exp(-j / SR / .02) * g * .35; sumar(FX, i0 + j, v, v * .8); } },
  corte(t, g) { const i0 = Math.round(t * SR); let ph = 0; for (let j = 0; j < .55 * SR; j++) { const s = j / SR, f = 2400 * Math.exp(-s * 7) + 60; ph += f / SR;
    const sq = Math.sign(Math.sin(TAU * ph)), bc = Math.round(sq * 4 + ruido() * 2) / 6; const v = bc * Math.exp(-s / .18) * g * .25; sumar(FX, i0 + j, v, -v); } },
  golpeSeco(t, g) { const i0 = Math.round(t * SR); let ph = 0; for (let j = 0; j < .7 * SR; j++) { const s = j / SR, f = 44 + 60 * Math.exp(-s * 18); ph += f / SR;
    const v = (Math.sin(TAU * ph) * Math.exp(-s / .28) + ruido() * Math.exp(-s / .006) * .35) * g * .9; sumar(FX, i0 + j, v, v); sumar(ENVIO, i0 + j, v * .2, v * .2); } },
  riser(t, g) { const fin = proximoGolpe(t), d = fin - t, i0 = Math.round(t * SR), hp = unPolo(), lp = unPolo(); let ph = 0;
    for (let j = 0; j < d * SR; j++) { const k = j / (d * SR), f = 180 + 1800 * k * k; ph += f / SR; const n = ruido(), h = n - hp(n, .02 + .3 * k);
      const v = (lp(h, .05 + .6 * k) * .7 + Math.sin(TAU * ph) * .18 + Math.sin(TAU * ph * 1.5) * .08) * Math.pow(k, 2.2) * g * .55; sumar(FX, i0 + j, v, v); sumar(ENVIO, i0 + j, v * .3, v * .3); } },
  riserFinal(t, g) { EF.riser(t, g * 1.25); },
  brillo(t, g) { [86, 90, 93, 98, 102].forEach((m, k) => campana(t + k * .05, m, .07 * g, 1.2, (k - 2) * .3, 1.5, .6, .8)); },
  impacto(t, g, med) { const i0 = Math.round(t * SR), lp = unPolo(); let ph = 0;
    for (let j = 0; j < 4 * SR; j++) { const s = j / SR, f = 34 + 70 * Math.exp(-s * 6); ph += f / SR; const n = lp(ruido(), .08);
      const v = (Math.tanh(Math.sin(TAU * ph) * 2) * Math.exp(-s / (med ? .5 : .9)) * 1.0 + n * Math.exp(-s / .25) * 1.2 + Math.sin(TAU * 98 * s) * Math.exp(-s / .15) * .3) * g * .85;
      sumar(FX, i0 + j, v, v); sumar(ENVIO, i0 + j, v * .35, v * .35); } },
  impactoMedio(t, g) { EF.impacto(t, g * .8, true); },
  impactoFinal(t, g) { EF.impacto(t, g); EF.impacto(t + .004, g * .5, true); platillo(t, .9); },
  caida(t, g) { EF.impacto(t, g * .7, true); },
  motivo(t, g) { motivo(t, g, true); },
  motivoCorto(t, g) { motivo(t, g * .7, false); },
  whoosh(t, g) { const d = .8, i0 = Math.round((t - .35) * SR), hp = unPolo(), lp = unPolo();
    for (let j = 0; j < d * SR; j++) { const k = j / (d * SR), a = Math.pow(Math.sin(Math.PI * k), 1.6), n = ruido(), h = n - hp(n, .01);
      const v = lp(h, .02 + .25 * Math.sin(Math.PI * k)) * a * g * .9, p = (k - .5) * 1.4; sumar(FX, i0 + j, v * (1 - p * .5), v * (1 + p * .5)); } },
  swish(t, g) { EF.whoosh(t + .15, g * .5); },
  trazo(t, g) { const i0 = Math.round(t * SR), hp = unPolo(); for (let j = 0; j < .35 * SR; j++) { const k = j / (.35 * SR), n = ruido(), v = (n - hp(n, .3)) * Math.sin(Math.PI * k) * g * .35; sumar(FX, i0 + j, v * (1 - k), v * k); } },
  tic(t, g, p) { const i0 = Math.round(t * SR), f = 2200 + (p % 3) * 300; for (let j = 0; j < .06 * SR; j++) { const s = j / SR, v = Math.sin(TAU * f * s) * Math.exp(-s / .012) * g * .3; sumar(FX, i0 + j, v, v); } },
  tecla(t, g) { const i0 = Math.round(t * SR), lp = unPolo(); for (let j = 0; j < .05 * SR; j++) { const s = j / SR, v = (lp(ruido(), .5) * .6 + Math.sin(TAU * 3100 * s) * .3) * Math.exp(-s / .008) * g * .35; sumar(FX, i0 + j, v, v); } },
  nexus(t, g) { [81, 86, 88, 93].forEach((m, k) => campana(t + k * .09, m, .1 * g, 1.8, (k - 1.5) * .35, 1.5, .8, .7)); },
  pop(t, g) { const i0 = Math.round(t * SR); let ph = 0; for (let j = 0; j < .2 * SR; j++) { const s = j / SR, f = 320 + 900 * Math.exp(-s * 28); ph += f / SR; const v = Math.sin(TAU * ph) * Math.exp(-s / .05) * g * .4; sumar(FX, i0 + j, v, v); } },
  moneda(t, g) { campana(t, 88, .16 * g, .9, -.2, 1, .4, .5); campana(t + .085, 95, .16 * g, 1.4, .2, 1, .4, .5); },
  silencio() {},
};
for (const c of CUES) { const f = EF[c.tipo]; if (f) f(c.t, c.g, c.p); else console.warn('efecto desconocido', c.tipo); }

// ── mezcla ──
// Reverb estéreo (combinaciones en paralelo + pasa todo), sobre el envío
function reverb(entrada, largo = .86, amort = .25) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116].map(n => Math.round(n * SR / 44100)), aps = [556, 441, 341, 225].map(n => Math.round(n * SR / 44100));
  const salidaR = bus();
  for (const [canal, desv] of [['L', 0], ['R', 23]]) {
    const x = entrada[canal], y = salidaR[canal];
    for (const n0 of combs) { const n = n0 + desv, buf = new Float32Array(n); let i = 0, filt = 0;
      for (let s = 0; s < N; s++) { const o = buf[i]; filt = o * (1 - amort) + filt * amort; buf[i] = x[s] + filt * largo; y[s] += o * .12; i = (i + 1) % n; } }
    for (const n0 of aps) { const n = n0 + desv, buf = new Float32Array(n); let i = 0;
      for (let s = 0; s < N; s++) { const b = buf[i], v = -y[s] + b; buf[i] = y[s] + b * .5; y[s] = v; i = (i + 1) % n; } }
  }
  return salidaR;
}
// Eco en ping-pong de 3/16 para el arpegio y las campanas
function eco(b, t = .375, fb = .32, mezcla = .22) {
  const d = Math.round(t * SR), l = new Float32Array(N), r = new Float32Array(N);
  for (let s = d; s < N; s++) { l[s] = (b.L[s - d] + b.R[s - d]) * .5 + r[s - d] * fb; r[s] = l[s - d]; }   // izquierda → derecha → izquierda
  for (let s = 0; s < N; s++) { b.L[s] += l[s] * mezcla; b.R[s] += r[s] * mezcla; }
}
eco(MUS);
const VERB = reverb(ENVIO);
// El pad no compite con el bajo: pasa altos a ~150 Hz
for (const ch of ['L', 'R']) { const lp = unPolo(), a = 1 - Math.exp(-TAU * 150 / SR); for (let s = 0; s < N; s++) PAD[ch][s] -= lp(PAD[ch][s], a); }
// Sidechain: el bombo hunde un poco el pad y el bajo
const ducking = new Float32Array(N).fill(1);
for (const tk of BOMBOS) { const i0 = Math.round(tk * SR); for (let j = 0; j < .3 * SR && i0 + j < N; j++) ducking[i0 + j] = Math.min(ducking[i0 + j], 1 - .55 * Math.exp(-j / SR / .09)); }

const L = new Float32Array(N), R = new Float32Array(N);
for (let s = 0; s < N; s++) {
  const t = s / SR, mute = enSilencio(t) ? 0 : 1, sc = ducking[s];
  const mus = (MUS.L[s] + PAD.L[s] * 1.0 * sc + BAJO.L[s] * sc + BAT.L[s]) * mute, musR = (MUS.R[s] + PAD.R[s] * sc + BAJO.R[s] * sc + BAT.R[s]) * mute;
  const gs = gSilencio(t);   // en los silencios se apaga todo, también la reverb y los efectos
  L[s] = (mus + FX.L[s] + VERB.L[s] * .9) * gs; R[s] = (musR + FX.R[s] + VERB.R[s] * .9) * gs;
}
// Desvanecido final y limitador suave
for (let s = 0; s < N; s++) { const t = s / SR, f = t > DUR - 4.2 ? Math.max(0, (DUR - 1.2 - t) / 3) : 1; L[s] = Math.tanh(L[s] * .9 * f); R[s] = Math.tanh(R[s] * .9 * f); }

// WAV 24 bits y normalización de sonoridad (−14 LUFS, pico −1 dBTP) con ffmpeg
const tmp = salida.replace(/\.wav$/, '.crudo.wav');
const buf = Buffer.alloc(44 + N * 6); buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 6, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 6, 28); buf.writeUInt16LE(6, 32); buf.writeUInt16LE(24, 34); buf.write('data', 36); buf.writeUInt32LE(N * 6, 40);
for (let s = 0; s < N; s++) for (const [k, ch] of [[0, L], [1, R]]) { const v = Math.round(clamp(ch[s], -1, 1) * 8388607); buf.writeIntLE(v, 44 + s * 6 + k * 3, 3); }
fs.writeFileSync(tmp, buf);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-af', 'loudnorm=I=-14:TP=-2:LRA=11,alimiter=limit=0.7:level=false:attack=2:release=60', '-ar', String(SR), '-c:a', 'pcm_s24le', salida]);
fs.rmSync(tmp);
console.log('Sonido listo:', salida);
