/**
 * Atribución de descargas a UpGames Blogs: ticket con `via` y reglas de la entrada. `node test/atribucionBlog.test.js`
 */
'use strict';
const assert = require('assert');
const T = require('../modulos/ticketPuente');
const A = require('../modulos/blogs/atribucion');
let passed = 0;
function test(n, fn) { try { fn(); passed++; console.log(`  ✓ ${n}`); } catch (e) { console.error(`  ✗ ${n}\n    ${e.message}`); process.exitCode = 1; } }
const S = 'secreto', J = 'a'.repeat(24), E = 'b'.repeat(24), IP = '1.2.3.4', t0 = 1_800_000_000_000, luego = t0 + T.ESPERA_MS;

console.log('ticket con via');
test('el ticket con via solo vale con ese mismo via', () => {
    const { ticket } = T.emitir(S, J, IP, t0, E);
    assert.ok(T.verificar(S, ticket, J, IP, luego, E).ok);
    assert.strictEqual(T.verificar(S, ticket, J, IP, luego, 'c'.repeat(24)).motivo, 'invalido');   // cambiar de blog
    assert.strictEqual(T.verificar(S, ticket, J, IP, luego).motivo, 'invalido');                     // quitarlo
});
test('un ticket sin via no admite que se le añada uno (nadie se atribuye una descarga ajena)', () => {
    const { ticket } = T.emitir(S, J, IP, t0);
    assert.ok(T.verificar(S, ticket, J, IP, luego).ok);
    assert.strictEqual(T.verificar(S, ticket, J, IP, luego, E).motivo, 'invalido');
});

console.log('reglas de la entrada');
const ent = (o = {}) => ({ tipo: 'entrada', estado: 'publicada', bloques: [{ tipo: 'texto', texto: 'x' }, { tipo: 'descarga', id: J }], ...o });
test('publicada con el bloque descarga de ese juego → atribuye', () => assert.ok(A.entradaAtribuye(ent(), J)));
test('otro juego, borrador, página o sin entrada → no', () => {
    assert.ok(!A.entradaAtribuye(ent(), 'c'.repeat(24)));
    assert.ok(!A.entradaAtribuye(ent({ estado: 'borrador' }), J));
    assert.ok(!A.entradaAtribuye(ent({ tipo: 'pagina' }), J));
    assert.ok(!A.entradaAtribuye(null, J));
});
test('un bloque «juego» (solo tarjeta) no cuenta: hace falta el bloque descarga', () => assert.ok(!A.entradaAtribuye(ent({ bloques: [{ tipo: 'juego', id: J }] }), J)));
test('programada: solo cuando ya llegó su hora', () => {
    assert.ok(A.entradaAtribuye(ent({ estado: 'programada', publicadaEn: new Date(1000) }), J, 2000));
    assert.ok(!A.entradaAtribuye(ent({ estado: 'programada', publicadaEn: new Date(5000) }), J, 2000));
});
test('resolver: via roto o inexistente no lanza y no paga', async () => {
    const vacio = { findById: () => ({ select: () => ({ lean: async () => null }) }) };
    assert.strictEqual(await A.resolver({ Blog: vacio, Entrada: vacio }, 'no-es-un-id', J, 'x'), null);
    assert.strictEqual(await A.resolver({ Blog: vacio, Entrada: vacio }, E, J, 'x'), null);
    assert.strictEqual(await A.resolver({ Blog: vacio, Entrada: { findById: () => { throw new Error('boom'); } } }, E, J, 'x'), null);
});
test('tarifa y tope con valores sensatos', () => { assert.ok(A.CPM >= 0 && A.CPM <= 5); assert.ok(A.MAX_DIA >= 1); });
setImmediate(() => console.log(`\natribucionBlog: ${passed} pruebas OK`));
