/* ═══════════════════════════════════════════════════════════════
   UpGames · Intro «Entrar a la red» (public/intro/)
   ───────────────────────────────────────────────────────────────
   • Se muestra a pantalla completa la primera vez que alguien entra
     desde un dispositivo (localStorage 'ug_intro_visto').
   • ?intro la fuerza siempre; ?nointro la evita.
   • No se muestra a buscadores ni con «reducir movimiento» activo.
   • La intro trae su propio botón SALTAR; al terminar o saltar avisa
     con postMessage('ug-intro-fin') y aquí se retira con un fundido.
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var q = location.search;
  var forzar = /[?&]intro\b/.test(q);
  if (/[?&]nointro\b/.test(q)) return;
  var visto = null;
  try { visto = localStorage.getItem('ug_intro_visto'); } catch (e) {}
  if (!forzar) {
    if (visto) return;
    if (/bot|crawl|spider|slurp|lighthouse|headless|preview/i.test(navigator.userAgent || '')) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.top !== window) return;   // dentro de otro marco, no
  }
  var base = (document.currentScript && document.currentScript.src || location.href).replace(/[^/]*$/, '');
  var f = document.createElement('iframe');
  f.src = base + 'intro/index.html?v=20261108a';
  f.title = 'Intro de UpGames';
  f.allow = 'autoplay; fullscreen';
  f.setAttribute('style', 'position:fixed;inset:0;width:100%;height:100%;border:0;z-index:2147483000;background:#020409;opacity:1;transition:opacity .6s ease');
  var root = document.documentElement;
  var overflowPrevio = root.style.overflow;
  root.style.overflow = 'hidden';
  root.appendChild(f);   // se monta antes de que exista <body>: cubre la página desde el primer cuadro

  var cerrado = false;
  function cerrar() {
    if (cerrado) return; cerrado = true;
    try { localStorage.setItem('ug_intro_visto', String(Date.now())); } catch (e) {}
    f.style.opacity = '0';
    root.style.overflow = overflowPrevio;
    setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 700);
    window.removeEventListener('message', alMensaje);
  }
  function alMensaje(e) { if (e.source === f.contentWindow && e.data === 'ug-intro-fin') cerrar(); }
  window.addEventListener('message', alMensaje);
  // Red de seguridad: si algo falla, la página nunca queda tapada
  setTimeout(cerrar, 95000);
  f.addEventListener('error', cerrar);
})();
