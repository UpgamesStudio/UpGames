/* ═══════════════════════════════════════════════════════════════
   UpGames · Métricas anónimas de producto
   Un id aleatorio por navegador (ug_vid). Sin IP, sin cuenta, sin datos
   personales. Si el navegador pide "No rastrear", no se envía nada.
   Eventos: visita · busqueda (con cuántos resultados) · ficha · descarga · registro
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const API = 'https://upgames-production.up.railway.app';
  const noRastrear = navigator.doNotTrack === '1' || window.doNotTrack === '1';
  function vid() {
    try {
      let v = localStorage.getItem('ug_vid');
      if (!v) { v = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, '').slice(0, 32); localStorage.setItem('ug_vid', v); }
      return v;
    } catch (_) { return null; }
  }
  function evento(tipo, extra) {
    if (noRastrear) return;
    const v = vid(); if (!v) return;
    // text/plain: sin preflight CORS (el servidor lo lee como JSON)
    const body = JSON.stringify({ vid: v, tipo, ...(extra || {}) });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(`${API}/m/e`, new Blob([body], { type: 'text/plain' }))) return;
    } catch (_) {}
    fetch(`${API}/m/e`, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'text/plain' }, body }).catch(() => {});
  }
  // Búsquedas: solo la frase final (no cada letra) y una vez por frase
  let tB = null, ultimaQ = '';
  function busqueda(q, n) {
    clearTimeout(tB);
    tB = setTimeout(() => { q = String(q || '').trim().toLowerCase(); if (q.length < 2 || q === ultimaQ) return; ultimaQ = q; evento('busqueda', { q: q.slice(0, 60), n }); }, 1500);
  }

  if (/biblioteca\.html|\/public\/?$/.test(location.pathname)) {
    evento('visita');
    addEventListener('ug:detalle', () => evento('ficha'));
    // "Obtener link" (va a la página puente)
    document.addEventListener('click', e => { if (e.target.closest?.('a[href*="puente.html"]')) evento('descarga'); }, true);
  }
  window.UGM = { evento, busqueda };
})();
