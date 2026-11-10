// Radio del ingeniero y megafonía del circuito. En español el ingeniero y el piloto hablan con
// voces GRABADAS (vozRadio.js): cada aviso puede llevar `voz: ['ing:…', 'pil:…']` y suena en
// orden; los avisos sin grabación salen solo como subtítulo (o con voz sintetizada si el jugador
// lo activa en Ajustes). La megafonía y los demás idiomas siguen con voz sintetizada. En el navegador usa
// la síntesis de voz del sistema (speechSynthesis); en la app de Android, cuyo WebView no
// la tiene, usa el motor de voz nativo a través del puente `ApexVoz`. Cada mensaje sale
// también como subtítulo, así que nunca se pierde aunque no haya voz.

import { tr, idiomaActual, lenguaVoz } from './idioma.js';
import { VOCES, archivoVoz, POR_CLAVE } from './vozRadio.js';

const voces = () => (window.speechSynthesis?.getVoices?.() || []).filter(v => v.lang?.toLowerCase().startsWith(idiomaActual()));
const MAX_COLA = 10;

// segundos mínimos entre dos avisos normales, y cuánto baja el resto del sonido mientras se habla
const PAUSA_RADIO = 28, ATENUA = 0.45;
export class Radio {
  constructor({ alSubtitulo, sonido } = {}) {
    this.alSubtitulo = alSubtitulo;
    this.sonido = sonido;
    this.voz = true;
    this.cola = [];
    this.hablando = false;
    this.ultimo = new Map();          // clave → instante (para no repetir)
    this.n = 0;
    this.sintetica = false;          // ¿voz sintetizada para los avisos del ingeniero sin grabación?
    this._buf = new Map();           // clave de voz → AudioBuffer (o promesa)
    window.speechSynthesis?.getVoices?.();
    window.speechSynthesis?.addEventListener?.('voiceschanged', () => { this._voces = null; });
    // Chrome y Safari solo hablan después de un toque del usuario: se "despierta" la voz con el primero
    const despertar = () => {
      removeEventListener('pointerdown', despertar, true); removeEventListener('keydown', despertar, true);
      try { const s = window.speechSynthesis; if (s && !this.nativa) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; s.speak(u); } } catch { /* nada */ }
    };
    addEventListener('pointerdown', despertar, true); addEventListener('keydown', despertar, true);
    // fin de frase avisado por la voz nativa
    window.__vozFin = (id) => { if (this._idActual === id) this._fin?.(); };
  }

  get nativa() {
    try {
      const si = !!window.ApexVoz?.disponible?.();
      if (si && !this._lenguaNativa) { this._lenguaNativa = true; window.ApexVoz.idioma?.(idiomaActual()); }
      return si;
    } catch { return false; }
  }
  get disponible() { return this.nativa || !!window.speechSynthesis; }
  get grabadas() { return idiomaActual() === 'es'; }

  /** Carga (y guarda) el audio de una frase grabada. */
  _cargar(clave) {
    const ctx = this.sonido?.ctx;
    if (!ctx) return Promise.resolve(null);
    if (!this._buf.has(clave)) this._buf.set(clave, fetch(archivoVoz(clave)).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).catch(() => null));
    return this._buf.get(clave);
  }
  /** Precarga las frases más habituales (sin bloquear nada). */
  precargar(claves = Object.keys(VOCES)) {
    // de una en una y con pausas, para no dar tirones al empezar la sesión
    if (this._precargando) return; this._precargando = true;
    const lista = claves.filter(k => !this._buf.has(k));
    const sig = () => { const k = lista.shift(); if (!k) { this._precargando = false; return; } this._cargar(k).finally(() => setTimeout(sig, 250)); };
    setTimeout(sig, 1500);
  }

  _vozDe(tipo) {
    const vs = voces();
    if (!vs.length) return null;
    // el ingeniero con una voz y el locutor con otra si hay más de una
    if (idiomaActual() !== 'es') return vs.find(v => v.lang === lenguaVoz()) || vs[0];
    const pref = tipo === 'megafonia' ? vs.find(v => /es-(ES|MX|US)/i.test(v.lang) && !/female|mujer|helena|laura|paulina|monica/i.test(v.name)) : vs.find(v => /es-(MX|US|CO|419)/i.test(v.lang));
    return pref || vs[tipo === 'megafonia' ? vs.length - 1 : 0];
  }

  /** tipo: 'ingeniero' | 'megafonia'. clave evita repetir el mismo aviso en `cada` segundos. */
  decir(texto, { tipo = 'ingeniero', clave = null, cada = 25, prioridad = false, voz = null } = {}) {
    const ahora = performance.now() / 1000;
    // la radio solo habla cuando hace falta: un aviso normal no entra si ya se está hablando, hay otro
    // esperando o se habló hace poco (los prioritarios —banderas, boxes, averías— entran siempre)
    if (!prioridad && (this.hablando || this.cola.length || ahora - (this._ultimaVez ?? -1e9) < PAUSA_RADIO)) return false;
    if (clave) {
      if (ahora - (this.ultimo.get(clave) ?? -1e9) < cada) return false;
      this.ultimo.set(clave, ahora);
    }
    // con grabación (en español): una entrada por frase, con su texto y quién habla
    if (!voz && clave && POR_CLAVE[clave]) { const v = POR_CLAVE[clave]; voz = v[Math.floor(Math.random() * v.length)]; }
    const lista = (Array.isArray(voz) ? voz : voz ? [voz] : []).filter(k => k === '@' || VOCES[k]);
    const msgs = lista.some(k => k !== '@') && this.grabadas
      ? lista.map(k => k === '@' ? { texto: tr(texto), tipo, t: ahora, prioridad } : { texto: VOCES[k], tipo: k.startsWith('pil:') ? 'piloto' : 'ingeniero', clip: k, t: ahora, prioridad })
      : [{ texto: tr(texto), tipo, t: ahora, prioridad }];
    this._ultimaVez = ahora;
    if (prioridad) this.cola.unshift(...msgs); else this.cola.push(...msgs);
    // (si se acumulan se descartan conversaciones enteras, no frases sueltas de una)
    // si se acumulan, se descartan los mensajes normales más viejos (nunca los prioritarios)
    while (this.cola.length > MAX_COLA) {
      const i = this.cola.findIndex(x => !x.prioridad);
      const x = this.cola[i >= 0 ? i : this.cola.length - 1];
      this.cola = this.cola.filter(y => y !== x && (x.conv == null || y.conv !== x.conv));
    }
    this._siguiente();
    return true;
  }

  _siguiente() {
    if (this.hablando || !this.cola.length) return;
    // los avisos que llevan demasiado esperando ya no tienen sentido (salvo los prioritarios)
    const ahora = performance.now() / 1000;
    this.cola = this.cola.filter(x => x.prioridad || ahora - x.t < (x.conv ? 45 : 20));
    if (!this.cola.length) return;
    const m = this.cola.shift();
    this.hablando = true;
    this.sonido?.atenuar?.(true);          // el motor baja mientras se habla
    // la radio del equipo se abre con su chasquido y pitidos, y la voz entra justo al terminar
    let abre = 0;
    const mega = m.tipo === 'megafonia';
    // entre dos frases seguidas de la misma conversación no se vuelve a abrir la radio
    const seguida = this._ultimaFin && performance.now() - this._ultimaFin < 500 && !mega;
    if (mega) this.sonido?.campana(); else if (!seguida) abre = this.sonido?.radio(false) || 0;
    this.alSubtitulo?.(m, true);
    let cerrado = false;
    const fin = this._fin = () => {
      if (cerrado) return;
      cerrado = true;
      this.hablando = false; this._fin = null;
      if (!this.cola.length) this.sonido?.atenuar?.(false);
      const sigueConv = !!m.conv && this.cola[0]?.conv === m.conv;
      if (m.tipo !== 'megafonia' && !sigueConv) this.sonido?.radio(true);
      this._ultimaFin = sigueConv ? performance.now() : 0;
      this.alSubtitulo?.(m, false);
      setTimeout(() => this._siguiente(), sigueConv ? 60 : 300);
    };
    const espera = mega ? 900 : seguida ? 150 : Math.max(180, abre - 40);
    // tiempo máximo por si la voz no avisa del final
    setTimeout(fin, espera + 2500 + m.texto.length * 95);
    if (!this.voz) { setTimeout(fin, 1200 + m.texto.length * 55); return; }
    if (m.clip) {
      // frase grabada: suena por la radio del equipo (la del piloto, más seca: es la de su casco)
      this._cargar(m.clip).then(buf => {
        const ctx = this.sonido?.ctx;
        if (!buf || !ctx || cerrado) { setTimeout(fin, 900 + m.texto.length * 50); return; }
        setTimeout(() => {
          if (cerrado) return;
          const s = ctx.createBufferSource(); s.buffer = buf;
          const g = ctx.createGain(); g.gain.value = (m.tipo === 'piloto' ? 1.9 : 2.3) / ATENUA;      // más alta (y compensa la bajada del resto)
          s.connect(g); g.connect(this.sonido.maestro || ctx.destination);
          s.onended = () => setTimeout(fin, 120);
          this._fuente = s;
          s.start();
        }, espera);
      });
      return;
    }
    // sin grabación (en español): solo el subtítulo, salvo que el jugador quiera la voz sintética
    if (!mega && this.grabadas && (!this.sintetica || m.conv)) { setTimeout(fin, 1300 + m.texto.length * 45); return; }
    if (this.nativa) {
      const id = 'v' + (++this.n);
      this._idActual = id;
      setTimeout(() => { try { window.ApexVoz.hablar(m.texto, id, mega ? 1.0 : 1.12, mega ? 0.85 : 1.0); } catch { fin(); } }, espera);
      return;
    }
    const synth = window.speechSynthesis;
    if (!synth) { setTimeout(fin, 1200 + m.texto.length * 55); return; }
    try {
      const u = new SpeechSynthesisUtterance(m.texto);
      u.lang = lenguaVoz();
      const v = this._vozDe(m.tipo); if (v) { u.voice = v; u.lang = v.lang; }
      if (mega) { u.rate = 1.0; u.pitch = 0.85; u.volume = 0.8; }
      else { u.rate = 1.12; u.pitch = 1.0; u.volume = 1; }
      u.onend = fin; u.onerror = fin;
      setTimeout(() => { try { synth.resume?.(); synth.speak(u); } catch { fin(); } }, espera);
    } catch { setTimeout(fin, 1500); }
  }

  callar() {
    this.cola.length = 0;
    try { this._fuente?.stop(); } catch { /* nada */ }
    try { window.speechSynthesis?.cancel(); } catch { /* nada */ }
    try { window.ApexVoz?.callar?.(); } catch { /* nada */ }
    this._fin?.();
    this.hablando = false;
    this.sonido?.atenuar?.(false);
  }
}
