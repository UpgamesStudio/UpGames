// Rueda de mandos del volante (táctil y ratón): se mantiene pulsado el botón del volante y
// alrededor del centro de la pantalla se abren las opciones (ERS, combustible, freno motor,
// reparto de frenada, boxes…). Se desliza el dedo hacia una: se abre su rueda de valores; se
// sigue deslizando hacia el valor y al soltar se aplica. La dirección cuenta, no la posición:
// funciona igual desde cualquier esquina y sin mirar (como la rueda de armas de un juego).
//  · soltar sobre una opción sin abrir sus valores = pasar al siguiente valor
//  · soltar sin mover el dedo = cancelar

const UMBRAL = 26;          // px de arrastre para marcar una dirección
const ABRIR = 78;           // px de arrastre que abren los valores de la opción marcada
const MANTENER = 380;       // ms quieto apuntando a una opción que también la abren

export class RuedaMandos {
  /**
   * boton: el botón que se mantiene pulsado.
   * opciones(): [{ id, nombre, icono, valores: [{ v, nombre, sub }], actual, accion? }]
   * alElegir(id, v | null): aplica el valor (null = siguiente valor / acción directa).
   */
  constructor(boton, { opciones, alElegir, alMarcar } = {}) {
    this.boton = boton; this.opciones = opciones; this.alElegir = alElegir; this.alMarcar = alMarcar;
    const el = this.el = document.createElement('div');
    el.id = 'ruedaMandos'; el.className = 'rueda-mandos'; el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    this.abierta = false;
    boton.addEventListener('pointerdown', (e) => this._inicio(e));
    boton.addEventListener('pointermove', (e) => this._mover(e));
    boton.addEventListener('pointerup', (e) => this._fin(e, true));
    boton.addEventListener('pointercancel', (e) => this._fin(e, false));
    boton.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  _inicio(e) {
    e.preventDefault(); e.stopPropagation();
    try { this.boton.setPointerCapture(e.pointerId); } catch { /* nada */ }
    this.id = e.pointerId; this.o = { x: e.clientX, y: e.clientY };
    this.ops = this.opciones().filter(Boolean);
    this.nivel = 1; this.marca = -1; this.marcaV = -1; this.tMarca = 0;
    this.abierta = true;
    this.boton.classList.add('pulsado');
    this._pintar();
  }

  _dir(v, n, desfase = 0) {
    // sector más cercano (0 = arriba, en el sentido de las agujas del reloj)
    const ang = (Math.atan2(v.x, -v.y) + Math.PI * 2 + desfase) % (Math.PI * 2);
    return Math.round(ang / (Math.PI * 2 / n)) % n;
  }

  _mover(e) {
    if (!this.abierta || e.pointerId !== this.id) return;
    const v = { x: e.clientX - this.o.x, y: e.clientY - this.o.y }, d = Math.hypot(v.x, v.y);
    if (this.nivel === 1) {
      const m = d > UMBRAL ? this._dir(v, this.ops.length) : -1;
      if (m !== this.marca) { this.marca = m; this.tMarca = performance.now(); this.alMarcar?.(); this._pintar(); }
      const op = this.ops[m];
      // alejarse (o quedarse apuntando) abre sus valores; el nuevo origen es donde está el dedo
      if (op?.valores?.length && (d > ABRIR || (m >= 0 && performance.now() - this.tMarca > MANTENER))) {
        this.nivel = 2; this.o = { x: e.clientX, y: e.clientY }; this.marcaV = -1; this.alMarcar?.(); this._pintar();
      }
    } else {
      const op = this.ops[this.marca], n = op.valores.length;
      const m = d > UMBRAL ? this._dir(v, n) : -1;
      if (m !== this.marcaV) { this.marcaV = m; this.alMarcar?.(); this._pintar(); }
    }
  }

  _fin(e, aplicar) {
    if (!this.abierta || e.pointerId !== this.id) return;
    this.abierta = false;
    this.boton.classList.remove('pulsado');
    this.el.classList.remove('visible');
    if (!aplicar) return;
    const op = this.ops[this.marca];
    if (!op) return;
    if (this.nivel === 2) { if (this.marcaV >= 0) this.alElegir?.(op.id, op.valores[this.marcaV].v); }
    else this.alElegir?.(op.id, null);
  }

  _pintar() {
    const el = this.el;
    el.classList.add('visible');
    const items = [];
    if (this.nivel === 1) {
      const n = this.ops.length;
      this.ops.forEach((op, k) => {
        const a = k / n * Math.PI * 2;
        items.push(`<div class="rm-item ${k === this.marca ? 'sel' : ''}" style="--x:${Math.sin(a).toFixed(3)};--y:${(-Math.cos(a)).toFixed(3)}"><i>${op.icono || ''}</i><b>${op.nombre}</b><small>${op.actualTxt ?? ''}</small></div>`);
      });
      const op = this.ops[this.marca];
      el.innerHTML = `<div class="rm-aro"></div><div class="rm-centro"><b>${op ? op.nombre : 'VOLANTE'}</b><small>${op ? (op.valores?.length ? 'Sigue hacia fuera para elegir · suelta para pasar al siguiente' : 'Suelta para confirmar') : 'Desliza hacia una opción'}</small></div>${items.join('')}`;
    } else {
      const op = this.ops[this.marca], n = op.valores.length;
      op.valores.forEach((val, k) => {
        const a = k / n * Math.PI * 2;
        items.push(`<div class="rm-item valor ${k === this.marcaV ? 'sel' : ''} ${val.v === op.actual ? 'actual' : ''}" style="--x:${Math.sin(a).toFixed(3)};--y:${(-Math.cos(a)).toFixed(3)}"><b>${val.nombre}</b>${val.sub ? `<small>${val.sub}</small>` : ''}</div>`);
      });
      const val = op.valores[this.marcaV];
      el.innerHTML = `<div class="rm-aro n2"></div><div class="rm-centro n2"><i>${op.icono || ''}</i><b>${op.nombre}</b><small>${val ? 'Suelta para poner ' + val.nombre : 'Desliza hacia el valor'}</small></div>${items.join('')}`;
    }
  }
}
