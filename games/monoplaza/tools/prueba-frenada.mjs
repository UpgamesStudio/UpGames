// Prueba de frenada: lanza el coche en recta, frena a fondo girando un poco y mide cuánto se cruza.
// Uso: node tools/prueba-frenada.mjs [f1|gt|stock]
import { aplicarCategoria } from '../js/config.js';
aplicarCategoria(process.argv[2] || 'gt');
const { Circuito } = await import('../js/track.js');
const { Monoplaza } = await import('../js/physics/monoplaza.js');
const c = new Circuito(process.env.CIRCUITO || 'valle');
for (const [nombre, ayudas] of [['con asistencia', { tc: 1, abs: true, frenada: true }], ['sin asistencia', { tc: 1, abs: true, frenada: false }], ['sin ABS ni asistencia', { tc: 0, abs: false, frenada: false }]]) {
  const car = new Monoplaza(c, { ayudas: { ...ayudas, cambioAuto: true, direccion: true } });
  car.colocar(c.largo - 20, 0);
  const dt = 1 / 300; let t = 0, betaMax = 0, dist = 0, v0 = 0, fase = 0;
  while (t < 40) {
    if (fase === 0) { car.mandos.acelerador = 1; car.mandos.freno = 0; car.mandos.direccion = 0; if (car.velocidad > 55 || t > 25) { fase = 1; v0 = car.velocidad; } }
    else { car.mandos.acelerador = 0; car.mandos.freno = 1; car.mandos.direccion = 0.25; dist += car.velocidad * dt; betaMax = Math.max(betaMax, Math.abs(Math.atan2(car.vy, Math.max(3, car.vx)))); if (car.velocidad < 8) break; }
    car.paso(dt); t += dt;
  }
  console.log(`${nombre}: de ${(v0 * 3.6).toFixed(0)} a 29 km/h en ${dist.toFixed(0)} m · deriva máxima ${(betaMax * 57.3).toFixed(1)}°`);
}
