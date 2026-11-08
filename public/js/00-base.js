// Imagen de respaldo local (antes via.placeholder.com, que dejó de existir: se veía la imagen rota)
window.UG_PH = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><rect width="320" height="180" fill="#12141c"/><text x="160" y="98" font-family="sans-serif" font-size="18" font-weight="700" fill="#3a3f4d" text-anchor="middle">UpGames</text></svg>');

// ═══════════════════════════════════════════════════════════
// UPGAMES — BIBLIOTECA REDESIGN v3.0
// Mobile-first · App Store style
// ═══════════════════════════════════════════════════════════

const API_URL = "https://upgames-production.up.railway.app";

// ── Sesión caducada o revocada: salir limpio en vez de quedar "conectado" con todo fallando ──
// (pasa al cambiar la contraseña en otro dispositivo, o cuando el token vence a los 30 días)
(function vigilarSesion() {
  const original = window.fetch.bind(window);
  let saliendo = false;
  window.fetch = async (input, init = {}) => {
    const r = await original(input, init);
    try {
      const url = typeof input === 'string' ? input : input?.url || '';
      const auth = init?.headers && (init.headers.Authorization || init.headers.authorization || (init.headers.get && init.headers.get('Authorization')));
      if (r.status === 401 && auth && url.startsWith(API_URL) && !saliendo) {
        const d = await r.clone().json().catch(() => ({}));
        if (['SESSION_REVOKED', 'TOKEN_EXPIRED', 'TOKEN_INVALID'].includes(d.code)) {
          saliendo = true;
          try { localStorage.removeItem('token'); localStorage.removeItem('user_admin'); sessionStorage.setItem('ug_sesion_msg', d.error || 'Vuelve a iniciar sesión'); } catch (_) {}
          location.replace('../login.html');
        }
      }
    } catch (_) {}
    return r;
  };
})();

// ── SAFE LOCALSTORAGE (modo incógnito estricto no rompe la app) ──────────
// Catálogo: portadas al ancho de la tarjeta, sin recortar (la tarjeta ya recorta con object-fit)
const CLD_TILE_FEED = 'c_limit,w_560,q_auto,f_auto', CLD_DESTACADA = 'c_limit,w_1100,q_auto,f_auto';
const LS = {
  get(k, fallback='') {
    try { return localStorage.getItem(k) ?? fallback; } catch(_) { return fallback; }
  },
  set(k, v) {
    try { localStorage.setItem(k, v); } catch(_) {}
  },
  remove(k) {
    try { localStorage.removeItem(k); } catch(_) {}
  },
  getJSON(k, fallback=null) {
    try { const r=localStorage.getItem(k); return r ? JSON.parse(r) : fallback; } catch(_) { return fallback; }
  },
  setJSON(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch(_) {}
  }
};

// ── INVITADOS ────────────────────────────────────────────
// Ver, buscar y descargar es libre. Interactuar (comentar, favoritos, seguir, reportar,
// publicar, comprar, chatear en lives y Nexus) pide una cuenta: se muestra una hoja
// que lleva al login y luego devuelve al usuario exactamente a donde estaba.
const ugSesion = () => !!(LS.get('token') && LS.get('user_admin'));
function ugUrlLogin(registro) {
  const aqui = './public/' + location.pathname.split('/').pop() + location.search.replace(/[^\w=&%.~+?-]/g, '');
  return `../login.html?volver=${encodeURIComponent(aqui)}${registro ? '&registro=1' : ''}`;
}
function ugPedirSesion(accion = 'interactuar') {
  if (ugSesion()) return true;
  let h = document.getElementById('ug-login-sheet');
  if (!h) {
    const st = document.createElement('style');
    st.textContent = `#ug-login-sheet{position:fixed;inset:0;z-index:99990;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.6);backdrop-filter:blur(4px)}
#ug-login-sheet .ugl{width:min(440px,100%);background:#12141b;border:1px solid rgba(50,213,131,.25);border-radius:22px 22px 0 0;padding:22px 20px calc(22px + env(safe-area-inset-bottom));text-align:center;color:#e9ecf3;animation:uglUp .22s ease}
@media(min-width:600px){#ug-login-sheet{align-items:center}#ug-login-sheet .ugl{border-radius:22px}}
@keyframes uglUp{from{transform:translateY(30px);opacity:0}}
#ug-login-sheet .ic{font-size:2.2rem}#ug-login-sheet h3{margin:6px 0 4px;font-size:1.15rem}#ug-login-sheet p{margin:0 0 16px;color:#A3A8B6;font-size:.9rem;line-height:1.45}
#ug-login-sheet a{display:block;padding:13px;border-radius:14px;font-weight:800;text-decoration:none;margin-top:8px;font-size:.95rem}
#ug-login-sheet .p{background:#32D583;color:#04110a}#ug-login-sheet .s{border:1px solid rgba(255,255,255,.14);color:#e9ecf3}
#ug-login-sheet button{margin-top:10px;background:none;border:0;color:#8a90a0;font-size:.85rem;padding:6px 12px;cursor:pointer}`;
    document.head.appendChild(st);
    h = document.createElement('div'); h.id = 'ug-login-sheet'; h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true');
    h.onclick = e => { if (e.target === h || e.target.dataset.cerrar !== undefined) h.remove(); };
  }
  h.innerHTML = `<div class="ugl"><div class="ic">🎮</div><h3>Crea tu cuenta gratis para ${escH(accion)}</h3>
    <p>Sin cuenta puedes ver y descargar todo. Con una cuenta además comentas, guardas favoritos, sigues creadores, chateas en los lives, publicas, ganas dinero y usas NEXUS IA.</p>
    <a class="p" href="${ugUrlLogin(true)}">Crear cuenta gratis</a><a class="s" href="${ugUrlLogin(false)}">Ya tengo cuenta · Iniciar sesión</a>
    <button type="button" data-cerrar>Ahora no</button></div>`;
  document.body.appendChild(h);
  return false;
}
window.ugPedirSesion = ugPedirSesion;
// ── Contador de UpCoins en la cabecera (comprados + ganados; toca para recargar) ──
function ugContadorUC(total) {
  if (!ugSesion()) return;
  const acc = document.querySelector('.hdr-actions'); if (!acc) return;
  let b = document.getElementById('hdr-uc');
  if (!b) {
    b = document.createElement('button'); b.id = 'hdr-uc'; b.type = 'button'; b.title = 'Tus UpCoins'; b.setAttribute('aria-label', 'Tus UpCoins');
    b.style.cssText = 'display:inline-flex;align-items:center;gap:5px;height:38px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,204,77,.35);background:rgba(255,204,77,.1);color:#ffcc4d;font-weight:800;font-size:.85rem;cursor:pointer;font-family:inherit;white-space:nowrap';
    b.onclick = () => { switchTab('economia'); setTimeout(() => { document.getElementById('eco-tienda')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); ecoAbrirTienda(); }, 350); };
    acc.insertBefore(b, acc.firstChild);
  }
  const pintar = t => { const n = Math.floor(t || 0); b.innerHTML = `🪙 <span>${n >= 1e4 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : n.toLocaleString('es-CO')}</span>`; };
  if (typeof total === 'number') return pintar(total);
  fetch(`${API_URL}/monedas/saldo`, { headers: { Authorization: `Bearer ${LS.get('token')}` } }).then(r => r.ok ? r.json() : null).then(d => d?.success && pintar(d.upcoins?.total ?? d.monedas)).catch(() => {});
}
window.ugContadorUC = ugContadorUC;
document.addEventListener('DOMContentLoaded', () => ugContadorUC());
window.addEventListener('ug:upcoins', () => ugContadorUC());

// ── Menú rápido radial: el orbe de la cabecera despliega las opciones en abanico ──
// Las burbujas se reparten en un cuarto de círculo hacia abajo-izquierda del orbe;
// las etiquetas van por fuera, sobre el mismo radio, para que nunca se pisen.
const UGR = (() => {
  let abierto = false;
  const raiz = () => document.getElementById('hdr-radial'), orbe = () => document.getElementById('hdr-orb');
  const ACCIONES = {
    live: () => { location.href = './live.html'; },
    subir: () => switchTab('upload'),
    premium: () => { switchTab('economia'); setTimeout(() => window.ecoCargarPlan?.(true), 350); },
    soporte: () => handleMail(),
  };
  function colocar() {
    const r = raiz(), o = orbe(); if (!r || !o) return;
    const b = o.getBoundingClientRect();
    r.style.setProperty('--ox', `${b.left + b.width / 2}px`); r.style.setProperty('--oy', `${b.top + b.height / 2}px`);   // --cy ya es el color cian
    const items = [...r.querySelectorAll('.ugr-item')], n = items.length;
    // Orbe pegado al borde (móviles angostos): el abanico termina un poco antes de "abajo"
    // para que la última etiqueta no se salga por la derecha.
    const fin = innerWidth - (b.left + b.width / 2) < 45 ? 102 : 90, arco = 180 - fin;
    const R = Math.min(n > 4 ? (arco < 90 ? 166 : 150) : 132, (innerWidth - 40) * 0.6);
    items.forEach((it, i) => {
      const ang = (180 - (n > 1 ? i * arco / (n - 1) : arco / 2)) * Math.PI / 180;   // 180° = izquierda · 90° = abajo
      const x = R * Math.cos(ang), y = R * Math.sin(ang);
      it.style.setProperty('--x', `${x.toFixed(1)}px`); it.style.setProperty('--y', `${y.toFixed(1)}px`);
      it.style.setProperty('--lx', `${(Math.cos(ang) * 62).toFixed(1)}px`); it.style.setProperty('--ly', `${(Math.sin(ang) * 44).toFixed(1)}px`);
      it.style.setProperty('--i', i);
    });
  }
  function abrir() {
    const r = raiz(); if (!r || abierto) return;
    abierto = true; colocar();
    r.classList.add('open'); r.setAttribute('aria-hidden', 'false');
    orbe()?.setAttribute('aria-expanded', 'true'); orbe()?.classList.add('on');
    setTimeout(() => r.querySelector('.ugr-item')?.focus({ preventScroll: true }), 120);
  }
  function cerrar(volverFoco) {
    const r = raiz(); if (!r || !abierto) return;
    abierto = false;
    r.classList.remove('open'); r.setAttribute('aria-hidden', 'true');
    orbe()?.setAttribute('aria-expanded', 'false'); orbe()?.classList.remove('on');
    if (volverFoco) orbe()?.focus({ preventScroll: true });
  }
  document.addEventListener('DOMContentLoaded', () => {
    const r = raiz(), o = orbe(); if (!r || !o) return;
    o.addEventListener('click', e => { e.stopPropagation(); abierto ? cerrar() : abrir(); });
    r.addEventListener('click', e => {
      if (e.target.closest('[data-ugr-cerrar]')) return cerrar(true);
      const it = e.target.closest('.ugr-item[data-ugr]'); if (!it) return;
      cerrar(); ACCIONES[it.dataset.ugr]?.();
    });
    r.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); return cerrar(true); }
      if (!/^Arrow/.test(e.key)) return;
      const l = [...r.querySelectorAll('.ugr-item')], i = l.indexOf(document.activeElement);
      e.preventDefault(); l[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + l.length) % l.length]?.focus();
    });
    addEventListener('resize', () => cerrar());
    addEventListener('scroll', () => cerrar(), { passive: true });
  });
  return { abrir, cerrar, colocar, get abierto() { return abierto; } };
})();
window.UGR = UGR;

// Invitados: botón "Entrar" en la cabecera (en lugar de pedir cuenta para mirar)
document.addEventListener('DOMContentLoaded', () => {
  if (ugSesion()) return;
  const acc = document.querySelector('.hdr-actions');
  if (!acc || document.getElementById('hdr-entrar')) return;
  const a = document.createElement('a');
  a.id = 'hdr-entrar'; a.href = ugUrlLogin(false); a.textContent = 'Entrar';
  a.style.cssText = 'display:inline-flex;align-items:center;padding:0 14px;height:38px;border-radius:999px;background:#32D583;color:#04110a;font-weight:800;font-size:.85rem;text-decoration:none;white-space:nowrap';
  acc.appendChild(a);
});

// State
let todosLosItems = [];
let filteredItems = [];
let mapaUsuarios = {};
let currentItem = null;
let currentTab = 'main';
let activeCategory = '';
let reportItemId = null;
let currentObserver = null;

// ── PRELOADER ─────────────────────────────────────────────
(function initPreloader() {
  const fill = document.getElementById('pl-fill');
  const preloader = document.getElementById('preloader');
  let closed = false;

  // Animar barra con delays absolutos: 30% → 55% → 75%
  setTimeout(() => { if(!closed) fill.style.width='30%'; }, 0);
  setTimeout(() => { if(!closed) fill.style.width='55%'; }, 300);
  setTimeout(() => { if(!closed) fill.style.width='75%'; }, 700);

  // Antes arrancaba solo un tutorial de 54 pasos que bloqueaba la pantalla. Ahora la
  // ayuda es la Guía de inicio y pistas puntuales (upgames-guia.js), sin bloquear nada.
  function afterPreloader() {}

  window.closePreloader = function() {
    if(closed) return;
    closed = true;
    fill.style.width='100%';
    setTimeout(()=>{
      preloader.classList.add('hide');
      if(typeof startTutorial === 'function') afterPreloader();
    }, 350);
  };

  // Si no hay caché, mostrar mensaje de estado al usuario
  const hasCachedItems = (()=>{ try{ const r=localStorage.getItem('upgames_items_cache'); if(!r) return false; const {ts}=JSON.parse(r); return (Date.now()-ts) < 120000; }catch(_){ return false; } })();
  if(!hasCachedItems) {
    const sub = preloader.querySelector('.pl-sub');
    if(sub) {
      setTimeout(()=>{ if(!closed) sub.textContent='CONECTANDO CON EL SERVIDOR...'; }, 800);
      setTimeout(()=>{ if(!closed) sub.textContent='EL SERVIDOR PUEDE TARDAR HASTA 30s...'; }, 4000);
    }
  }

  setTimeout(()=>{ window.closePreloader && window.closePreloader(); }, 1500);
})();

// (Se quitaron los "pings de despertar" no-cors: en Railway el backend no se
// duerme, el navegador descartaba su respuesta (CORP same-origin) y cada visita
// descargaba el catálogo y la lista de usuarios de más.)

// ── CACHE SYSTEM ──────────────────────────────────────────
const CACHE_KEY_ITEMS   = 'upgames_items_cache';
const CACHE_KEY_USERS   = 'upgames_users_cache';
const CACHE_TTL         = 10 * 60 * 1000; // 10 minutos

function cacheSet(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch(_) {}
}

function cacheGet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch(_) { return null; }
}

// ── TOAST ─────────────────────────────────────────────────
// Ajustes (biblioteca.html) llama a showToast(msg, 'error'|'success'): no existía y cada aviso
// lanzaba un error silencioso (el usuario no veía si su cambio funcionó).
function showToast(msg, tipo) { toast((tipo === 'error' ? '⚠️ ' : tipo === 'success' ? '✅ ' : '') + msg, tipo === 'error' ? 3800 : 2600); }
function toast(msg, dur=2500) {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className='toast'; t.textContent=msg;
  c.appendChild(t);
  setTimeout(()=>{
    t.classList.add('out');
    setTimeout(()=>t.remove(), 320);
  }, dur);
}

// ── CUSTOM CONFIRM (reemplaza confirm() nativo) ────────────
function customConfirm({ icon='⚠️', title='', msg='', okText='Confirmar', okDanger=false } = {}) {
  return new Promise(resolve => {
    const el = document.getElementById('custom-confirm');
    document.getElementById('cc-icon').textContent = icon;
    document.getElementById('cc-title').textContent = title;
    document.getElementById('cc-msg').textContent = msg;
    const okBtn = document.getElementById('cc-ok');
    okBtn.textContent = okText;
    okBtn.className = 'cc-btn confirm' + (okDanger ? ' danger' : '');
    el.classList.add('show');
    document.body.style.overflow = 'hidden';
    const close = (val) => {
      el.classList.remove('show');
      document.body.style.overflow = '';
      resolve(val);
    };
    okBtn.onclick = () => close(true);
    document.getElementById('cc-cancel').onclick = () => close(false);
    el.onclick = (e) => { if(e.target === el) close(false); };
  });
}

// ── FORMAT NUMBER ─────────────────────────────────────────
function fmt(n) {
  if(n>=1e6) return (n/1e6).toFixed(1)+'M';
  if(n>=1e3) return (n/1e3).toFixed(1)+'K';
  return n||'0';
}

// ── TIME AGO ──────────────────────────────────────────────
function timeAgo(d) {
  const diff = Date.now()-new Date(d).getTime();
  const m=Math.floor(diff/60000), h=Math.floor(m/60), days=Math.floor(h/24);
  if(m<1) return 'Ahora';
  if(m<60) return m+'m';
  if(h<24) return h+'h';
  if(days<7) return days+'d';
  return new Date(d).toLocaleDateString('es-ES',{day:'numeric',month:'short'});
}

// ── VERIFICATION BADGE ────────────────────────────────────
function getBadge(usuario) {
  const n = mapaUsuarios[usuario]||0;
  if(!n) return '';
  const cls = ['','lv1','lv2','lv3'][n]||'lv3';
  return `<ion-icon name="checkmark-circle" class="verificado-badge ${cls}" title="Verificado nivel ${n}"></ion-icon>`;
}

// ── AVATAR LETTER ─────────────────────────────────────────
function avatarLetter(str) {
  return (str||'?')[0].toUpperCase();
}

