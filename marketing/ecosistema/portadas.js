#!/usr/bin/env node
/**
 * Portadas e imágenes de DEMOSTRACIÓN para el video: ilustraciones propias (hechas con código) con títulos y estudios
 * inventados, para no mostrar portadas ni marcas de juegos comerciales. Las usa capturar.js en lugar del catálogo real.
 * Uso: node portadas.js   → portadas/*.jpg (600×800 a 2×), avatar y banner
 */
'use strict';
const path = require('path'), fs = require('fs');
const { navegador } = require('../../test/real/util');
const OUT = path.join(__dirname, 'portadas');

const R = s => { let x = Math.sin(s * 127.1) * 43758.5453; return x - Math.floor(x); };
const estrellas = (n, sem, w = 600, h = 520) => Array.from({ length: n }, (_, i) => `<circle cx="${R(sem + i) * w}" cy="${R(sem + i + 99) * h}" r="${.6 + R(sem + i + 7) * 1.8}" fill="#fff" opacity="${.3 + R(sem + i + 3) * .7}"/>`).join('');
const MOTIVOS = {
  // atardecer sobre una pista con un auto de líneas simples
  sunsetCar: (c) => `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset=".6" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/></linearGradient></defs>
    <rect width="600" height="800" fill="url(#s)"/><circle cx="300" cy="400" r="150" fill="${c[3]}" opacity=".95"/>${[0, 1, 2, 3, 4, 5].map(i => `<rect x="120" y="${360 + i * 22}" width="360" height="${3 + i}" fill="${c[0]}" opacity=".9"/>`).join('')}
    <path d="M0 520 L600 520 L600 800 L0 800Z" fill="#0b0720"/>${Array.from({ length: 14 }, (_, i) => `<path d="M${300 + (i - 7) * 14} 520 L${300 + (i - 7) * 150} 800" stroke="${c[3]}" stroke-width="2" opacity=".55"/>`).join('')}
    ${Array.from({ length: 6 }, (_, i) => `<path d="M0 ${540 + i * i * 9} L600 ${540 + i * i * 9}" stroke="${c[3]}" stroke-width="2" opacity=".4"/>`).join('')}
    <g transform="translate(300 600)"><path d="M-120 20 L-95 -18 Q-60 -40 0 -40 Q60 -40 95 -18 L120 20 Q0 36 -120 20Z" fill="#0b0720" stroke="${c[3]}" stroke-width="3"/><rect x="-92" y="-16" width="184" height="10" rx="5" fill="${c[3]}" opacity=".8"/><circle cx="-76" cy="24" r="17" fill="#0b0720" stroke="${c[3]}" stroke-width="3"/><circle cx="76" cy="24" r="17" fill="#0b0720" stroke="${c[3]}" stroke-width="3"/></g>`,
  planet: (c) => `<rect width="600" height="800" fill="${c[0]}"/>${estrellas(90, 3)}<defs><radialGradient id="p" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="${c[3]}"/><stop offset=".55" stop-color="${c[2]}"/><stop offset="1" stop-color="${c[1]}"/></radialGradient></defs>
    <circle cx="300" cy="330" r="190" fill="url(#p)"/><ellipse cx="300" cy="350" rx="320" ry="62" fill="none" stroke="${c[3]}" stroke-width="10" opacity=".75" transform="rotate(-16 300 350)"/>
    <path d="M110 330 A190 190 0 0 1 490 330" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="3"/><circle cx="478" cy="170" r="22" fill="${c[3]}" opacity=".9"/><circle cx="120" cy="560" r="10" fill="${c[3]}" opacity=".8"/>
    <path d="M0 800 L0 640 Q150 590 300 650 T600 620 L600 800Z" fill="#000" opacity=".5"/>`,
  peaks: (c) => `<defs><linearGradient id="k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient></defs><rect width="600" height="800" fill="url(#k)"/>
    <circle cx="420" cy="260" r="80" fill="${c[3]}" opacity=".9"/>${estrellas(40, 11, 600, 300)}
    <path d="M0 640 L120 430 L210 540 L330 330 L460 520 L540 440 L600 520 L600 800 L0 800Z" fill="${c[2]}"/><path d="M0 700 L90 560 L200 650 L320 500 L430 640 L600 540 L600 800 L0 800Z" fill="#000" opacity=".45"/>
    <path d="M330 330 L300 400 L330 380 L350 420 L372 385Z" fill="#fff" opacity=".5"/>${Array.from({ length: 16 }, (_, i) => `<circle cx="${R(i) * 600}" cy="${560 + R(i + 40) * 200}" r="${1 + R(i + 9) * 3}" fill="${c[3]}" opacity=".8"/>`).join('')}`,
  blade: (c) => `<rect width="600" height="800" fill="${c[0]}"/><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c[3]}"/><stop offset="1" stop-color="${c[2]}"/></linearGradient></defs>
    ${[0, 1, 2, 3, 4, 5, 6].map(i => `<path d="M${-80 + i * 110} 800 L${240 + i * 60} 0" stroke="${c[1]}" stroke-width="${30 + i * 4}" opacity=".35"/>`).join('')}
    <g transform="translate(300 380) rotate(-35)"><path d="M0 -300 L28 160 L0 220 L-28 160Z" fill="url(#b)"/><path d="M0 -300 L0 220" stroke="#fff" stroke-opacity=".6" stroke-width="3"/><rect x="-80" y="150" width="160" height="22" rx="11" fill="${c[3]}"/><rect x="-14" y="170" width="28" height="90" rx="10" fill="${c[1]}"/></g>
    ${estrellas(50, 21, 600, 800)}`,
  garden: (c) => `<defs><radialGradient id="g" cx=".5" cy=".7" r=".8"><stop offset="0" stop-color="${c[2]}"/><stop offset="1" stop-color="${c[0]}"/></radialGradient></defs><rect width="600" height="800" fill="url(#g)"/>
    ${Array.from({ length: 9 }, (_, i) => { const x = 40 + i * 64, h = 160 + R(i + 5) * 260; return `<path d="M${x} 800 Q${x + 30 * (R(i) - .5) * 2} ${800 - h / 2} ${x + 10} ${800 - h}" stroke="${c[1]}" stroke-width="10" fill="none" stroke-linecap="round"/><circle cx="${x + 10}" cy="${800 - h}" r="${22 + R(i + 2) * 18}" fill="${c[3]}" opacity=".95"/><circle cx="${x + 10}" cy="${800 - h}" r="${46 + R(i + 2) * 30}" fill="${c[3]}" opacity=".18"/>`; }).join('')}
    ${Array.from({ length: 30 }, (_, i) => `<circle cx="${R(i + 60) * 600}" cy="${R(i + 61) * 700}" r="${1.5 + R(i) * 3}" fill="${c[3]}" opacity=".7"/>`).join('')}`,
  moon: (c) => `<defs><linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient></defs><rect width="600" height="800" fill="url(#m)"/>${estrellas(60, 31, 600, 500)}
    <circle cx="300" cy="300" r="170" fill="${c[3]}"/><circle cx="360" cy="270" r="170" fill="${c[1]}" opacity=".0"/><circle cx="250" cy="260" r="26" fill="#000" opacity=".12"/><circle cx="350" cy="350" r="40" fill="#000" opacity=".1"/>
    <path d="M0 800 L0 600 Q60 540 120 600 L120 470 L150 440 L180 470 L180 600 Q300 520 420 600 L420 500 L470 450 L520 500 L520 600 Q570 560 600 600 L600 800Z" fill="#000"/>
    <rect x="132" y="520" width="14" height="22" fill="${c[3]}" opacity=".9"/><rect x="452" y="540" width="14" height="22" fill="${c[3]}" opacity=".9"/>`,
  waves: (c) => `<rect width="600" height="800" fill="${c[0]}"/><defs><linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[3]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient></defs>
    <circle cx="300" cy="300" r="120" fill="${c[3]}"/>${[0, 1, 2, 3, 4, 5, 6].map(i => `<path d="M0 ${420 + i * 60} Q75 ${390 + i * 60} 150 ${420 + i * 60} T300 ${420 + i * 60} T450 ${420 + i * 60} T600 ${420 + i * 60} L600 800 L0 800Z" fill="${i % 2 ? c[1] : c[2]}" opacity="${.55 + i * .07}"/>`).join('')}
    ${Array.from({ length: 12 }, (_, i) => `<rect x="${R(i + 2) * 560}" y="${R(i + 3) * 380}" width="14" height="14" fill="#fff" opacity=".6"/>`).join('')}`,
  station: (c) => `<rect width="600" height="800" fill="${c[0]}"/>${estrellas(80, 41, 600, 800)}<g transform="translate(300 380)"><circle r="120" fill="${c[2]}" stroke="${c[3]}" stroke-width="6"/><circle r="70" fill="${c[1]}" stroke="${c[3]}" stroke-width="4"/>
    <rect x="-300" y="-16" width="600" height="32" fill="${c[1]}" stroke="${c[3]}" stroke-width="3"/>${[-250, -200, 200, 250].map(x => `<rect x="${x - 22}" y="-90" width="44" height="180" fill="${c[3]}" opacity=".35" stroke="${c[3]}"/>`).join('')}
    ${Array.from({ length: 8 }, (_, i) => `<circle cx="${Math.cos(i * .785) * 95}" cy="${Math.sin(i * .785) * 95}" r="7" fill="${c[3]}"/>`).join('')}</g>`,
  orb: (c) => `<defs><radialGradient id="o" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="${c[3]}"/><stop offset="1" stop-color="${c[0]}" stop-opacity="0"/></radialGradient></defs><rect width="600" height="800" fill="${c[0]}"/>
    <circle cx="300" cy="360" r="330" fill="url(#o)"/>${[1, 2, 3, 4, 5].map(i => `<circle cx="300" cy="360" r="${60 + i * 52}" fill="none" stroke="${c[3]}" stroke-width="1.5" opacity="${.5 - i * .07}"/>`).join('')}
    ${Array.from({ length: 22 }, (_, i) => { const a = i * .6, r = 90 + i * 11; return `<circle cx="${300 + Math.cos(a) * r}" cy="${360 + Math.sin(a) * r}" r="${2 + R(i) * 4}" fill="#fff" opacity=".8"/>`; }).join('')}`,
  circuit: (c) => `<rect width="600" height="800" fill="${c[0]}"/>${Array.from({ length: 16 }, (_, i) => { const y = 80 + i * 44, x1 = R(i + 70) * 200, x2 = 300 + R(i + 71) * 300; return `<path d="M0 ${y} H${x1} L${x1 + 40} ${y + 22} H${x2} L${x2 + 30} ${y} H600" fill="none" stroke="${c[2]}" stroke-width="3" opacity=".7"/><circle cx="${x1 + 40}" cy="${y + 22}" r="6" fill="${c[3]}"/><circle cx="${x2 + 30}" cy="${y}" r="6" fill="${c[3]}"/>`; }).join('')}
    <g transform="translate(300 400)"><path d="M-130 40 L-100 -30 Q-60 -60 0 -60 Q60 -60 100 -30 L130 40 Q0 62 -130 40Z" fill="${c[1]}" stroke="${c[3]}" stroke-width="4"/><circle cx="-80" cy="48" r="22" fill="${c[0]}" stroke="${c[3]}" stroke-width="4"/><circle cx="80" cy="48" r="22" fill="${c[0]}" stroke="${c[3]}" stroke-width="4"/><path d="M-70 -32 Q0 -52 70 -32" stroke="${c[3]}" stroke-width="5" fill="none"/></g>`,
  dunes: (c) => `<defs><linearGradient id="d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset=".55" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[2]}"/></linearGradient></defs><rect width="600" height="800" fill="url(#d)"/>
    <circle cx="300" cy="330" r="110" fill="${c[3]}" opacity=".95"/>${[0, 1, 2, 3].map(i => `<path d="M0 ${520 + i * 70} Q150 ${440 + i * 70} 320 ${520 + i * 70} T600 ${500 + i * 70} L600 800 L0 800Z" fill="${c[2]}" opacity="${.35 + i * .2}"/>`).join('')}
    <g transform="translate(300 480)"><path d="M-6 0 L0 -70 L6 0Z" fill="#000"/><circle cx="0" cy="-78" r="8" fill="#000"/><path d="M-30 -40 L30 -40" stroke="#000" stroke-width="4"/></g>`,
  stars: (c) => `<defs><radialGradient id="n" cx=".5" cy=".4" r=".8"><stop offset="0" stop-color="${c[2]}"/><stop offset="1" stop-color="${c[0]}"/></radialGradient></defs><rect width="600" height="800" fill="url(#n)"/>${estrellas(140, 51, 600, 800)}
    <path d="M300 130 L335 270 L480 300 L335 335 L300 480 L265 335 L120 300 L265 270Z" fill="${c[3]}"/><path d="M300 130 L335 270 L480 300 L335 335 L300 480 L265 335 L120 300 L265 270Z" fill="none" stroke="#fff" stroke-width="3" opacity=".8"/>
    <circle cx="300" cy="300" r="260" fill="none" stroke="${c[3]}" stroke-width="1.5" opacity=".4"/><circle cx="300" cy="300" r="200" fill="none" stroke="${c[3]}" stroke-width="1.5" opacity=".3"/>`,
};
// título, estudio ficticio, paleta [fondo, medio, oscuro/acento, brillo], motivo
const PORTADAS = [
  ['neon-drift', 'NEON DRIFT', 'sunsetCar', ['#1a0b3b', '#7a1fa2', '#ff3d81', '#ffd166']],
  ['void-harvest', 'VOID HARVEST', 'planet', ['#050a1c', '#10286b', '#2d6df6', '#7dd3fc']],
  ['emberfall', 'EMBERFALL', 'peaks', ['#2a0a0a', '#7a1d12', '#c2410c', '#ffb347']],
  ['skyblade', 'SKYBLADE', 'blade', ['#04141c', '#0a4a5a', '#0ea5b7', '#a7f3d0']],
  ['echo-garden', 'ECHO GARDEN', 'garden', ['#031a14', '#0f766e', '#0b3d2e', '#6ee7b7']],
  ['crypt-signal', 'CRYPT SIGNAL', 'moon', ['#0a0a14', '#1e1b4b', '#4338ca', '#e0e7ff']],
  ['pixel-tide', 'PIXEL TIDE', 'waves', ['#07102a', '#1d4ed8', '#38bdf8', '#fde68a']],
  ['iron-orbit', 'IRON ORBIT', 'station', ['#06080f', '#1f2937', '#475569', '#f59e0b']],
  ['lumen', 'LUMEN', 'orb', ['#0a0420', '#4c1d95', '#7c3aed', '#c4b5fd']],
  ['turbo-circuit', 'TURBO CIRCUIT', 'circuit', ['#06121a', '#0e3a4a', '#14b8a6', '#5eead4']],
  ['ashen-vale', 'ASHEN VALE', 'dunes', ['#2b1408', '#7c3a14', '#3a1d0a', '#fcd34d']],
  ['starlorn', 'STARLORN', 'stars', ['#03030c', '#1a1050', '#3b2ea8', '#ffd6f5']],
];
const pagina = (id, titulo, motivo, c, sub) => `<!DOCTYPE html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@800;900&family=Manrope:wght@600;800&display=block" rel="stylesheet">
<style>html,body{margin:0;width:600px;height:800px;overflow:hidden;background:#000}svg{position:absolute;inset:0}
.t{position:absolute;left:0;right:0;bottom:70px;text-align:center;font:900 62px/1 Orbitron,sans-serif;color:#fff;letter-spacing:.02em;text-shadow:0 4px 30px rgba(0,0,0,.7),0 0 40px ${c[3]}88;padding:0 24px}
.s{position:absolute;left:0;right:0;bottom:34px;display:none;text-align:center;font:800 15px Manrope,sans-serif;letter-spacing:.32em;color:${c[3]};text-transform:uppercase}
.v{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.25),transparent 28%,transparent 56%,rgba(0,0,0,.6))}</style></head>
<body><svg viewBox="0 0 600 800" width="600" height="800">${MOTIVOS[motivo](c)}</svg><div class="v"></div><div class="t">${titulo}</div><div class="s">${sub}</div></body></html>`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await navegador(), ctx = await b.newContext({ viewport: { width: 600, height: 800 }, deviceScaleFactor: 2 }), p = await ctx.newPage();
  for (const [id, titulo, motivo, c] of PORTADAS) {
    await p.setContent(pagina(id, titulo, motivo, c, '')); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(OUT, id + '.jpg'), type: 'jpeg', quality: 90 }); console.log('  ✓', id);
  }
  // avatar y banner de la cuenta de demostración
  const q = await (await b.newContext({ viewport: { width: 400, height: 400 }, deviceScaleFactor: 2 })).newPage();
  await q.setContent(`<body style="margin:0;width:400px;height:400px;background:radial-gradient(circle at 30% 25%,#5ce1ff,#39ff88 45%,#0b3d2e);display:grid;place-items:center;font:900 190px Orbitron,sans-serif;color:#031109">N</body>`); await q.screenshot({ path: path.join(OUT, 'avatar.jpg'), type: 'jpeg', quality: 90 });
  const w = await (await b.newContext({ viewport: { width: 1500, height: 500 }, deviceScaleFactor: 1 })).newPage();
  await w.setContent(`<body style="margin:0;width:1500px;height:500px;background:radial-gradient(60% 90% at 20% 20%,#39ff8866,transparent),radial-gradient(60% 90% at 85% 80%,#8f7bff88,transparent),linear-gradient(120deg,#04101c,#0b1f3a 60%,#1a0f3a)"><svg width="1500" height="500" style="position:absolute">${Array.from({ length: 40 }, (_, i) => `<circle cx="${R(i + 7) * 1500}" cy="${R(i + 8) * 500}" r="${1 + R(i) * 3}" fill="#fff" opacity=".6"/>`).join('')}<path d="M0 420 Q250 330 520 410 T1040 380 T1500 400 V500 H0Z" fill="#000" opacity=".35"/></svg></body>`); await w.screenshot({ path: path.join(OUT, 'banner.jpg'), type: 'jpeg', quality: 90 });
  await b.close();
})();
