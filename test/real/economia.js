#!/usr/bin/env node
/**
 * Prueba ADVERSARIAL de la economía: intenta, como lo haría un tramposo, saltarse la espera de la página
 * puente, reciclar tickets e IPs, falsear vistas y colarse como «descarga desde un blog». Cada intento debe
 * fallar y el dinero debe cuadrar al centavo.
 *
 * Dos modos:
 *  · LOCAL (por defecto): levanta el servidor real (index.js) con MongoDB en memoria, crea las cuentas y
 *    publicaciones y además comprueba saldos en la base de datos. Es el que corre en CI.
 *      node test/real/economia.js
 *  · STAGING: ataca un servidor ya desplegado, solo por HTTP (sin acceso a la base). ESCRIBE datos
 *    (cuenta descargas reales en las publicaciones que indiques), así que nunca contra producción:
 *      API=https://staging.ejemplo.app JUEGO_ID=<id aprobado> [JUEGO_ID_2=<otro id>] CONFIRMO_STAGING=si \
 *        node test/real/economia.js
 *    Se niega a correr contra upgames.games o upgames-production.up.railway.app.
 *
 * Códigos de salida: 0 todo bien · 1 algún ataque funcionó (o algo no cuadra).
 */
'use strict';
const path = require('path');
const REPO = path.join(__dirname, '..', '..');
const API_REMOTA = (process.env.API || '').replace(/\/+$/, '');
const REMOTO = !!API_REMOTA;
const PROHIBIDOS = ['upgames.games', 'upgames-production.up.railway.app'];

let ok = 0, mal = 0; const fallos = [];
const prueba = (n, c, extra = '') => { c ? ok++ : (mal++, fallos.push(n)); console.log(`${c ? '  ✓' : '  ✗'} ${n}${!c && extra ? ' → ' + extra : ''}`); };
const nota = t => console.log(`  ℹ ${t}`);
const espera = ms => new Promise(r => setTimeout(r, ms));
const hoy = () => new Date().toISOString().slice(0, 10);

(async () => {
    if (REMOTO) {
        const host = new URL(API_REMOTA).hostname;
        if (PROHIBIDOS.some(p => host === p || host.endsWith('.' + p))) { console.error(`✗ Me niego a atacar ${host}: esto escribe datos y solo es para staging.`); process.exit(2); }
        if (process.env.CONFIRMO_STAGING !== 'si') { console.error('✗ Falta CONFIRMO_STAGING=si (esta prueba cuenta descargas reales en el servidor indicado).'); process.exit(2); }
        if (!/^[a-f0-9]{24}$/i.test(process.env.JUEGO_ID || '')) { console.error('✗ Falta JUEGO_ID (id de una publicación aprobada en staging).'); process.exit(2); }
    }

    // ── Preparación ──────────────────────────────────────────────────────────────────────
    let A = API_REMOTA, cerrar = async () => {}, db = null, SECRET = null, T = null, J1 = process.env.JUEGO_ID, J2 = process.env.JUEGO_ID_2 || null, jwt = null;
    const PORT = 10078, TOPE_BLOG = 2;
    const ids = {};   // entradas del blog (solo modo local)
    if (!REMOTO) {
        const { requerir } = require('./util');
        const { MongoMemoryServer } = requerir('mongodb-memory-server');
        const { spawn } = require('child_process');
        const mongoose = require(REPO + '/node_modules/mongoose'); jwt = require(REPO + '/node_modules/jsonwebtoken'); const bcrypt = require(REPO + '/node_modules/bcryptjs');
        SECRET = 'e2e-secreto-largo-para-pruebas-0123456789abcdef'; A = `http://127.0.0.1:${PORT}`;
        T = require(REPO + '/modulos/ticketPuente');
        const m = await MongoMemoryServer.create(); const uri = m.getUri('upgames');
        const srv = spawn('node', ['index.js'], { cwd: REPO, env: { ...process.env, MONGODB_URI: uri, JWT_SECRET: SECRET, PORT: String(PORT), NODE_ENV: 'development', GROQ_API_KEY: '', APP_URL: 'https://upgames.games', HTTPS_PROXY: '', HTTP_PROXY: '', PUENTE_TICKET_OBLIGATORIO: '1', BLOGS_DESCARGAS_MAX_DIA: String(TOPE_BLOG), BLOGS_DESCARGA_CPM: '0.50' }, stdio: ['ignore', 'pipe', 'pipe'] });
        let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
        cerrar = async () => { srv.kill(); await mongoose.disconnect().catch(() => {}); await m.stop().catch(() => {}); };
        for (let i = 0; i < 60; i++) { try { await fetch(A + '/blogs/temas'); break; } catch (_) { await espera(500); } }
        await mongoose.connect(uri); db = mongoose.connection.db;
        const hash = await bcrypt.hash('x', 4);
        const mkU = (u, extra = {}) => db.collection('usuarios').insertOne({ usuario: u, email: `${u}@t.test`, password: hash, emailVerificado: true, listaSeguidores: [], seguidos: [], saldo: 0, createdAt: new Date(), ...extra });
        await Promise.all(['autor', 'duenoblog', 'tramposo'].map(u => mkU(u)));
        const mkJ = (title, usuario) => db.collection('juegos').insertOne({ title, usuario, status: 'aprobado', category: 'Mod', image: 'https://res.cloudinary.com/x/image/upload/a.jpg', link: 'https://descarga-secreta.test/archivo.apk', description: 'Un mod de prueba', descargasEfectivas: 0, createdAt: new Date() }).then(r => r.insertedId.toString());
        J1 = await mkJ('Mod uno', 'autor'); J2 = await mkJ('Mod dos', 'autor');
        const J3 = await mkJ('Mod del dueño del blog', 'duenoblog'); ids.J3 = J3;
        const blog = (await db.collection('blogs').insertOne({ usuario: 'duenoblog', direccion: 'dueno-blog', titulo: 'Blog', tema: 'neon', visibilidad: 'publico', estado: 'activo', createdAt: new Date() })).insertedId;
        const ent = (titulo, slug, estado, bloques) => db.collection('entradas').insertOne({ blog, usuario: 'duenoblog', tipo: 'entrada', titulo, slug, estado, publicadaEn: new Date(), bloques, etiquetas: [], etiquetasSlug: [], createdAt: new Date() }).then(r => r.insertedId.toString());
        ids.blog = String(blog);
        ids.buena = await ent('Reseña', 'resena', 'publicada', [{ tipo: 'descarga', id: J1 }]);
        ids.borrador = await ent('Borrador', 'borrador', 'borrador', [{ tipo: 'descarga', id: J1 }]);
        ids.otroJuego = await ent('Otro juego', 'otro', 'publicada', [{ tipo: 'descarga', id: J2 }]);
        ids.soloTarjeta = await ent('Solo tarjeta', 'tarjeta', 'publicada', [{ tipo: 'juego', id: J1 }]);
        ids.propio = await ent('Mi propio juego', 'propio', 'publicada', [{ tipo: 'descarga', id: J3 }]);
        // Autor nuevo + juego + entrada del blog por escenario: el antifraude marca al autor que recibe muchas descargas
        // seguidas y entonces (con razón) no se paga a nadie; cada escenario necesita un autor limpio.
        let nAutor = 0;
        ids.nuevoEscenario = async (variante = 'buena') => {
            const u = `autor${++nAutor}`; await mkU(u); const j = await mkJ('Mod ' + u, u), otro = J2;
            const bloques = { buena: [{ tipo: 'descarga', id: j }], borrador: [{ tipo: 'descarga', id: j }], otroJuego: [{ tipo: 'descarga', id: otro }], tarjeta: [{ tipo: 'juego', id: j }] }[variante];
            return { juego: j, via: await ent('Reseña ' + u, 'r-' + u, variante === 'borrador' ? 'borrador' : 'publicada', bloques) };
        };
    }
    const tok = u => jwt.sign({ usuario: u, email: `${u}@t.test`, sv: 0 }, SECRET, { expiresIn: '1h' });
    let ipN = 10; const ipNueva = () => `203.0.113.${ipN++}`;   // documentación TEST-NET-3: nunca es una IP real
    // XFF simula al proxy de Railway: req.ip es la ENTRADA MÁS A LA DERECHA (TRUST_PROXY_HOPS=1)
    const post = async (ruta, body, ip, extraXff = '') => {
        const r = await fetch(A + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': extraXff ? `${extraXff}, ${ip}` : ip }, body: JSON.stringify(body) });
        const t = await r.text(); let d; try { d = JSON.parse(t); } catch (_) { d = { raw: t }; } return { s: r.status, d, txt: t };
    };
    const ticket = async (juegoId, ip, via) => (await post('/economia/ticket', { juegoId, ...(via ? { via } : {}) }, ip)).d.ticket;
    // Ticket «ya esperado»: en local se firma con el secreto y se pone la hora 30 s atrás; en staging hay que esperar de verdad
    // En staging no hay secreto: los tickets se piden al empezar (precalentados) y se usan tras la única espera real de 27 s
    const previos = {};
    const ticketListo = async (juegoId, ip, via) => REMOTO ? previos[`${juegoId}|${ip}`] : T.emitir(SECRET, juegoId, ip, Date.now() - 30e3, via || '').ticket;
    const validar = (juegoId, tk, ip, extra = {}) => post('/economia/validar-descarga', { juegoId, ticket: tk, tieneAdBlocker: false, ...extra }, ip);
    const esperarTickets = async () => { if (REMOTO) { nota('esperando 27 s de la página puente (staging usa el reloj real)…'); await espera(27e3); } };
    const saldo = async u => db ? (await db.collection('usuarios').findOne({ usuario: u })).saldo || 0 : null;
    const cerca = (a, b) => Math.abs(a - b) < 1e-9;

    const ipA = ipNueva(), ipB = ipNueva();
    if (REMOTO) { previos[`${J1}|${ipA}`] = await ticket(J1, ipA); previos[`${J1}|${ipB}`] = await ticket(J1, ipB); }
    console.log(`Economía adversarial · ${REMOTO ? 'STAGING ' + A : 'local (servidor real + MongoDB en memoria)'}`);

    // ── 1. Saltarse la espera ────────────────────────────────────────────────────────────
    console.log('\n1. Saltarse la espera de la página puente');
    let ip = ipNueva();
    let r = await validar(J1, undefined, ip);
    prueba('sin ticket → no hay enlace (428)', r.s === 428 && !r.d.link && !/descarga-secreta/.test(r.txt), `${r.s} ${r.txt.slice(0, 120)}`);
    r = await validar(J1, 'basura', ip);
    prueba('ticket basura → rechazado, sin enlace', [425, 428].includes(r.s) && !r.d.link, `${r.s}`);
    r = await validar(J1, 'zzzzzzzz.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', ip);
    prueba('ticket con formato correcto y firma inventada → rechazado', r.s === 428 && !r.d.link, `${r.s}`);
    let tk = await ticket(J1, ip);
    prueba('el servidor entrega un ticket firmado', typeof tk === 'string' && /^[a-z0-9]+\.[\w-]+$/i.test(tk), String(tk));
    r = await validar(J1, tk, ip);
    prueba('ticket recién emitido, sin esperar → 425 y sin enlace', r.s === 425 && !r.d.link, `${r.s} ${r.txt.slice(0, 120)}`);
    r = await validar(J1, tk, ip);
    prueba('insistir antes de tiempo sigue sin dar el enlace', r.s === 425 && !r.d.link, `${r.s}`);
    // Manipular la hora del ticket hacia el pasado (la hora va firmada)
    if (tk) { const [t36, f] = tk.split('.'); const viejo = (parseInt(t36, 36) - 60e3).toString(36); r = await validar(J1, `${viejo}.${f}`, ip); prueba('ticket con la hora adelantada a mano → rechazado', r.s === 428 && !r.d.link, `${r.s}`); }
    r = await post('/economia/validar-descarga', { juegoId: { $ne: null }, ticket: tk }, ip);
    prueba('inyección NoSQL en juegoId → 400', r.s === 400, `${r.s}`);
    r = await post('/economia/ticket', { juegoId: 'no-es-un-id' }, ip);
    prueba('ticket para un id inválido → 400', r.s === 400, `${r.s}`);

    // ── 2. Reciclar tickets y atarlos a otra IP/juego/blog ────────────────────────────────
    console.log('\n2. Reciclar tickets');
    await esperarTickets();   // en staging: pasan los 27 s de los tickets pedidos al empezar
    ip = ipA;
    const tA = await ticketListo(J1, ip);
    r = await validar(J1, tA, ipNueva());
    prueba('ticket usado desde OTRA IP → rechazado (va atado a la IP)', r.s === 428 && !r.d.link, `${r.s}`);
    if (J2) { r = await validar(J2, tA, ip); prueba('ticket de un juego usado en OTRO juego → rechazado', r.s === 428 && !r.d.link, `${r.s}`); }
    r = await validar(J1, tA, ip, { via: 'c'.repeat(24) });
    prueba('añadir un `via` de blog a un ticket que no lo tenía → rechazado', r.s === 428 && !r.d.link, `${r.s}`);
    const antes = db ? await saldo('autor') : 0;
    r = await validar(J1, tA, ip);
    prueba('el ticket legítimo sí funciona y cuenta', r.s === 200 && r.d.descargaContada === true && /^https?:/.test(r.d.link || ''), `${r.s} ${r.txt.slice(0, 160)}`);
    if (db) prueba('el autor ganó exactamente 1 visualización (CPM/1000)', cerca((await saldo('autor')) - antes, 1.5 / 1000), String((await saldo('autor')) - antes));

    // ── 3. Reciclar IPs: tope de descargas por IP y día ───────────────────────────────────
    console.log('\n3. Reciclar IPs');
    r = await validar(J1, tA, ip);   // el mismo ticket otra vez (repetición)
    prueba('repetir el MISMO ticket: la 2.ª cuenta, la 3.ª ya no (tope por IP)', r.d.descargaContada === true, `${r.s} ${r.txt.slice(0, 160)}`);
    const r3 = await validar(J1, tA, ip);
    prueba('3.ª descarga de la misma IP y juego → límite alcanzado, NO cuenta', r3.d.limiteAlcanzado === true && !r3.d.descargaContada, r3.txt.slice(0, 160));
    const r4 = await validar(J1, tA, ip, {});
    prueba('seguir golpeando no cuenta más', !r4.d.descargaContada, r4.txt.slice(0, 120));
    // Añadir entradas falsas a la izquierda del X-Forwarded-For no debe dar una IP nueva
    const rF = await post('/economia/validar-descarga', { juegoId: J1, ticket: tA, tieneAdBlocker: false }, ip, '8.8.8.8, 1.2.3.4');
    prueba('falsear X-Forwarded-For por la izquierda NO libera el tope (solo cuenta la IP del proxy)', !rF.d.descargaContada, rF.txt.slice(0, 160));
    if (db) { const a = await db.collection('juegos').findOne({ _id: new (require(REPO + '/node_modules/mongoose').Types.ObjectId)(J1) }); prueba('descargasEfectivas = 2 (solo las dos permitidas)', a.descargasEfectivas === 2, String(a.descargasEfectivas)); }
    // Rotar IPs reales sí da descargas nuevas: es el techo conocido; lo frenan el antifraude y la retención, no este tope
    nota('rotar IPs de verdad (proxies/VPN) sigue contando: ese techo lo cubren fraudDetector, la verificación nivel 1 y el mínimo de retiro');

    // ── 4. Falsear el bloqueador de anuncios ──────────────────────────────────────────────
    console.log('\n4. Bloqueador de anuncios');
    ip = ipB; const tB = await ticketListo(J1, ip);
    const antesB = db ? await saldo('autor') : 0;
    r = await validar(J1, tB, ip, { tieneAdBlocker: true });
    prueba('declarar bloqueador → enlace sí, pero NO cuenta ni paga', r.d.descargaContada === false && r.d.adBlockerDetectado === true, r.txt.slice(0, 160));
    if (db) prueba('el saldo del autor no se movió', cerca((await saldo('autor')) - antesB, 0));
    nota('el servidor no puede comprobar que el anuncio se vio: con `tieneAdBlocker:false` mentido cuenta igual. Lo limitan el tope por IP, el ticket con espera y el antifraude (limitación conocida)');

    // ── 5. Frenos de abuso ─────────────────────────────────────────────────────────────────
    console.log('\n5. Frenos de abuso');
    ip = ipNueva(); let ultimo = 0, n429 = 0;
    for (let i = 0; i < 24; i++) { ultimo = (await post('/economia/ticket', { juegoId: J1 }, ip)).s; if (ultimo === 429) n429++; }
    prueba('pedir tickets en ráfaga desde una IP → 429', n429 > 0, `429 x${n429}`);

    // ── 6. Vistas falsas ───────────────────────────────────────────────────────────────────
    console.log('\n6. Vistas');
    ip = ipNueva();
    const v1 = await post(`/items/${J1}/vista`, {}, ip), v2 = await post(`/items/${J1}/vista`, {}, ip), v3 = await post(`/items/${J1}/vista`, {}, ip, '5.5.5.5');
    prueba('la 1.ª vista de una IP cuenta', v1.d.contada === true, v1.txt);
    prueba('la 2.ª vista el mismo día no cuenta', v2.d.contada === false, v2.txt);
    prueba('falsear X-Forwarded-For por la izquierda no da otra vista', v3.d.contada === false, v3.txt);
    prueba('una vista a un id inexistente no revienta', (await post(`/items/${'0'.repeat(24)}/vista`, {}, ip)).d.contada === false);

    // ── 7. El enlace no se filtra por los listados públicos ───────────────────────────────
    console.log('\n7. Enlace de descarga');
    const lista = await (await fetch(A + '/items?limit=50')).text(), ficha = await (await fetch(`${A}/items/${J1}`)).text();
    prueba('GET /items no trae enlaces de descarga', !/descarga-secreta/.test(lista) && !/"link"\s*:\s*"https?:/i.test(lista), lista.slice(0, 120));
    prueba('GET /items/:id no trae el enlace (solo la página puente lo entrega)', !/descarga-secreta/.test(ficha) && !/"link"\s*:\s*"https?:/i.test(ficha), ficha.slice(0, 120));

    // ── 8. Descargas desde blogs (pago al dueño del blog) ─────────────────────────────────
    if (REMOTO) {
        console.log('\n8. Descargas desde blogs');
        nota('requieren sembrar blogs y entradas en la base de datos: solo se prueban en modo local (CI)');
    } else {
        console.log('\n8. Descargas desde blogs (el dueño del blog cobra; nadie más)');
        const PAGO = 0.5 / 1000, blogUsd = () => saldo('duenoblog');
        // 8a. camino feliz
        ip = ipNueva(); let b0 = await blogUsd();
        let t = await ticketListo(J1, ip, ids.buena);
        r = await validar(J1, t, ip, { via: ids.buena });
        prueba('descarga desde una entrada con el bloque → cuenta y paga al dueño del blog', r.d.descargaContada === true && cerca((await blogUsd()) - b0, PAGO), `${r.txt.slice(0, 120)} Δ=${(await blogUsd()) - b0}`);
        const bl = await db.collection('blogs').findOne({ direccion: 'dueno-blog' });
        prueba('el blog acumula descargasGeneradas e ingresosDescargas', bl.descargasGeneradas === 1 && cerca(bl.ingresosDescargas, PAGO), JSON.stringify([bl.descargasGeneradas, bl.ingresosDescargas]));
        // 8b. el autor del juego cobra igual que siempre
        // 8c. atribuciones falsas
        // Cada ataque usa un autor limpio (si no, el antifraude del autor podría ser lo que impide el pago y la prueba no probaría nada)
        const intento = async (nombre, variante, viaFalso) => {
            const sc = await ids.nuevoEscenario(variante), via = viaFalso || sc.via;
            const ipx = ipNueva(), base = await blogUsd(), tx = await ticketListo(sc.juego, ipx, /^[a-f0-9]{24}$/i.test(via) ? via : '');   // el servidor ignora un `via` que no sea un id
            const rx = await validar(sc.juego, tx, ipx, { via });
            prueba(`${nombre} → la descarga cuenta para el autor pero no paga al dueño del blog`, rx.d.descargaContada === true && cerca((await blogUsd()) - base, 0), `Δ=${(await blogUsd()) - base} ${rx.txt.slice(0, 100)}`);
            return rx;
        };
        await intento('entrada en borrador', 'borrador');
        await intento('entrada que enlaza OTRO juego', 'otroJuego');
        await intento('entrada con solo la tarjeta del juego (sin bloque descarga)', 'tarjeta');
        await intento('id de entrada inexistente', 'buena', 'f'.repeat(24));
        const rBasura = await intento('`via` con basura', 'buena', 'no-es-un-id');
        prueba('un `via` basura no rompe la descarga normal', rBasura.s === 200, String(rBasura.s));
        // dueño del blog descargando su propio juego: ya cobra como autor
        { const ipx = ipNueva(), b = await blogUsd(), tx = await ticketListo(ids.J3, ipx, ids.propio); await validar(ids.J3, tx, ipx, { via: ids.propio });
          const cobrado = (await blogUsd()) - b; prueba('juego del propio dueño del blog: cobra una vez como autor, no se duplica', cerca(cobrado, 1.5 / 1000), `Δ=${cobrado}`); }
        // con bloqueador, sin ticket o pasados del tope por IP no hay pago de blog
        { const ipx = ipNueva(), b = await blogUsd(), tx = await ticketListo(J1, ipx, ids.buena); await validar(J1, tx, ipx, { via: ids.buena, tieneAdBlocker: true });
          prueba('con bloqueador de anuncios la descarga no paga al blog', cerca((await blogUsd()) - b, 0)); }
        { const ipx = ipNueva(), b = await blogUsd(); await validar(J1, undefined, ipx, { via: ids.buena });
          prueba('sin ticket no paga al blog', cerca((await blogUsd()) - b, 0)); }
        { const sc = await ids.nuevoEscenario(); await db.collection('blogvistas').deleteMany({});
          const ipx = ipNueva(), t0 = await ticketListo(sc.juego, ipx, sc.via), b = await blogUsd(); await validar(sc.juego, t0, ipx, { via: sc.via }); await validar(sc.juego, t0, ipx, { via: sc.via });
          const r3b = await validar(sc.juego, t0, ipx, { via: sc.via }); const cobrado = (await blogUsd()) - b;
          prueba('la misma IP no hace pagar al blog más de 2 veces por juego y día', cerca(cobrado, 2 * PAGO) && !r3b.d.descargaContada, `Δ=${cobrado} ${r3b.txt.slice(0, 100)}`); }
        // 8d. tope diario por blog (BLOGS_DESCARGAS_MAX_DIA=2 en este servidor): hasta ahora se pagaron 1 + 1(8c última) + ... se comprueba el tope exacto
        await db.collection('blogvistas').deleteMany({ blog: new (require(REPO + '/node_modules/mongoose').Types.ObjectId)(ids.blog) });
        const antesTope = await blogUsd(); let pagadas = 0;
        for (let i = 0; i < TOPE_BLOG + 3; i++) {
            const sc = await ids.nuevoEscenario();
            const ipx = ipNueva(), b = await blogUsd(), tx = await ticketListo(sc.juego, ipx, sc.via);
            const rx = await validar(sc.juego, tx, ipx, { via: sc.via });
            if (cerca((await blogUsd()) - b, PAGO)) pagadas++;
            if (!rx.d.descargaContada) { prueba('la descarga del autor sigue contando aunque el blog haya llegado a su tope', false, rx.txt.slice(0, 100)); }
        }
        prueba(`tope diario por blog: pagó ${TOPE_BLOG} descargas y se detuvo`, pagadas === TOPE_BLOG && cerca((await blogUsd()) - antesTope, TOPE_BLOG * PAGO), `pagadas=${pagadas}`);
        const vd = await db.collection('blogvistas').findOne({ dia: hoy(), blog: new (require(REPO + '/node_modules/mongoose').Types.ObjectId)(ids.blog) });
        prueba('el registro diario del blog no superó el tope', vd && vd.d === TOPE_BLOG, JSON.stringify(vd));
        // 8e. blogs suspendidos o dueño en lista negra no cobran
        await db.collection('blogs').updateOne({ direccion: 'dueno-blog' }, { $set: { estado: 'suspendido' } });
        await db.collection('blogvistas').deleteMany({});
        const sus = await ids.nuevoEscenario(); { const ipx = ipNueva(), b = await blogUsd(), tx = await ticketListo(sus.juego, ipx, sus.via); const rx = await validar(sus.juego, tx, ipx, { via: sus.via });
          prueba('blog suspendido → cuenta para el autor, no paga al blog', rx.d.descargaContada === true && cerca((await blogUsd()) - b, 0), rx.txt.slice(0, 100)); }
        await db.collection('blogs').updateOne({ direccion: 'dueno-blog' }, { $set: { estado: 'activo' } });
        await db.collection('usuarios').updateOne({ usuario: 'duenoblog' }, { $set: { listaNegraAdmin: true } });
        const neg = await ids.nuevoEscenario(); { const ipx = ipNueva(), b = await blogUsd(), tx = await ticketListo(neg.juego, ipx, neg.via); const rx = await validar(neg.juego, tx, ipx, { via: neg.via });
          prueba('dueño del blog en lista negra → cuenta para el autor, no cobra', rx.d.descargaContada === true && cerca((await blogUsd()) - b, 0), rx.txt.slice(0, 100)); }
        await db.collection('usuarios').updateOne({ usuario: 'duenoblog' }, { $set: { listaNegraAdmin: false } });
        // 8f. el saldo nunca queda negativo ni raro
        const todos = await db.collection('usuarios').find({}).toArray();
        prueba('ningún saldo quedó negativo o NaN', todos.every(u => Number.isFinite(u.saldo || 0) && (u.saldo || 0) >= 0), JSON.stringify(todos.map(u => [u.usuario, u.saldo])));
    }

    await cerrar();
    console.log(`\n${ok} pruebas OK, ${mal} con fallo`);
    if (mal) { console.error('\nATAQUES QUE FUNCIONARON / COSAS QUE NO CUADRAN:\n - ' + fallos.join('\n - ')); process.exit(1); }
    process.exit(0);
})().catch(e => { console.error('Error en la prueba:', e); process.exit(1); });
