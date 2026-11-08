// ── TUTORIAL ─────────────────────────────────────────────
// Cada paso puede tener:
//   sel      → selector CSS del elemento a destacar
//   title    → título del tooltip
//   body     → explicación detallada
//   onEnter  → función que se ejecuta al llegar a este paso
//   onExit   → función que se ejecuta al salir de este paso
//   scrollEl → selector del contenedor a hacer scroll (para elementos dentro del sheet)

// Recorrido rápido (opcional, desde Ayuda → "Recorrido de 1 min"). Antes eran 54 pasos que
// arrancaban solos y bloqueaban la pantalla; lo demás se aprende con la Guía de inicio y
// pistas puntuales (upgames-guia.js).
const TUT_STEPS = [
  { sel: '#buscador', title: '🔍 Busca lo que quieras', body: 'Escribe el nombre de un juego, mod, app o creador: los resultados aparecen mientras escribes.' },
  { sel: '#category-row', title: '🏷️ Filtra por categoría', body: 'Juegos, mods, apps, software y videos. Desliza para ver más.' },
  { sel: '.game-tile', title: '📦 Abre una publicación', body: 'Toca una tarjeta para ver su detalle: portada, descripción, comentarios y el botón para <strong>descargar</strong>.' },
  { sel: '#hdr-uc, #hdr-entrar', title: '🪙 Tus UpCoins', body: 'La moneda de UpGames. Tócala para recargar y úsala en lives, NEXUS, Premium y el estilo de tu perfil. Si aún no tienes cuenta, aquí entras.' },
  { sel: '#hdr-orb', title: '✨ Menú rápido', body: 'Avisos, lives, subir contenido, Premium y soporte, desplegados en círculo.' },
  { sel: '#bottom-nav', title: '🧭 Navegación', body: '<strong>Explorar</strong>, <strong>Favoritos</strong>, <strong>NEXUS</strong> (tu asistente de IA), <strong>Economía</strong> (ganancias, misiones y UpCoins) y tu <strong>Perfil</strong> (publicar y ajustes).' },
  { sel: '#tut-fab', title: '❔ Ayuda y guía de inicio', body: 'Aquí tienes tu lista de primeros pasos, guías cortas con buscador y acceso a NEXUS y soporte. ¡Listo! 🚀' },
];

let tutIdx=0, tutActive=false, tutLastEl=null;

function startTutorial() {
  tutIdx=0;
  tutActive=true;
  if(nxOpen) nxToggle();
  closeDetail();
  switchTab('main'); // siempre empieza en main
  document.getElementById('btut-lock').classList.add('on');
  document.getElementById('btut-lock').classList.remove('dim');
  document.getElementById('btut-tooltip').style.display='flex';
  document.body.style.overflow='hidden';
  renderTut();
}

function finishTutorial() {
  tutActive=false;
  const lock = document.getElementById('btut-lock');
  lock.classList.remove('on','dim');
  document.getElementById('btut-spotlight').style.display='none';
  document.getElementById('btut-tooltip').style.display='none';
  document.body.style.overflow='';
  clearPulse();
  if(nxOpen) nxToggle();
  closeDetail();
  switchTab('main');
  LS.set('upgames_onboarding_done','1');
}

function renderTut() {
  const s    = TUT_STEPS[tutIdx];
  const lock = document.getElementById('btut-lock');
  const sp   = document.getElementById('btut-spotlight');
  const tip  = document.getElementById('btut-tooltip');

  // Ejecutar onEnter si existe
  if(s.onEnter) s.onEnter();

  // Contenido del tooltip
  document.getElementById('btut-badge').textContent     = `Paso ${tutIdx+1} de ${TUT_STEPS.length}`;
  document.getElementById('btut-title').textContent     = s.title;
  document.getElementById('btut-body').innerHTML        = s.body;
  document.getElementById('btut-next').textContent      = tutIdx === TUT_STEPS.length-1 ? '¡Listo! ✓' : 'Siguiente →';
  document.getElementById('btut-prev').style.visibility = tutIdx === 0 ? 'hidden' : 'visible';

  // Dots (máximo 20 visibles para no desbordar)
  const dotsEl = document.getElementById('btut-dots');
  dotsEl.innerHTML = '';
  const total = TUT_STEPS.length;
  const maxDots = 20;
  if(total <= maxDots) {
    TUT_STEPS.forEach((_,i) => {
      const d = document.createElement('span');
      d.className = 'btut-dot' + (i===tutIdx ? ' on' : '');
      dotsEl.appendChild(d);
    });
  } else {
    // Solo mostrar rango alrededor del actual
    const half = Math.floor(maxDots/2);
    let start = Math.max(0, tutIdx - half);
    let end   = Math.min(total-1, start + maxDots - 1);
    start = Math.max(0, end - maxDots + 1);
    for(let i=start; i<=end; i++){
      const d = document.createElement('span');
      d.className = 'btut-dot' + (i===tutIdx ? ' on' : '');
      dotsEl.appendChild(d);
    }
  }

  clearPulse();
  sp.style.display='none';

  // Delay: si hay onEnter (cambio de tab/sheet) esperamos más
  const delay = s.onEnter ? 900 : 50;

  // Intentar spotlight con reintentos si el elemento no está visible aún
  function trySpot(attempts) {
    if(!tutActive) return;
    const el = s.sel ? document.querySelector(s.sel) : null;
    if(el) {
      const r = el.getBoundingClientRect();
      // Si el elemento no tiene dimensiones aún, reintentamos
      if((r.width === 0 || r.height === 0) && attempts > 0) {
        setTimeout(() => trySpot(attempts-1), 200);
        return;
      }
      lock.classList.remove('dim');
      // Scroll para que sea visible
      try { el.scrollIntoView({behavior:'smooth', block:'center'}); } catch(_){}
      setTimeout(() => {
        if(!tutActive) return;
        const r2 = el.getBoundingClientRect();
        const PAD = 10;
        sp.style.top    = (r2.top    - PAD) + 'px';
        sp.style.left   = (r2.left   - PAD) + 'px';
        sp.style.width  = (r2.width  + PAD*2) + 'px';
        sp.style.height = (r2.height + PAD*2) + 'px';
        sp.style.display = 'block';
        el.classList.add('btut-pulse');
        tutLastEl = el;
        // Tooltip arriba si elemento está en mitad inferior de pantalla
        if(r2.top > window.innerHeight * 0.45) {
          tip.classList.add('at-top');
        } else {
          tip.classList.remove('at-top');
        }
      }, 300);
    } else {
      // Sin selector: fondo oscuro, tooltip centrado abajo
      sp.style.display='none';
      lock.classList.add('dim');
      tip.classList.remove('at-top');
    }
  }

  setTimeout(() => trySpot(5), delay);

  // Animación de entrada del tooltip
  tip.classList.remove('btut-in');
  void tip.offsetWidth;
  tip.classList.add('btut-in');
}

function clearPulse() {
  if(tutLastEl) { tutLastEl.classList.remove('btut-pulse'); tutLastEl=null; }
}

document.getElementById('btut-next').addEventListener('click', () => {
  if(tutIdx < TUT_STEPS.length-1) { tutIdx++; renderTut(); }
  else finishTutorial();
});
document.getElementById('btut-prev').addEventListener('click', () => {
  if(tutIdx > 0) { tutIdx--; renderTut(); }
});
document.getElementById('btut-close').addEventListener('click', finishTutorial);

// ── Enlace directo a Ajustes del perfil: biblioteca.html?ajustes=portada ──
(function abrirPestanaDesdeURL() {
  // Acceso directo de la app instalada: biblioteca.html?tab=perfil
  const t = new URLSearchParams(location.search).get('tab');
  if (t === 'perfil' && LS.get('token')) setTimeout(() => switchTab('profile'), 300);
})();
(function abrirAjustesDesdeURL() {
  const tab = new URLSearchParams(location.search).get('ajustes');
  if (!tab || !/^[a-z]+$/.test(tab) || !LS.get('token')) return;
  const go = () => {
    switchTab('profile');
    setTimeout(() => pfOpenSettings(tab), 400);
    // Limpiar el parámetro para que recargar no vuelva a abrir el modal
    try { history.replaceState(null, '', location.pathname); } catch(_) {}
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(go, 300));
  else setTimeout(go, 300);
})();

// ── INIT ─────────────────────────────────────────────────
window.startBibliotecaTutorial = startTutorial;
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded', loadContent);
} else { loadContent(); }

