/* ═══════════════════════════════════════════════════════════════
   UpGames · Compatibilidad real por dispositivo
   "Funcionó en mi Snapdragon 8 Gen 2 a 45 FPS con Winlator"
   • En la ficha: resumen de la comunidad, por gama y "en equipos como el tuyo".
   • Reportar: el navegador detecta GPU/modelo/RAM; el usuario confirma el procesador,
     elige cómo le fue, los FPS y con qué lo ejecutó. Una opinión por cuenta (se puede cambiar).
   Servidor: rutas/compat.js
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const API = (typeof API_URL !== 'undefined' && API_URL) || 'https://upgames-production.up.railway.app';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ls = k => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  const RES = { funciona: ['✅', 'Funciona'], ajustes: ['⚙️', 'Con ajustes'], no: ['❌', 'No funciona'] };
  const APPS = [['nativo', 'Nativo'], ['winlator', 'Winlator'], ['gamehub', 'GameHub'], ['mobox', 'Mobox'], ['emulador', 'Emulador'], ['pc', 'PC'], ['otro', 'Otro']];
  const FPS = [[15, '< 20'], [25, '20–30'], [38, '30–45'], [52, '45–60'], [60, '60+']];
  let item = null, equipo = null, pedido = 0;

  async function miEquipo() {
    if (equipo) return equipo;
    const d = window.UGDispositivo ? await window.UGDispositivo().catch(() => null) : null;
    let sug = {};
    if (d?.gpu) { try { sug = await (await fetch(`${API}/compat/equipo?gpu=${encodeURIComponent(d.gpu)}`)).json(); } catch (_) {} }
    equipo = { d: d || {}, familia: sug.familia || '', chip: sug.chip || '', nombreGama: sug.nombreGama || '' };
    return equipo;
  }
  const barra = r => {
    const n = Math.max(1, r.n), p = k => Math.round(r[k] / n * 100);
    return `<div class="ucx-barra" title="${r.funciona} funciona · ${r.ajustes} con ajustes · ${r.no} no"><i class="si" style="width:${p('funciona')}%"></i><i class="aj" style="width:${p('ajustes')}%"></i><i class="no" style="width:${p('no')}%"></i></div>`;
  };
  const frase = r => { if (!r.n) return 'Sin reportes'; const k = r.funciona + r.ajustes; return `${k} de ${r.n} ${r.n === 1 ? 'equipo' : 'equipos'} lo ${k === 1 ? 'hizo' : 'hicieron'} funcionar${r.fps ? ` · ~${r.fps} FPS` : ''}`; };

  async function pintar() {
    const caja = $('ds-compat'); if (!caja) return;
    const n = ++pedido, it = item;
    if (!it || it.category === 'Video') { caja.hidden = true; return; }
    caja.hidden = false;
    caja.innerHTML = '<div class="ucx"><div class="ucx-h"><b>📱 Compatibilidad real</b><small>reportada por la comunidad</small></div><p class="ucx-p">Cargando…</p></div>';
    const eq = await miEquipo();
    let d = null;
    try { d = await (await fetch(`${API}/items/${it._id}/compat?gpu=${encodeURIComponent(eq.d.gpu || '')}`)).json(); } catch (_) {}
    if (n !== pedido) return;
    const T = d?.total || { n: 0 };
    const tuyo = d?.tuyo;
    const nombreEquipo = eq.chip || eq.familia || eq.d.modelo || 'tu equipo';
    caja.innerHTML = `<div class="ucx">
      <div class="ucx-h"><b>📱 Compatibilidad real</b><small>${T.n ? `${T.n} ${T.n === 1 ? 'reporte' : 'reportes'} de la comunidad` : 'aún sin reportes'}</small></div>
      ${T.n ? `<div class="ucx-total">${barra(T)}<span>${esc(frase(T))}</span></div>` : '<p class="ucx-p">Sé el primero en contar cómo te funcionó: ayudas a que otros sepan si vale la pena descargarlo.</p>'}
      ${tuyo && tuyo.n ? `<div class="ucx-tuyo"><span class="ucx-tuyo-ic">🎯</span><div><b>En ${tuyo.exacto ? `equipos con ${esc(tuyo.familia)}` : `${esc((tuyo.nombreGama || 'tu gama').toLowerCase())}`}${tuyo.exacto && eq.chip ? ` (${esc(eq.chip)})` : ''}</b>
          <small>${esc(frase(tuyo))}${tuyo.no ? ` · ${tuyo.no} no ${tuyo.no === 1 ? 'pudo' : 'pudieron'}` : ''}</small></div></div>` : ''}
      ${(d?.porGama || []).length > 1 ? `<div class="ucx-gamas">${d.porGama.map(g => `<div><span>${esc(g.nombre)}</span>${barra(g)}<small>${g.funciona + g.ajustes}/${g.n}${g.fps ? ` · ${g.fps} FPS` : ''}</small></div>`).join('')}</div>` : ''}
      ${(d?.recientes || []).length ? `<details class="ucx-lista"><summary>Ver reportes (${d.recientes.length})</summary>${d.recientes.map(r => `<div class="ucx-rep"><span>${RES[r.resultado]?.[0] || '•'}</span><div><b>${esc(r.equipo)}</b>${r.fps ? ` · ${r.fps} FPS` : ''}${r.app && r.app !== 'otro' ? ` · ${esc((APPS.find(a => a[0] === r.app) || [, r.app])[1])}` : ''}${r.ram ? ` · ${r.ram >= 8 ? '8 GB+' : r.ram + ' GB'} RAM` : ''}${r.nota ? `<small>${esc(r.nota)}</small>` : ''}</div></div>`).join('')}</details>` : ''}
      <button type="button" class="ucx-btn" id="ucx-reportar">✍️ Contar cómo me funcionó en ${esc(nombreEquipo)}</button>
      <div class="ucx-form" id="ucx-form" hidden></div>
    </div>`;
    $('ucx-reportar').onclick = abrirForm;
  }

  async function abrirForm() {
    if (!ls('token')) { window.ugPedirSesion?.('contar cómo te funcionó'); return; }
    const f = $('ucx-form'); if (!f) return;
    const eq = await miEquipo();
    let resultado = null, fps = null, app = /android/i.test(eq.d.so || navigator.userAgent) ? 'winlator' : 'pc';
    const det = [eq.d.modelo, eq.familia, eq.d.ramGB ? `${eq.d.ramGB >= 8 ? '8 GB+' : '≈' + eq.d.ramGB + ' GB'} RAM` : ''].filter(Boolean).join(' · ');
    f.hidden = false;
    f.innerHTML = `
      <label class="ucx-lbl">Tu procesador</label>
      <input type="text" class="pf-input ucx-chip" maxlength="40" value="${esc(eq.chip)}" placeholder="Ej: Snapdragon 8 Gen 2, Dimensity 8100, Ryzen 5…">
      <small class="ucx-det">Detectado: ${esc(det || 'no se pudo identificar tu equipo')}</small>
      <label class="ucx-lbl">¿Cómo te funcionó?</label>
      <div class="ucx-ops" data-g="resultado">${Object.entries(RES).map(([k, [ic, t]]) => `<button type="button" data-v="${k}">${ic} ${t}</button>`).join('')}</div>
      <label class="ucx-lbl">FPS aproximados <small>(opcional)</small></label>
      <div class="ucx-ops" data-g="fps">${FPS.map(([v, t]) => `<button type="button" data-v="${v}">${t}</button>`).join('')}</div>
      <label class="ucx-lbl">Lo ejecuté con</label>
      <div class="ucx-ops" data-g="app">${APPS.map(([k, t]) => `<button type="button" data-v="${k}" class="${k === app ? 'on' : ''}">${t}</button>`).join('')}</div>
      <label class="ucx-lbl">Ajustes que usaste <small>(opcional)</small></label>
      <textarea class="pf-textarea ucx-nota" maxlength="300" rows="2" placeholder="Ej: Box64 Performance, DXVK 2.3, resolución 720p"></textarea>
      <button type="button" class="ucx-enviar" disabled>Publicar mi reporte</button>`;
    f.querySelectorAll('.ucx-ops').forEach(g => g.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      g.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b && !(g.dataset.g === 'fps' && b.classList.contains('on'))));
      const v = b.classList.contains('on') ? b.dataset.v : null;
      if (g.dataset.g === 'resultado') resultado = v; else if (g.dataset.g === 'fps') fps = v ? Number(v) : null; else app = v || 'otro';
      f.querySelector('.ucx-enviar').disabled = !resultado;
    }));
    f.querySelector('.ucx-enviar').onclick = async ev => {
      const b = ev.currentTarget; b.disabled = true; b.textContent = 'Guardando…';
      try {
        const r = await fetch(`${API}/items/${item._id}/compat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ls('token')}` },
          body: JSON.stringify({ dispositivo: eq.d, chip: f.querySelector('.ucx-chip').value, resultado, fps, app, nota: f.querySelector('.ucx-nota').value }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.success) throw new Error(d.error || 'No se pudo guardar');
        if (typeof toast === 'function') toast('✅ ¡Gracias! Tu reporte ayuda a toda la comunidad');
        pintar();
      } catch (e) { b.disabled = false; b.textContent = 'Publicar mi reporte'; if (typeof toast === 'function') toast('❌ ' + e.message); }
    };
    f.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function montar() {
    const ancla = $('ds-guia') || $('ds-serie');
    if (!ancla || $('ds-compat')) return;
    const c = document.createElement('div'); c.id = 'ds-compat'; c.hidden = true;
    ancla.after(c);
  }
  addEventListener('ug:detalle', e => {
    montar();
    item = (typeof currentItem !== 'undefined' && currentItem?._id === e.detail) ? currentItem : null;
    pintar();
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();
