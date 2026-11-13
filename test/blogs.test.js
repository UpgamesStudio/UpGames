/**
 * Tests de UpGames Blogs: validación (modulos/blogs/validar.js) y render (modulos/blogs/render.js).
 * Autónomo: `node test/blogs.test.js` (o `npm test`).
 */
'use strict';

const assert = require('assert');
const V = require('../modulos/blogs/validar');
const R = require('../modulos/blogs/render');
const Temas = require('../modulos/blogs/temas');
const { enlaceProhibido } = require('../rutas/blogs');
const Anuncios = require('../modulos/blogs/anuncios');

let passed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log(`  ✓ ${name}`); }
    catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
}

console.log('direcciones y dominios');
test('slug quita acentos y símbolos', () => assert.strictEqual(V.slug('¡Cómo instalar el MOD (v2)!'), 'como-instalar-el-mod-v2'));
for (const d of ['kale-mods', 'abc', 'blog2026']) test(`dirección válida: ${d}`, () => assert.strictEqual(V.validarDireccion(d).valor, d));
for (const d of ['ab', '-kale', 'kale-', 'ka--le', 'kale mods', 'admin', 'upgames', 'paypal', 'a'.repeat(31), 'ñandú'])
    test(`dirección rechazada: ${d}`, () => assert.ok(V.validarDireccion(d).error));
test('dominio: limpia https y barras', () => assert.strictEqual(V.validarDominio('https://WWW.MiSitio.com/').valor, 'www.misitio.com'));
for (const d of ['misitio', 'http://1.2.3.4', 'upgames.games', 'blog.upgames.games', 'x.up.railway.app', 'mi sitio.com', 'a..com', ''])
    test(`dominio rechazado: «${d}»`, () => assert.ok(V.validarDominio(d).error));

console.log('bloques');
test('descarta tipos desconocidos y campos de más', () => {
    const b = V.limpiarBloques([{ tipo: 'html', texto: '<b>x</b>' }, { tipo: 'texto', texto: 'hola', onclick: 'x' }, null, 'x']);
    assert.deepStrictEqual(b, [{ tipo: 'texto', texto: 'hola' }]);
});
test('imágenes y botones solo con https', () => {
    assert.deepStrictEqual(V.limpiarBloques([{ tipo: 'imagen', url: 'javascript:alert(1)' }, { tipo: 'imagen', url: 'http://a.com/x.png' }, { tipo: 'boton', texto: 'Ir', url: 'data:text/html,x' }]), []);
    assert.strictEqual(V.limpiarBloques([{ tipo: 'imagen', url: 'https://a.com/x.png" onerror="x' }]).length, 0);
    assert.strictEqual(V.limpiarBloques([{ tipo: 'imagen', url: 'https://res.cloudinary.com/d/image/upload/v1/a.jpg' }]).length, 1);
});
test('video: saca el id de YouTube de cualquier enlace', () => {
    for (const u of ['https://youtu.be/dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3', 'https://youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'])
        assert.strictEqual(V.idYouTube(u), 'dQw4w9WgXcQ');
    assert.strictEqual(V.idYouTube('https://evil.com/watch?v=dQw4w9WgXcQ'), '');
});
test('límite de bloques', () => assert.strictEqual(V.limpiarBloques(Array.from({ length: 200 }, () => ({ tipo: 'separador' }))).length, V.LIMITES.BLOQUES_POR_ENTRADA));
test('etiquetas: sin repetidas y máximo 8', () => {
    assert.deepStrictEqual(V.etiquetas('Mods, mods, #Android,  , MODS'), ['Mods', 'Android']);
    assert.strictEqual(V.etiquetas('a1,b1,c1,d1,e1,f1,g1,h1,i1,j1').length, 8);
});
test('enlaces de una entrada', () => assert.deepStrictEqual(V.enlacesDe([{ tipo: 'texto', texto: 'mira [esto](https://a.com/x) y [esto](https://b.com)' }, { tipo: 'boton', url: 'https://c.com/' }]), ['https://a.com/x', 'https://b.com', 'https://c.com/']));
test('enlaces prohibidos: acortadores e IP', () => {
    assert.ok(enlaceProhibido(['https://bit.ly/abc']));
    assert.ok(enlaceProhibido(['https://192.168.1.1/x']));
    assert.strictEqual(enlaceProhibido(['https://upgames.games/x', 'https://www.mediafire.com/file/x']), '');
});

console.log('render');
const ctx = { blog: { titulo: 'Blog "de" <Kale>', usuario: 'kale', direccion: 'kale', tema: 'neon', ajustes: {}, visibilidad: 'publico', descripcion: '' }, base: '/b/kale', origen: 'https://x.test', appUrl: 'https://upgames.games', paginas: [{ titulo: 'Sobre mí', slug: 'sobre-mi' }] };
test('el texto se escapa: no sale HTML del autor', () => {
    const html = R.bloquesHtml(V.limpiarBloques([{ tipo: 'texto', texto: '<script>alert(1)</script> <img src=x onerror=alert(1)>' }, { tipo: 'titulo', texto: '<b>x</b>' }, { tipo: 'codigo', texto: '</code><script>x</script>' }]), ctx);
    assert.ok(!/<script|<img|<b>/.test(html), html);
    assert.ok(html.includes('&lt;script&gt;'));
});
test('formato: negrita, cursiva, código, enlaces y listas', () => {
    assert.strictEqual(R.textoHtml('Hola **mundo** y *esto* con `a*b`'), '<p>Hola <strong>mundo</strong> y <em>esto</em> con <code>a*b</code></p>');
    assert.strictEqual(R.textoHtml('- uno\n- dos'), '<ul><li>uno</li><li>dos</li></ul>');
    assert.strictEqual(R.textoHtml('1. uno\n2. dos'), '<ol><li>uno</li><li>dos</li></ol>');
    assert.strictEqual(R.textoHtml('a\nb\n\nc'), '<p>a<br>b</p><p>c</p>');
    assert.ok(R.textoHtml('[sitio](https://a.com/?x=1&y=2)').includes('<a href="https://a.com/?x=1&amp;y=2" target="_blank" rel="nofollow ugc noopener">sitio</a>'));
});
test('enlaces que no son https quedan como texto', () => {
    const h = R.textoHtml('[x](javascript:alert(1)) [y](http://a.com) [z](https://a.com" onclick="x)');
    assert.ok(!h.includes('<a '), h);
});
test('página completa: título escapado, canonical y RSS', () => {
    const html = R.inicio(ctx, { entradas: [{ titulo: 'Uno <x>', slug: 'uno', bloques: [{ tipo: 'texto', texto: 'Texto de la entrada' }], publicadaEn: new Date('2026-11-13T10:00:00Z') }] });
    assert.ok(html.startsWith('<!DOCTYPE html>'));
    assert.ok(html.includes('<title>Blog &quot;de&quot; &lt;Kale&gt;</title>'));
    assert.ok(html.includes('<link rel="canonical" href="https://x.test/b/kale/">'));
    assert.ok(html.includes('href="/b/kale/e/uno"') && html.includes('Uno &lt;x&gt;') && html.includes('13 de noviembre de 2026'));
    assert.ok(html.includes('href="/b/kale/p/sobre-mi"'));
    assert.ok(!html.includes('<Kale>'));
});
test('blog oculto: no se indexa', () => {
    const html = R.inicio({ ...ctx, blog: { ...ctx.blog, visibilidad: 'oculto' } }, { entradas: [] });
    assert.ok(html.includes('noindex') && !html.includes('rel="canonical"'));
});
test('entrada: datos estructurados sin cerrar el script', () => {
    const html = R.entrada(ctx, { _id: 'a'.repeat(24), tipo: 'entrada', titulo: '</script><script>alert(1)</script>', slug: 'x', bloques: [{ tipo: 'texto', texto: 'hola' }], etiquetas: ['Mods'], publicadaEn: new Date() });
    assert.strictEqual((html.match(/<script/g) || []).length, 1);
    assert.ok(html.includes('\\u003c/script>') && html.includes('/b/kale/etiqueta/mods') && html.includes(`/b/kale/_v/${'a'.repeat(24)}.gif`));
});
test('con dominio propio las rutas salen sin prefijo', () => {
    const html = R.entrada({ ...ctx, base: '', origen: 'https://www.kale.com' }, { tipo: 'pagina', titulo: 'Contacto', slug: 'contacto', bloques: [] });
    assert.ok(html.includes('<link rel="canonical" href="https://www.kale.com/p/contacto">') && html.includes('class="marca" href="/"'));
});
test('color de acento: solo hexadecimal', () => {
    assert.ok(Temas.esColor('#ff00aa') && !Temas.esColor('red') && !Temas.esColor('#fff;}body{display:none'));
    const html = R.inicio({ ...ctx, blog: { ...ctx.blog, ajustes: { acento: '#fff;}body{x' } } }, { entradas: [] });
    assert.ok(!html.includes('body{x'));
});
test('todos los temas generan una página', () => { for (const id of Object.keys(Temas.TEMAS)) assert.ok(R.inicio({ ...ctx, blog: { ...ctx.blog, tema: id } }, { entradas: [] }).includes(`tema-${id}`)); });
test('feed y sitemap', () => {
    const e = [{ titulo: 'A & B', slug: 'a-b', tipo: 'entrada', bloques: [], publicadaEn: new Date('2026-01-02') }];
    assert.ok(R.feed(ctx, e).includes('<title>A &amp; B</title>') && R.feed(ctx, e).includes('<link>https://x.test/b/kale/e/a-b</link>'));
    assert.ok(R.sitemap(ctx, e).includes('<loc>https://x.test/b/kale/e/a-b</loc><lastmod>2026-01-02</lastmod>'));
});

console.log('herramientas creativas');
test('bloques nuevos: aviso, preguntas, ficha y Spotify', () => {
    const b = V.limpiarBloques([{ tipo: 'aviso', texto: 'ojo', estilo: 'x"><script>' }, { tipo: 'faq', items: [{ p: '¿Sirve?', r: 'Sí' }, { p: '', r: 'sin pregunta' }] },
        { tipo: 'ficha', titulo: 'Requisitos', filas: [{ k: 'RAM', v: '4 GB' }, { k: '', v: 'x' }] }, { tipo: 'audio', url: 'https://open.spotify.com/intl-es/track/4cOdK2wGLETKBW3PvgPWqT?si=1' },
        { tipo: 'audio', url: 'https://evil.com/track/4cOdK2wGLETKBW3PvgPWqT' }, { tipo: 'texto', texto: 'a', centro: 1, grande: 'sí' }, { tipo: 'imagen', url: 'https://a.com/i.png', enlace: 'javascript:alert(1)' }]);
    assert.deepStrictEqual(b.map(x => x.tipo), ['aviso', 'faq', 'ficha', 'audio', 'texto', 'imagen']);
    assert.strictEqual(b[0].estilo, 'info'); assert.strictEqual(b[1].items.length, 1); assert.strictEqual(b[2].filas.length, 1);
    assert.deepStrictEqual(b[3], { tipo: 'audio', clase: 'track', id: '4cOdK2wGLETKBW3PvgPWqT' });
    assert.strictEqual(b[5].enlace, '');
    const html = R.bloquesHtml(b, ctx);
    assert.ok(html.includes('class="aviso aviso-info"') && html.includes('<details><summary>¿Sirve?</summary>') && html.includes('<dt>RAM</dt><dd>4 GB</dd>')
        && html.includes('https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT') && html.includes('class="t-centro t-grande"') && !html.includes('<script'));
});
test('diseño: fondo, esquinas y forma del inicio', () => {
    const html = R.inicio({ ...ctx, blog: { ...ctx.blog, ajustes: { fondo: 'rejilla', esquinas: 'rectas', portadaForma: 'revista' } } }, { entradas: [] });
    assert.ok(html.includes('--radio:2px') && html.includes('--fondo-rep:repeat'));
    const e = [{ titulo: 'Uno', slug: 'uno', bloques: [], publicadaEn: new Date() }];
    assert.ok(R.inicio({ ...ctx, blog: { ...ctx.blog, ajustes: { portadaForma: 'revista' } } }, { entradas: e }).includes('class="rejilla revista"'));
    assert.ok(R.inicio({ ...ctx, blog: { ...ctx.blog, ajustes: { portadaForma: 'x' } } }, { entradas: e }).includes('class="rejilla"'));
});
test('vista previa: avisa, no se indexa y no cuenta visitas ni anuncios', () => {
    const html = R.entrada({ ...ctx, anuncio: true }, { _id: 'b'.repeat(24), tipo: 'entrada', titulo: 'Borrador', slug: 'borrador', bloques: [] }, { previa: true });
    assert.ok(html.includes('Vista previa') && html.includes('noindex') && !html.includes('/_v/') && !html.includes('_anuncio'));
});

console.log('monetización');
test('el anuncio solo sale si el creador lo activó, en un marco aislado', () => {
    const e = { _id: 'c'.repeat(24), tipo: 'entrada', titulo: 'T', slug: 't', bloques: [], publicadaEn: new Date() };
    assert.ok(!R.entrada(ctx, e).includes('_anuncio'));
    const html = R.entrada({ ...ctx, anuncio: true }, e);
    assert.ok(html.includes('<iframe src="/b/kale/_anuncio"') && html.includes('sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"'));
    assert.strictEqual((html.match(/<script/g) || []).length, 1);   // solo los datos estructurados: la página del blog sigue sin scripts
});
test('ticket del anuncio: firma, espera, IP y vigencia', () => {
    const S = 'secreto', t0 = 1_800_000_000_000, tk = Anuncios.emitir(S, 'blog1', '1.2.3.4', t0);
    assert.strictEqual(Anuncios.verificar(S, tk, 'blog1', '1.2.3.4', t0 + 2000).motivo, 'pronto');
    assert.strictEqual(Anuncios.verificar(S, tk, 'blog1', '1.2.3.4', t0 + Anuncios.ESPERA_MS + 1).ok, true);
    assert.strictEqual(Anuncios.verificar(S, tk, 'blog2', '1.2.3.4', t0 + 9000).motivo, 'invalido');
    assert.strictEqual(Anuncios.verificar(S, tk, 'blog1', '9.9.9.9', t0 + 9000).motivo, 'invalido');
    assert.strictEqual(Anuncios.verificar('otro', tk, 'blog1', '1.2.3.4', t0 + 9000).motivo, 'invalido');
    assert.strictEqual(Anuncios.verificar(S, tk, 'blog1', '1.2.3.4', t0 + 21 * 60e3).motivo, 'vencido');
    assert.strictEqual(Anuncios.verificar(S, '', 'blog1', '1.2.3.4').motivo, 'falta');
    assert.strictEqual(Anuncios.verificar(S, 'x'.repeat(200), 'blog1', '1.2.3.4').motivo, 'falta');
});
test('marco del anuncio: lleva el ticket y avisa a la URL dada', () => {
    const p = Anuncios.pagina('abc.def', 'https://x.test/b/kale/_av');
    assert.ok(p.includes('var T="abc.def"') && p.includes('U="https://x.test/b/kale/_av"') && p.includes('highperformanceformat.com'));
});

console.log(`\n${passed} pruebas de blogs pasaron`);

console.log('bloque de descarga');
test('descarga: valida el id y pasa por la página puente', () => {
    const id = 'a'.repeat(24);
    assert.deepStrictEqual(V.limpiarBloques([{ tipo: 'descarga', id: id.toUpperCase() }, { tipo: 'descarga', id: 'x' }]), [{ tipo: 'descarga', id }]);
    const h = R.entrada({ blog: { usuario: 'kale', tema: 'neon', ajustes: {}, titulo: 'B', direccion: 'kale' }, base: '/b/kale', origen: 'https://x.test', appUrl: 'https://app.test', paginas: [], populares: [], nube: [], juegos: { [id]: { title: 'GTA <V>', image: 'https://res.cloudinary.com/x/image/upload/a.jpg', usuario: 'leo' } } }, { titulo: 'T', slug: 't', tipo: 'entrada', bloques: [{ tipo: 'descarga', id }], publicadaEn: new Date() });
    assert.ok(h.includes(`https://app.test/public/puente.html?id=${id}`), 'enlaza a puente.html');
    assert.ok(!h.includes('GTA <V>') && h.includes('GTA &lt;V&gt;'), 'escapa el título');
    assert.ok(!/href="[^"]*biblioteca\.html\?id=a{24}"[^>]*>Descargar/.test(h));
});
test('descarga: si la publicación no existe no pinta nada', () => {
    const h = R.entrada({ blog: { usuario: 'kale', tema: 'neon', ajustes: {}, titulo: 'B', direccion: 'kale' }, base: '/b/kale', origen: 'https://x.test', appUrl: 'https://app.test', paginas: [], populares: [], nube: [], juegos: {} }, { titulo: 'T', slug: 't', tipo: 'entrada', bloques: [{ tipo: 'descarga', id: 'b'.repeat(24) }], publicadaEn: new Date() });
    assert.ok(!h.includes('class="descarga"'));
});

console.log('comentarios, marca y Premium');
const ctxB = (extra = {}, tema = 'neon') => ({ blog: { usuario: 'kale', tema, ajustes: {}, titulo: 'B', direccion: 'kale' }, base: '/b/kale', origen: 'https://x.test', appUrl: 'https://app.test', paginas: [], populares: [], nube: [], juegos: {}, ...extra });
const ent = (extra = {}) => ({ _id: 'c'.repeat(24), titulo: 'T', slug: 't', tipo: 'entrada', bloques: [{ tipo: 'texto', texto: 'hola' }], publicadaEn: new Date(), ...extra });
test('las entradas llevan el marco de comentarios (no las páginas ni la vista previa)', () => {
    assert.ok(R.entrada(ctxB(), ent()).includes('https://app.test/public/blog-comentarios.html?e=' + 'c'.repeat(24)));
    assert.ok(!R.entrada(ctxB(), ent({ tipo: 'pagina' })).includes('blog-comentarios'));
    assert.ok(!R.entrada(ctxB(), ent(), { previa: true }).includes('blog-comentarios'));
});
test('«Hecho con UpGames»: aparece salvo en Premium', () => {
    assert.ok(R.entrada(ctxB(), ent()).includes('Hecho con'));
    assert.ok(!R.entrada(ctxB({ sinMarca: true }), ent()).includes('Hecho con'));
});
test('temas exclusivos: marcados Premium en la lista y se pintan con sus colores', () => {
    const l = Temas.lista();
    assert.ok(l.filter(t => t.premium).length >= 2 && !l.find(t => t.id === 'neon').premium);
    assert.ok(R.entrada(ctxB({}, 'cristal'), ent()).includes('#7C5CFF'));
});

console.log('Nexus escritor');
const Escritor = require('../modulos/blogs/escritor');
const juegoX = { _id: 'd'.repeat(24), title: 'Mod <b>X</b>', image: 'https://res.cloudinary.com/x/image/upload/a.jpg', category: 'Mods', tags: ['gta'], description: 'Mejora el rendimiento', extraData: { RAM: '4 GB', detectedGame: { gameName: 'GTA' } } };
test('escritor: arma bloques válidos, agrega imagen y tarjeta, y descarta lo peligroso', () => {
    const r = Escritor.armar({ titulo: 'Reseña', resumen: 'r', etiquetas: ['a', 'b'], bloques: [{ tipo: 'texto', texto: 'Intro', grande: true }, { tipo: 'boton', texto: 'x', url: 'https://evil.test' }, { tipo: 'codigo', texto: 'rm -rf' }, { tipo: 'titulo', texto: 'Lo mejor' }, { tipo: 'texto', texto: '- a\n- b' }, { tipo: 'script', texto: '<script>' }, { tipo: 'aviso', estilo: 'raro', texto: 'ojo' }] }, juegoX, 'resena');
    assert.deepStrictEqual(r.bloques.map(b => b.tipo), ['texto', 'imagen', 'juego', 'titulo', 'texto', 'aviso']);
    assert.strictEqual(r.bloques.find(b => b.tipo === 'aviso').estilo, 'info');
    assert.strictEqual(r.bloques.find(b => b.tipo === 'juego').id, 'd'.repeat(24));
});
test('escritor: la guía termina con la descarga por la página puente; respuesta inútil → null', () => {
    const b = [{ tipo: 'texto', texto: 'a' }, { tipo: 'titulo', texto: 'b' }, { tipo: 'texto', texto: 'c' }];
    assert.strictEqual(Escritor.armar({ bloques: b }, juegoX, 'guia').bloques.at(-1).tipo, 'descarga');
    assert.strictEqual(Escritor.armar({ bloques: [{ tipo: 'texto', texto: 'solo uno' }] }, juegoX, 'resena'), null);
    assert.strictEqual(Escritor.armar(null, juegoX, 'resena'), null);
});
test('escritor: el pedido recorta datos y no filtra detectedGame', () => {
    const p = Escritor.pedido(juegoX, 'resena', 'enfócate en el rendimiento');
    assert.ok(p.includes('RAM') && !p.includes('detectedGame') && p.includes('rendimiento'));
});
