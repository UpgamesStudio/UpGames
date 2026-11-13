/**
 * Tests del informe mensual: límites del mes, lista de meses y CSV (funciones puras de rutas/informes.js)
 */
'use strict';
const assert = require('assert');
const { aCSV, limitesMes, mesAnterior, listaMeses, nombreMes } = require('../rutas/informes');

let n = 0;
const test = (nombre, fn) => { fn(); n++; console.log('  ✓ ' + nombre); };
console.log('informes');

test('límites del mes en hora de Colombia', () => {
    const l = limitesMes('2026-02');
    assert.strictEqual(l.dias.length, 28);
    assert.strictEqual(l.dias[0], '2026-02-01'); assert.strictEqual(l.dias[27], '2026-02-28');
    assert.strictEqual(l.desde.toISOString(), '2026-02-01T05:00:00.000Z');   // medianoche de Bogotá
    assert.strictEqual(l.hasta.toISOString(), '2026-03-01T05:00:00.000Z');
    assert.strictEqual(limitesMes('2024-02').dias.length, 29);               // bisiesto
    assert.throws(() => limitesMes('2026-13')); assert.throws(() => limitesMes('26-1'));
});

test('mes anterior y lista de meses', () => {
    assert.strictEqual(mesAnterior('2026-01'), '2025-12');
    assert.strictEqual(mesAnterior('2026-11'), '2026-10');
    const l = listaMeses(3, Date.UTC(2026, 0, 1, 3));      // 1 de enero 03:00 UTC = aún 31 de diciembre en Colombia
    assert.deepStrictEqual(l.map(m => m.mes), ['2025-12', '2025-11', '2025-10']);
    assert.strictEqual(l[0].enCurso, true); assert.strictEqual(l[1].enCurso, false);
    assert.strictEqual(nombreMes('2026-03'), 'marzo de 2026');
});

const informe = (extra = {}) => ({
    mes: '2026-10', nombre: 'octubre de 2026', dias: ['2026-10-01', '2026-10-02'], enCurso: false, generado: Date.UTC(2026, 10, 1),
    resumen: [{ nombre: 'Visitantes', valor: 1500, anterior: 1000 }, { nombre: 'Cuentas nuevas', valor: 3, anterior: 0 }],
    porDia: [{ dia: '2026-10-01', visitantes: 700, nuevos: 100, busquedas: 5, fichas: 9, clicsDescarga: 2, anuncios: 30, cuentas: 1, publicaciones: 0, comentarios: 4, reportes: 0 }],
    topCreadores: [{ usuario: 'ana', anuncios: 20, vistas: 5, ganancia: 0.03 }],
    topPublicaciones: [{ titulo: 'Mod "Súper"; v2', usuario: 'ana', anuncios: 20 }],
    categorias: [{ categoria: 'Mod', n: 4 }], busquedas: [{ q: '=cmd|calc', n: 2 }], busquedasVacias: [], reportes: [],
    pagos: null, equipo: null, ...extra,
});

test('CSV: secciones, separador, comillas y cambio porcentual', () => {
    const csv = aCSV(informe());
    assert.ok(csv.startsWith('﻿UPGAMES · INFORME MENSUAL DE ACTIVIDAD'));
    assert.ok(csv.includes('Mes;octubre de 2026'));
    assert.ok(csv.includes('Visitantes;1500;1000;50'));
    assert.ok(csv.includes('Cuentas nuevas;3;0;\r\n'));               // sin mes anterior no hay porcentaje
    assert.ok(csv.includes('2026-10-01;700;100;5;9;2;30;1;0;4;0'));
    assert.ok(csv.includes('1;"Mod ""Súper""; v2";ana;20'));          // comillas y ; dentro de una celda
    assert.ok(csv.includes('1;ana;20;5;0,03'));                      // decimales con coma
    assert.ok(csv.includes('(sin datos)'));
});

test('CSV: una celda que parece fórmula no se ejecuta en Excel', () => {
    assert.ok(aCSV(informe()).includes("'=cmd|calc;2"));
});

test('CSV: pagos y equipo solo si vienen en el informe', () => {
    assert.ok(!aCSV(informe()).includes('PAGOS A CREADORES'));
    const csv = aCSV(informe({ pagos: { porEstado: [{ estado: 'completado', n: 2, monto: 40.5 }], detalle: [{ fecha: '2026-10-03 10:00', usuario: 'ana', monto: 20, metodo: 'paypal', estado: 'completado' }] },
        equipo: { porAdmin: [{ admin: 'luis', rol: 'revisor', n: 7 }], detalle: [{ fecha: '2026-10-03 11:00', admin: 'luis', accion: 'PUT /admin/items/1', objetivo: 'x', estado: 'Correcto' }] } }));
    assert.ok(csv.includes('completado;2;40,5'));
    assert.ok(csv.includes('luis;revisor;7'));
});

console.log(`\n${n} test(s) OK`);
