/**
 * Tests de la fórmula con la que Nexus ordena el feed (public/upgames-ranking.js).
 * Autónomo: `node test/ranking.test.js` (o `npm test`).
 */
'use strict';

const assert = require('assert');
const R = require('../public/upgames-ranking');

let passed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log(`  ✓ ${name}`); }
    catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
}
const DIA = 864e5;
const hace = d => new Date(Date.now() - d * DIA).toISOString();
const futuro = d => new Date(Date.now() + d * DIA).toISOString();
const base = (o = {}) => ({ _id: Math.random().toString(16).slice(2), title: 'x', category: 'Mod', usuario: 'ana', createdAt: hace(20), likesCount: 0, descargasEfectivas: 0, descargasSemana: 0, seguidoresAutor: 0, ...o });

console.log('pesos');
test('los pesos orgánicos suman 100 %', () => assert.strictEqual(Math.round(Object.values(R.PESOS).reduce((a, b) => a + b, 0) * 100), 100));
test('reseñas 30 %, recurrencia 10 %, promoción máx 50 %', () => {
    assert.strictEqual(R.PESOS.resenas, 0.30); assert.strictEqual(R.PESOS.recurrencia, 0.10);
    assert.strictEqual(Math.max(...R.PROMO_NIVELES.map(n => n.peso)), 0.50);
});

console.log('promoción');
test('más UpCoins → más peso de promoción', () => {
    const p = n => R.pesoPromo({ destacadoHasta: futuro(1), promoNivel: n });
    assert.ok(p('estandar') < p('plus') && p('plus') < p('max'));
});
test('promoción vencida no pesa', () => assert.strictEqual(R.pesoPromo({ destacadoHasta: hace(1), promoNivel: 'max' }), 0));
test('una promoción Máx nunca pasa del 50 % del puntaje', () => {
    const it = base({ destacadoHasta: futuro(2), promoNivel: 'max', promocionado: true });
    const r = R.puntaje(it, R.contexto([it]), null);
    assert.ok(Math.abs(r.total - (0.5 + 0.5 * r.organico)) < 1e-9);
});
test('precios: más días cuestan más pero menos por día; más nivel cuesta más', () => {
    assert.strictEqual(R.precioPromo(1, 'estandar'), 50);
    assert.ok(R.precioPromo(7, 'estandar') > R.precioPromo(3, 'estandar'));
    assert.ok(R.precioPromo(30, 'estandar') / 30 < R.precioPromo(1, 'estandar'));
    assert.ok(R.precioPromo(7, 'max') > R.precioPromo(7, 'plus'));
    assert.strictEqual(R.precioPromo(2, 'estandar'), null);
    assert.strictEqual(R.precioPromo(1, 'oro'), null);
});
test('un contenido excelente puede superar a una promoción Estándar con contenido flojo', () => {
    const bueno = base({ resenas: { n: 40, promedio: 4.9, si: 38, no: 1 }, likesCount: 300, seguidoresAutor: 900, descargasSemana: 500, createdAt: hace(1) });
    const flojo = base({ resenas: { n: 6, promedio: 1.5, si: 0, no: 5 }, destacadoHasta: futuro(1), promoNivel: 'estandar', promocionado: true });
    const orden = R.ordenar([flojo, bueno]);
    assert.strictEqual(orden[0], bueno);
});

console.log('reseñas');
test('sin reseñas = neutro; 5★ sube; 1★ baja', () => {
    assert.strictEqual(R.puntajeResenas(null), 0.5);
    assert.ok(R.puntajeResenas({ n: 10, promedio: 5 }) > 0.8);
    assert.ok(R.puntajeResenas({ n: 10, promedio: 1 }) < 0.2);
});
test('una sola reseña de 5★ pesa menos que veinte (media bayesiana)', () =>
    assert.ok(R.puntajeResenas({ n: 1, promedio: 5 }) < R.puntajeResenas({ n: 20, promedio: 5 })));
test('"no me funcionó" baja el puntaje', () =>
    assert.ok(R.puntajeResenas({ n: 10, promedio: 4, si: 0, no: 10 }) < R.puntajeResenas({ n: 10, promedio: 4, si: 10, no: 0 })));

console.log('personalización');
test('gustos: a quien descarga mods de Resident Evil le sube Resident Evil', () => {
    const re = base({ usuario: 'leo', category: 'Juego', extraData: { detectedGame: { gameName: 'Resident Evil' } } });
    const otro = base({ usuario: 'mia', category: 'Apps' });
    const pf = R.perfil([{ cat: 'juego', g: 'resident evil', u: 'leo', k: 'd', t: Date.now() }, { cat: 'juego', g: 'resident evil', k: 'v', t: Date.now() }]);
    const ctx = R.contexto([re, otro]);
    assert.ok(R.puntaje(re, ctx, pf).total > R.puntaje(otro, ctx, pf).total);
});
test('recurrencia: volver a un creador y a un juego lo sube (el juego pesa más)', () => {
    const pf = R.perfil(Array.from({ length: 5 }, () => ({ u: 'leo', g: 'gta v', k: 'v', t: Date.now() })));
    assert.ok(R.personales(base({ usuario: 'leo', juego: 'GTA V' }), pf).recurrencia > 0.8);
    assert.ok(R.personales(base({ usuario: 'leo' }), pf).recurrencia > 0.3);
    assert.ok(R.personales(base({ usuario: 'otro', juego: 'GTA V' }), pf).recurrencia > R.personales(base({ usuario: 'leo' }), pf).recurrencia);
    assert.strictEqual(R.personales(base({ usuario: 'otro' }), pf).recurrencia, 0);
});
test('sin historial no se inventan gustos: se reparte el peso', () => {
    const it = base({ resenas: { n: 10, promedio: 5 } });
    const r = R.puntaje(it, R.contexto([it]), R.perfil([]));
    assert.ok(!('gustos' in r.senales) && r.organico > 0);
});
test('variedad: no salen 3 seguidas del mismo creador si hay alternativas parecidas', () => {
    const items = [...Array.from({ length: 3 }, () => base({ usuario: 'ana', likesCount: 10 })), ...Array.from({ length: 3 }, () => base({ usuario: 'bob', likesCount: 9 }))];
    const top3 = R.ordenar(items).slice(0, 3).map(i => i.usuario);
    assert.ok(new Set(top3).size > 1);
});

console.log(`\nranking: ${passed} pruebas OK`);
