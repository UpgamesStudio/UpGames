/**
 * Informe mensual de actividad (panel admin → Informes).
 *
 * Reúne en un solo documento todo lo que pasó en UpGames en un mes natural (hora de Colombia):
 *   • resumen: visitantes, cuentas nuevas, publicaciones, anuncios vistos, comentarios, reportes, pagos
 *   • día a día: una fila por día con las mismas cifras
 *   • top de creadores y de publicaciones del mes, búsquedas más repetidas y búsquedas sin resultado
 *   • pagos a creadores (solo con permiso de finanzas) y acciones del equipo (solo el dueño)
 *
 *   GET /admin/informes/meses                         meses disponibles (los últimos 12)
 *   GET /admin/informes/mensual?mes=AAAA-MM           el informe en JSON (para verlo en el panel)
 *   GET /admin/informes/mensual?mes=AAAA-MM&formato=csv   el mismo informe en CSV (se abre en Excel)
 *
 * Aviso automático: el primer día que el servidor está en marcha en un mes nuevo, envía al dueño
 * (OWNER_EMAIL) un correo con el resumen del mes cerrado y el enlace para descargarlo. Se anota en
 * la colección `informes_enviados` para no repetirlo.
 *
 * Datos personales: el informe no incluye emails, IP ni datos de cobro; los visitantes son anónimos.
 */
'use strict';

const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const NOMBRES_MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const TZ_MS = 5 * 3600e3;                                   // Colombia va 5 h por detrás de UTC
const diaCol = (t = Date.now()) => new Date(t - TZ_MS).toISOString().slice(0, 10);
const mesCol = (t = Date.now()) => diaCol(t).slice(0, 7);
const nombreMes = (mes) => `${NOMBRES_MES[+mes.slice(5) - 1]} de ${mes.slice(0, 4)}`;

/** Límites del mes: días (AAAA-MM-DD) y fechas UTC de inicio y fin en hora de Colombia. */
function limitesMes(mes) {
    if (!MES_RE.test(mes)) throw new Error('Mes no válido (formato AAAA-MM)');
    const [a, m] = mes.split('-').map(Number);
    const nDias = new Date(Date.UTC(a, m, 0)).getUTCDate();
    const dias = Array.from({ length: nDias }, (_, i) => `${mes}-${String(i + 1).padStart(2, '0')}`);
    return { dias, desde: new Date(Date.UTC(a, m - 1, 1) + TZ_MS), hasta: new Date(Date.UTC(a, m, 1) + TZ_MS) };
}

/** Mes anterior a uno dado (AAAA-MM). */
function mesAnterior(mes) {
    const [a, m] = mes.split('-').map(Number);
    return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
}

/** Los últimos n meses, del más reciente al más antiguo; el actual va marcado como «en curso». */
function listaMeses(n = 12, ahora = Date.now()) {
    const out = []; let mes = mesCol(ahora);
    for (let i = 0; i < n; i++) { out.push({ mes, nombre: nombreMes(mes), enCurso: i === 0 }); mes = mesAnterior(mes); }
    return out;
}

// ── CSV (con ; como separador y BOM: Excel en español lo abre bien con doble clic) ──
const celda = (v) => {
    if (v === null || v === undefined) return '';
    let s = typeof v === 'number' ? String(Math.round(v * 100) / 100).replace('.', ',') : String(v);
    // (una celda que empieza por = + - @ la ejecutaría Excel como fórmula: se neutraliza)
    if (/^[=+\-@\t\r]/.test(s) && typeof v !== 'number') s = "'" + s;
    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const fila = (...cols) => cols.map(celda).join(';');

/** El informe completo como texto CSV, por secciones. */
function aCSV(inf) {
    const L = [];
    const seccion = (titulo, cabecera, filas) => { L.push('', fila(titulo.toUpperCase()), fila(...cabecera)); for (const f of filas) L.push(fila(...f)); if (!filas.length) L.push(fila('(sin datos)')); };
    L.push(fila('UPGAMES · INFORME MENSUAL DE ACTIVIDAD'));
    L.push(fila('Mes', inf.nombre));
    L.push(fila('Periodo', `${inf.dias[0]} a ${inf.dias[inf.dias.length - 1]} (hora de Colombia)`));
    L.push(fila('Generado', new Date(inf.generado).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'));
    if (inf.enCurso) L.push(fila('Aviso', 'Mes en curso: las cifras aún pueden subir'));
    seccion('Resumen', ['Indicador', 'Este mes', 'Mes anterior', 'Cambio %'],
        inf.resumen.map(r => [r.nombre, r.valor, r.anterior, r.anterior ? Math.round((r.valor - r.anterior) / r.anterior * 1000) / 10 : '']));
    seccion('Día a día', ['Día', 'Visitantes', 'Visitantes nuevos', 'Búsquedas', 'Publicaciones abiertas', 'Idas a descargar', 'Anuncios vistos', 'Cuentas nuevas', 'Publicaciones nuevas', 'Comentarios', 'Reportes'],
        inf.porDia.map(d => [d.dia, d.visitantes, d.nuevos, d.busquedas, d.fichas, d.clicsDescarga, d.anuncios, d.cuentas, d.publicaciones, d.comentarios, d.reportes]));
    seccion('Creadores con más anuncios vistos en el mes', ['#', 'Creador', 'Anuncios vistos', 'Vistas de video', 'Ganancia estimada USD'],
        inf.topCreadores.map((c, i) => [i + 1, c.usuario, c.anuncios, c.vistas, c.ganancia]));
    seccion('Publicaciones con más anuncios vistos en el mes', ['#', 'Publicación', 'Creador', 'Anuncios vistos'],
        inf.topPublicaciones.map((p, i) => [i + 1, p.titulo, p.usuario, p.anuncios]));
    seccion('Publicaciones nuevas por categoría', ['Categoría', 'Publicaciones'], inf.categorias.map(c => [c.categoria, c.n]));
    seccion('Lo más buscado', ['Búsqueda', 'Veces'], inf.busquedas.map(b => [b.q, b.n]));
    seccion('Búsquedas sin resultado (contenido que falta)', ['Búsqueda', 'Veces sin resultado'], inf.busquedasVacias.map(b => [b.q, b.vacias]));
    seccion('Reportes por motivo', ['Motivo', 'Reportes'], inf.reportes.map(r => [r.motivo, r.n]));
    if (inf.pagos) {
        seccion('Pagos a creadores · resumen', ['Estado', 'Solicitudes', 'Monto USD'], inf.pagos.porEstado.map(p => [p.estado, p.n, p.monto]));
        seccion('Pagos a creadores · detalle', ['Fecha', 'Creador', 'Monto USD', 'Método', 'Estado'], inf.pagos.detalle.map(p => [p.fecha, p.usuario, p.monto, p.metodo, p.estado]));
    }
    if (inf.equipo) {
        seccion('Acciones del equipo · por persona', ['Administrador', 'Rol', 'Acciones'], inf.equipo.porAdmin.map(a => [a.admin, a.rol, a.n]));
        seccion('Acciones del equipo · detalle', ['Fecha', 'Administrador', 'Acción', 'Objetivo', 'Resultado'], inf.equipo.detalle.map(a => [a.fecha, a.admin, a.accion, a.objetivo, a.estado]));
    }
    return '﻿' + L.join('\r\n') + '\r\n';
}

function registrar(app, { verificarAdmin, Usuario, Juego, Comentario, Pago, Reporte, sendEmail, logger, ownerEmails }) {
    const mongoose = require('mongoose');
    const db = () => mongoose.connection;
    const fechaCorta = (d) => new Date(new Date(d).getTime() - TZ_MS).toISOString().replace('T', ' ').slice(0, 16);
    const cache = new Map();                        // meses cerrados: no cambian, se guardan 6 h

    const porDiaDe = (Modelo, campo, desde, hasta) => Modelo.aggregate([
        { $match: { [campo]: { $gte: desde, $lt: hasta } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$' + campo, timezone: '-05:00' } }, n: { $sum: 1 } } },
    ]);

    /** Cifras de un mes. `nivel`: { finanzas, owner } decide qué secciones sensibles se incluyen. */
    async function construir(mes, nivel = {}) {
        const { dias, desde, hasta } = limitesMes(mes);
        const enCurso = mes === mesCol();
        const clave = `${mes}|${nivel.finanzas ? 1 : 0}${nivel.owner ? 1 : 0}`;
        const c = cache.get(clave);
        if (c && Date.now() - c.t < (enCurso ? 5 * 60e3 : 6 * 3600e3)) return c.inf;

        const d0 = dias[0], d1 = dias[dias.length - 1];
        const visitas = db().collection('metricas_visitas'), stats = db().collection('stats_items'), busq = db().collection('metricas_busquedas');
        const AdminLog = mongoose.models.AdminLog;
        const [vis, st, cuentas, pubs, coms, reps, repMotivo, cats, topC, topP, bus, pagos, logs] = await Promise.all([
            visitas.aggregate([{ $match: { dia: { $gte: d0, $lte: d1 } } },
                { $group: { _id: '$dia', visitantes: { $sum: 1 }, nuevos: { $sum: { $cond: ['$nuevo', 1, 0] } }, busquedas: { $sum: { $ifNull: ['$nb', 0] } },
                    fichas: { $sum: { $ifNull: ['$nf', 0] } }, clics: { $sum: { $ifNull: ['$nd', 0] } } } }]).toArray(),
            stats.aggregate([{ $match: { dia: { $gte: d0, $lte: d1 } } }, { $group: { _id: '$dia', d: { $sum: { $ifNull: ['$d', 0] } } } }]).toArray(),
            porDiaDe(Usuario, 'createdAt', desde, hasta),
            porDiaDe(Juego, 'createdAt', desde, hasta),
            porDiaDe(Comentario, 'fecha', desde, hasta),
            Reporte ? porDiaDe(Reporte, 'fecha', desde, hasta) : [],
            Reporte ? Reporte.aggregate([{ $match: { fecha: { $gte: desde, $lt: hasta } } }, { $group: { _id: '$motivo', n: { $sum: 1 } } }, { $sort: { n: -1 } }]) : [],
            Juego.aggregate([{ $match: { createdAt: { $gte: desde, $lt: hasta } } }, { $group: { _id: { $ifNull: ['$category', 'General'] }, n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 30 }]),
            stats.aggregate([{ $match: { dia: { $gte: d0, $lte: d1 } } },
                { $group: { _id: '$autor', anuncios: { $sum: { $ifNull: ['$d', 0] } }, vistas: { $sum: { $ifNull: ['$v', 0] } }, ganancia: { $sum: { $ifNull: ['$g', 0] } } } },
                { $sort: { anuncios: -1 } }, { $limit: 25 }]).toArray(),
            stats.aggregate([{ $match: { dia: { $gte: d0, $lte: d1 } } },
                { $group: { _id: '$itemId', autor: { $first: '$autor' }, anuncios: { $sum: { $ifNull: ['$d', 0] } } } },
                { $sort: { anuncios: -1 } }, { $limit: 25 }]).toArray(),
            busq.aggregate([{ $match: { dia: { $gte: d0, $lte: d1 } } }, { $group: { _id: '$q', n: { $sum: '$n' }, vacias: { $sum: '$vacias' } } }, { $sort: { n: -1 } }, { $limit: 400 }]).toArray(),
            nivel.finanzas ? Pago.find({ fecha: { $gte: desde, $lt: hasta } }).select('usuario monto metodo estado fecha').sort({ fecha: 1 }).limit(5000).lean() : null,
            nivel.owner && AdminLog ? AdminLog.find({ fecha: { $gte: desde, $lt: hasta }, accion: { $not: /^(LOGIN|LOGOUT)/ } }).select('admin rol accion objetivo estado fecha').sort({ fecha: 1 }).limit(5000).lean() : null,
        ]);
        const idx = (arr, k = 'n') => Object.fromEntries(arr.map(x => [x._id, k ? x[k] : x]));
        const V = idx(vis, null), S = idx(st, 'd'), C = idx(cuentas), P = idx(pubs), M = idx(coms), R = idx(reps);
        const porDia = dias.map(d => ({ dia: d, visitantes: V[d]?.visitantes || 0, nuevos: V[d]?.nuevos || 0, busquedas: V[d]?.busquedas || 0, fichas: V[d]?.fichas || 0,
            clicsDescarga: V[d]?.clics || 0, anuncios: S[d] || 0, cuentas: C[d] || 0, publicaciones: P[d] || 0, comentarios: M[d] || 0, reportes: R[d] || 0 }));
        const suma = (k) => porDia.reduce((a, x) => a + x[k], 0);
        const totales = { visitantes: suma('visitantes'), nuevos: suma('nuevos'), busquedas: suma('busquedas'), fichas: suma('fichas'), clicsDescarga: suma('clicsDescarga'),
            anuncios: suma('anuncios'), cuentas: suma('cuentas'), publicaciones: suma('publicaciones'), comentarios: suma('comentarios'), reportes: suma('reportes') };

        // títulos de las publicaciones del top
        const ids = topP.map(p => p._id).filter(id => mongoose.isValidObjectId(id));
        const tit = ids.length ? Object.fromEntries((await Juego.find({ _id: { $in: ids } }).select('title').lean()).map(j => [String(j._id), j.title])) : {};

        const inf = {
            mes, nombre: nombreMes(mes), dias, enCurso, generado: Date.now(), totales, porDia,
            topCreadores: topC.filter(c => c._id).map(c => ({ usuario: c._id, anuncios: c.anuncios, vistas: c.vistas, ganancia: Math.round((c.ganancia || 0) * 100) / 100 })),
            topPublicaciones: topP.map(p => ({ id: p._id, titulo: tit[p._id] || '(publicación eliminada)', usuario: p.autor || '', anuncios: p.anuncios })),
            categorias: cats.map(c => ({ categoria: c._id || 'General', n: c.n })),
            busquedas: bus.slice(0, 40).map(b => ({ q: b._id, n: b.n })),
            busquedasVacias: bus.filter(b => b.vacias > 0).sort((a, b) => b.vacias - a.vacias).slice(0, 40).map(b => ({ q: b._id, vacias: b.vacias })),
            reportes: repMotivo.map(r => ({ motivo: { caido: 'Enlace caído', viejo: 'Versión vieja', malware: 'Malware' }[r._id] || r._id, n: r.n })),
            pagos: null, equipo: null,
        };
        if (pagos) {
            const est = {};
            for (const p of pagos) { const e = est[p.estado] || (est[p.estado] = { estado: p.estado, n: 0, monto: 0 }); e.n++; e.monto += p.monto || 0; }
            inf.pagos = { porEstado: Object.values(est).map(e => ({ ...e, monto: Math.round(e.monto * 100) / 100 })),
                detalle: pagos.map(p => ({ fecha: fechaCorta(p.fecha), usuario: p.usuario, monto: p.monto, metodo: p.metodo || '', estado: p.estado })) };
            totales.pagosCompletados = Math.round(pagos.filter(p => p.estado === 'completado').reduce((a, p) => a + (p.monto || 0), 0) * 100) / 100;
        }
        if (logs) {
            const por = {};
            for (const l of logs) { const a = por[l.admin] || (por[l.admin] = { admin: l.admin, rol: l.rol || '', n: 0 }); a.n++; }
            inf.equipo = { porAdmin: Object.values(por).sort((a, b) => b.n - a.n),
                detalle: logs.map(l => ({ fecha: fechaCorta(l.fecha), admin: l.admin, accion: l.accion, objetivo: l.objetivo || '', estado: l.estado >= 400 ? `Error ${l.estado}` : 'Correcto' })) };
        }
        cache.set(clave, { t: Date.now(), inf });
        if (cache.size > 40) cache.delete(cache.keys().next().value);
        return inf;
    }

    const INDICADORES = [['visitantes', 'Visitantes'], ['nuevos', 'Visitantes nuevos'], ['cuentas', 'Cuentas nuevas'], ['publicaciones', 'Publicaciones nuevas'],
        ['anuncios', 'Anuncios vistos'], ['busquedas', 'Búsquedas'], ['fichas', 'Publicaciones abiertas'], ['clicsDescarga', 'Idas a descargar'],
        ['comentarios', 'Comentarios'], ['reportes', 'Reportes recibidos'], ['pagosCompletados', 'Pagos completados (USD)']];
    /** El informe con la comparación contra el mes anterior. */
    async function informeCompleto(mes, nivel) {
        const [inf, ant] = await Promise.all([construir(mes, nivel), construir(mesAnterior(mes), nivel)]);
        return { ...inf, anterior: ant.nombre,
            resumen: INDICADORES.filter(([k]) => inf.totales[k] !== undefined).map(([k, nombre]) => ({ clave: k, nombre, valor: inf.totales[k], anterior: ant.totales[k] || 0 })) };
    }
    const nivelDe = (adm) => ({ owner: adm?.rol === 'owner', finanzas: adm?.rol === 'owner' || (adm?.permisos || []).includes('finanzas') });

    app.get('/admin/informes/meses', verificarAdmin, (req, res) => res.json({ success: true, meses: listaMeses(12) }));

    app.get('/admin/informes/mensual', verificarAdmin, async (req, res) => {
        try {
            const mes = String(req.query.mes || mesAnterior(mesCol()));
            if (!MES_RE.test(mes) || mes > mesCol()) return res.status(400).json({ success: false, error: 'Mes no válido' });
            const inf = await informeCompleto(mes, nivelDe(req.admin));
            if (req.query.formato === 'csv') {
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename="UpGames-informe-${mes}.csv"`);
                return res.send(aCSV(inf));
            }
            res.json({ success: true, informe: inf });
        } catch (e) { logger?.error?.(`[informes] ${e.message}`); res.status(500).json({ success: false, error: 'No se pudo generar el informe' }); }
    });

    // ── Aviso automático al dueño al empezar cada mes ──
    async function avisoMensual() {
        try {
            if (mongoose.connection.readyState !== 1 || typeof sendEmail !== 'function') return;
            const mes = mesAnterior(mesCol());
            const col = db().collection('informes_enviados');
            // (insertar primero: si hay varias instancias del servidor, solo una envía)
            try { await col.insertOne({ _id: mes, fecha: new Date() }); } catch (_) { return; }
            const inf = await informeCompleto(mes, { owner: true, finanzas: true });
            const filas = inf.resumen.map(r => { const p = r.anterior ? Math.round((r.valor - r.anterior) / r.anterior * 100) : null;
                return `<tr><td style="padding:6px 12px 6px 0">${r.nombre}</td><td style="padding:6px 12px;text-align:right"><b>${Number(r.valor).toLocaleString('es-CO')}</b></td><td style="padding:6px 0;text-align:right;color:${p === null ? '#888' : p >= 0 ? '#16a34a' : '#dc2626'}">${p === null ? '—' : (p >= 0 ? '+' : '') + p + ' %'}</td></tr>`; }).join('');
            const html = `<div style="font-family:system-ui,sans-serif;max-width:600px;color:#111"><h2 style="margin:0 0 4px">Informe de ${inf.nombre}</h2>
                <p style="color:#555;margin:0 0 14px">Resumen de la actividad de UpGames, comparado con ${inf.anterior}.</p>
                <table style="border-collapse:collapse;font-size:14px">${filas}</table>
                <p style="margin:18px 0"><a href="https://upgames.games/admin/#informes" style="background:#16a34a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:700">Abrir y descargar el informe completo</a></p>
                <p style="color:#888;font-size:12px">El informe completo (día a día, creadores, publicaciones, búsquedas, pagos y acciones del equipo) se descarga en Excel desde el panel → Informes.</p></div>`;
            for (const to of (ownerEmails?.() || [])) await sendEmail({ to, subject: `UpGames · Informe de ${inf.nombre}`, html });
        } catch (e) { logger?.warn?.(`[informes] aviso mensual: ${e.message}`); }
    }
    setTimeout(avisoMensual, 90 * 1000).unref?.();
    setInterval(avisoMensual, 6 * 3600e3).unref?.();

    return { construir, informeCompleto };
}

module.exports = { registrar, aCSV, limitesMes, mesAnterior, listaMeses, nombreMes, mesCol };
