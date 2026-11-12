// ── Historial ──
// ── Utilidades de imagen ──────────────────────────────────
function ugEsc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
/**
 * Entrega optimizada de Cloudinary: tamaño justo + formato automático.
 * Las fotos de iPhone (HEIC) no se ven en Chrome/Android y las de 4000px
 * pesan varios MB: con f_auto,q_auto y un ancho fijo cargan rápido y en todos lados.
 */
function cldOpt(url, t) {
  const u = String(url || '');
  if (!/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(u)) return u;
  // Ya trae transformaciones (recorte del widget, q_auto…): no anteponer otra o el recorte se descuadra
  if (/\/image\/upload\/(?!v\d+\/)[a-z]{1,3}_[^/]*\//.test(u)) return u.replace(/\.(heic|heif)(\?|$)/i, '.jpg$2');
  return u.replace('/image/upload/', `/image/upload/${t}/`).replace(/\.(heic|heif)(\?|$)/i, '.jpg$2');
}
// srcset: cada pantalla recibe su tamaño exacto. En móviles premium (DPR 3) las
// portadas se ven nítidas y en los demás no se baja de más.
const UG_SS_TILE = [320, 480, 640, 800, 1000], UG_SS_GRANDE = [640, 960, 1280, 1600, 2000];
const UG_SIZES_TILE = '(min-width: 1100px) 22vw, (min-width: 700px) 31vw, 47vw';
function cldSrcset(url, anchos, sizes, comoObjeto) {
  const u = String(url || '');
  const t = w => `c_limit,w_${w},q_auto,f_auto`;
  if (!/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(u) || cldOpt(u, t(1)) === u) return comoObjeto ? null : '';
  const srcset = anchos.map(w => `${cldOpt(u, t(w))} ${w}w`).join(', ');
  return comoObjeto ? { srcset, sizes } : ` srcset="${escH(srcset)}" sizes="${escH(sizes)}"`;
}
const CLD_BANNER = 'c_fill,g_auto,w_1500,h_500,q_auto,f_auto';
const CLD_AVATAR = 'c_fill,g_face,w_400,h_400,q_auto,f_auto';
const CLD_TILE   = 'c_fill,g_auto,w_420,h_420,q_auto,f_auto';
const UG_VIDEO_RE = { test: u => ugEsVideoArchivo(u) };   // portadas que en realidad son video

// ── Publicaciones del perfil: cuadrícula tipo Instagram ──
let _pfMisItems = [];
function pfTileHTML(item, i) {
  const isVideo   = item.category === 'Video';
  const isPending = item.status === 'pendiente' || item.status === 'pending';
  const ls        = item.linkStatus || 'online';
  const img       = item.image && !UG_VIDEO_RE.test(item.image) ? cldOpt(item.image, CLD_TILE) : '';
  const n         = isVideo ? vistasVideo(item) : (item.descargasEfectivas || 0);
  return `<button type="button" class="pf2-tile${img ? '' : ' no-img'}" onclick="pfOpenPostSheet(${i})" aria-label="${ugEsc(item.title || 'Publicación')}">
      ${img ? `<img src="${ugEsc(img)}" alt="" loading="lazy" onerror="this.remove();this.parentElement.classList.add('no-img')">` : ''}
      <span class="pf2-tile-ph"><ion-icon name="${isVideo ? 'play' : 'game-controller'}"></ion-icon><em>${ugEsc(item.title || '')}</em></span>
      ${isPending ? '<span class="pf2-tile-badge">Pendiente</span>' : ''}
      ${!isPending && ls !== 'online' ? `<span class="pf2-tile-badge ${ls === 'caido' ? 'bad' : 'warn'}">${ls === 'caido' ? 'Link caído' : 'Revisión'}</span>` : ''}
      ${isVideo ? '<span class="pf2-tile-type"><ion-icon name="play"></ion-icon></span>' : ''}
      <span class="pf2-tile-meta"><ion-icon name="${isVideo ? 'eye-outline' : 'cloud-download-outline'}"></ion-icon>${pfFmt ? pfFmt(n) : n}</span>
    </button>`;
}

async function pfLoadHistorial() {
  const cont      = document.getElementById('pf-showContent');
  const vidCont   = document.getElementById('pf-showVideos');
  const vidCount  = document.getElementById('pf-hist-vid-count');
  if(!cont || !pfUser) return;
  const skel = '<div class="pf2-grid">' + '<span class="pf2-tile pf2-skel"></span>'.repeat(6) + '</div>';
  cont.innerHTML = skel; if (vidCont) vidCont.innerHTML = skel;
  try {
    const token = LS.get('token');
    const res = await fetch(`${PF_API}/items/user/${encodeURIComponent(pfUser)}`, {
      headers: token ? { Authorization:`Bearer ${token}` } : {}
    });
    const data = await res.json();
    // Lo más reciente primero (como Instagram/TikTok)
    _pfMisItems = (Array.isArray(data) ? data : [])
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const up = document.getElementById('pf-stat-uploads');
    if (up) up.textContent = _pfMisItems.filter(i => i.status === 'aprobado').length;

    const idx = it => _pfMisItems.indexOf(it);
    const juegos = _pfMisItems.filter(i => i.category !== 'Video');
    const videos = _pfMisItems.filter(i => i.category === 'Video');

    cont.innerHTML = juegos.length
      ? `<div class="pf2-grid">${juegos.map(it => pfTileHTML(it, idx(it))).join('')}</div>`
      : `<div class="pf2-empty"><ion-icon name="images-outline"></ion-icon><h4>Aún no tienes publicaciones</h4><p>Comparte tu primer juego, mod o app con la comunidad.</p><button type="button" class="pf2-btn pf2-btn-primary" onclick="pfOpenPublish(true)">Crear publicación</button></div>`;

    if (vidCount) { vidCount.textContent = videos.length; vidCount.style.display = videos.length ? 'inline-flex' : 'none'; }
    if (vidCont) vidCont.innerHTML = videos.length
      ? `<div class="pf2-grid">${videos.map(it => pfTileHTML(it, idx(it))).join('')}</div>`
      : `<div class="pf2-empty"><ion-icon name="videocam-outline"></ion-icon><h4>Aún no tienes videos</h4><p>Sube tutoriales, gameplays o reviews.</p><button type="button" class="pf2-btn pf2-btn-primary" onclick="pfOpenPublish(true);pfOnCategoryChange && pfOnCategoryChange('Video', document.querySelector('.pf-cat-btn[data-cat=&quot;Video&quot;]'))">Subir video</button></div>`;
  } catch(e) {
    cont.innerHTML='<div class="pf2-empty"><ion-icon name="cloud-offline-outline"></ion-icon><h4>No se pudieron cargar tus publicaciones</h4><button type="button" class="pf2-btn" onclick="pfLoadHistorial()">Reintentar</button></div>';
  }
}

// ── Hoja de acciones al tocar una publicación propia ──
function pfOpenPostSheet(i) {
  const item = _pfMisItems[i];
  if (!item) return;
  const isVideo   = item.category === 'Video';
  const isPending = item.status === 'pendiente' || item.status === 'pending';
  const isRejected = item.status === 'rechazado';
  const ls = item.linkStatus || 'online';
  const lsTxt = ls === 'online' ? '🟢 Online' : ls === 'revision' ? '🟡 En revisión' : '🔴 Caído';
  const img = item.image && !UG_VIDEO_RE.test(item.image) ? cldOpt(item.image, 'c_fill,g_auto,w_900,h_506,q_auto,f_auto') : '';
  const m = item.nexusMentor;
  const mentorHTML = m && (m.analisis || (m.mejoras || []).length) ? `<div class="pf2-nexus">
      <div class="pf2-nexus-h"><span class="pf2-nexus-ic">✦</span><b>Consejos de Nexus</b>${m.puntuacion != null ? `<span class="pf2-nexus-score">${ugEsc(Number(m.puntuacion).toFixed(1))}/10</span>` : ''}</div>
      ${m.analisis ? `<p>${ugEsc(String(m.analisis).slice(0, 400))}</p>` : ''}
      ${(m.mejoras || []).length ? `<ul>${m.mejoras.slice(0, 4).map(x => `<li>${ugEsc(x)}</li>`).join('')}</ul>` : ''}
      ${(m.alertas || []).length ? `<div class="pf2-nexus-alert">⚠️ ${ugEsc(m.alertas.slice(0, 2).join(' · '))}</div>` : ''}
    </div>` : '';
  let ov = document.getElementById('pf2-sheet');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'pf2-sheet'; ov.className = 'pf2-sheet-ov';
    ov.addEventListener('click', e => { if (e.target === ov) pfClosePostSheet(); });
    document.body.appendChild(ov);
  }
  ov.innerHTML = `<div class="pf2-sheet" role="dialog" aria-modal="true" aria-label="${ugEsc(item.title)}">
      <span class="pf2-sheet-grab"></span>
      ${img ? `<img class="pf2-sheet-img" src="${ugEsc(img)}" alt="" onerror="this.remove()">` : ''}
      <div class="pf2-sheet-body">
        <div class="pf2-sheet-cat">${ugEsc(catLabel(item.category))} · <span class="${isRejected ? 'bad' : isPending ? 'warn' : 'ok'}">${isRejected ? 'Rechazado' : isPending ? 'Pendiente de revisión' : 'Aprobado'}</span></div>
        <h3>${ugEsc(item.title || 'Sin título')}</h3>
        <div class="pf2-sheet-stats">
          <div><b>${isVideo ? vistasVideo(item) : item.descargasEfectivas || 0}</b><span>${isVideo ? 'Vistas' : 'Anuncios vistos'}</span></div>
          <div><b>${item.likesCount || 0}</b><span>Likes</span></div>
          <div><b style="color:${(item.reportes || 0) >= 3 ? '#ff4343' : 'inherit'}">${item.reportes || 0}</b><span>Reportes</span></div>
          <div><b style="font-size:.78rem">${lsTxt}</b><span>Enlace</span></div>
        </div>
        ${isRejected ? `<div class="pf2-rechazo"><b>Motivo del rechazo:</b> ${ugEsc(item.motivoRechazo || 'No cumple las normas de publicación.')}<br><small>Corrígelo con Editar o publícalo de nuevo.</small></div>` : ''}
        ${mentorHTML}
        <button type="button" class="pf2-btn pf2-btn-nexus" onclick="pfClosePostSheet();nexusPreguntar(${ugEsc(JSON.stringify(`¿Cómo puedo mejorar mi publicación "${item.title}" para conseguir más descargas?`))})"><span class="pf2-nexus-ic">✦</span> Pedir consejo a Nexus</button>
        ${isPending ? `<div class="pf2-destacar" id="pf2-prioridad">${item.prioridadDesde
          ? `<span>⚡ <b>Revisión prioritaria activa</b>: va primera en la fila${item.prioridadReembolso ? ' (te devolvimos los UpCoins por la espera)' : ''}</span>`
          : `<span>⚡ <b>Revisión prioritaria</b>: pasa al frente de la fila por 🪙 <b data-ugx-precio="prioridad">30</b> UC. Si no se revisa en 24 h, te devolvemos los UpCoins.</span><button type="button" class="pf2-btn" onclick="UGX.prioridad('${item._id}', this)">Priorizar</button>`}</div>` : ''}
        ${!isPending && !isRejected ? `<div class="pf2-destacar" id="pf2-destacar">${item.destacadoHasta && new Date(item.destacadoHasta) > new Date()
          ? `<span>🚀 Promocionada${item.promoUCDia && window.UGRank ? ` (pesa ${Math.round(window.UGRank.pesoDeUCDia(item.promoUCDia) * 100)} %)` : ''} hasta el ${new Date(item.destacadoHasta).toLocaleString('es-CO')}</span><button type="button" class="pf2-btn" onclick="pfDestacar('${item._id}')">Extender</button>`
          : `<span>🚀 <b>Promociónala</b>: elige días y nivel desde 🪙 50 UC</span><button type="button" class="pf2-btn" onclick="pfDestacar('${item._id}')">Promocionar</button>`}</div><div id="pf2-destacar-pago"></div>` : ''}
        <div class="pf2-sheet-actions">
          ${!isPending && !isRejected ? `<button type="button" class="pf2-btn pf2-btn-primary" onclick="pfVerPublicacion(${i})"><ion-icon name="open-outline"></ion-icon> Ver publicación</button>` : ''}
          <button type="button" class="pf2-btn" onclick="pfClosePostSheet();${isVideo ? `pfOpenEditVideoModal('${item._id}')` : `pfOpenEditModal('${item._id}')`}"><ion-icon name="create-outline"></ion-icon> Editar</button>
          <button type="button" class="pf2-btn pf2-btn-danger" onclick="pfClosePostSheet();${isVideo ? `pfEliminarVideo('${item._id}')` : `pfEliminar('${item._id}')`}"><ion-icon name="trash-outline"></ion-icon> Borrar</button>
        </div>
      </div>
    </div>`;
  ov.classList.add('show');
  document.body.style.overflow = 'hidden';
}
// Destacar una publicación propia con UpCoins (sale arriba marcada como "Promocionado")
// Promocionar con UpCoins: el creador elige los días y cuánto invertir (niveles rápidos o una
// cantidad libre). Más UpCoins por día = más peso en el feed de Nexus (30 % → hasta 85 %), con
// toda su fuerza para quienes les gusta ese tipo de contenido (public/upgames-ranking.js).
async function pfDestacar(id) {
  const caja = document.getElementById('pf2-destacar-pago'); if (!caja) return;
  const R = window.UGRank;
  if (!R) { toast('No se pudo cargar la promoción'); return; }
  const item = (_pfMisItems || []).find(x => x._id === id);
  const activo = item?.destacadoHasta && new Date(item.destacadoHasta) > new Date();
  let dias = 7, nivel = 'plus', libre = null;   // libre: monto escrito por el creador
  const monto = () => (libre != null ? libre : R.precioPromo(dias, nivel));
  const pintar = () => {
    const min = R.precioPromo(dias, 'estandar'), m = monto(), valido = !!R.montoPromoValido(dias, m);
    const peso = valido ? R.pesoDeUCDia(R.ucDiaEquivalente(m, dias)) : 0;
    caja.innerHTML = `<div class="ugx-promo">
      <div class="ugx-promo-h"><b>🚀 Promocionar</b><small>${activo ? 'Se suma a la promoción que ya tiene.' : 'Sale marcada como "Promocionado".'}</small></div>
      <div class="ugx-promo-lbl">Duración</div>
      <div class="ugx-promo-chips">${R.PROMO_DIAS.map(d => `<button type="button" class="${d === dias ? 'on' : ''}" data-dias="${d}">${d} día${d > 1 ? 's' : ''}</button>`).join('')}</div>
      <div class="ugx-promo-lbl">Inversión · cuánto pesa la promoción en el feed de Nexus</div>
      <div class="ugx-promo-niv">${R.PROMO_NIVELES.map(x => `<button type="button" class="${libre == null && x.id === nivel ? 'on' : ''}" data-nivel="${x.id}"><b>${x.nombre}</b><span>${Math.round(x.peso * 100)} %</span><small>🪙 ${fmt(R.precioPromo(dias, x.id))}</small></button>`).join('')}</div>
      <label class="ugx-promo-libre ${libre != null ? 'on' : ''}"><span>Otra cantidad</span><input type="number" inputmode="numeric" min="${min}" step="50" placeholder="Desde ${fmt(min)} UC" value="${libre != null ? libre : ''}"><b>UC</b></label>
      <div class="ugx-promo-medidor" aria-hidden="true"><i style="width:${Math.round(peso / R.PROMO_PESO_MAX * 100)}%"></i></div>
      <p class="ugx-promo-res">${valido ? `Peso de la promoción: <b>${Math.round(peso * 100)} %</b> de su posición${peso >= R.PROMO_PESO_MAX ? ' (el máximo)' : ''}.` : `Mínimo 🪙 ${fmt(min)} UC para ${dias} día${dias > 1 ? 's' : ''}.`}</p>
      <p class="ugx-promo-nota">🎯 Nexus la muestra a todos, pero con toda su fuerza a quienes ya eligieron contenido parecido (mismo juego o género, p. ej. carreras). El resto de la posición la gana tu publicación con sus reseñas, me gusta, guardados y descargas.</p>
      <button type="button" class="pf2-btn pf2-btn-primary ugx-promo-ir" ${valido ? '' : 'disabled'}>Continuar · 🪙 ${Number(m || 0).toLocaleString('es-CO')} UC · ${dias} día${dias > 1 ? 's' : ''}</button>
    </div>`;
    caja.querySelectorAll('[data-dias]').forEach(b => b.onclick = () => { dias = +b.dataset.dias; pintar(); });
    caja.querySelectorAll('[data-nivel]').forEach(b => b.onclick = () => { nivel = b.dataset.nivel; libre = null; pintar(); });
    const inp = caja.querySelector('.ugx-promo-libre input');
    inp.oninput = () => {
      const v = parseInt(inp.value, 10); libre = Number.isFinite(v) && v > 0 ? v : null;
      const val = libre != null ? libre : 0, ok = !!R.montoPromoValido(dias, val), p = ok ? R.pesoDeUCDia(R.ucDiaEquivalente(val, dias)) : 0;
      caja.querySelectorAll('[data-nivel]').forEach(b => b.classList.toggle('on', libre == null && b.dataset.nivel === nivel));
      caja.querySelector('.ugx-promo-libre').classList.toggle('on', libre != null);
      caja.querySelector('.ugx-promo-medidor i').style.width = Math.round(p / R.PROMO_PESO_MAX * 100) + '%';
      caja.querySelector('.ugx-promo-res').innerHTML = ok ? `Peso de la promoción: <b>${Math.round(p * 100)} %</b> de su posición${p >= R.PROMO_PESO_MAX ? ' (el máximo)' : ''}.` : `Mínimo 🪙 ${fmt(R.precioPromo(dias, 'estandar'))} UC para ${dias} día${dias > 1 ? 's' : ''}.`;
      const ir = caja.querySelector('.ugx-promo-ir'); ir.disabled = !ok && libre != null; ir.textContent = `Continuar · 🪙 ${Number(monto() || 0).toLocaleString('es-CO')} UC · ${dias} día${dias > 1 ? 's' : ''}`;
    };
    caja.querySelector('.ugx-promo-ir').onclick = async () => {
      const m2 = monto();
      if (!R.montoPromoValido(dias, m2)) { toast(`Mínimo ${fmt(R.precioPromo(dias, 'estandar'))} UC para ${dias} días`); return; }
      const producto = libre != null ? `impulso:${id}:${dias}:uc${m2}` : `impulso:${id}:${dias}:${nivel}`;
      caja.innerHTML = '<div class="eco-spin"><ion-icon name="sync-outline"></ion-icon></div>';
      try { await ugPagosListo(); window.UGPagos.pagar(caja, { producto, alExito: () => { pfClosePostSheet(); ugContadorUC(); pfLoadHistorial(); } }); }
      catch (_) { caja.innerHTML = ''; toast('No se pudo cargar el pago'); }
    };
  };
  pintar();
}
function pfClosePostSheet() {
  const ov = document.getElementById('pf2-sheet');
  if (ov) ov.classList.remove('show');
  document.body.style.overflow = '';
}
function pfVerPublicacion(i) {
  const item = _pfMisItems[i];
  pfClosePostSheet();
  if (item && typeof window.openDetail === 'function') window.openDetail(todosLosItems.find(x => x._id === item._id) || item);
}

// ── Eliminar Video ──
async function pfEliminarVideo(id) {
  const ok = await customConfirm({
    icon: '🎬',
    title: '¿Eliminar este video?',
    msg: 'Se eliminará de la plataforma y de Cloudinary. No se puede deshacer.',
    okText: 'Eliminar',
    okDanger: true
  });
  if(!ok) return;
  const token = LS.get('token');
  if(!token) { toast('⚠️ Sesión expirada'); location.href='../login.html'; return; }
  try {
    const res = await fetch(`${PF_API}/items/${id}/video`, {
      method: 'DELETE',
      headers: { Authorization:`Bearer ${token}` }
    });
    if(res.ok) { toast('✅ Video eliminado.'); pfLoadHistorial(); pfLoadUserData(); }
    else { const e = await res.json(); toast('❌ '+(e.error||'Error al eliminar')); }
  } catch(e) { toast('❌ Error de conexión'); }
}

// ── Abrir modal editar video ──
let pfCurrentEditVideoId = null;
async function pfOpenEditVideoModal(itemId) {
  pfCurrentEditVideoId = itemId;
  try {
    const token = LS.get('token');
    const res = await fetch(`${PF_API}/items/user/${pfUser}`, {
      headers: token ? { Authorization:`Bearer ${token}` } : {}
    });
    const data = await res.json();
    const item = data.find(i => i._id === itemId);
    if(!item) { toast('❌ Video no encontrado'); return; }
    document.getElementById('pf-edit-vid-id').value    = item._id;
    document.getElementById('pf-edit-vid-title').value = item.title||'';
    document.getElementById('pf-edit-vid-desc').value  = item.description||'';
    document.getElementById('pf-edit-vid-thumb').value = item.image||'';
    const durEl = document.getElementById('pf-edit-vid-duracion');
    if(durEl) durEl.value = item.extraData?.duracion || '';
    const prevImg = document.getElementById('pf-edit-vid-thumb-prev');
    if(prevImg && item.image) { prevImg.src=item.image; prevImg.style.display='block'; }
    const currentType = item.videoType||'Tutorial';
    document.querySelectorAll('.pf-edit-vid-type-btn').forEach(b=>{
      b.classList.toggle('active', b.dataset.type===currentType);
    });
    document.getElementById('pf-edit-vid-type').value = currentType;
    document.getElementById('pf-editVideoModal').classList.add('show');
    document.body.style.overflow='hidden';
  } catch(e) { toast('❌ Error al cargar video'); }
}
function pfCloseEditVideoModal() {
  document.getElementById('pf-editVideoModal').classList.remove('show');
  document.body.style.overflow='';
  pfCurrentEditVideoId = null;
}
function pfEditVidSelectType(type, btn) {
  document.querySelectorAll('.pf-edit-vid-type-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('pf-edit-vid-type').value = type;
}
async function pfSaveEditVideo() {
  if(!pfCurrentEditVideoId) return;
  const title    = document.getElementById('pf-edit-vid-title').value.trim();
  const desc     = document.getElementById('pf-edit-vid-desc').value.trim();
  const thumb    = document.getElementById('pf-edit-vid-thumb').value.trim();
  const type     = document.getElementById('pf-edit-vid-type').value;
  const duracion = document.getElementById('pf-edit-vid-duracion')?.value.trim() || '';
  if(!title) { toast('⚠️ El título es obligatorio'); return; }
  const token = LS.get('token');
  if(!token) { toast('⚠️ Sesión expirada'); return; }
  const btn = document.getElementById('pf-edit-vid-save-btn');
  btn.textContent = 'Guardando...'; btn.disabled = true;
  try {
    const res = await fetch(`${PF_API}/items/${pfCurrentEditVideoId}`, {
      method: 'PUT',
      headers: { 'Content-Type':'application/json', Authorization:`Bearer ${token}` },
      body: JSON.stringify({
        title, description:desc, image:thumb, videoType:type, category:'Video',
        extraData: { duracion: duracion || '' }
      })
    });
    if(res.ok) { toast('✅ Video actualizado'); pfCloseEditVideoModal(); pfLoadHistorial(); }
    else { const e=await res.json(); toast('❌ '+(e.error||'Error al guardar')); }
  } catch(e) { toast('❌ Error de conexión'); }
  finally { btn.innerHTML='<ion-icon name="checkmark-circle"></ion-icon> GUARDAR CAMBIOS'; btn.disabled=false; }
}

async function pfEliminar(id) {
  if(!confirm('¿Eliminar este archivo de la nube?')) return;
  const token = LS.get('token');
  if(!token) { toast('⚠️ Sesión expirada'); location.href='../login.html'; return; }
  try {
    const res = await fetch(`${PF_API}/items/${id}`,{
      method:'DELETE', headers:{'Authorization':`Bearer ${token}`}
    });
    if(res.ok) { toast('✅ Eliminado.'); pfLoadHistorial(); pfLoadUserData(); }
    else { const e=await res.json(); toast('❌ '+(e.mensaje||e.error||'Error')); }
  } catch(e) { toast('❌ Error de conexión'); }
}

// ── Edit Modal ──
// Todas las claves de campos extra que existen (para limpiar las de otra categoría al cambiarla)
const PF_EX_TODAS = [...new Set(Object.values(CAT_CONFIG).flatMap(c => (c.extras || []).map(f => pfExKey(f.id))))];
let pfEditItem = null;

async function pfOpenEditModal(itemId) {
  pfCurrentEditId = itemId;
  try {
    const token = LS.get('token');
    const res = await fetch(`${PF_API}/items/user/${pfUser}`,{
      headers: token ? { Authorization:`Bearer ${token}` } : {}
    });
    const data = await res.json();
    const item = (Array.isArray(data) ? data : []).find(i => i._id === itemId);
    if(!item) { toast('❌ Item no encontrado'); return; }
    pfEditItem = item;
    document.getElementById('pf-edit-id').value = item._id;
    document.getElementById('pf-edit-title').value = item.title||'';
    document.getElementById('pf-edit-description').value = item.description||'';
    document.getElementById('pf-edit-link').value = item.link||'';
    document.getElementById('pf-edit-image').value = item.image||'';
    // Cargar medias adicionales (images[])
    const imgs = item.images || [];
    ['pf-edit-image2','pf-edit-image3','pf-edit-image4'].forEach((id, i) => {
      const el = document.getElementById(id);
      if(el) el.value = imgs[i] || '';
    });
    pfEditCategoria(CAT_CONFIG[item.category] ? item.category : 'Juego', item.extraData || {});
    window.UGUX?.ponerGuia('pfe', item);
    [0,1,2,3].forEach(pfEditPrevSlot);
    pfValidateEditTitle(); pfValidateEditLink(); pfValidateEditImage(); pfEditContador(); pfEditDetectar();
    // Estado actual: si está rechazada o en revisión, se explica por qué
    const est = document.getElementById('pf-edit-estado');
    if (est) {
      const rech = item.status === 'rechazado';
      const msg = rech ? `❌ Rechazada${item.motivoRechazo ? ': ' + item.motivoRechazo : ''}. Corrígela y guarda.`
        : item.linkStatus === 'caido' ? '⚠️ El enlace está marcado como caído: pega uno nuevo.'
        : item.linkStatus === 'revision' ? '⏳ En revisión: estamos comprobando el enlace.' : '';
      est.textContent = msg; est.hidden = !msg; est.className = 'pfe-estado' + (rech || item.linkStatus === 'caido' ? ' mal' : '');
    }
    document.getElementById('pf-edit-nexus-res').innerHTML = '';
    document.getElementById('pf-editModal').classList.add('show');
    document.body.style.overflow='hidden';
  } catch(e) { toast('❌ Error al cargar'); }
}
// Cambia la categoría en el editor y pinta sus campos extra (conservando lo ya escrito)
function pfEditCategoria(cat, valores) {
  const zona = document.getElementById('pf-edit-extra-fields');
  const previos = valores || { ...(pfEditItem?.extraData || {}), ...pfLeerExtras(zona) };
  document.getElementById('pf-edit-category').value = cat;
  document.querySelectorAll('#pf-edit-cat-grid .pf-cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
  pfRenderExtras(zona, cat, 'pf-edit-ex-', previos);
}
function pfEditPrevSlot(i) {
  const ids = ['pf-edit-image','pf-edit-image2','pf-edit-image3','pf-edit-image4'];
  const url = (document.getElementById(ids[i])?.value || '').trim();
  const prev = document.getElementById('pf-edit-prev-' + i); if (!prev) return;
  if (!url) { prev.classList.remove('show','rota'); return; }
  const img = prev.querySelector('img');
  img.onerror = () => { prev.classList.remove('show'); prev.classList.add('rota'); };
  img.onload = () => prev.classList.remove('rota');
  img.src = isYouTubeUrl(url) ? getYouTubeThumbnail(url) : url;
  prev.classList.add('show');
}
function pfEditContador() {
  const ta = document.getElementById('pf-edit-description'), n = document.getElementById('pf-edit-desc-n');
  if (ta && n) n.textContent = `${ta.value.length} / 1000`;
}
let _pfEditDetT = null;
function pfEditDetectar() {
  clearTimeout(_pfEditDetT);
  _pfEditDetT = setTimeout(async () => {
    const t = (document.getElementById('pf-edit-title')?.value || '').trim();
    const box = document.getElementById('pf-edit-detectado'); if (!box) return;
    const pinta = nombre => { box.style.display = nombre ? 'flex' : 'none'; if (nombre) document.getElementById('pf-edit-detectado-n').textContent = '🎮 Detectado: ' + nombre; };
    const prev = pfEditItem?.extraData?.detectedGame;
    if (prev && t === (pfEditItem?.title || '')) return pinta(prev.gameName);
    if (t.length < 3) return pinta('');
    try {
      const d = await fetch(`${PF_API}/items/detect-game`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: t }) }).then(x => x.json());
      if ((document.getElementById('pf-edit-title')?.value || '').trim() === t) pinta(d && d.detected ? d.gameName : '');
    } catch (_) { pinta(''); }
  }, 600);
}
function pfFormEdicion() {
  const v = id => (document.getElementById(id)?.value || '').trim();
  return { title: v('pf-edit-title'), description: v('pf-edit-description'), link: v('pf-edit-link'), image: v('pf-edit-image'),
    images: ['pf-edit-image2','pf-edit-image3','pf-edit-image4'].map(v).filter(Boolean), category: v('pf-edit-category') || 'Juego' };
}
async function pfRevisarEdicionConNexus() {
  const d = pfFormEdicion(), out = document.getElementById('pf-edit-nexus-res'), btn = document.getElementById('pf-edit-nexus-btn');
  if (!d.title || !d.link) return toast('✦ Escribe al menos el título y el enlace para que Nexus lo revise');
  const token = LS.get('token'); if (!token) return;
  out.innerHTML = `<div class="pf-nx-load"><span class="pf-nx-orb"></span><div><b>Nexus está revisando tus cambios…</b><small>Abriendo tu enlace, comprobando la portada y el texto</small></div></div>`;
  if (btn) btn.disabled = true;
  try {
    const r = await fetch(`${PF_API}/items/precheck`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ ...d, ia: true, editId: pfCurrentEditId }) });
    const res = await r.json().catch(() => ({}));
    if (!r.ok || !res.success) { out.innerHTML = `<div class="pf-nx-res warn">${ugEsc(res.error || 'Nexus no pudo revisar ahora. Puedes guardar igualmente.')}</div>`; return; }
    pfPintarNexus(res, out);
  } catch (_) { out.innerHTML = '<div class="pf-nx-res warn">Error de conexión</div>'; }
  finally { if (btn) btn.disabled = false; }
}
function pfCloseEditModal() {
  document.getElementById('pf-editModal').classList.remove('show');
  document.body.style.overflow='';
  pfCurrentEditId = null;
  pfEditItem = null;
  // Reset validation states
  ['pf-edit-title','pf-edit-link','pf-edit-image','pf-edit-image2','pf-edit-image3','pf-edit-image4','pf-edit-description'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) { el.classList.remove('valid','invalid'); el.value=''; }
  });
  [0,1,2,3].forEach(i => document.getElementById('pf-edit-prev-' + i)?.classList.remove('show','rota'));
  const zona = document.getElementById('pf-edit-extra-fields'); if (zona) zona.innerHTML = '';
  ['pf-edit-title-hint','pf-edit-link-hint','pf-edit-image-hint'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.textContent='';
  });
  document.querySelectorAll('.pf-tooltip').forEach(t=>t.classList.remove('active'));
}
// ── Edit Modal field validators ──
function pfValidateEditTitle() {
  const el = document.getElementById('pf-edit-title');
  const hint = document.getElementById('pf-edit-title-hint');
  if(!el) return;
  const txt = el.value;
  const bad = PF_BANNED_VISUAL.some(k => new RegExp('\\b'+k+'\\b','i').test(txt));
  if(bad && txt.length > 0) {
    el.classList.add('invalid'); el.classList.remove('valid');
    if(hint) hint.innerHTML='<span style="color:#ff4343">🚫 Palabra prohibida detectada</span>';
  } else if(txt.length > 0) {
    el.classList.remove('invalid'); el.classList.add('valid');
    if(hint) hint.textContent = '';
  } else {
    el.classList.remove('invalid','valid');
    if(hint) hint.textContent = '';
  }
}
function pfValidateEditLink() {
  const el = document.getElementById('pf-edit-link');
  const hint = document.getElementById('pf-edit-link-hint');
  if(!el) return;
  const val = el.value.trim();
  if(!val) { el.classList.remove('valid','invalid'); if(hint) hint.textContent=''; return; }
  const r = pfAnalizarLink(val);
  el.classList.toggle('valid', r.ok === true);
  el.classList.toggle('invalid', r.ok === false);
  if(hint) hint.innerHTML = r.ok === false ? `<span style="color:#ff4343">${r.msg}</span>` : r.ok === true ? '<span style="color:var(--g)">✅ Plataforma permitida</span>' : '';
}
function pfValidateEditImage() {
  const el = document.getElementById('pf-edit-image');
  const hint = document.getElementById('pf-edit-image-hint');
  if(!el) return;
  const val = el.value.trim();
  if(!val) { el.classList.remove('valid','invalid'); if(hint) hint.textContent=''; return; }
  // Acepta imagen, video, y URLs conocidas sin extensión
  const ok = /\.(jpg|jpeg|png|webp|gif|avif|svg|mp4|webm|mov)(\?.*)?$/i.test(val) || val.length > 10;
  el.classList.toggle('valid', ok);
  el.classList.toggle('invalid', !ok);
  if(hint) hint.innerHTML = !ok ? '<span style="color:#ffcc00">⚠️ Debe terminar en .jpg .png .webp o .gif</span>' : '';
}

async function pfSaveEdit() {
  if(!pfCurrentEditId) return;
  const upd = pfFormEdicion();
  // Campos extra: los de la categoría actual; los de otras categorías se borran ('' = quitar)
  const ex = pfLeerExtras(document.getElementById('pf-edit-extra-fields'));
  upd.extraData = {};
  PF_EX_TODAS.forEach(k => { upd.extraData[k] = ex[k] || ''; });
  Object.assign(upd, window.UGUX?.leerGuia('pfe') || {});
  if(!upd.image) { toast('⚠️ La portada es obligatoria.'); return; }
  const vl = pfAnalizarLink(upd.link);
  if(vl.ok===false) { toast(vl.msg); return; }
  if(!upd.title||!upd.link) { toast('⚠️ Título y enlace requeridos'); return; }
  const bad = PF_BANNED.find(k => new RegExp('\\b'+k+'\\b','i').test(upd.title.toLowerCase()));
  if(bad) { toast(`🚫 Palabra prohibida: "${bad}"`); return; }
  // La imagen puede ser cualquier URL válida (imagen, video, CDN sin extensión)
  const token = LS.get('token');
  if(!token) { toast('Sesión expirada'); return; }
  try {
    const res = await fetch(`${PF_API}/items/${pfCurrentEditId}`,{
      method:'PUT',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
      body: JSON.stringify(upd)
    });
    if(res.ok) {
      const cambioLink = pfEditItem && (pfEditItem.link || '').trim() !== upd.link;
      toast(cambioLink ? '✅ Guardado. El nuevo enlace queda "En revisión" hasta comprobarlo.' : '✅ Cambios guardados');
      pfCloseEditModal(); pfLoadHistorial();
    }
    else { const e=await res.json(); toast('❌ '+(e.error||'Error')); }
  } catch(e) { toast('❌ Error de conexión'); }
}

// ── Bóveda ──
async function pfLoadBoveda() {
  const cont = document.getElementById('pf-vaultContent');
  if(!cont||!pfUser) return;
  cont.innerHTML='<div class="pf-empty"><ion-icon name="sync-outline"></ion-icon><p>Cargando...</p></div>';
  try {
    const res = await fetch(`${PF_API}/favoritos/${pfUser}`);
    const data = await res.json();
    const favs = Array.isArray(data) ? data : [];
    if(!favs.length) {
      cont.innerHTML='<div class="pf-empty"><ion-icon name="heart-dislike-outline"></ion-icon><p>Tu bóveda está vacía.<br>Agrega favoritos desde la biblioteca.</p></div>';
      return;
    }
    cont.innerHTML='';
    favs.forEach(item => {
      if(!item) return;
      const card = document.createElement('div');
      card.className='pf-vault-card';
      card.innerHTML=`
        <img src="${item.image||window.UG_PH}" alt="${item.title||''}" onerror="this.onerror=null;this.src=window.UG_PH">
        <div class="pf-vault-info">
          <div class="pf-vault-title">${(item.title||'Sin título').substring(0,40)}</div>
          <div class="pf-vault-user">@${escH(item.usuario||'Anónimo')}</div>
          <div class="pf-vault-actions">
            <button class="pf-vault-btn access" onclick="window.open('puente.html?id=${item._id}','_blank')"><ion-icon name="cloud-download"></ion-icon> Acceder</button>
            <button class="pf-vault-btn remove" onclick="pfRemoveFav('${item._id}')"><ion-icon name="trash"></ion-icon> Quitar</button>
          </div>
        </div>`;
      cont.appendChild(card);
    });
  } catch(e) { cont.innerHTML='<div class="pf-empty" style="color:#ff4343"><p>Error al cargar favoritos</p></div>'; }
}
async function pfRemoveFav(itemId) {
  const ok = await customConfirm({
    icon: '💔',
    title: '¿Quitar de tu bóveda?',
    msg: 'Este contenido se eliminará de tus favoritos guardados.',
    okText: 'Quitar',
    okDanger: true
  });
  if(!ok) return;
  try {
    const token = LS.get('token');
    const res = await fetch(`${PF_API}/favoritos/remove`,{
      method:'DELETE',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
      body: JSON.stringify({ itemId })
    });
    const d = await res.json();
    if(d.success||d.ok) { toast('💔 Eliminado de favoritos'); pfLoadBoveda(); }
    else toast('❌ '+(d.error||'Error'));
  } catch(e) { toast('❌ Error de conexión'); }
}

// ── Reportes ──
async function pfLoadReportes() {
  const cont = document.getElementById('pf-reportesContent');
  if(!cont||!pfUser) return;
  cont.innerHTML='<div class="pf-empty"><ion-icon name="sync-outline"></ion-icon><p>Cargando...</p></div>';
  try {
    const res = await fetch(`${PF_API}/items/mis-reportes/${pfUser}`);
    const data = await res.json();
    if(!data.success||!data.publicaciones||!data.publicaciones.length) {
      cont.innerHTML=`<div class="pf-empty"><ion-icon name="happy-outline"></ion-icon><p>¡Excelente! No tienes publicaciones con reportes activos.</p></div>`;
      return;
    }
    cont.innerHTML='';
    data.publicaciones.forEach(pub => {
      const d = pub.reportesDesglose||{caido:0,viejo:0,malware:0};
      const sColor = pub.linkStatus==='online'?'var(--g)':pub.linkStatus==='revision'?'#ffcc00':'#ff4343';
      const sText = pub.linkStatus==='online'?'🟢 Online':pub.linkStatus==='revision'?'🟡 En Revisión':'🔴 Caído';
      const card = document.createElement('div');
      card.className='pf-reporte-card';
      card.style.borderLeftColor = sColor;
      card.innerHTML=`
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
          <div><div class="pf-reporte-title">${escH(pub.title)}</div>
          <div class="pf-reporte-date">${new Date(pub.createdAt).toLocaleDateString('es-ES')}</div></div>
          <div style="text-align:right">
            <div class="pf-reporte-badge">${pub.reportes} Reportes</div>
            <div style="font-size:.65rem;font-weight:700;margin-top:4px;color:${sColor}">${sText}</div>
          </div>
        </div>
        <div class="pf-reporte-motivos">
          <div class="pf-reporte-motivo"><ion-icon name="link-outline" style="color:#ff4343"></ion-icon><span style="font-weight:700;color:#ff4343">${d.caido||0}</span><span>Link caído</span></div>
          <div class="pf-reporte-motivo"><ion-icon name="time-outline" style="color:#ffaa00"></ion-icon><span style="font-weight:700;color:#ffaa00">${d.viejo||0}</span><span>Obsoleto</span></div>
          <div class="pf-reporte-motivo"><ion-icon name="shield-outline" style="color:#ff00ff"></ion-icon><span style="font-weight:700;color:#ff00ff">${d.malware||0}</span><span>Malware</span></div>
        </div>
        <div class="pf-reporte-tip">💡 <strong>Consejo:</strong> Actualiza tu link para mantener tu reputación y tus ganancias.</div>
        <button class="pf-reporte-ver" onclick="window.open('biblioteca.html?id=${pub._id}','_blank')"><ion-icon name="eye-outline"></ion-icon> Ver Publicación</button>`;
      cont.appendChild(card);
    });
  } catch(e) { cont.innerHTML='<div class="pf-empty" style="color:#ff4343"><p>Error al cargar reportes</p></div>'; }
}

