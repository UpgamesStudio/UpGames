/**
 * Tests de la detección de posibles juegos comerciales completos (modulos/sospecha.js).
 * Autónomo: `node test/sospecha.test.js` (o `npm test`).
 */
'use strict';

const assert = require('assert');
const S = require('../modulos/sospecha');

let passed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log(`  ✓ ${name}`); }
    catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
}
const sosp = (title, category = 'Mod') => S.evaluar({ title, category });

console.log('sospechosas (sin pagos hasta revisar)');
for (const [t, c] of [
    ['GTA V', 'Juego'], ['Dark Souls Prepare To Die Edition', 'Mod'], ['Silencio Hill 3', 'Mod'], ['Outlast+DLC', 'Mod'],
    ['resident evil 2 remake mod: PT1', 'Mod'], ['Left 4 Dead 2 mobile', 'Mod'], ['GTA IV Lite + rendimiento', 'Juego'],
    ['Dead space (2008/2023)', 'Mod'], ['Hollow knight silksong Mobile port', 'Apps'],
]) test(`"${t}" (${c})`, () => assert.ok(sosp(t, c), 'debería ser sospechosa'));

console.log('mods claros (pagan normal)');
for (const [t, c] of [
    ['GTA V Mod ultra rendimiento', 'Optimizacion'], ['GTA San Andreas mod texturas HD', 'Mod'], ['Red dead redemption mod 60fps', 'Mod'],
    ['Mods para project Zomboid', 'Mod'], ['APEX GP UPGAMES', 'Juego'], ['Mi juego indie de plataformas', 'Juego'],
    ['Tema cyberpunk para Android', 'Apps'], ['f1 2014 mod + configuración gamehub', 'Video'],
]) test(`"${t}" (${c})`, () => assert.strictEqual(sosp(t, c), null));

console.log('detalles');
test('explica el juego y los motivos', () => {
    const r = sosp('Silencio Hill 2', 'Mod');
    assert.strictEqual(r.juego, 'Silent Hill');
    assert.ok(r.motivos.length >= 1 && r.motivos.every(m => typeof m === 'string'));
});
test('el aviso al creador dice que sigue visible y sin UpCoins', () => {
    const m = S.mensajeCreador('Silencio Hill 2', 'Silent Hill');
    assert.ok(/sigue visible/.test(m) && /no generará UpCoins/.test(m));
});

console.log(`\nsospecha: ${passed} pruebas OK`);
