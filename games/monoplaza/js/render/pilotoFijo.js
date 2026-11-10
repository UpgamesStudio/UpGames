// Piloto integrado en el coche: solo lo que se ve (casco, pecho y manos), sin esqueleto ni
// animación de brazos. Son tres mallas en total: el busto con el mono, el casco (la visera va
// pintada en su textura) y los guantes, que van sujetos al volante y giran con él.
// Tiene la misma interfaz que el piloto articulado de antes (render/piloto.js) para el resto del
// juego: cámaras, repetición y nivel de detalle.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { texturaCasco } from './librea.js';

const texturas = new Map();
/** Textura del casco con la visera pintada (el frente del casco cae en la costura u = 0). */
function texturaCascoVisera(diseno, colores) {
  const clave = `${diseno}|${colores.base}|${colores.acento}`;
  if (texturas.has(clave)) return texturas.get(clave);
  const base = texturaCasco(diseno, colores).image, W = 512, H = 256;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  x.drawImage(base, 0, 0, W, H);
  // visera: banda oscura con reflejo, a caballo de la costura
  for (const x0 of [-0.15 * W, 0.85 * W]) {
    const g = x.createLinearGradient(0, 0.40 * H, 0, 0.56 * H);
    g.addColorStop(0, '#2a3a52'); g.addColorStop(0.35, '#0b0e15'); g.addColorStop(1, '#05060a');
    x.fillStyle = '#07080b'; x.beginPath(); x.roundRect?.(x0 - 4, 0.375 * H, 0.30 * W + 8, 0.215 * H, 0.05 * H); if (!x.roundRect) x.rect(x0 - 4, 0.375 * H, 0.30 * W + 8, 0.215 * H); x.fill();
    x.fillStyle = g; x.beginPath(); x.roundRect?.(x0, 0.39 * H, 0.30 * W, 0.185 * H, 0.04 * H); if (!x.roundRect) x.rect(x0, 0.39 * H, 0.30 * W, 0.185 * H); x.fill();
    x.fillStyle = 'rgba(190,215,255,.35)'; x.fillRect(x0 + 0.03 * W, 0.405 * H, 0.24 * W, 0.012 * H);
  }
  // borde inferior de goma y toma de aire de arriba
  x.fillStyle = '#0a0b0e'; x.fillRect(0, 0.80 * H, W, 0.20 * H);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  texturas.set(clave, t);
  return t;
}

const geos = {};
function geoCasco(alta) {
  const k = alta ? 'cascoA' : 'cascoB';
  if (geos[k]) return geos[k];
  const g = new THREE.SphereGeometry(0.135, alta ? 32 : 18, alta ? 22 : 12), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    x *= 1.12; z *= 0.92;
    if (y < -0.02 && x > 0) x += (-0.02 - y) * 0.55;          // mentonera
    if (y < -0.07) y = -0.07 - (-0.07 - y) * 0.6;
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals(); g.rotateY(Math.PI);
  return (geos[k] = g);
}
function geoBusto(alta) {
  const k = alta ? 'bustoA' : 'bustoB';
  if (geos[k]) return geos[k];
  const s = alta ? 16 : 10, partes = [];
  const torso = new THREE.CapsuleGeometry(0.105, 0.16, 5, s); torso.rotateX(Math.PI / 2); torso.scale(1, 1.15, 0.86); torso.translate(0, 0.632, 0); partes.push(torso);
  const pecho = new THREE.SphereGeometry(0.13, s, 10); pecho.scale(0.95, 0.9, 1.45); pecho.translate(0.03, 0.62, 0); partes.push(pecho);
  const cuello = new THREE.CylinderGeometry(0.058, 0.07, 0.07, s, 1, true); cuello.translate(0.04, 0.705, 0); partes.push(cuello);
  for (const l of [-1, 1]) {
    const hombro = new THREE.SphereGeometry(0.062, s, 8); hombro.translate(0.05, 0.665, l * 0.165); partes.push(hombro);
    // brazo hacia el volante (casi todo queda bajo el borde de la cabina)
    const brazo = new THREE.CapsuleGeometry(0.042, 0.24, 3, s); brazo.rotateZ(Math.PI / 2 - 0.28); brazo.rotateY(l * 0.12); brazo.translate(0.20, 0.625, l * 0.16); partes.push(brazo);
  }
  return (geos[k] = mergeGeometries(partes.map(g => g.toNonIndexed()), false));
}
function geoManos() {
  if (geos.manos) return geos.manos;
  const partes = [];
  for (const l of [-1, 1]) {
    // guante cerrado sobre la empuñadura y la muñeca hacia el piloto
    const mano = new THREE.CapsuleGeometry(0.03, 0.06, 3, 10); mano.scale(1.25, 1, 1.05); mano.translate(-0.014, -0.004, l * 0.129); partes.push(mano);
    const muneca = new THREE.CapsuleGeometry(0.027, 0.09, 3, 10); muneca.rotateZ(Math.PI / 2); muneca.rotateY(-l * 0.25); muneca.translate(-0.085, -0.012, l * 0.145); partes.push(muneca);
  }
  return (geos.manos = mergeGeometries(partes.map(g => g.toNonIndexed()), false));
}

/**
 * Crea el piloto fijo. traje y guante: materiales · giroVolante: grupo del volante (lleva las manos).
 */
export function crearPiloto({ traje, guante, equipado = {}, colores = {}, giroVolante, calidad = 1 }) {
  const grupo = new THREE.Group(); grupo.name = 'piloto';
  const alta = calidad >= 2;
  grupo.add(new THREE.Mesh(geoBusto(alta), traje));
  const cuello = new THREE.Group(); cuello.position.set(0.04, 0.72, 0);
  const matCasco = new THREE.MeshPhysicalMaterial({ map: texturaCascoVisera(equipado.casco || 'clasico', equipado.cascoColores || { base: colores.tercero || '#ffffff', acento: colores.base || '#0d47ff' }), roughness: 0.2, metalness: 0.1, clearcoat: alta ? 1 : 0, clearcoatRoughness: 0.06 });
  const cabeza = new THREE.Mesh(geoCasco(alta), matCasco); cabeza.position.set(0.04, 0.085, 0);
  cuello.add(cabeza); grupo.add(cuello);
  const manos = new THREE.Mesh(geoManos(), guante); manos.name = 'manos';
  giroVolante?.add(manos);
  return {
    grupo, cuello, casco: cabeza, manos,
    cabezaG: { x: 0, vx: 0, z: 0, vz: 0 }, mirada: 0, glb: null,
    /** La cámara de cabina va dentro del casco: ahí el casco no se dibuja. */
    verCabeza(si) { cabeza.visible = si; },
    usarGLB() {}, saludar() {}, pulsar() {},
    /** Devuelve el ángulo del volante (rad); la cabeza mira hacia dentro de la curva. */
    actualizar(car, dt) {
      const ang = (car.anguloVolante || 0) * 9;
      const vib = (car.enBordillo ? Math.min(1, (car.velocidad || 0) / 35) : 0) + Math.min(0.6, car.vibracion || 0);
      const tv = performance.now() / 1000;
      this.mirada += (Math.max(-0.45, Math.min(0.45, ang * 0.16)) - this.mirada) * Math.min(1, dt * 6);
      cuello.rotation.y = this.mirada;
      return ang + (vib > 0.02 ? (Math.sin(tv * 57) * 0.6 + Math.sin(tv * 83 + 1) * 0.4) * 0.045 * vib : 0);
    },
  };
}
