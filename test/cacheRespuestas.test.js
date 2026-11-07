/**
 * Caché corta de respuestas GET públicas (modulos/cacheRespuestas.js) con un servidor
 * Express real: aciertos, claves por usuario, escrituras que la vacían, caducidad y
 * rutas que nunca se guardan. Autónomo: `node test/cacheRespuestas.test.js`.
 */
'use strict';
const assert = require('assert');
const express = require('express');
const jwt = require('jsonwebtoken');
const C = require('../modulos/cacheRespuestas');

let passed = 0;
async function test(name, fn) {
    try { await fn(); passed++; console.log(`  ✓ ${name}`); }
    catch (e) { console.error(`  ✗ ${name}\n    ${e.stack}`); process.exitCode = 1; }
}

(async () => {
    let t = 1_000_000;
    const SECRETO = 'secreto-de-prueba';
    const cache = C.crear({ secreto: SECRETO, ahora: () => t });
    const app = express();
    app.use(express.json());
    app.use(cache.middleware);
    let lecturas = 0, n = 0;
    app.get('/usuarios/perfil-publico/:u', (req, res) => { lecturas++; res.set('Cache-Control', 'public, max-age=5').json({ u: req.params.u, n: ++n }); });
    app.get('/items/:id', (req, res) => { lecturas++; if (req.params.id === 'aaaaaaaaaaaaaaaaaaaaaaaa') return res.status(404).json({ error: 'no' }); res.json({ id: req.params.id, n: ++n }); });
    app.get('/economia/mi-saldo', (req, res) => { lecturas++; res.json({ n: ++n }); });
    app.post('/comentarios', (req, res) => res.json({ ok: true }));
    app.post('/items/vistas/:id', (req, res) => res.json({ ok: true }));
    app.post('/falla', (req, res) => res.status(400).json({ ok: false }));
    const srv = app.listen(0); const base = `http://127.0.0.1:${srv.address().port}`;
    const get = async (p, token) => { const r = await fetch(base + p, { headers: token ? { Authorization: `Bearer ${token}` } : {} }); return { st: r.status, x: r.headers.get('x-cache'), cc: r.headers.get('cache-control'), body: await r.json() }; };
    const post = (p) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });

    await test('la segunda lectura sale de memoria, con las mismas cabeceras', async () => {
        const a = await get('/usuarios/perfil-publico/ana'), b = await get('/usuarios/perfil-publico/ana');
        assert.strictEqual(a.x, 'MISS'); assert.strictEqual(b.x, 'HIT');
        assert.deepStrictEqual(a.body, b.body); assert.strictEqual(lecturas, 1);
        assert.strictEqual(b.cc, 'public, max-age=5');
    });
    await test('cada usuario (token) tiene su propia entrada; un token falso no usa caché', async () => {
        const tok = jwt.sign({ usuario: 'beto' }, SECRETO);
        const a = await get('/usuarios/perfil-publico/ana', tok);
        assert.strictEqual(a.x, 'MISS');
        assert.strictEqual((await get('/usuarios/perfil-publico/ana', tok)).x, 'HIT');
        const f = await get('/usuarios/perfil-publico/ana', 'x'.repeat(40));
        assert.strictEqual(f.x, null);
    });
    await test('una escritura que sale bien la vacía; una fallida o un contador no', async () => {
        await get('/items/bbbbbbbbbbbbbbbbbbbbbbbb');
        assert.strictEqual((await get('/items/bbbbbbbbbbbbbbbbbbbbbbbb')).x, 'HIT');
        await post('/falla'); await post('/items/vistas/bbbbbbbbbbbbbbbbbbbbbbbb');
        assert.strictEqual((await get('/items/bbbbbbbbbbbbbbbbbbbbbbbb')).x, 'HIT');
        await post('/comentarios');
        assert.strictEqual((await get('/items/bbbbbbbbbbbbbbbbbbbbbbbb')).x, 'MISS');
    });
    await test('caduca a los segundos de su ruta', async () => {
        await get('/usuarios/perfil-publico/caro');
        t += 29_000; assert.strictEqual((await get('/usuarios/perfil-publico/caro')).x, 'HIT');
        t += 2_000; assert.strictEqual((await get('/usuarios/perfil-publico/caro')).x, 'MISS');
    });
    await test('no guarda errores ni rutas privadas fuera de la lista', async () => {
        const antes = lecturas;
        await get('/items/aaaaaaaaaaaaaaaaaaaaaaaa'); await get('/items/aaaaaaaaaaaaaaaaaaaaaaaa');
        assert.strictEqual(lecturas, antes + 2);
        const s1 = await get('/economia/mi-saldo'), s2 = await get('/economia/mi-saldo');
        assert.strictEqual(s1.x, null); assert.notDeepStrictEqual(s1.body, s2.body);
    });
    await test('rutas de la lista blanca', () => {
        for (const r of ['/items/6aee95bed50e6d2754da3654', '/favoritos/ana', '/comentarios/6aee95bed50e6d2754da3654', '/live/activos', '/apexgp/campeonato/ranking'])
            assert.ok(cache._ttlDe(r) > 0, r);
        for (const r of ['/items', '/auth/verify-email/x', '/economia/mi-saldo', '/notificaciones/ana', '/chat/conversaciones', '/admin/items'])
            assert.strictEqual(cache._ttlDe(r), 0, r);
    });
    srv.close();
    console.log(`\ncacheRespuestas: ${passed} pruebas OK`);
})();
