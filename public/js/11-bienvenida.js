// ── Prueba A/B de la bienvenida: cada dispositivo ve siempre la misma versión ──
// A = "ecosistema que no existe en otro lugar" · B = "lo que creas te genera dinero real"
const UG_AB = (() => { try { let v = localStorage.getItem('ug_ab_bienv'); if (v !== 'A' && v !== 'B') { v = Math.random() < 0.5 ? 'A' : 'B'; localStorage.setItem('ug_ab_bienv', v); } return v; } catch (_) { return 'A'; } })();
function ugAB(evento, modo) {
  try {
    const env = JSON.parse(localStorage.getItem('ug_ab_env') || '{}'), k = `${evento}:${modo}`;
    if (env[k]) return; env[k] = Date.now(); localStorage.setItem('ug_ab_env', JSON.stringify(env));
    fetch(`${API_URL}/ab/evento`, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ exp: 'bienvenida', variante: UG_AB, evento, modo }) }).catch(() => {});
  } catch (_) {}
}

// ── Bienvenida animada: la información de la bienvenida contada en 6 capítulos ──
// Animación tipo "SaaS" hecha con el DOM: render(t) es una función pura del tiempo
// (así se puede pausar, adelantar por capítulos y grabar). Al terminar llama a alTerminar().
function ugBienvAnim(escena, prog, { alTerminar } = {}) {
  const CAPS = [0, 5.6, 12.4, 18.2, 25.6, 31.2, 35.4];   // inicio de cada capítulo · fin
  const DUR = CAPS[CAPS.length - 1];
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const E = { out: k => 1 - Math.pow(1 - k, 3), io: k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2,
    back: k => { const c = 1.6; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); } };
  const en = (t, a, d, e = E.out) => e(clamp((t - a) / d));
  // aparece: opacidad + subida + desenfoque (sin movimiento con "reducir movimiento")
  const entra = (el, k, { dy = 18, s = 1, blur = 6 } = {}) => {
    if (!el) return;
    el.style.opacity = k;
    el.style.transform = reducido ? '' : `translateY(${(1 - k) * dy}px) scale(${lerp(s, 1, k)})`;
    el.style.filter = reducido || k > .98 ? '' : `blur(${(1 - k) * blur}px)`;
  };
  const caps = [...escena.querySelectorAll('.oba-cap')];
  const q = (i, sel) => [...caps[i].querySelectorAll(sel)];
  const barras = [...prog.querySelectorAll('b')];

  // Palabras y letras sueltas para animarlas una a una (respeta <br>, <b> y <span>)
  const partir = (el, porLetra) => {
    const piezas = [];
    const recorrer = nodo => [...nodo.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        (porLetra ? [...n.textContent] : n.textContent.split(/(\s+)/)).forEach(w => {
          if (!w) return;
          if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; }
          const sp = document.createElement('span'); sp.className = 'oba-w'; sp.textContent = w; frag.appendChild(sp); piezas.push(sp);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') recorrer(n);
    });
    recorrer(el);
    return piezas;
  };
  let pal0, letras, palT3, palT5;
  const preparar = () => {
    pal0 = partir(caps[0].querySelector('.obh-titulo'));
    letras = partir(caps[0].querySelector('.oba-logo'), true);
    palT3 = partir(caps[3].querySelector('.oba-titulo'));
    palT5 = partir(caps[5].querySelector('.oba-titulo'));
  };

  const fmt = n => Math.round(n).toLocaleString('es-CO');
  const render = t => {
    // capítulo visible (fundido cruzado de 0,45 s)
    caps.forEach((c, i) => {
      const a = CAPS[i], b = CAPS[i + 1];
      const vis = Math.min(clamp((t - a + .05) / .45), i === caps.length - 1 ? 1 : clamp((b - t) / .45));
      c.style.opacity = vis; c.style.visibility = vis > 0 ? 'visible' : 'hidden';
      const entraY = (1 - clamp((t - a) / .45)) * 14, saleY = i < caps.length - 1 ? (1 - clamp((b - t) / .45)) * 14 : 0;
      c.style.transform = reducido ? '' : `translateY(${entraY - saleY}px)`;
    });
    // barra de progreso por capítulos
    barras.forEach((b, i) => { b.style.width = clamp((t - CAPS[i]) / (CAPS[i + 1] - CAPS[i])) * 100 + '%'; });

    // 0 · Bienvenida: pastilla, logo letra a letra, titular palabra a palabra
    if (t < CAPS[1] + .5) {
      entra(caps[0].querySelector('.obh-pill'), en(t, .2, .6), { dy: -14 });
      letras.forEach((l, i) => entra(l, en(t, .7 + i * .06, .5), { dy: 22, s: .6, blur: 10 }));
      pal0.forEach((w, i) => entra(w, en(t, 1.6 + i * .11, .5), { dy: 16, blur: 8 }));
      entra(caps[0].querySelector('.obh-sub'), en(t, 1.9 + pal0.length * .11, .7), { dy: 12 });
    }
    // 1 · Seis apps que se funden en UpGames
    if (t > CAPS[1] - .5 && t < CAPS[2] + .5) {
      const a = CAPS[1];
      entra(caps[1].querySelector('.oba-kicker'), en(t, a + .1, .5));
      const apps = q(1, '.oba-app'), junta = en(t, a + 3.9, .9, E.io);
      const g = caps[1].querySelector('.oba-fusion').getBoundingClientRect();
      apps.forEach((el, i) => {
        const k = en(t, a + .3 + i * .22, .55, E.back);
        const r = el.getBoundingClientRect();
        const cx = g.left + g.width / 2 - (r.left + r.width / 2) + (parseFloat(el.dataset.dx) || 0), cy = g.top + g.height / 2 - (r.top + r.height / 2) + (parseFloat(el.dataset.dy) || 0);
        // la posición se mide sin la transformación propia: se guarda el desplazamiento aplicado
        const dx = reducido ? 0 : cx * junta, dy = reducido ? 0 : cy * junta;
        el.dataset.dx = dx; el.dataset.dy = dy;
        el.style.opacity = clamp(k * 1.5) * (1 - junta * .9);
        el.style.transform = reducido ? '' : `translate(${dx}px, ${dy}px) translateY(${(1 - Math.min(k, 1)) * 26}px) scale(${lerp(.7, 1, k) * (1 - junta * .55)})`;
      });
      const seis = caps[1].querySelector('.oba-seis'), uno = caps[1].querySelector('.oba-uno');
      entra(seis, en(t, a + 3.2, .4));
      seis.style.setProperty('--tachado', en(t, a + 4.4, .4) * 100 + '%');
      entra(caps[1].querySelector('.oba-igual i'), en(t, a + 4.6, .3));
      entra(uno, en(t, a + 4.8, .6, E.back), { s: .4, dy: 0, blur: 10 });
      uno.style.boxShadow = `0 0 ${20 + 30 * Math.abs(Math.sin(t * 2.5))}px rgba(50,213,131,.6)`;
    }
    // 2 · Gratis · Te paga · Tuyo · Insignia Fundador
    if (t > CAPS[2] - .5 && t < CAPS[3] + .5) {
      const a = CAPS[2];
      entra(caps[2].querySelector('.oba-kicker'), en(t, a + .1, .5));
      q(2, '.oba-props > div').forEach((el, i) => entra(el, en(t, a + .4 + i * .55, .6, E.back), { dy: 30, s: .85 }));
      const f = caps[2].querySelector('.oba-fundador');
      entra(f, en(t, a + 2.4, .7, E.back), { dy: 30, s: .9 });
      f.querySelector('.oba-brillo').style.transform = `translateX(${lerp(-120, 520, ((t - a - 2.9) % 2.6) / 2.6)}%) skewX(-20deg)`;
      f.querySelector('.obh-medalla').style.transform = reducido ? '' : `rotateY(${Math.max(0, 1 - en(t, a + 2.5, 1.2)) * 360}deg)`;
    }
    // 3 · Publica una vez, gana UpCoins: contador de descargas → +50 UC, regalos y retiros
    if (t > CAPS[3] - .5 && t < CAPS[4] + .5) {
      const a = CAPS[3];
      entra(caps[3].querySelector('.oba-kicker'), en(t, a + .1, .5));
      palT3.forEach((w, i) => entra(w, en(t, a + .3 + i * .1, .5), { dy: 14 }));
      entra(caps[3].querySelector('.oba-panel'), en(t, a + 1.2, .6), { dy: 24 });
      const c = en(t, a + 1.6, 1.9, E.io);
      caps[3].querySelector('.oba-num').textContent = fmt(c * 1000);
      caps[3].querySelector('.oba-barra i').style.width = c * 100 + '%';
      const pr = caps[3].querySelector('.oba-premio');
      entra(pr, en(t, a + 3.5, .55, E.back), { dy: 0, s: .5, blur: 8 });
      q(3, '.oba-fila').forEach((el, i) => entra(el, en(t, a + 4.3 + i * .8, .55), { dy: 18 }));
      q(3, '.oba-metodos i').forEach((el, i) => entra(el, en(t, a + 5.4 + i * .12, .45, E.back), { dy: 10, s: .7 }));
    }
    // 4 · Premium, misiones y NEXUS IA
    if (t > CAPS[4] - .5 && t < CAPS[5] + .5) {
      const a = CAPS[4];
      entra(caps[4].querySelector('.oba-kicker'), en(t, a + .1, .5));
      q(4, '.oba-feat').forEach((el, i) => entra(el, en(t, a + .4 + i * .9, .6), { dy: 26 }));
      entra(caps[4].querySelector('.oba-nota'), en(t, a + 3.4, .7));
    }
    // 5 · Reglas claras
    if (t > CAPS[5] - .5) {
      const a = CAPS[5];
      entra(caps[5].querySelector('.oba-kicker'), en(t, a + .1, .5));
      palT5.forEach((w, i) => entra(w, en(t, a + .3 + i * .12, .5), { dy: 14 }));
      q(5, '.oba-reglas > div').forEach((el, i) => entra(el, en(t, a + 1.2 + i * .5, .6, E.back), { dy: 24, s: .8 }));
    }
  };

  let t = 0, ultimo = 0, raf = 0, pausado = false, activo = false, fin = false;
  const bucle = now => {
    if (!activo) return;
    if (ultimo && !pausado) t += Math.min(.1, (now - ultimo) / 1000);
    ultimo = now;
    if (t >= DUR) { t = DUR; render(t); terminar(); return; }
    render(t);
    raf = requestAnimationFrame(bucle);
  };
  const terminar = () => { if (fin) return; fin = true; activo = false; cancelAnimationFrame(raf); alTerminar && alTerminar(); };
  const capActual = () => { let i = 0; while (i < CAPS.length - 2 && t >= CAPS[i + 1]) i++; return i; };
  // pausa mientras se mantiene presionado (como las historias)
  const pausar = v => { pausado = v; escena.classList.toggle('pausada', v); };
  escena.addEventListener('pointerdown', () => pausar(true));
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => escena.addEventListener(ev, () => pausar(false)));
  document.addEventListener('visibilitychange', () => { if (document.hidden) ultimo = 0; });

  preparar();
  return {
    DUR, CAPS, render,
    iniciar() { activo = true; fin = false; ultimo = 0; raf = requestAnimationFrame(bucle); },
    detener() { activo = false; cancelAnimationFrame(raf); },
    // siguiente capítulo (o terminar si es el último); anterior vuelve al inicio del capítulo
    siguiente() { const i = capActual(); if (i >= CAPS.length - 2) { t = DUR; render(t); terminar(); } else t = CAPS[i + 1]; },
    anterior() { const i = capActual(); t = (t - CAPS[i] < 1 && i > 0) ? CAPS[i - 1] : CAPS[i]; },
    get t() { return t; }, set t(v) { t = v; },
  };
}

// ── BIENVENIDA — animación + términos ───────────────────
(function initOnboarding() {
  const TERMINOS_VERSION = '7.3';   // súbela al cambiar los Términos o la Privacidad
  function avisoTerminosNuevos() {
    const a = document.createElement('div'); a.className = 'ug-terminos-aviso'; a.setAttribute('role', 'status');
    a.innerHTML = `<span>📜 Actualizamos los <a href="./terminos_condiciones.html" target="_blank" rel="noopener">Términos (v${TERMINOS_VERSION})</a> y la <a href="./politica-privacidad.html" target="_blank" rel="noopener">Privacidad</a>: ahora bajo la ley colombiana, a los creadores se les paga solo por descargas efectivas (no por vistas) y saltar la espera es solo con Premium.</span><button type="button">Entendido</button>`;
    a.querySelector('button').onclick = () => { LS.set('upgames_terms_v', TERMINOS_VERSION); a.remove(); };
    setTimeout(() => document.body.appendChild(a), 2500);
  }
  // Invitados: nada a pantalla completa al entrar (Google penaliza los intersticiales en
  // móvil). Una barra elegante, que no tapa nada, abre la bienvenida con "Crear cuenta".
  if (window.UG_INVITADO) {
    window.ugAbrirBienvenida = () => abrir(true);
    // Aparece cuando la persona ya mostró interés: bajó por el catálogo o abrió y cerró una ficha
    const mostrarTeaser = fn => {
      let hecho = false;
      const go = () => { if (hecho) return; hecho = true; removeEventListener('scroll', alBajar); removeEventListener('ug:detalle-cerrado', alCerrar); setTimeout(fn, 900); };
      const alBajar = () => { if (scrollY > innerHeight * 1.2) go(); };
      const alCerrar = () => go();
      addEventListener('scroll', alBajar, { passive: true }); addEventListener('ug:detalle-cerrado', alCerrar);
    };
    if (!LS.get('ug_bienv_inv')) mostrarTeaser(() => {
      if (!window.UG_INVITADO || document.getElementById('obh-teaser') || document.getElementById('detail-sheet')?.classList.contains('open')) return;
      const t = document.createElement('div'); t.id = 'obh-teaser'; t.className = 'obh-teaser'; t.setAttribute('role', 'region'); t.setAttribute('aria-label', 'Bienvenida');
      t.innerHTML = `<span class="obh-teaser-ic">✦</span><span><b>Esto no existe en otro lugar</b><small>Descargas, lives, red social e IA que te paga.</small></span><button type="button" data-a="ver">Descúbrelo</button><button type="button" data-a="x" aria-label="Cerrar">✕</button>`;
      t.onclick = e => { const a = e.target.closest('button')?.dataset.a; if (!a) return; LS.set('ug_bienv_inv', '1'); t.remove(); if (a === 'ver') abrir(true); };
      document.body.appendChild(t);
    });
    return;
  }
  // Bienvenida UNA vez por versión de los términos (antes volvía cada semana).
  // Quien ya la había aceptado antes solo ve un aviso pequeño de "términos actualizados".
  const aceptada = LS.get('upgames_terms_v');
  if (aceptada === TERMINOS_VERSION) return;
  if (aceptada || LS.getJSON('upgames_terms_seen_ts')) { avisoTerminosNuevos(); return; }
  abrir(false);

  function abrir(invitado) {
  if (abrir.listo) { document.getElementById('onboarding-modal').classList.add('show'); document.body.style.overflow = 'hidden'; return; }
  abrir.listo = true;
  const modal   = document.getElementById('onboarding-modal');
  const track   = document.getElementById('ob-track');
  const footer  = document.getElementById('ob-footer');
  const btnNext = document.getElementById('ob-btn-next');
  const btnAccept = document.getElementById('btn-accept-terms');
  const slides  = document.querySelectorAll('.ob-slide');
  const TOTAL   = slides.length;   // 2: animación + reglas
  // Invitado: en la última pantalla, crear cuenta (los términos se aceptan al registrarse) o seguir mirando
  if (invitado) {
    modal.classList.add('modo-inv');
    btnAccept.innerHTML = '✨ Crear mi cuenta gratis';
    const salir = modal.querySelector('.ob-btn-reject');
    if (salir) { salir.textContent = 'Seguir explorando sin cuenta'; salir.onclick = () => { ugAB('saltar', 'inv'); modal.classList.remove('show'); document.body.style.overflow = ''; }; }
  }

  // Fecha real del cierre de la etapa Fundador (y si tu cuenta ya tiene la insignia)
  (async () => {
    if (document.readyState === 'loading') await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));   // upgames-extras.js carga después
    const txt = document.getElementById('obh-fundador-txt'); if (!txt || !window.UGX) return;
    const m = invitado ? null : await UGX.cargarMio().catch(() => null);
    const c = m?.catalogo || await UGX.cargarCfg().catch(() => null);
    const f = c?.fundadorHasta ? new Date(c.fundadorHasta).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' }) : '';
    if (m?.fundador) txt.textContent = 'Tu cuenta ya la tiene: llegaste en la etapa fundadora. No se vende y no vuelve a salir.';
    else if (f) txt.textContent = `Solo para las cuentas creadas hasta el ${f}. No se vende y no vuelve a salir.`;
  })();

  // Versión B de la prueba A/B (la A es el HTML tal cual)
  if (UG_AB === 'B') {
    const t = modal.querySelector('.obh-titulo'), sub = modal.querySelector('.obh-sub');
    if (t) t.innerHTML = 'Aquí lo que creas, juegas y transmites<br><span>te genera dinero real.</span>';
    if (sub) sub.innerHTML = 'Descargas, videos, lives, red social e IA en <b>un solo ecosistema</b>. Gratis, sin límites… <b>y cada descarga te paga.</b>';
  }
  const modoAB = invitado ? 'inv' : 'usr';
  ugAB('visto', modoAB);

  let current = 0;

  // Mostrar modal
  modal.classList.add('show');
  document.body.style.overflow = 'hidden';

  // La animación (pantalla 0) termina sola, o con Saltar, en las reglas y aceptar (pantalla 1)
  const anim = ugBienvAnim(document.getElementById('oba-escena'), document.getElementById('oba-prog'), { alTerminar: () => _goTo(1) });
  slides[0].classList.add('active');
  _syncFooter(0);
  // Si la intro «Entrar a la red» está en pantalla, la bienvenida espera a que se cierre
  if (window.UG_INTRO_ACTIVA) addEventListener('ug:intro-fin', () => anim.iniciar(), { once: true });
  else anim.iniciar();

  function _goTo(idx) {
    if (idx < 0 || idx >= TOTAL || idx === current) return;
    slides[current].classList.remove('active');
    slides[current].classList.add('exit-left');
    const previa = current; setTimeout(() => slides[previa].classList.remove('exit-left'), 400);
    current = idx;
    slides[current].classList.add('active');
    if (idx === TOTAL - 1) anim.detener();
    _syncFooter(current);
  }

  function _syncFooter(idx) {
    // En las reglas el pie se oculta (se usan los botones de la pantalla) y Saltar desaparece
    const isLast = idx === TOTAL - 1;
    footer.classList.toggle('is-last', isLast);
    const saltar = document.getElementById('ob-saltar'); if (saltar) saltar.hidden = isLast;
    btnNext.innerHTML = 'Siguiente <ion-icon name="arrow-forward-outline"></ion-icon>';
  }

  // Siguiente: avanza un capítulo (en el último, pasa a las reglas). Saltar: directo a las reglas
  btnNext.addEventListener('click', () => { if (current === 0) anim.siguiente(); });
  document.getElementById('ob-saltar')?.addEventListener('click', () => { ugAB('saltar_anim', modoAB); _goTo(TOTAL - 1); });

  // Deslizar: a la izquierda el siguiente capítulo, a la derecha el anterior
  let _tx = 0;
  modal.addEventListener('touchstart', e => { _tx = e.touches[0].clientX; }, { passive: true });
  modal.addEventListener('touchend', e => {
    const diff = _tx - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50 && current === 0) { if (diff > 0) anim.siguiente(); else anim.anterior(); }
  }, { passive: true });

  // Teclado
  document.addEventListener('keydown', function _kb(e) {
    if (!modal.classList.contains('show')) { document.removeEventListener('keydown', _kb); return; }
    if (current !== 0) return;
    if (e.key === 'ArrowRight') anim.siguiente();
    if (e.key === 'ArrowLeft') anim.anterior();
    if (e.key === 'Escape') _goTo(TOTAL - 1);
  });

  // Botón Aceptar (última pantalla)
  btnAccept.addEventListener('click', () => {
    ugAB('cta', modoAB);
    if (invitado) { location.href = ugUrlLogin(true); return; }
    LS.setJSON('upgames_terms_seen_ts', Date.now());
    LS.set('upgames_terms_v', TERMINOS_VERSION);
    modal.classList.remove('show');
    document.body.style.overflow = '';
    setTimeout(() => window.UGG?.bienvenida(), 700);   // presenta la Guía de inicio (no bloquea)
  });
  }   // fin abrir()
})();

