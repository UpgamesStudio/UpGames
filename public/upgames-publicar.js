/* ═══════════════════════════════════════════════════════════════
   UpGames · Publicar por pasos (asistente)
   ───────────────────────────────────────────────────────────────
   1. ¿Qué deseas publicar hoy?     → categoría
   2. ¿Cómo se llamará…?            → nombre, descripción, imágenes/videos
   3. Agrega el enlace              → enlace (+ detalles y guía, opcional)
   4. Revisa y publica              → Nexus revisa; aviso si el nombre es de un
                                      juego comercial (no gana UpCoins mientras se
                                      verifica); declaración solo en Juegos.
   Los campos y la lógica de publicar siguen en script.js (mismos ids).
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const TOTAL = 4;
  let raiz = null, paso = 1;

  const esVideo = () => ($('pf-addCategory')?.value || 'Juego') === 'Video';
  const formActual = () => (esVideo() ? $('pf-form-video') : $('pf-form-standard'));
  const val = id => ($(id)?.value || '').trim();


  function pintar() {
    if (!raiz) return;
    raiz.dataset.paso = paso;
    raiz.querySelectorAll('.pfw-paso').forEach(el => { el.hidden = Number(el.dataset.paso) !== paso || (paso > 1 && !formActual()?.contains(el)); });
    // El paso 1 vive fuera de los formularios; los demás dentro del formulario de la categoría
    const std = $('pf-form-standard'), vid = $('pf-form-video');
    if (paso === 1) { if (std) std.style.display = 'none'; if (vid) vid.style.display = 'none'; }
    else { if (std) std.style.display = esVideo() ? 'none' : 'block'; if (vid) vid.style.display = esVideo() ? 'block' : 'none'; }
    raiz.querySelector('.pfw-prog i').style.width = `${(paso - 1) / (TOTAL - 1) * 100}%`;
    raiz.querySelectorAll('.pfw-pasos span').forEach(s => { const n = Number(s.dataset.n); s.classList.toggle('on', n === paso); s.classList.toggle('hecho', n < paso); });
    $('pfw-atras').hidden = paso === 1;
    $('pfw-sig').hidden = paso === 1 || paso === TOTAL;   // paso 1 avanza al elegir; el 4 publica
    const decl = $('pfw-declara'); if (decl) decl.hidden = val('pf-addCategory') !== 'Juego';
    if (paso === 4 && !esVideo()) alLlegarAlFinal();
    if (paso === 4 && esVideo() && typeof window.pfUpdateVideoPreview === 'function') window.pfUpdateVideoPreview();
  }
  function ir(n, desplazar = true) {
    paso = Math.max(1, Math.min(TOTAL, n));
    pintar();
    if (desplazar) raiz.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const foco = raiz.querySelector(`.pfw-paso[data-paso="${paso}"]:not([hidden]) input:not([type=hidden]):not([type=checkbox]), .pfw-paso[data-paso="${paso}"]:not([hidden]) textarea`);
    if (foco && paso > 1 && !foco.value) setTimeout(() => foco.focus({ preventScroll: true }), 250);
  }
  const avisar = msg => (typeof toast === 'function' ? toast(msg) : alert(msg));

  /** ¿Se puede pasar al siguiente paso? (muestra qué falta) */
  function valido() {
    if (esVideo()) {
      if (paso === 2 && val('pf-vid-title').length < 3) return avisar('✏️ Escribe un título para tu video'), false;
      if (paso === 3 && !val('pf-vid-url')) return avisar('🎬 Sube tu video para continuar'), false;
      return true;
    }
    if (paso === 2) {
      if (val('pf-addTitle').length < 3) return avisar('✏️ Escribe el nombre de tu publicación'), false;
      if (!val('pf-addImage')) return avisar('🖼️ Agrega una portada: las publicaciones con imagen se descargan mucho más'), false;
    }
    if (paso === 3) {
      const link = val('pf-addLink');
      if (!link) return avisar('🔗 Pega el enlace de descarga'), false;
      const r = typeof window.pfAnalizarLink === 'function' ? window.pfAnalizarLink(link) : { ok: true };
      if (r.ok === false) return avisar(r.msg || 'Revisa el enlace'), false;
    }
    return true;
  }

  // Paso 4: Nexus revisa (rápido, sin IA) y, si el nombre es de un juego comercial, se avisa arriba
  let firmaRevisada = '';
  async function alLlegarAlFinal() {
    if (typeof window.pfUpdatePreview === 'function') window.pfUpdatePreview();
    const firma = [val('pf-addTitle'), val('pf-addLink'), val('pf-addImage'), val('pf-addCategory')].join('|');
    if (firma === firmaRevisada || typeof window.pfRevisarConNexus !== 'function') return;
    firmaRevisada = firma;
    const out = $('pf-nexus-res');
    if (out) out.innerHTML = '<div class="pf-nx-load"><span class="pf-nx-orb"></span><div><b>Nexus está analizando tu publicación…</b><small>Enlace, portada, texto y nombre</small></div></div>';
    const r = await window.pfRevisarConNexus(false);
    if (!r && out) out.innerHTML = '';
  }

  // Aviso en vivo mientras escribe el nombre: el servidor (modulos/sospecha.js) tiene la lista
  // completa de juegos comerciales y las mismas reglas que se aplican al publicar
  const API = (typeof API_URL !== 'undefined' && API_URL) || 'https://upgames-production.up.railway.app';
  let tmr = null, seq = 0;
  function avisoComercial() {
    clearTimeout(tmr);
    tmr = setTimeout(async () => {
      const box = $('pfw-aviso-com'), t = val('pf-addTitle'), n = ++seq; if (!box) return;
      if (t.length < 3) { box.hidden = true; return; }
      try {
        const d = await (await fetch(`${API}/publicar/sospecha?titulo=${encodeURIComponent(t)}&categoria=${encodeURIComponent(val('pf-addCategory'))}`)).json();
        if (n !== seq) return;
        box.hidden = !d?.sospecha;
        if (d?.sospecha) box.innerHTML = `<ion-icon name="alert-circle"></ion-icon><span><b>Nombre de un juego comercial.</b> ${String(d.mensaje).replace(/[<>&]/g, '')} Mientras se verifica no ganarás UpCoins.</span>`;
      } catch (_) {}
    }, 600);
  }

  function reiniciar() {
    firmaRevisada = '';
    const box = $('pfw-aviso-com'); if (box) box.hidden = true;
    const out = $('pf-nexus-res'); if (out) out.innerHTML = '';
    ir(1, false);
  }

  function iniciar() {
    raiz = document.querySelector('.pfw'); if (!raiz) return;
    // Paso 1: elegir categoría avanza solo
    raiz.querySelectorAll('#pf-cat-grid .pf-cat-btn').forEach(b => b.addEventListener('click', () => { setTimeout(() => ir(2), 140); avisoComercial(); }));
    $('pfw-atras').onclick = () => ir(paso - 1);
    $('pfw-sig').onclick = () => { if (valido()) ir(paso + 1); };
    $('pf-addTitle')?.addEventListener('input', avisoComercial);
    $('pf-declara')?.addEventListener('change', () => $('pfw-declara')?.classList.remove('pfw-falta'));
    // Enter en un campo de una línea = Siguiente
    raiz.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.matches('input.pf-input') && paso > 1 && paso < TOTAL) { e.preventDefault(); if (valido()) ir(paso + 1); }
    });
    pintar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();

  window.UGPublicar = { ir, reiniciar, get paso() { return paso; } };
})();
