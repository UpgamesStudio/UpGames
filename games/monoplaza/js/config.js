// Parámetros del monoplaza, compuestos y equipos.
// Unidades SI: metros, kilogramos, segundos, newtons, radianes.

export const G = 9.81;
export const RHO_AIRE = 1.2;

export const COCHE = {
  masaSeca: 768,            // coche + piloto, sin combustible
  wheelbase: 3.60,
  viaDel: 1.60,
  viaTras: 1.55,
  repartoDel: 0.455,        // fracción del peso estático sobre el eje delantero
  alturaCG: 0.29,
  centroBalanceoDel: 0.04,
  centroBalanceoTras: 0.09,
  inerciaYaw: 1150,         // kg·m²
  // Ruedas
  radioDel: 0.36,
  radioTras: 0.365,
  inerciaRueda: 1.2,
  // Dirección
  angMaxRueda: 0.33,        // ángulo máximo de la rueda delantera (rad)
  ackermann: 0.08,
  // Suspensión (para transferencias dinámicas y alturas)
  rigidezBalanceoTotal: 220000, // N·m/rad
  rigidezCabeceo: 300000,
  muelleDel: 240000,        // N/m equivalente en rueda (por eje)
  muelleTras: 190000,
  alturaLibreDel: 0.032,    // m, estática
  alturaLibreTras: 0.075,
  // Aerodinámica (valores base, el reglaje los modifica)
  areaFrontal: 1.5,
  // Motor
  rpmRalenti: 4000,
  rpmLimite: 15000,
  rpmEmbrague: 6500,
  inerciaMotor: 0.09,
  // curva de par del motor térmico (rpm, N·m)
  curvaPar: [
    [3000, 220], [4000, 270], [6000, 340], [8000, 400], [10000, 440],
    [11000, 455], [12000, 448], [13000, 425], [14000, 392], [15000, 352], [15500, 0],
  ],
  frenoMotor: [30, 0.0042],  // N·m = a + b·rpm
  eficiencia: 0.92,
  relaciones: [19.6, 15.2, 12.2, 10.2, 8.75, 7.55, 6.5, 5.55],
  relacionReversa: -16,
  tiempoCambioSubir: 0.035,
  tiempoCambioBajar: 0.06,
  // ERS (MGU-K)
  ersPotencia: 120000,       // W
  ersParMax: 200,            // N·m en el cigüeñal
  ersCapacidad: 4.0e6,       // J
  ersDespliegueVuelta: 4.0e6,
  ersRecuperacionVuelta: 2.0e6,
  // Combustible
  consumoMax: 100 / 3600,    // kg/s a plena carga
  // Frenos
  parFrenoMax: 13200,        // N·m sumando las cuatro ruedas
  frenoTempOpt: [350, 1000], // °C ventana del carbono
  // Rozamiento de rodadura
  rodadura: 0.012,
};

// ─── Categorías ─────────────────────────────────────────────────────────────────────────────
// Todas comparten la física (neumáticos, transferencias, daños); cambian el coche. Para no
// tocar el resto del juego, el motor trabaja siempre en la escala de rpm del F1 (4.000-15.000)
// y cada categoría trae su factor para mostrarlas y para el sonido (rpmReal).
// CAT es la categoría activa: aplicarCategoria() la cambia ANTES de crear el circuito y los coches.
const COCHE_F1 = JSON.parse(JSON.stringify(COCHE));
export const CATEGORIAS = {
  f1: {
    id: 'f1', nombre: 'Fórmula', corto: 'F1', desc: 'Monoplaza de 1.000 CV con efecto suelo, DRS y ERS.',
    coche: {}, cl: 1, cd: 1, mu: 1, rebufo: 1.05, sucio: 1.3, drs: true, ers: true, rpmReal: 1, radio: 1, tono: 1, brillo: 1,
    perfil: { mu: 1.55, clA: 4.6, cdA: 1.07, P: 640000, vmax: 97 },
  },
  gt: {
    id: 'gt', nombre: 'GT', corto: 'GT', desc: 'Gran turismo de 550 CV: carrocería cerrada, más peso, menos carga y roces sin miedo.',
    coche: {
      masaSeca: 1300, wheelbase: 2.70, viaDel: 1.62, viaTras: 1.60, repartoDel: 0.46, alturaCG: 0.42,
      centroBalanceoDel: 0.06, centroBalanceoTras: 0.11, inerciaYaw: 2050, radioDel: 0.345, radioTras: 0.35, inerciaRueda: 1.6,
      angMaxRueda: 0.42, rigidezBalanceoTotal: 140000, rigidezCabeceo: 190000, muelleDel: 160000, muelleTras: 150000,
      alturaLibreDel: 0.055, alturaLibreTras: 0.07, areaFrontal: 2.0,
      curvaPar: COCHE_F1.curvaPar.map(([r, t]) => [r, Math.round(t * 0.74)]),
      relaciones: [22.6, 16.6, 13.0, 10.5, 8.6, 7.07], relacionReversa: -18, tiempoCambioSubir: 0.06, tiempoCambioBajar: 0.09,
      ersPotencia: 0, parFrenoMax: 11500, consumoMax: 90 / 3600,
    },
    cl: 0.30, cd: 0.86, mu: 0.86, rebufo: 1.4, sucio: 0.5, susp: { kc: 330, cc: 14, kb: 250, cb: 11.5, gan: 1.5, peso: 0.55 }, drs: false, ers: false, rpmReal: 0.55, radio: 0.96, tono: 0.72, brillo: 0.8,
    perfil: { mu: 1.30, clA: 1.4, cdA: 0.92, P: 390000, vmax: 82 },
  },
  stock: {
    id: 'stock', nombre: 'Stock Car', corto: 'STOCK', desc: 'Berlina de 670 CV para óvalos: mucho rebufo, pelotones a tres en fondo y aire sucio.',
    coche: {
      masaSeca: 1550, wheelbase: 2.79, viaDel: 1.66, viaTras: 1.64, repartoDel: 0.52, alturaCG: 0.45,
      centroBalanceoDel: 0.07, centroBalanceoTras: 0.12, inerciaYaw: 2500, radioDel: 0.355, radioTras: 0.355, inerciaRueda: 1.8,
      angMaxRueda: 0.40, rigidezBalanceoTotal: 120000, rigidezCabeceo: 170000, muelleDel: 150000, muelleTras: 140000,
      alturaLibreDel: 0.06, alturaLibreTras: 0.08, areaFrontal: 2.3,
      curvaPar: COCHE_F1.curvaPar.map(([r, t]) => [r, Math.round(t * 0.95)]),
      relaciones: [15.5, 11.0, 8.2, 5.6], relacionReversa: -16, tiempoCambioSubir: 0.08, tiempoCambioBajar: 0.11,
      ersPotencia: 0, parFrenoMax: 10500, consumoMax: 110 / 3600,
    },
    cl: 0.21, cd: 0.90, mu: 0.80, rebufo: 1.45, sucio: 0.9, susp: { kc: 260, cc: 11.5, kb: 200, cb: 9.5, gan: 1.7, peso: 0.45 }, drs: false, ers: false, rpmReal: 0.62, radio: 1, tono: 0.66, brillo: 0.7,
    perfil: { mu: 1.14, clA: 0.95, cdA: 0.95, P: 500000, vmax: 101 },
  },
};
export const CAT = { ...CATEGORIAS.f1 };
export const categoriaOk = (id) => (CATEGORIAS[id] ? id : 'f1');
/** Cambia la categoría activa (coche, aerodinámica y agarre). Devuelve la categoría. */
export function aplicarCategoria(id) {
  const c = CATEGORIAS[categoriaOk(id)];
  for (const k of Object.keys(COCHE)) delete COCHE[k];
  Object.assign(COCHE, JSON.parse(JSON.stringify(COCHE_F1)), JSON.parse(JSON.stringify(c.coche)));
  for (const k of Object.keys(CAT)) delete CAT[k];
  Object.assign(CAT, c);
  return CAT;
}

// Reglaje por defecto (valores enteros como en un simulador)
export const REGLAJE_DEF = {
  aleronDel: 6,      // 1..11
  aleronTras: 6,     // 1..11
  repartoFreno: 57,  // % delante, 50..65
  difTraccion: 60,   // % bloqueo en aceleración, 20..100
  difRetencion: 45,  // % bloqueo en retención, 20..100
  barraDel: 6,       // 1..11
  barraTras: 5,      // 1..11
  alturaDel: 3,      // 1..10 (mm extra sobre la mínima / 3)
  alturaTras: 5,
  presion: 5,        // 1..10 (afecta calentamiento, agarre y desgaste)
  compuesto: 'blando',
};

// Neumáticos: agarre base, ventana térmica, desgaste
export const COMPUESTOS = {
  blando: { nombre: 'Blando', color: '#e8202a', mu: 1.80, tOpt: 88, ancho: 28, calor: 1.15, desgaste: 1.6 },
  medio:  { nombre: 'Medio',  color: '#f5c518', mu: 1.75, tOpt: 93, ancho: 30, calor: 1.0,  desgaste: 1.0 },
  duro:   { nombre: 'Duro',   color: '#f2f2f2', mu: 1.70, tOpt: 100, ancho: 32, calor: 0.85, desgaste: 0.6 },
  // de lluvia: más dibujo evacua agua, pero en seco se recalientan y se destrozan
  inter:  { nombre: 'Intermedio', color: '#2fbf4a', mu: 1.60, tOpt: 64, ancho: 32, calor: 1.25, desgaste: 1.4, lluvia: true },
  lluvia: { nombre: 'Lluvia', color: '#1f6fff', mu: 1.50, tOpt: 52, ancho: 34, calor: 1.4, desgaste: 1.6, lluvia: true },
};
export const SECOS = ['blando', 'medio', 'duro'];

// Agarre relativo según el agua en la pista (0 seco .. 1 encharcada), por tipo de neumático
const TABLA_AGUA = {
  slick:  [1.00, 0.74, 0.55, 0.45, 0.38],
  inter:  [1.00, 0.97, 0.88, 0.72, 0.60],
  lluvia: [1.00, 1.00, 0.97, 0.90, 0.83],
};
export function factorAgua(compuesto, agua) {
  if (!(agua > 0)) return 1;
  const t = TABLA_AGUA[compuesto.lluvia ? (compuesto.nombre === 'Lluvia' ? 'lluvia' : 'inter') : 'slick'];
  const f = Math.min(1, agua) * 4, i = Math.min(3, Math.floor(f));
  return t[i] + (t[i + 1] - t[i]) * (f - i);
}
/** Mejor neumático para el agua que hay (lo que haría un ingeniero). */
export function compuestoParaAgua(agua, seco = 'medio') {
  return agua > 0.48 ? 'lluvia' : agua > 0.13 ? 'inter' : seco;
}

// Equipos ficticios: 11 escuderías con dos pilotos (22 coches como en la parrilla real)
export const EQUIPOS = [
  { nombre: 'UpGames Racing', corto: 'UPG', base: '#0d47ff', acento: '#00e5ff', tercero: '#ffffff', pilotos: ['A. Volt', 'R. Nova'], patron: 'flecha' },
  { nombre: 'Rosso Vulcano', corto: 'RSV', base: '#c4061a', acento: '#ffd200', tercero: '#111111', pilotos: ['L. Moretti', 'A. Ferrandi'], patron: 'franjas' },
  { nombre: 'Silver Arrowhead', corto: 'SAH', base: '#b9c2c9', acento: '#00b3a4', tercero: '#111111', pilotos: ['K. Brandt', 'J. Weller'], patron: 'degradado' },
  { nombre: 'Nightbull', corto: 'NBL', base: '#14204a', acento: '#e3001b', tercero: '#ffd200', pilotos: ['M. Varga', 'T. Okafor'], patron: 'rayo' },
  { nombre: 'Papaya Speed', corto: 'PAP', base: '#ff7a00', acento: '#1c8dff', tercero: '#111111', pilotos: ['O. Reyes', 'N. Harlow'], patron: 'geometrico' },
  { nombre: 'Verde Andino', corto: 'VAN', base: '#0b6b4f', acento: '#c8ff00', tercero: '#ffffff', pilotos: ['S. Quintero', 'D. Arango'], patron: 'franjas' },
  { nombre: 'Alpine Blue', corto: 'ALB', base: '#1060d0', acento: '#ff4fa3', tercero: '#ffffff', pilotos: ['P. Dubois', 'E. Marchand'], patron: 'degradado' },
  { nombre: 'Kraken GP', corto: 'KRK', base: '#1b1b1f', acento: '#ff3df5', tercero: '#00e5ff', pilotos: ['H. Sato', 'Y. Mori'], patron: 'digital' },
  { nombre: 'Halcón Dorado', corto: 'HDO', base: '#f2f2f2', acento: '#c9a227', tercero: '#111111', pilotos: ['F. Salgado', 'C. Ibarra'], patron: 'flecha' },
  { nombre: 'Polar Racing', corto: 'POL', base: '#e8f4ff', acento: '#0057b8', tercero: '#ff3b3b', pilotos: ['A. Lindqvist', 'M. Koskinen'], patron: 'geometrico' },
  { nombre: 'Tormenta Roja', corto: 'TRJ', base: '#5a0b1e', acento: '#ff5a1f', tercero: '#ffffff', pilotos: ['V. Petrov', 'G. Rinaldi'], patron: 'llamas' },
];

// Efecto de cada nivel de mejora comprada con UpCoins (niveles 0..5). Los mismos
// nombres que modulos/apexgp.js en el servidor.
export const MEJORAS_INFO = {
  motor: 'Motor', aero: 'Aerodinámica', frenos: 'Frenos', chasis: 'Chasis ligero', neumaticos: 'Neumáticos', ers: 'ERS',
};
export function efectosMejoras(m = {}) {
  const n = (k) => Math.max(0, Math.min(5, Math.floor(m?.[k] || 0)));
  return {
    potencia: 1 + 0.012 * n('motor'),
    cl: 1 + 0.01 * n('aero'), cd: 1 - 0.006 * n('aero'),
    freno: 1 + 0.03 * n('frenos'), refrigeracion: 1 + 0.1 * n('frenos'),
    kg: 3 * n('chasis'),
    desgaste: 1 - 0.06 * n('neumaticos'), mu: 1 + 0.004 * n('neumaticos'),
    ers: 1 + 0.05 * n('ers'), recuperacion: 1 + 0.04 * n('ers'),
  };
}
