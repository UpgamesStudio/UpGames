// Entorno de reflejos «de circuito» para la pintura, los cristales y las llantas cuando no se
// fotografía el circuito real (calidad baja y media, garaje y visor): un cielo con degradado y sol,
// nubes, una línea de horizonte con arboleda, muro, gradas y edificios claros, y asfalto oscuro
// debajo. Lo que hace que un coche parezca de verdad es lo que se refleja en él: el costado
// recoge el suelo oscuro abajo y el cielo claro arriba, con el horizonte cruzando la carrocería.
import * as THREE from 'three';

const PALETAS = {
  dia: { cenit: 0x2a6fd6, horizonte: 0xcfe2f5, suelo: 0x2b2d30, sol: 0xfff2d8, fSol: 26, arbol: 0x1f3a1c, nube: 0xffffff, edificio: 0xe8eaee },
  atardecer: { cenit: 0x2b3f7a, horizonte: 0xffb070, suelo: 0x2a221e, sol: 0xff9a4a, fSol: 18, arbol: 0x1c1a14, nube: 0xffc6a0, edificio: 0xd9a888 },
  noche: { cenit: 0x03050c, horizonte: 0x101828, suelo: 0x0a0b0d, sol: 0xdfe8ff, fSol: 9, arbol: 0x05070a, nube: 0x1a2236, edificio: 0x2a3040 },
};

// el cielo es mucho más luminoso que cualquier pintura: es lo que da contraste a los reflejos
const BRILLO = { dia: 1.9, atardecer: 1.6, noche: 1 };
/** Escena con el entorno (para PMREMGenerator.fromScene). `sol`: dirección del sol (Vector3) o null. */
export function escenaEntorno(hora = 'dia', sol = null) {
  const p = PALETAS[hora] || PALETAS.dia, e = new THREE.Scene();
  const basico = (color, f = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(f), side: THREE.BackSide, fog: false });
  // cúpula con degradado por vértices: horizonte claro, cenit más oscuro y saturado
  const cup = new THREE.SphereGeometry(500, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const cC = new THREE.Color(p.cenit), cH = new THREE.Color(p.horizonte), col = [], P = cup.attributes.position, c = new THREE.Color();
  for (let i = 0; i < P.count; i++) { const t = Math.pow(Math.max(0, P.getY(i) / 500), 0.55); c.copy(cH).lerp(cC, t).multiplyScalar(BRILLO[hora] ?? 2.4); col.push(c.r, c.g, c.b); }
  cup.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  e.add(new THREE.Mesh(cup, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false })));
  // suelo: asfalto oscuro cerca, algo más claro hacia el horizonte (bruma)
  const sue = new THREE.CircleGeometry(500, 32, 0, Math.PI * 2).rotateX(-Math.PI / 2);
  const cs = [], S = sue.attributes.position, cS = new THREE.Color(p.suelo), cB = new THREE.Color(p.suelo).lerp(cH, 0.35);
  for (let i = 0; i < S.count; i++) { const t = Math.min(1, Math.hypot(S.getX(i), S.getZ(i)) / 500); c.copy(cS).lerp(cB, t * t); cs.push(c.r, c.g, c.b); }
  sue.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3));
  const suelo = new THREE.Mesh(sue, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false })); suelo.position.y = -1.2; e.add(suelo);
  // horizonte: arboleda irregular, muro claro con franja y gradas / edificios aquí y allá
  let s = 97531; const rnd = () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x6D2B79F5 >>> 0) / 4294967296);
  const caja = (ang, dist, ancho, alto, mat, y = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, 2), mat); m.position.set(Math.cos(ang) * dist, y + alto / 2 - 1.2, Math.sin(ang) * dist); m.lookAt(0, m.position.y, 0); e.add(m); };
  const mArbol = new THREE.MeshBasicMaterial({ color: p.arbol, fog: false }), mMuro = new THREE.MeshBasicMaterial({ color: new THREE.Color(p.edificio).multiplyScalar(0.85), fog: false });
  const mEdif = new THREE.MeshBasicMaterial({ color: p.edificio, fog: false }), mGrada = new THREE.MeshBasicMaterial({ color: new THREE.Color(p.edificio).lerp(new THREE.Color(0x2a3a55), 0.6), fog: false });
  const mRojo = new THREE.MeshBasicMaterial({ color: hora === 'noche' ? 0x30080a : 0xc8202a, fog: false });
  for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2 + rnd() * 0.05; caja(a, 190, 28, 14 + rnd() * 16, mArbol); }
  for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; caja(a, 60, 16.5, 1.1, mMuro); if (k % 3 === 0) caja(a, 59.5, 16.5, 0.35, mRojo, 1.1); }
  for (let k = 0; k < 7; k++) { const a = rnd() * Math.PI * 2; caja(a, 110 + rnd() * 40, 30 + rnd() * 40, 10 + rnd() * 14, k % 2 ? mEdif : mGrada); }
  // de noche: torres de focos (lo que brilla en la carrocería en un GP nocturno)
  if (hora === 'noche') { const mFoco = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xeaf0ff).multiplyScalar(30), fog: false });
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2 + 0.2; const m = new THREE.Mesh(new THREE.BoxGeometry(7, 3, 1), mFoco); m.position.set(Math.cos(a) * 85, 34, Math.sin(a) * 85); m.lookAt(0, 0, 0); e.add(m); } }
  // nubes: manchas blandas y anchas a media altura
  if (hora !== 'noche') { const mNube = new THREE.MeshBasicMaterial({ color: new THREE.Color(p.nube).multiplyScalar(1.5), fog: false, transparent: true, opacity: 0.85 });
    for (let k = 0; k < 14; k++) { const a = rnd() * Math.PI * 2, el = 0.25 + rnd() * 0.75, d = 420;
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), mNube); m.scale.set(60 + rnd() * 70, 10 + rnd() * 10, 30 + rnd() * 30);
      m.position.set(Math.cos(a) * Math.cos(el) * d, Math.sin(el) * d, Math.sin(a) * Math.cos(el) * d); m.lookAt(0, 0, 0); e.add(m); } }
  // sol (o luna): un disco muy brillante; da el destello vivo en el barniz
  const dir = (sol ? sol.clone() : new THREE.Vector3(0.45, 0.62, 0.35)).normalize(); if (dir.y < 0.08) { dir.y = 0.08; dir.normalize(); }
  const disco = new THREE.Mesh(new THREE.CircleGeometry(hora === 'noche' ? 12 : 22, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(p.sol).multiplyScalar(p.fSol), fog: false, side: THREE.DoubleSide }));
  disco.position.copy(dir).multiplyScalar(450); disco.lookAt(0, 0, 0); e.add(disco);
  return e;
}

/** Entorno prefiltrado listo para scene.environment. */
export function crearEntorno(renderer, hora = 'dia', sol = null) {
  const pm = new THREE.PMREMGenerator(renderer), esc = escenaEntorno(hora, sol);
  const tex = pm.fromScene(esc, 0.015, 0.5, 1200).texture;
  pm.dispose();
  esc.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.(); });
  return tex;
}
