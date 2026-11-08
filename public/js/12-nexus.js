// ── NEXUS IA (nativa) ────────────────────────────────────
// Nexus vive en el backend de UpGames (/nexus/*): misma base de datos y
// servidor. Aquí solo está el chat: mensajes, tarjetas tocables y botones.
let nxOpen=false, nxExpanded=false;
const NX = { cargado:false, enviando:false, msgs:[] };   // msgs: [{rol, texto, items, acciones}]
const NX_SUGERENCIAS_INV = ['¿Qué me recomiendas descargar hoy?', '¿Cómo gano dinero publicando?', 'Mods populares para Minecraft', '¿Cómo publico mi contenido?'];
const NX_SUGERENCIAS_USR = ['Recomiéndame algo según mis gustos', '¿Cuánto llevo ganado y qué me falta para retirar?', '¿Cómo van mis publicaciones?', '¿Qué está en tendencia ahora?'];
const nxToken = () => { const t = LS.get('token'); return t && t !== 'null' && t.length > 20 ? t : ''; };
const nxHeaders = () => { const h = { 'Content-Type':'application/json' }; const t = nxToken(); if (t) h.Authorization = `Bearer ${t}`; return h; };

function nxToggle() {
  if (!nxOpen && !ugPedirSesion('usar NEXUS IA')) return;
  nxOpen=!nxOpen;
  if (nxOpen) nxCargarCuota();
  document.getElementById('nxPanel').classList.toggle('open',nxOpen);
  document.body.style.overflow = nxOpen && innerWidth < 900 ? 'hidden' : '';   // en escritorio es una ventana flotante
  document.body.classList.toggle('nx-open', nxOpen);
  if (nxOpen) { _clearNxFabBadge(); nxCargar(); setTimeout(() => { if (!matchMedia('(pointer:coarse)').matches) document.getElementById('nxInput')?.focus(); }, 300); }
}
function nxClose() {
  nxOpen=false;
  document.getElementById('nxPanel').classList.remove('open');
  document.body.style.overflow = '';
  document.body.classList.remove('nx-open');
}
function nxExpand() {
  nxExpanded=!nxExpanded;
  document.getElementById('nxPanel').classList.toggle('expanded',nxExpanded);
  const ico=document.getElementById('nxExpBtn');
  ico.innerHTML = nxExpanded
    ? '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M6 2v4H2M10 2v4h4M10 14v-4h4M6 14v-4H2"/></svg>'
    : '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/></svg>';
}

// Historial: con sesión vive en el servidor (cualquier dispositivo); invitado, en este navegador
async function nxCargar() {
  if (NX.cargado) return;
  NX.cargado = true;
  if (nxToken()) {
    try {
      const r = await fetchTimeout(`${API_URL}/nexus/historial`, 8000, { headers: nxHeaders() });
      if (r.ok) NX.msgs = ((await r.json()).historial || []).slice(-24);
    } catch (_) {}
  } else NX.msgs = LS.getJSON('nx_hist_inv', []).slice(-20);
  nxPintar();
}
function nxGuardarLocal() { if (!nxToken()) LS.setJSON('nx_hist_inv', NX.msgs.slice(-20).map(m => ({ rol:m.rol, texto:m.texto, items:m.items||[], acciones:m.acciones||[] }))); }

async function nxNuevaConversacion() {
  if (NX.enviando) return;
  NX.msgs = []; nxGuardarLocal();
  if (nxToken()) fetch(`${API_URL}/nexus/historial`, { method:'DELETE', headers:nxHeaders() }).catch(()=>{});
  nxPintar();
}

// Texto de Nexus → HTML seguro (negritas, listas y saltos de línea)
function nxFormato(t) {
  const lineas = escH(t).split('\n');
  let html = '', enLista = false;
  for (const l of lineas) {
    const m = l.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)$/);
    if (m) { if (!enLista) { html += '<ul>'; enLista = true; } html += `<li>${m[1]}</li>`; continue; }
    if (enLista) { html += '</ul>'; enLista = false; }
    html += l.trim() ? `<p>${l}</p>` : '';
  }
  if (enLista) html += '</ul>';
  return html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<i>$2</i>');
}
function nxTarjetas(items) {
  if (!items?.length) return '';
  return `<div class="nx-cards">${items.map(it => {
    const img = it.imagen && !UG_VIDEO_RE.test(it.imagen) ? cldOpt(it.imagen, 'c_fill,g_auto,w_320,h_180,q_auto,f_auto') : '';
    return `<button type="button" class="nx-card" data-nx-item="${escH(it.id)}">
      <span class="nx-card-img">${img ? `<img src="${escH(img)}" alt="" loading="lazy" onerror="this.remove()">` : '<ion-icon name="cube-outline"></ion-icon>'}${it.partes > 1 ? `<span class="nx-card-pts">${escH(it.partes)} partes</span>` : ''}</span>
      <span class="nx-card-t">${escH(it.titulo)}</span>
      <span class="nx-card-m">${escH(catLabel(it.categoria))} · ${escH(it.descargas || 0)} ↓${it.autor ? ` · @${escH(it.autor)}` : ''}</span>
    </button>`; }).join('')}</div>`;
}
function nxBotones(acciones) {
  if (!acciones?.length) return '';
  return `<div class="nx-acts">${acciones.map((a, i) => `<button type="button" class="nx-act" data-nx-act="${i}">${escH(a.etiqueta || a.valor)} <ion-icon name="arrow-forward"></ion-icon></button>`).join('')}</div>`;
}
function nxPintar(pensando = false) {
  const box = document.getElementById('nxMsgs');
  if (!box) return;
  const usuario = LS.get('user_admin');
  let html = '';
  if (!NX.msgs.length) {
    const sug = nxToken() ? NX_SUGERENCIAS_USR : NX_SUGERENCIAS_INV;
    html = `<div class="nx-hola">
      <div class="nx-hola-orb"><span></span></div>
      <h3>${usuario ? `Hola, @${escH(usuario)}` : 'Hola, soy Nexus'}</h3>
      <p>Conozco todo el catálogo de UpGames${usuario ? ', tu cuenta y tus publicaciones' : ''}. Pregúntame lo que quieras.</p>
      <div class="nx-sugs">${sug.map(s => `<button type="button" class="nx-sug" data-nx-sug="${escH(s)}">${escH(s)}</button>`).join('')}</div>
    </div>`;
  }
  html += NX.msgs.map((m, i) => m.rol === 'user'
    ? `<div class="nx-msg nx-yo"><div class="nx-bub">${escH(m.texto).replace(/\n/g, '<br>')}</div></div>`
    : m.upsell ? `<div class="nx-msg nx-ia" data-nx-i="${i}"><div class="nx-bub">${escH(m.texto)}<div class="nx-upsell"><div class="nx-upsell-acc"><button type="button" class="uc" onclick="nxDesbloquear(this)">🪙 Más mensajes con UpCoins</button><button type="button" class="pr" onclick="nxIrPremium()">⭐ Premium: NEXUS ilimitado</button></div><div class="nx-upsell-pago"></div></div></div></div>`
    : `<div class="nx-msg nx-ia${m.error ? ' nx-err' : ''}" data-nx-i="${i}"><div class="nx-bub">${nxFormato(m.texto)}</div>${nxTarjetas(m.items)}${nxBotones(m.acciones)}</div>`).join('');
  if (pensando) html += '<div class="nx-msg nx-ia"><div class="nx-bub nx-typing"><i></i><i></i><i></i></div></div>';
  box.innerHTML = html;
  box.scrollTop = box.scrollHeight;
}

function nxContexto() {
  return {
    pestana: currentTab || 'main',
    categoria: activeCategory || null,
    busqueda: document.getElementById('buscador')?.value?.trim() || null,
    itemId: document.getElementById('detail-sheet')?.classList.contains('open') ? (_viewItemId || null) : null,
  };
}

async function nxEnviar(texto, extra) {
  texto = String(texto || '').trim().slice(0, 1500);
  if (!texto || NX.enviando) return;
  NX.enviando = true;
  window.dispatchEvent(new CustomEvent('ug:guia', { detail: 'nexus' }));
  const historialInv = nxToken() ? undefined : NX.msgs.filter(m => !m.error).slice(-10).map(m => ({ rol:m.rol, texto:m.texto }));
  NX.msgs.push({ rol:'user', texto });
  nxPintar(true);
  const input = document.getElementById('nxInput'), send = document.getElementById('nxSend');
  if (send) send.disabled = true;
  try {
    const r = await fetchTimeout(`${API_URL}/nexus/chat`, 60000, { method:'POST', headers:nxHeaders(), body: JSON.stringify({ mensaje:texto, historial:historialInv, contexto:{ ...nxContexto(), ...(extra || {}) } }) });
    const d = await r.json().catch(() => ({}));
    if (d.cuota) nxPintarCuota(d.cuota);
    if (r.status === 402 && d.code === 'IA_LIMITE') { NX.msgs.pop(); NX.msgs.push({ rol:'assistant', upsell:true, texto:d.error }); return; }
    if (!r.ok || !d.ok) throw new Error(d.error || 'Nexus no pudo responder ahora.');
    NX.msgs.push({ rol:'assistant', texto:d.texto, items:d.items || [], acciones:d.acciones || [] });
  } catch (e) {
    NX.msgs.push({ rol:'assistant', error:true, texto: e.name === 'AbortError' ? 'Tardé demasiado en responder. Inténtalo otra vez.' : (e.message || 'Sin conexión. Inténtalo otra vez.') });
  } finally {
    NX.enviando = false;
    if (send) send.disabled = false;
    nxGuardarLocal();
    nxPintar();
    if (!nxOpen) _showNxFabBadge();
  }
}

// ── Cuota de NEXUS: mensajes gratis del día, créditos y Premium ──
function nxPintarCuota(c) {
  const el = document.getElementById('nxCuota'); if (!el || !c) return;
  el.hidden = false; el.classList.toggle('prem', !!c.premium);
  el.innerHTML = c.premium ? '<span>⭐ <b>Premium</b>: NEXUS ilimitado con el modelo más potente</span>'
    : `<span><b>${c.restantesHoy}</b> de ${c.gratisDia} mensajes gratis hoy${c.creditos ? ` · <b>${c.creditos}</b> extra` : ''}</span><button type="button" onclick="nxIrPremium()">Ilimitado</button>`;
}
function nxCargarCuota() {
  if (!nxToken()) return;
  fetch(`${API_URL}/nexus/cuota`, { headers: nxHeaders() }).then(r => r.ok ? r.json() : null).then(d => d?.ok && nxPintarCuota(d)).catch(() => {});
}
async function nxDesbloquear(btn) {
  const caja = btn.closest('.nx-upsell')?.querySelector('.nx-upsell-pago'); if (!caja) return;
  caja.innerHTML = '<div class="eco-spin"><ion-icon name="sync-outline"></ion-icon></div>';
  try { await ugPagosListo(); window.UGPagos.creditosIA(caja, { alComprar: () => { nxCargarCuota(); ugContadorUC(); } }); }
  catch (_) { caja.innerHTML = '<p style="font-size:.8rem">No se pudo cargar. Inténtalo de nuevo.</p>'; }
}
function nxIrPremium() { nxClose(); switchTab('economia'); setTimeout(() => ecoCargarPlan(true), 300); }

async function nexusAbrirItem(itemId) {
  let item = todosLosItems.find(i => i._id === itemId);
  if (!item) {
    try {
      const r = await fetchTimeout(`${API_URL}/items/${encodeURIComponent(itemId)}`, 8000);
      if (r.ok) item = await r.json();
    } catch(_) {}
  }
  if (!item || !item._id) { toast('No pude abrir ese contenido'); return; }
  nxClose();
  window.openDetail(item);
}
function nxEjecutar(a) {
  if (!a) return;
  nxClose();
  if (a.tipo === 'filtrar_categoria') {
    if (currentTab !== 'main') switchTab('main');
    document.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.cat === a.valor));
    activeCategory = a.valor;
    const b = document.getElementById('buscador'); if (b) b.value = '';
    filteredItems = todosLosItems.filter(i => i.category === a.valor);
    render(filteredItems);
    nexusTrack('category', { categoria: a.valor });
  } else if (a.tipo === 'ir_a') {
    if (['main', 'favs', 'economia', 'profile'].includes(a.valor)) switchTab(a.valor);
  } else if (a.tipo === 'buscar') {
    if (currentTab !== 'main') switchTab('main');
    const b = document.getElementById('buscador');
    if (b) { b.value = a.valor; b.dispatchEvent(new Event('input', { bubbles:true })); }
  }
}

(function nxInitUI() {
  const panel = document.getElementById('nxPanel'), box = document.getElementById('nxMsgs');
  const form = document.getElementById('nxForm'), input = document.getElementById('nxInput');
  if (!panel || !box || !form || !input) return;
  form.addEventListener('submit', e => { e.preventDefault(); const t = input.value; input.value = ''; input.style.height = ''; nxEnviar(t); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
  input.addEventListener('input', () => { input.style.height = ''; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; });
  box.addEventListener('click', e => {
    const sug = e.target.closest('[data-nx-sug]'); if (sug) return nxEnviar(sug.dataset.nxSug);
    const card = e.target.closest('[data-nx-item]'); if (card) return nexusAbrirItem(card.dataset.nxItem);
    const act = e.target.closest('[data-nx-act]');
    if (act) { const m = NX.msgs[+act.closest('[data-nx-i]')?.dataset.nxI]; return nxEjecutar(m?.acciones?.[+act.dataset.nxAct]); }
  });
  // Tocar fuera de la hoja (zona oscurecida) la cierra
  panel.addEventListener('click', e => { if (e.target === panel && !nxExpanded && e.clientY < panel.getBoundingClientRect().top) nxClose(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && nxOpen) nxClose(); });
})();

// Abre Nexus y le hace una pregunta en nombre del usuario (botones "Pregúntale a Nexus")
async function nexusPreguntar(texto) {
  if (!ugPedirSesion('preguntarle a NEXUS IA')) return;
  const itemId = document.getElementById('detail-sheet')?.classList.contains('open') ? _viewItemId : null;
  if (typeof closeDetail === 'function' && document.getElementById('detail-sheet')?.classList.contains('open')) { try { closeDetail(); } catch (_) {} }
  if (!nxOpen) nxToggle();
  await nxCargar();
  nxEnviar(texto, itemId ? { itemId } : null);
}
window.nexusPreguntar = nexusPreguntar;

// Punto verde en el botón de Nexus cuando responde con el panel cerrado
let _nxFabBadgeEl = null;
function _showNxFabBadge() {
  const fab = document.querySelector('.nav-nexus') || document.getElementById('nxFab');
  if (!fab || _nxFabBadgeEl) return;
  _nxFabBadgeEl = document.createElement('span');
  _nxFabBadgeEl.className = 'nx-fab-badge';
  fab.style.position = 'relative';
  fab.appendChild(_nxFabBadgeEl);
}
function _clearNxFabBadge() { if (_nxFabBadgeEl) { _nxFabBadgeEl.remove(); _nxFabBadgeEl = null; } }
document.querySelectorAll('.nav-nexus, #nxFab').forEach(b => b.addEventListener('click', _clearNxFabBadge));

