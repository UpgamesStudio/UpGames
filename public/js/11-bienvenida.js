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

// ── BIENVENIDA — 3 pantallas + términos ───────────────────
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
  const dots    = document.querySelectorAll('.ob-dot');
  const slides  = document.querySelectorAll('.ob-slide');
  const TOTAL   = slides.length;   // 3
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

  // Activar primer slide
  slides[0].classList.add('active');
  _syncFooter(0);

  function _goTo(idx) {
    if (idx < 0 || idx >= TOTAL) return;

    // Salir slide actual
    slides[current].classList.remove('active');
    slides[current].classList.add('exit-left');
    setTimeout(() => slides[current].classList.remove('exit-left'), 400);

    current = idx;

    // Entrar slide nuevo
    slides[current].classList.add('active');
    _syncFooter(current);
  }

  function _syncFooter(idx) {
    // Dots
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));

    // Botón siguiente — en el último slide se oculta (usa los botones del slide)
    const isLast = idx === TOTAL - 1;
    footer.classList.toggle('is-last', isLast);

    // Texto del botón
    const saltar = document.getElementById('ob-saltar'); if (saltar) saltar.hidden = isLast;
    if (idx === TOTAL - 2) {
      btnNext.innerHTML = 'Ver reglas <ion-icon name="arrow-forward-outline"></ion-icon>';
    } else {
      btnNext.innerHTML = 'Siguiente <ion-icon name="arrow-forward-outline"></ion-icon>';
    }
  }

  // Dots clickeables (solo hacia adelante — UX intencional)
  dots.forEach((d, i) => {
    d.addEventListener('click', () => { if (i > current) _goTo(i); });
  });

  // Botón Siguiente / Saltar (va directo a las reglas: aceptar sigue siendo obligatorio)
  btnNext.addEventListener('click', () => _goTo(current + 1));
  document.getElementById('ob-saltar')?.addEventListener('click', () => _goTo(TOTAL - 1));

  // Swipe horizontal (touch)
  let _tx = 0;
  modal.addEventListener('touchstart', e => { _tx = e.touches[0].clientX; }, { passive: true });
  modal.addEventListener('touchend', e => {
    const diff = _tx - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && current < TOTAL - 1) _goTo(current + 1);
      else if (diff < 0 && current > 0)   _goTo(current - 1);
    }
  }, { passive: true });

  // Teclado
  document.addEventListener('keydown', function _kb(e) {
    if (!modal.classList.contains('show')) { document.removeEventListener('keydown', _kb); return; }
    if (e.key === 'ArrowRight' && current < TOTAL - 1) _goTo(current + 1);
    if (e.key === 'ArrowLeft'  && current > 0)         _goTo(current - 1);
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

