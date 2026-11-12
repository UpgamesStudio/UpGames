// Lluvia: gotas en trazos alrededor de la cámara, salpicaduras en el asfalto, cielo cubierto,
// asfalto mojado que brilla y niebla más cerrada. Todo escala con la intensidad (0..1).
//
// Las gotas las mueve la GPU: cada una es un rectángulo instanciado cuya posición sale de una
// semilla y del reloj en el sombreador de vértices (la CPU no toca ni un vértice por fotograma;
// antes se reescribían y subían 30.000 números cada vez). Caen en el mundo, no pegadas a la
// cámara: al correr se ven venir de frente y el trazo se alarga con la velocidad, como en la tele.

import * as THREE from 'three';

const CAJA = new THREE.Vector3(56, 30, 56);       // volumen de lluvia alrededor de la cámara (m)

const VERT_GOTAS = `
  attribute vec4 semilla;
  uniform vec3 uCam, uDesp, uCaja, uVelRel;
  uniform float uLargo, uAncho;
  varying vec2 vUv; varying float vAlfa;
  void main() {
    // posición de la gota en el mundo, repetida en una caja centrada en la cámara
    vec3 celda = fract(semilla.xyz + uDesp - uCam / uCaja);
    vec3 p = uCam + (celda - 0.5) * uCaja;
    vec3 dir = normalize(uVelRel);
    vec3 aCam = p - uCam; float d = length(aCam);
    vec3 lado = normalize(cross(dir, aCam));
    float largo = uLargo * (0.7 + 0.6 * semilla.w);
    p += dir * (-largo * position.y) + lado * position.x * uAncho * (0.6 + 0.8 * semilla.w) * (1.0 + d * 0.035);
    vUv = position.xy;
    // se desvanecen en los bordes de la caja y pegadas a la lente
    vec3 b = abs(celda - 0.5) * 2.0;
    vAlfa = (1.0 - smoothstep(0.75, 1.0, max(b.x, max(b.y, b.z)))) * smoothstep(0.6, 2.5, d) * (0.55 + 0.45 * semilla.w);
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }`;
const FRAG_GOTAS = `
  uniform vec3 uColor; uniform float uOpacidad;
  varying vec2 vUv; varying float vAlfa;
  void main() {
    // trazo fino: más brillante por el centro y por la cabeza, cola que se apaga
    float a = (1.0 - abs(vUv.x)) * (1.0 - vUv.y * 0.8) * smoothstep(0.0, 0.08, vUv.y);
    gl_FragColor = vec4(uColor, a * vAlfa * uOpacidad);
  }`;

// salpicaduras: cada gota que llega al asfalto abre una corona que crece y se apaga
const VERT_SALP = `
  attribute vec4 semilla;
  uniform vec3 uCentro; uniform vec2 uPend; uniform float uT, uArea;
  varying vec2 vUv; varying float vVida;
  void main() {
    float vida = fract(semilla.w + uT * (1.6 + semilla.z * 1.2));
    float ciclo = floor(semilla.w + uT * (1.6 + semilla.z * 1.2));
    // cada ciclo cae en otro sitio
    vec2 h = fract(semilla.xy + ciclo * vec2(0.6180339, 0.7548776));
    vec2 celda = fract(h - uCentro.xz / uArea);
    vec2 xz = uCentro.xz + (celda - 0.5) * uArea;
    float y = uCentro.y + dot(xz - uCentro.xz, uPend) + 0.03;
    float r = (0.03 + 0.16 * vida) * (0.7 + 0.6 * semilla.z);
    vec3 p = vec3(xz.x + position.x * r, y, xz.y + position.y * r);
    vUv = position.xy; vVida = vida;
    vec2 b = abs(celda - 0.5) * 2.0;
    vVida += smoothstep(0.7, 1.0, max(b.x, b.y));        // fuera del área: apagada
    gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
  }`;
const FRAG_SALP = `
  uniform vec3 uColor; uniform float uOpacidad;
  varying vec2 vUv; varying float vVida;
  void main() {
    float d = length(vUv);
    float aro = smoothstep(0.55, 0.8, d) * (1.0 - smoothstep(0.85, 1.0, d)) + (1.0 - smoothstep(0.0, 0.25, d)) * (1.0 - vVida) * 0.6;
    float a = aro * clamp(1.0 - vVida, 0.0, 1.0);
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a * uOpacidad);
  }`;

function instancias(n, plano) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(plano, 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const sem = new Float32Array(n * 4);
  for (let i = 0; i < sem.length; i++) sem[i] = Math.random();
  g.setAttribute('semilla', new THREE.InstancedBufferAttribute(sem, 4));
  g.instanceCount = n;
  return g;
}

export class Lluvia {
  constructor(scene, escenario, calidad) {
    this.esc = escenario;
    this.n = calidad >= 2 ? 9000 : calidad >= 1 ? 5200 : 2600;
    this.uG = {
      uCam: { value: new THREE.Vector3() }, uDesp: { value: new THREE.Vector3() }, uCaja: { value: CAJA },
      uVelRel: { value: new THREE.Vector3(0, -1, 0) }, uLargo: { value: 0.6 }, uAncho: { value: 0.012 },
      uColor: { value: new THREE.Color(0xc4d2e2) }, uOpacidad: { value: 0 },
    };
    this.mat = new THREE.ShaderMaterial({ uniforms: this.uG, vertexShader: VERT_GOTAS, fragmentShader: FRAG_GOTAS, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
    // rectángulo: x de -1 a 1 (ancho), y de 0 (cabeza) a 1 (cola)
    this.lineas = new THREE.Mesh(instancias(this.n, [-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0]), this.mat);
    this.lineas.frustumCulled = false; this.lineas.renderOrder = 5; this.lineas.visible = false;
    scene.add(this.lineas);
    // salpicaduras en el suelo (calidad media en adelante)
    this.salp = null;
    if (calidad >= 1) {
      this.nS = calidad >= 2 ? 1400 : 700;
      this.uS = { uCentro: { value: new THREE.Vector3() }, uPend: { value: new THREE.Vector2() }, uT: { value: 0 }, uArea: { value: 44 }, uColor: { value: new THREE.Color(0xd4dee8) }, uOpacidad: { value: 0 } };
      this.matS = new THREE.ShaderMaterial({ uniforms: this.uS, vertexShader: VERT_SALP, fragmentShader: FRAG_SALP, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
      this.salp = new THREE.Mesh(instancias(this.nS, [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), this.matS);
      this.salp.frustumCulled = false; this.salp.renderOrder = 4; this.salp.visible = false;
      scene.add(this.salp);
    }
    this.scene = scene;
    this.t = 0;
    this.desp = new THREE.Vector3();            // camino recorrido por la lluvia (en cajas)
    this.camAnt = null; this.velCam = new THREE.Vector3();
    this.viento = new THREE.Vector3();
    // valores de seco para volver a ellos
    this.fogColor = scene.fog.color.clone();
    this.fogFar = scene.fog.far;
    this.sol = escenario.luzSol.intensity;
    this.exp = null;
    const m = escenario.matAsfalto;
    this.asf = m ? { rough: m.roughness, color: m.color.clone(), env: m.envMapIntensity ?? 1 } : null;
    this.intensidad = -1;
    this._colNiebla = new THREE.Color();
  }

  forzar() { this.intensidad = -1; }

  /** suelo: { x, y, z, px, pz } punto del asfalto junto al coche y su pendiente (para las salpicaduras);
   *  viento: { x, z } en m/s. */
  actualizar(dt, camPos, lluvia, agua, renderer, sombraNubes = 0, suelo = null, viento = null) {
    this.t += dt;
    const on = lluvia > 0.02;
    this.lineas.visible = on;
    if (this.salp) this.salp.visible = on && !!suelo;
    if (on) {
      // velocidad de la cámara (suavizada; un corte de plano no cuenta)
      if (this.camAnt && dt > 0) {
        const dx = camPos.x - this.camAnt.x, dy = camPos.y - this.camAnt.y, dz = camPos.z - this.camAnt.z;
        if (dx * dx + dy * dy + dz * dz < 25 * 25) { const k = Math.min(1, dt * 6); this.velCam.x += (dx / dt - this.velCam.x) * k; this.velCam.y += (dy / dt - this.velCam.y) * k; this.velCam.z += (dz / dt - this.velCam.z) * k; }
        else this.velCam.set(0, 0, 0);
      }
      (this.camAnt ||= new THREE.Vector3()).copy(camPos);
      // la lluvia cae a ~9-13 m/s (más fuerte, gota más gorda y rápida) y el viento la tumba
      if (viento) this.viento.set(viento.x || 0, 0, viento.z || 0); 
      const caida = 9 + 4.5 * lluvia;
      const vx = this.viento.x * 0.8 + 0.6, vz = this.viento.z * 0.8 + 0.4;
      this.desp.x = (this.desp.x + vx * dt / CAJA.x) % 1; this.desp.y = (this.desp.y - caida * dt / CAJA.y) % 1; this.desp.z = (this.desp.z + vz * dt / CAJA.z) % 1;
      const u = this.uG;
      u.uCam.value.copy(camPos); u.uDesp.value.copy(this.desp);
      // trazo: lo que recorre la gota respecto a la cámara durante la exposición (~1/45 s)
      u.uVelRel.value.set(vx - this.velCam.x, -caida - this.velCam.y, vz - this.velCam.z);
      const vRel = u.uVelRel.value.length();
      u.uLargo.value = Math.min(3.2, Math.max(0.28, vRel / 45));
      u.uAncho.value = 0.007 + 0.006 * lluvia;
      u.uOpacidad.value = 0.22 + lluvia * 0.4;
      this.lineas.geometry.instanceCount = Math.round(this.n * (0.3 + 0.7 * Math.min(1, lluvia * 1.25)));
      if (this.salp?.visible) {
        const s = this.uS;
        s.uCentro.value.set(suelo.x, suelo.y, suelo.z); s.uPend.value.set(suelo.px || 0, suelo.pz || 0);
        s.uT.value = this.t; s.uOpacidad.value = 0.25 + 0.45 * lluvia;
        this.salp.geometry.instanceCount = Math.round(this.nS * (0.25 + 0.75 * Math.min(1, lluvia * 1.25)));
      }
    } else this.camAnt = null;
    // ambiente: solo se recalcula cuando cambia algo
    const clave = Math.round(lluvia * 50) + Math.round(agua * 50) * 100 + Math.round(sombraNubes * 40) * 10000;
    if (clave === this.intensidad) return;
    this.intensidad = clave;
    const nube = Math.min(1, lluvia * 1.4 + agua * 0.3);
    const b = this.esc.base || { sol: this.sol, fogColor: this.fogColor, fogFar: this.fogFar, exp: 0.92, hemi: 0.55 };
    const noche = this.esc.hora === 'noche';
    this.scene.fog.color.copy(b.fogColor).lerp(this._colNiebla.set(noche ? 0x0c1220 : 0x6f7a86), nube);
    // (con lluvia la cortina de agua cierra la vista; el ahorro de rendimiento acerca la distancia de dibujo)
    this.scene.fog.far = b.fogFar * (1 - 0.6 * lluvia) * (this.scene.userData.ahorroDist ?? 1);
    this.uG.uColor.value.set(noche ? 0x9fb4d8 : 0xc4d2e2);
    // una nube tapando el sol: la luz directa baja y el cielo rellena un poco
    const sn = noche ? 0 : sombraNubes * (1 - nube);
    this.esc.luzSol.intensity = b.sol * (1 - (noche ? 0.25 : 0.7) * nube) * (1 - 0.6 * sn);
    if (this.esc.hemi) this.esc.hemi.intensity = b.hemi + (noche ? 0 : 0.35) * nube + 0.12 * sn;
    if (renderer) renderer.toneMappingExposure = b.exp - 0.12 * nube;
    if (this.asf) {
      // asfalto mojado: más oscuro y con reflejos
      const m = this.esc.matAsfalto;
      // (una película de agua: casi un espejo que recoge el cielo gris y las luces)
      m.roughness = this.asf.rough * (1 - 0.72 * agua);
      m.metalness = 0.16 * agua;
      m.envMapIntensity = this.asf.env * (1 + 1.6 * agua);
      m.color.copy(this.asf.color).multiplyScalar(1 - 0.42 * agua);
    }
  }

  quitar() { this.scene.remove(this.lineas); this.lineas.geometry.dispose(); this.mat.dispose(); if (this.salp) { this.scene.remove(this.salp); this.salp.geometry.dispose(); this.matS.dispose(); } }
}
