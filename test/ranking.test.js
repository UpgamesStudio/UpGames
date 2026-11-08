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
test('reseñas 30 %, recurrencia 10 %; los pesos de videos suman 100 %', () => {
    assert.strictEqual(R.PESOS.resenas, 0.30); assert.strictEqual(R.PESOS.recurrencia, 0.10);
    assert.strictEqual(Math.round(Object.values(R.PESOS_VIDEO).reduce((a, b) => a + b, 0) * 100), 100);
    assert.ok(R.PESOS_VIDEO.megusta > 0 && R.PESOS_VIDEO.guardados > 0);
});

console.log('promoción');
test('más UpCoins → más peso de promoción', () => {
    const p = n => R.pesoPromo({ destacadoHasta: futuro(1), promoNivel: n });
    assert.ok(p('estandar') < p('plus') && p('plus') < p('max'));
});
test('promoción vencida no pesa', () => assert.strictEqual(R.pesoPromo({ destacadoHasta: hace(1), promoNivel: 'max' }), 0));
test('más UpCoins por día → más peso, hasta un tope de 85 %', () => {
    assert.strictEqual(R.pesoDeUCDia(50), 0.30);
    assert.ok(R.pesoDeUCDia(1000) > R.pesoDeUCDia(400) && R.pesoDeUCDia(400) > R.pesoDeUCDia(100));
    assert.strictEqual(R.pesoDeUCDia(1e6), 0.85);
    const mega = base({ destacadoHasta: futuro(30), promoUCDia: 1e6 / 30 / 0.65, promocionado: true });
    const r = R.puntaje(mega, R.contexto([mega]), null);
    assert.ok(Math.abs(r.total - (r.promo + (1 - r.promo) * r.organico)) < 1e-9 && r.promo <= 0.85);
});
test('inversión libre: mínimo el precio Estándar de esos días', () => {
    assert.strictEqual(R.montoPromoValido(30, 1000000), 1000000);
    assert.strictEqual(R.montoPromoValido(7, 100), null);
    assert.strictEqual(R.montoPromoValido(5, 5000), null);
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

console.log('segmentación por gustos');
test('una promo de carros pesa más con quien le gustan los carros que con quien le gusta el terror', () => {
    const promo = base({ title: 'Real Racing 3 mod', usuario: 'zed', destacadoHasta: futuro(5), promoUCDia: 400, promocionado: true });
    const fanCarros = R.perfil([{ cat: 'mod', gs: ['carreras'], g: 'need for speed', u: 'x', k: 'd', t: Date.now() }]);
    const fanTerror = R.perfil([{ cat: 'mod', gs: ['terror'], g: 'resident evil', u: 'y', k: 'd', t: Date.now() }]);
    const ctx = R.contexto([promo]);
    const a = R.puntaje(promo, ctx, fanCarros).promo, b = R.puntaje(promo, ctx, fanTerror).promo;
    assert.ok(a > b * 2, `${a} vs ${b}`);
    assert.ok(b > 0, 'igual le sale a todos, con menos fuerza');
});
test('géneros: detecta carreras, terror y mundo abierto', () => {
    assert.deepStrictEqual(R.generos({ title: 'Need for speed underground 2 mod' }), ['carreras']);
    assert.ok(R.generos({ title: 'Resident evil revelations' }).includes('terror'));
    assert.ok(R.generos({ title: 'GTA V mod' }).includes('mundoAbierto'));
});

console.log('videos');
test('en videos, los me gusta y los guardados suben la posición', () => {
    const a = base({ category: 'Video', meGustaCount: 500, likesCount: 80, vistasSemana: 900 });
    const b = base({ category: 'Video', meGustaCount: 3, likesCount: 1, vistasSemana: 20 });
    assert.strictEqual(R.ordenar([b, a])[0], a);
    const conGuardados = base({ category: 'Video', meGustaCount: 10, likesCount: 60 }), sin = base({ category: 'Video', meGustaCount: 10, likesCount: 0 });
    assert.strictEqual(R.ordenar([sin, conGuardados])[0], conGuardados);
});
test('un video promocionado con mucha inversión llega arriba aunque tenga pocas interacciones', () => {
    const vids = Array.from({ length: 10 }, (_, i) => base({ category: 'Video', meGustaCount: 50 + i * 10, likesCount: 10, vistasSemana: 300 }));
    const promo = base({ category: 'Video', meGustaCount: 2, destacadoHasta: futuro(30), promoUCDia: 50000, promocionado: true });
    assert.ok(R.ordenar([...vids, promo]).indexOf(promo) <= 1);
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
