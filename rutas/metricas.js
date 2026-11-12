/**
 * Métricas de producto (panel admin → Métricas).
 *
 * La web envía eventos anónimos con un id aleatorio del navegador (ug_vid): sin IP, sin
 * cuenta ni datos personales. Con eso se mide:
 *   • visitantes únicos por día y nuevos vs. recurrentes
 *   • búsquedas (y las que no encontraron nada: contenido que falta)
 *   • fichas abiertas y clics en "Obtener link"
 *   • retención: cuántos vuelven al día siguiente (D1) y en la semana (D7)
 *   • embudo: visitaron → buscaron → abrieron una ficha → fueron a descargar → crearon cuenta
 * Los anuncios vistos (descargasEfectivas), cuentas nuevas y publicaciones salen de la base de datos real.
 *
 *   POST /m/e                  { vid, tipo, q?, n? }   (público, con límite por IP)
 *   GET  /admin/metricas?dias= (panel admin)
 */
'use strict';

const mongoose = require('mongoose');
const express = require('express');

const DIA_MS = 864e5;
const dia = (t = Date.now()) => new Date(t - 5 * 3600e3).toISOString().slice(0, 10);   // hora de Colombia
const TIPOS = { visita: 'v', busqueda: 'b', ficha: 'f', descarga: 'd', registro: 'r' };
const vidOk = v => /^[a-z0-9]{12,40}$/i.test(String(v || ''));
const limpiarQ = q => String(q || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);

function registrar(app, { verificarAdmin, Usuario, Juego, Limites, logger }) {
    const db = () => mongoose.connection;
    const visitas = () => db().collection('metricas_visitas');       // _id "<dia>:<vid>" → flags del día
    const visitantes = () => db().collection('metricas_visitantes'); // _id vid → { primera }
    const busquedas = () => db().collection('metricas_busquedas');   // _id "<dia>:<q>" → { n, vacias }
    let indices = false;
    function asegurarIndices() {
        if (indices) return; indices = true;
        visitas().createIndex({ dia: 1 }).catch(() => {});
        visitas().createIndex({ fecha: 1 }, { expireAfterSeconds: 180 * 86400 }).catch(() => {});
        visitantes().createIndex({ primera: 1 }).catch(() => {});
        visitantes().createIndex({ ultima: 1 }, { expireAfterSeconds: 400 * 86400 }).catch(() => {});
        busquedas().createIndex({ dia: 1 }).catch(() => {});
        busquedas().createIndex({ fecha: 1 }, { expireAfterSeconds: 120 * 86400 }).catch(() => {});
    }

    // ── En vivo: últimos 60 minutos en memoria (por minuto y tipo) y los últimos eventos ──
    // Solo para la tarjeta «En vivo» del panel: se pierde al reiniciar el servidor, y por eso el
    // número de personas activas sale de la base de datos (visitantes.ultima), no de aquí.
    const VIVO_MIN = 60, vivo = new Map(), recientes = [];
    const minuto = (t = Date.now()) => Math.floor(t / 60000);
    function anotarVivo(k, q) {
        const m = minuto();
        let c = vivo.get(m); if (!c) { vivo.set(m, c = { v: 0, b: 0, f: 0, d: 0, r: 0 }); for (const x of vivo.keys()) if (x < m - VIVO_MIN) vivo.delete(x); }
        c[k]++;
        recientes.unshift({ t: Date.now(), k, q: k === 'b' && q ? q : undefined });
        if (recientes.length > 40) recientes.length = 40;
    }

    // ── Recepción de eventos (anónimos) ──
    app.post('/m/e', express.text({ type: 'text/plain', limit: '2kb' }), async (req, res) => {
        res.status(204).end();   // responde al instante; el navegador no espera
        try {
            if (typeof req.body === 'string') { try { req.body = JSON.parse(req.body); } catch (_) { return; } }
            const { vid, tipo } = req.body || {};
            const k = TIPOS[tipo];
            if (!k || !vidOk(vid)) return;
            if (!(await Limites.permitir(`m:${req.ip}`, [[Limites.MIN, 60]]))) return;
            asegurarIndices();
            anotarVivo(k, tipo === 'busqueda' ? limpiarQ(req.body.q) : '');
            const d = dia(), ahora = new Date();
            const r = await visitantes().findOneAndUpdate({ _id: vid }, { $setOnInsert: { primera: d }, $set: { ultima: ahora } }, { upsert: true, returnDocument: 'after' });
            const primera = (r?.value || r)?.primera || d;
            await visitas().updateOne({ _id: `${d}:${vid}` }, { $set: { [k]: true }, $inc: { [`n${k}`]: 1 }, $setOnInsert: { dia: d, vid, nuevo: primera === d, fecha: ahora } }, { upsert: true });
            if (tipo === 'busqueda') {
                const q = limpiarQ(req.body.q);
                if (q.length >= 2) {
                    const vacia = Number(req.body.n) === 0;
                    await busquedas().updateOne({ _id: `${d}:${q}` }, { $inc: { n: 1, vacias: vacia ? 1 : 0 }, $setOnInsert: { dia: d, q, fecha: ahora } }, { upsert: true });
                }
            }
        } catch (e) { logger?.debug?.(`[metricas] ${e.message}`); }
    });

    // ── Panel: en vivo (se pide cada pocos segundos; consultas ligeras e indexadas) ──
    app.get('/admin/metricas/vivo', verificarAdmin, async (req, res) => {
        try {
            asegurarIndices();
            const ahora = Date.now(), hoy = dia(ahora);
            const [activos5, activos30, visitantesHoy, nuevosHoy, cuentas] = await Promise.all([
                visitantes().countDocuments({ ultima: { $gte: new Date(ahora - 5 * 60e3) } }),
                visitantes().countDocuments({ ultima: { $gte: new Date(ahora - 30 * 60e3) } }),
                visitas().countDocuments({ dia: hoy }),
                visitas().countDocuments({ dia: hoy, nuevo: true }),
                Usuario.find({ createdAt: { $gte: new Date(ahora - 24 * 3600e3) } }).sort({ createdAt: -1 }).limit(8).select('usuario createdAt').lean(),
            ]);
            const cuentasHora = await Usuario.countDocuments({ createdAt: { $gte: new Date(ahora - 3600e3) } });
            const m0 = minuto(ahora);
            const porMinuto = Array.from({ length: VIVO_MIN }, (_, i) => { const c = vivo.get(m0 - (VIVO_MIN - 1 - i)); return c ? [c.v, c.b, c.f, c.d, c.r] : [0, 0, 0, 0, 0]; });
            res.json({ success: true, ahora, activos5, activos30, visitantesHoy, nuevosHoy, cuentasHora,
                porMinuto, actividad: recientes.slice(0, 25),
                cuentas: cuentas.map(u => ({ usuario: u.usuario, t: new Date(u.createdAt).getTime() })) });
        } catch (e) { logger?.warn?.(`[metricas/vivo] ${e.message}`); res.status(500).json({ success: false, error: 'No se pudo leer la actividad en vivo' }); }
    });

    // ── Panel ──
    app.get('/admin/metricas', verificarAdmin, async (req, res) => {
        try {
            asegurarIndices();
            const dias = Math.min(90, Math.max(7, parseInt(req.query.dias, 10) || 30));
            const hoy = Date.now();
            const lista = Array.from({ length: dias }, (_, i) => dia(hoy - (dias - 1 - i) * DIA_MS));
            const desde = lista[0], desdeFecha = new Date(hoy - dias * DIA_MS);

            const [porDia, statsDia, cuentas, pubs, bus] = await Promise.all([
                visitas().aggregate([
                    { $match: { dia: { $gte: desde } } },
                    { $group: { _id: '$dia', visitantes: { $sum: 1 }, nuevos: { $sum: { $cond: ['$nuevo', 1, 0] } },
                        buscaron: { $sum: { $cond: ['$b', 1, 0] } }, fichas: { $sum: { $cond: ['$f', 1, 0] } },
                        descargaron: { $sum: { $cond: ['$d', 1, 0] } }, registros: { $sum: { $cond: ['$r', 1, 0] } },
                        busquedas: { $sum: { $ifNull: ['$nb', 0] } }, fichasAbiertas: { $sum: { $ifNull: ['$nf', 0] } }, clics: { $sum: { $ifNull: ['$nd', 0] } } } },
                ]).toArray(),
                db().collection('stats_items').aggregate([
                    { $match: { dia: { $gte: desde } } },
                    { $group: { _id: '$dia', descargas: { $sum: { $ifNull: ['$d', 0] } }, vistas: { $sum: { $ifNull: ['$v', 0] } } } },
                ]).toArray(),
                Usuario.aggregate([{ $match: { createdAt: { $gte: desdeFecha } } },
                    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '-05:00' } }, n: { $sum: 1 } } }]),
                Juego.aggregate([{ $match: { createdAt: { $gte: desdeFecha } } },
                    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '-05:00' } }, n: { $sum: 1 } } }]),
                busquedas().aggregate([
                    { $match: { dia: { $gte: desde } } },
                    { $group: { _id: '$q', n: { $sum: '$n' }, vacias: { $sum: '$vacias' } } },
                    { $sort: { n: -1 } }, { $limit: 300 },
                ]).toArray(),
            ]);
            const m = (arr, k = 'n') => Object.fromEntries(arr.map(x => [x._id, k ? x[k] : x]));
            const V = m(porDia, null), S = m(statsDia, null), C = m(cuentas), P = m(pubs);
            const serie = lista.map(d => ({
                dia: d, visitantes: V[d]?.visitantes || 0, nuevos: V[d]?.nuevos || 0, busquedas: V[d]?.busquedas || 0,
                fichas: V[d]?.fichasAbiertas || 0, clicsDescarga: V[d]?.clics || 0, descargas: S[d]?.descargas || 0,
                vistasVideo: S[d]?.vistas || 0, cuentas: C[d] || 0, publicaciones: P[d] || 0,
            }));

            // Totales de 7 días contra los 7 anteriores
            const suma = (a, b, k) => serie.slice(a, b).reduce((s, x) => s + x[k], 0);
            const n = serie.length, claves = ['visitantes', 'nuevos', 'busquedas', 'fichas', 'clicsDescarga', 'descargas', 'cuentas', 'publicaciones'];
            const kpis = Object.fromEntries(claves.map(k => [k, { ahora: suma(n - 7, n, k), antes: suma(n - 14, n - 7, k) }]));

            // Embudo de 7 días: visitantes únicos que llegaron a cada paso
            const desde7 = dia(hoy - 6 * DIA_MS);
            const [emb] = await visitas().aggregate([
                { $match: { dia: { $gte: desde7 } } },
                { $group: { _id: '$vid', b: { $max: { $cond: ['$b', 1, 0] } }, f: { $max: { $cond: ['$f', 1, 0] } }, d: { $max: { $cond: ['$d', 1, 0] } }, r: { $max: { $cond: ['$r', 1, 0] } } } },
                { $group: { _id: null, visitaron: { $sum: 1 }, buscaron: { $sum: '$b' }, fichas: { $sum: '$f' }, descargar: { $sum: '$d' }, cuentas: { $sum: '$r' } } },
            ]).toArray();

            // Retención: de quienes llegaron por primera vez hace 8–21 días, cuántos volvieron
            const coh0 = dia(hoy - 21 * DIA_MS), coh1 = dia(hoy - 8 * DIA_MS);
            const cohorte = await visitantes().find({ primera: { $gte: coh0, $lte: coh1 } }).project({ _id: 1, primera: 1 }).limit(20000).toArray();
            let d1 = 0, d7 = 0;
            if (cohorte.length) {
                const ids = cohorte.map(c => c._id), prim = new Map(cohorte.map(c => [c._id, c.primera]));
                const v = await visitas().find({ vid: { $in: ids }, dia: { $gt: coh0 } }).project({ vid: 1, dia: 1 }).toArray();
                const vuelta = new Map();
                for (const x of v) {
                    const dd = Math.round((new Date(x.dia) - new Date(prim.get(x.vid))) / DIA_MS);
                    if (dd >= 1) { const s = vuelta.get(x.vid) || new Set(); s.add(dd); vuelta.set(x.vid, s); }
                }
                for (const s of vuelta.values()) { if (s.has(1)) d1++; if ([...s].some(x => x >= 1 && x <= 7)) d7++; }
            }

            res.json({
                success: true, dias, serie, kpis,
                embudo: emb || { visitaron: 0, buscaron: 0, fichas: 0, descargar: 0, cuentas: 0 },
                retencion: { cohorte: cohorte.length, d1, d7, desde: coh0, hasta: coh1 },
                busquedas: {
                    top: bus.slice(0, 20).map(b => ({ q: b._id, n: b.n, vacias: b.vacias })),
                    sinResultado: bus.filter(b => b.vacias > 0).sort((a, b) => b.vacias - a.vacias).slice(0, 20).map(b => ({ q: b._id, n: b.vacias })),
                },
            });
        } catch (e) {
            logger?.error?.(`[metricas] ${e.message}`);
            res.status(500).json({ success: false, error: 'No se pudieron calcular las métricas' });
        }
    });
}

module.exports = { registrar, dia, limpiarQ };
