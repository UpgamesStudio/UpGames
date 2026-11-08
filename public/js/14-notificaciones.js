// ══════════════════════════════════════════════════════════════════
//  NEXUS APRENDE TUS GUSTOS
//  Lo que miras y las categorías que filtras llegan a /nexus/evento (los
//  favoritos, búsquedas y descargas los registra el servidor). Con eso
//  Nexus personaliza sus recomendaciones y el orden del inicio.
// ══════════════════════════════════════════════════════════════════

function nexusTrack(tipo, datos = {}) {
  const t = nxToken();
  if (!t) return; // sin sesión no hay perfil que construir
  fetch(`${API_URL}/nexus/evento`, { method:'POST', headers:nxHeaders(), body: JSON.stringify({ tipo, ...datos }) }).catch(() => {});
}

// Apertura de detalle → vista (solo si se queda más de 3 s mirando)
const _openDetailOriginal = window.openDetail || openDetail;
let _viewItemId = null, _viewTimer = null;
window.openDetail = function(item) {
  _openDetailOriginal(item);
  _viewItemId = item?._id || null;
  clearTimeout(_viewTimer);
  if (_viewItemId) { const id = _viewItemId; _viewTimer = setTimeout(() => { if (_viewItemId === id) {
    nexusTrack('view', { itemId:id });
    // Vista para las estadísticas del creador (1 por persona y día; el servidor ignora al autor)
    const tk = LS.get('token');
    fetch(`${API_URL}/items/${encodeURIComponent(id)}/vista`, { method: 'POST', keepalive: true, headers: tk ? { Authorization: `Bearer ${tk}` } : {} }).catch(() => {});
  } }, 3000); }
};
const _closeDetailOriginal = window.closeDetail || closeDetail;
window.closeDetail = function() {
  _closeDetailOriginal();
  clearTimeout(_viewTimer);
  _viewItemId = null;
};

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', function() {
    const cat = this.dataset.cat;
    if (cat) nexusTrack('category', { categoria: cat });
  });
});

// Reordena el inicio según los gustos aprendidos (los 3 primeros se quedan fijos)
async function nexusCargarPerfil() {
  if (!nxToken()) return;
  try {
    const r = await fetchTimeout(`${API_URL}/nexus/perfil`, 8000, { headers: nxHeaders() });
    if (!r.ok) return;
    const perfil = await r.json();
    if (perfil?.categorias?.length) nexusAplicarPerfil(perfil);
  } catch(_) {}
}

function nexusAplicarPerfil(perfil) {
  if (!perfil?.categorias?.length || !todosLosItems.length) return;
  const maxCat = perfil.categorias[0].peso || 1, maxTag = perfil.tags?.[0]?.peso || 1;
  const pesoCat = {}, pesoTag = {};
  perfil.categorias.forEach(c => { pesoCat[c.nombre] = (c.peso / maxCat) * 10; });
  (perfil.tags || []).forEach(t => { pesoTag[t.tag] = (t.peso / maxTag) * 5; });
  const recientes = new Set(perfil.recientes || []);
  const TOP_FIJOS = 3;
  const fijos = todosLosItems.slice(0, TOP_FIJOS);
  const resto = todosLosItems.slice(TOP_FIJOS).map(item => ({
    item,
    score: (item.scoreRecomendacion || 0) + (pesoCat[item.category] || 0)
      + (item.tags || []).reduce((acc, t) => acc + (pesoTag[String(t).toLowerCase()] || 0), 0)
      - (recientes.has(item._id) ? 3 : 0),
  })).sort((a, b) => b.score - a.score).map(x => x.item);
  todosLosItems = [...fijos, ...resto];
  const query = document.getElementById('buscador')?.value?.trim() || '';
  if (currentTab === 'main' && !query) {
    filteredItems = activeCategory ? todosLosItems.filter(i => i.category === activeCategory) : todosLosItems.filter(i => i.category !== 'Video');
    render(filteredItems);
  }
}
setTimeout(nexusCargarPerfil, 2000);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  AUTOPLAY — SIGUIENTE VIDEO (punto 6)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let _autoplayTimer = null;

/**
 * Obtiene hasta 3 videos relacionados (misma categoría Video, excluyendo el actual)
 */
function getRelatedVideos(currentItem, count=3) {
  return todosLosItems
    .filter(i => i.category === 'Video' && i._id !== currentItem._id)
    .sort((a,b) => (b.likesCount||0) - (a.likesCount||0))
    .slice(0, count);
}

/**
 * Adjunta listener al video MP4 inyectado para disparar autoplay al terminar
 */
function attachAutoplayListener(item) {
  const injVid = document.getElementById('ds-injected-vid');
  if(!injVid) return;
  injVid.addEventListener('ended', () => { triggerAutoplay(item); }, { once: true });
}

/**
 * Muestra el panel de autoplay con countdown de 5s
 */
function triggerAutoplay(currentItem) {
  const sheetMedia = document.querySelector('.sheet-media');
  if(!sheetMedia) return;

  const related = getRelatedVideos(currentItem, 3);
  if(!related.length) return;

  const nextItem = related[0];
  let countdown = 5;

  // Crear panel
  const panel = document.createElement('div');
  panel.id = 'autoplay-panel';
  panel.innerHTML = `
    <div class="autoplay-label">A CONTINUACIÓN</div>
    <div class="autoplay-next-title">${escH(nextItem.title)}</div>
    <div class="autoplay-related">
      ${related.map((v,i) => {
        const thumb = v.image || window.UG_PH;
        return `<div class="autoplay-rel-thumb" data-id="${v._id}">
          <img src="${escH(thumb)}" alt="${escH(v.title)}" onerror="this.onerror=null;this.src=window.UG_PH">
          <span>${escH(v.title)}</span>
        </div>`;
      }).join('')}
    </div>
    <div class="autoplay-countdown" id="ap-countdown">${countdown}</div>
    <div class="autoplay-actions">
      <button class="autoplay-btn autoplay-btn--play" id="ap-btn-play">▶ Ver ahora</button>
      <button class="autoplay-btn autoplay-btn--cancel" id="ap-btn-cancel">Cancelar</button>
    </div>
  `;
  sheetMedia.appendChild(panel);
  // forzar reflow para que la transición funcione
  panel.offsetHeight;
  panel.classList.add('show');

  // Clicks en miniaturas relacionadas
  panel.querySelectorAll('.autoplay-rel-thumb').forEach(th => {
    th.onclick = () => {
      if(_autoplayTimer){ clearTimeout(_autoplayTimer); _autoplayTimer=null; }
      panel.remove();
      const v = todosLosItems.find(i => i._id === th.dataset.id);
      if(v) openDetail(v);
    };
  });

  // Botón "Ver ahora"
  document.getElementById('ap-btn-play').onclick = () => {
    if(_autoplayTimer){ clearTimeout(_autoplayTimer); _autoplayTimer=null; }
    panel.remove();
    openDetail(nextItem);
  };

  // Botón cancelar
  document.getElementById('ap-btn-cancel').onclick = () => {
    if(_autoplayTimer){ clearTimeout(_autoplayTimer); _autoplayTimer=null; }
    panel.classList.remove('show');
    setTimeout(() => panel.remove(), 350);
  };

  // Countdown automático
  _autoplayTimer = setInterval(() => {
    countdown--;
    const cdEl = document.getElementById('ap-countdown');
    if(cdEl) cdEl.textContent = countdown;
    if(countdown <= 0) {
      clearInterval(_autoplayTimer); _autoplayTimer = null;
      panel.remove();
      openDetail(nextItem);
    }
  }, 1000);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  MODO TEATRO (punto 12)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Crear el overlay de teatro en el DOM (una sola vez)
(function initTheaterOverlay() {
  if(document.getElementById('theater-overlay')) return;
  const ov = document.createElement('div');
  ov.id = 'theater-overlay';
  ov.innerHTML = `
    <div id="theater-player-wrap"></div>
    <div id="theater-info">
      <div id="theater-title"></div>
      <div id="theater-meta"></div>
    </div>
    <button id="theater-close" aria-label="Cerrar modo teatro">
      <ion-icon name="close"></ion-icon>
    </button>
  `;
  document.body.appendChild(ov);
  document.getElementById('theater-close').onclick = closeTheater;
  ov.addEventListener('keydown', e => { if(e.key==='Escape') closeTheater(); });
})();

function openTheater(item) {
  if(!item) return;
  const ov = document.getElementById('theater-overlay');
  const wrap = document.getElementById('theater-player-wrap');
  const titleEl = document.getElementById('theater-title');
  const metaEl  = document.getElementById('theater-meta');
  if(!ov || !wrap) return;

  // Limpiar player anterior
  wrap.innerHTML = '';

  const isYT2  = isYouTubeUrl(item.link);
  const isMp42 = ugEsVideoArchivo(item.link);

  if(isYT2) {
    const ytId = getYouTubeId(item.link);
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${ytId}?autoplay=1&controls=1&rel=0&playsinline=1`;
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    wrap.appendChild(iframe);
  } else if(isMp42) {
    const nv = document.createElement('video');
    nv.src = ugVideoSrc(item.link);
    if (ugVideoThumb(item.link)) nv.poster = ugVideoThumb(item.link);
    nv.controls = true;
    nv.autoplay = true;
    nv.playsInline = true;
    nv.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#000;';
    wrap.appendChild(nv);
    // Autoplay siguiente al terminar
    nv.addEventListener('ended', () => { triggerAutoplay(item); }, { once: true });
  }

  titleEl.textContent = item.title;
  metaEl.innerHTML = `
    <span>@${escH(item.usuario||'Cloud')}</span>
    ${item.videoType ? `<span>· ${escH(item.videoType)}</span>` : ''}
    <span>· ${fmt(vistasVideo(item))} vistas</span>
    <span>· ${fmt(item.likesCount||0)} likes</span>
  `;

  ov.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeTheater() {
  const ov = document.getElementById('theater-overlay');
  if(!ov) return;
  ov.classList.remove('open');
  document.body.style.overflow = '';
  // Detener video / iframe
  const wrap = document.getElementById('theater-player-wrap');
  if(wrap) wrap.innerHTML = '';
  if(_autoplayTimer){ clearInterval(_autoplayTimer); _autoplayTimer=null; }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  NOTIFICACIONES — panel Liquid Glass, isla flotante y push al móvil
//  • Panel: agrupado por día, filtros, ajustes de avisos y tarjeta para
//    activar las notificaciones del móvil.
//  • Isla: cuando llega algo con la app abierta (polling o push del service
//    worker), una "isla" flotante arriba; al tocarla te lleva al contenido.
//  • Push: Web Push con claves VAPID del servidor; llega aunque UpGames
//    esté cerrado (en iPhone, con la app instalada en la pantalla de inicio).
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const UGN = { lista: [], filtro: 'todas', vistos: new Set(), inicio: Date.now(), abierto: false, ultimoConteo: null, cola: [], islaT: null };
const UGN_TIPOS = {
  nueva_publicacion: { ic: 'cloud-upload', c: '#32D583', cat: 'publicaciones' },
  favorito:   { ic: 'heart', c: '#ff5c7a', cat: 'social' },
  comentario: { ic: 'chatbubble', c: '#5AC8FA', cat: 'social' },
  seguidor:   { ic: 'person-add', c: '#a78bfa', cat: 'social' },
  logro:      { ic: 'trophy', c: '#ffd23f', cat: 'social' },
  descarga:   { ic: 'download', c: '#32D583', cat: 'social' },
};
function ugnMeta(n) {
  const t = n.itemTitle || '';
  if (n.tipo === 'sistema') {
    if (t.startsWith('Mensaje')) return { ic: 'chatbubbles', c: '#5AC8FA', cat: 'mensajes' };
    if (t === 'En vivo') return { ic: 'radio', c: '#ff4d6d', cat: 'social' };
    if (t === 'Verifica tu email') return { ic: 'mail-unread', c: '#ffcc4d', cat: 'anuncios' };
    if (t === 'Tu pase vence' || t === 'Tu Premium vence') return { ic: 'star', c: '#5AC8FA', cat: 'anuncios' };
    if (t === 'Anuncio') return { ic: 'megaphone', c: '#32D583', cat: 'anuncios' };
    if (t === 'Revisión') return { ic: 'shield-checkmark', c: '#ff8a8d', cat: 'anuncios' };
    if (t === 'Equipo') return { ic: 'shield-half', c: '#a78bfa', cat: 'anuncios' };
    return { ic: 'notifications', c: '#8f98a8', cat: 'anuncios' };
  }
  return UGN_TIPOS[n.tipo] || { ic: 'notifications', c: '#8f98a8', cat: 'anuncios' };
}
// Texto plano de una notificación (los mensajes del servidor llegan con HTML escapado)
const ugnPlano = s => { const d = document.createElement('textarea'); d.innerHTML = String(s || '').replace(/<[^>]*>/g, ''); return d.value; };
function ugnTexto(n) {
  if (n._push) return { quien: n._push.title || 'UpGames', accion: '', sub: n._push.body || '', anuncio: true };
  const e = n.emisor ? '@' + n.emisor : 'UpGames', t = n.itemTitle || '', msg = ugnPlano(n.mensaje);
  switch (n.tipo) {
    case 'nueva_publicacion': return { quien: e, accion: 'publicó algo nuevo', sub: t };
    case 'favorito':   return { quien: e, accion: 'guardó tu publicación', sub: t };
    case 'comentario': return { quien: e, accion: 'comentó tu publicación', sub: msg || t };
    case 'seguidor':   return { quien: e, accion: 'empezó a seguirte', sub: 'Toca para ver su perfil' };
    case 'logro':      return { quien: '🏆', accion: msg || '¡Nuevo logro desbloqueado!', sub: t };
    case 'descarga':   return { quien: e, accion: 'descargó tu contenido', sub: t };
  }
  if (t.startsWith('Mensaje')) return { quien: e, accion: 'te envió un mensaje', sub: 'Toca para responder' };
  if (t === 'En vivo') return { quien: e, accion: 'está en vivo 🔴', sub: msg || 'Toca para verlo' };
  if (t === 'Verifica tu email') return { quien: 'Verifica tu email', accion: '', sub: msg.replace(/^📧\s*/, '') };
  if (t === 'Tu pase vence' || t === 'Tu Premium vence') return { quien: 'Tu Premium vence pronto', accion: '', sub: msg.replace(/^⏳\s*/, '') };
  if (t === 'Anuncio') return { quien: 'UpGames', accion: '', sub: msg.replace(/^📢\s*/, ''), anuncio: true };
  if (t === 'Revisión') return { quien: 'Revisión', accion: '', sub: msg, anuncio: true };
  if (t === 'Equipo') return { quien: 'Equipo UpGames', accion: '', sub: msg, anuncio: true };
  return { quien: e, accion: msg || 'Notificación', sub: t };
}
function ugnAvatar(n, meta) {
  const sistema = !n.emisor || n.emisor === 'UpGames' || ugnTexto(n).anuncio;
  const letra = sistema ? '' : escH((n.emisor[0] || '?').toUpperCase());
  let h = 0; for (const ch of n.emisor || 'u') h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `<div class="ugn-av" style="${sistema ? '' : `background:linear-gradient(135deg,hsl(${h} 70% 55%),hsl(${(h + 50) % 360} 75% 45%))`}">
      ${sistema ? '<img src="./icons/icon-96.png?v=2" alt="">' : letra}
      <span class="ugn-av-ic" style="background:${meta.c}"><ion-icon name="${meta.ic}"></ion-icon></span></div>`;
}
const ugnAuth = () => ({ Authorization: `Bearer ${LS.get('token')}` });

// ── Botón de campana + panel ─────────────────────────
function _initNotifUI() {
  const hdrActions = document.querySelector('.hdr-actions');
  const radial = document.querySelector('#hdr-radial .ugr-items');   // la campana vive en el menú radial
  if ((!hdrActions && !radial) || document.getElementById('notif-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'notif-btn'; btn.type = 'button'; btn.title = 'Notificaciones'; btn.setAttribute('aria-label', 'Notificaciones');
  if (radial) {
    btn.className = 'ugr-item'; btn.setAttribute('role', 'menuitem');
    btn.innerHTML = '<span class="ugr-bub"><ion-icon name="notifications-outline"></ion-icon><span id="notif-badge" class="ugn-badge" hidden>0</span></span><span class="ugr-lbl">Avisos</span>';
    btn.onclick = e => { e.stopPropagation(); UGR.cerrar(); ugnToggle(); };
    radial.insertBefore(btn, radial.firstChild);
    if (UGR.abierto) UGR.colocar();   // si el menú ya estaba abierto, reacomoda el abanico
  } else {
    btn.className = 'hdr-btn';
    btn.innerHTML = '<ion-icon name="notifications-outline"></ion-icon><span id="notif-badge" class="ugn-badge" hidden>0</span>';
    btn.onclick = e => { e.stopPropagation(); ugnToggle(); };
    hdrActions.insertBefore(btn, hdrActions.firstChild);
  }

  const panel = document.createElement('div');
  panel.id = 'ugn-panel'; panel.className = 'ugn-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Notificaciones');
  panel.innerHTML = `
    <div class="ugn-head">
      <div><h3>Notificaciones</h3><span id="ugn-sub">Al día</span></div>
      <div class="ugn-head-acts">
        <button class="ugn-ib" onclick="ugnMarcarTodas()" title="Marcar todas como leídas"><ion-icon name="checkmark-done"></ion-icon></button>
        <button class="ugn-ib" onclick="ugnAjustes(true)" title="Ajustes de avisos"><ion-icon name="settings-outline"></ion-icon></button>
        <button class="ugn-ib" onclick="ugnCerrar()" title="Cerrar"><ion-icon name="close"></ion-icon></button>
      </div>
    </div>
    <div id="ugn-main">
      <div id="ugn-push"></div>
      <div class="ugn-chips" id="ugn-chips">
        <button data-f="todas" class="on">Todas</button><button data-f="noleidas">Sin leer</button>
        <button data-f="publicaciones">Publicaciones</button><button data-f="mensajes">Mensajes</button>
        <button data-f="social">Social</button><button data-f="anuncios">Anuncios</button>
      </div>
      <div class="ugn-list" id="notif-list"></div>
      <div class="ugn-foot"><button onclick="ugnVaciar()"><ion-icon name="trash-outline"></ion-icon> Vaciar todo</button></div>
    </div>
    <div id="ugn-settings" hidden></div>`;
  document.body.appendChild(panel);
  const scrim = document.createElement('div'); scrim.id = 'ugn-scrim'; scrim.className = 'ugn-scrim'; scrim.onclick = ugnCerrar;
  document.body.appendChild(scrim);
  panel.querySelector('#ugn-chips').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    UGN.filtro = b.dataset.f; panel.querySelectorAll('#ugn-chips button').forEach(x => x.classList.toggle('on', x === b)); ugnPintar();
  });
  panel.querySelector('#notif-list').addEventListener('click', e => {
    const del = e.target.closest('[data-del]'); if (del) { e.stopPropagation(); return ugnEliminar(del.dataset.del); }
    const row = e.target.closest('[data-id]'); if (row) ugnAbrir(UGN.lista.find(n => n._id === row.dataset.id));
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && UGN.abierto) ugnCerrar(); });
}
function ugnToggle() { UGN.abierto ? ugnCerrar() : ugnAbrirPanel(); }
function ugnAbrirPanel() {
  const p = document.getElementById('ugn-panel'); if (!p) return;
  UGN.abierto = true; ugnAjustes(false);
  p.classList.add('open'); document.getElementById('ugn-scrim')?.classList.add('open');
  ugnPintarPush(); _cargarNotificaciones();
}
function ugnCerrar() {
  UGN.abierto = false;
  document.getElementById('ugn-panel')?.classList.remove('open'); document.getElementById('ugn-scrim')?.classList.remove('open');
}
const _toggleNotifPanel = ugnToggle;   // compatibilidad

async function _cargarNotificaciones() {
  const usuario = LS.get('user_admin'), token = LS.get('token');
  if (!usuario || !token) return;
  const list = document.getElementById('notif-list');
  if (list && !UGN.lista.length) list.innerHTML = '<div class="ugn-skel"></div><div class="ugn-skel"></div><div class="ugn-skel"></div>';
  try {
    const r = await fetch(`${API_URL}/notificaciones/${encodeURIComponent(usuario)}`, { headers: ugnAuth() });
    const d = r.ok ? await r.json() : null;
    if (!d?.success) return;
    UGN.lista = d.notificaciones || [];
    _updateNotifBadge(d.noLeidas || 0);
    ugnPintar();
    return UGN.lista;
  } catch (_) {}
}
function ugnPintar() {
  const list = document.getElementById('notif-list'); if (!list) return;
  const f = UGN.filtro;
  const items = UGN.lista.filter(n => f === 'todas' || (f === 'noleidas' ? !n.leida : ugnMeta(n).cat === f));
  const sinLeer = UGN.lista.filter(n => !n.leida).length;
  const sub = document.getElementById('ugn-sub'); if (sub) sub.textContent = sinLeer ? `${sinLeer} sin leer` : 'Al día';
  if (!items.length) {
    list.innerHTML = `<div class="ugn-empty"><div class="ugn-empty-ic"><ion-icon name="notifications-off-outline"></ion-icon></div>
      <b>${f === 'todas' ? 'No tienes notificaciones' : 'Nada por aquí'}</b><span>Sigue a creadores para enterarte cuando publiquen.</span></div>`;
    return;
  }
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const grupo = d => { const t = new Date(d).getTime(); return t >= hoy ? 'Hoy' : t >= hoy - 864e5 ? 'Ayer' : t >= hoy - 6 * 864e5 ? 'Esta semana' : 'Antes'; };
  let actual = '', html = '';
  for (const n of items) {
    const g = grupo(n.fecha); if (g !== actual) { actual = g; html += `<div class="ugn-group">${g}</div>`; }
    const meta = ugnMeta(n), tx = ugnTexto(n);
    const img = /^https?:\/\//.test(n.itemImage || '') && !ugEsVideoArchivo(n.itemImage) ? n.itemImage : '';
    html += `<div class="ugn-item ${n.leida ? '' : 'unread'} ${tx.anuncio ? 'anuncio' : ''}" data-id="${escH(n._id)}" role="button" tabindex="0">
      ${ugnAvatar(n, meta)}
      <div class="ugn-body">
        <div class="ugn-line"><b>${escH(tx.quien)}</b> ${escH(tx.accion)}</div>
        ${tx.sub ? `<div class="ugn-subl ${tx.anuncio ? 'full' : ''}">${escH(tx.sub)}</div>` : ''}
        <div class="ugn-time">${_timeAgo(new Date(n.fecha))}</div>
      </div>
      ${img ? `<img class="ugn-thumb" src="${escH(img)}" alt="" loading="lazy" onerror="this.remove()">` : ''}
      ${n.leida ? '' : '<span class="ugn-dot"></span>'}
      <button class="ugn-del" data-del="${escH(n._id)}" title="Eliminar" aria-label="Eliminar"><ion-icon name="close"></ion-icon></button>
    </div>`;
  }
  list.innerHTML = html;
}

// ── Abrir el contenido de una notificación ───────────
async function ugnAbrir(n) {
  if (!n) return;
  if (!n.leida) {
    n.leida = true; ugnPintar(); _updateNotifBadge(UGN.lista.filter(x => !x.leida).length);
    fetch(`${API_URL}/notificaciones/leida/${n._id}`, { method: 'PUT', headers: ugnAuth() }).catch(() => {});
  }
  const t = n.itemTitle || '';
  if (n.tipo === 'sistema' && t.startsWith('Mensaje')) { location.href = `./chats.html?usuario=${encodeURIComponent(n.emisor || '')}`; return; }
  if (n.tipo === 'sistema' && t === 'Verifica tu email') { ugnCerrar(); window.ugVerifMostrar?.(); return; }
  if (n.tipo === 'sistema' && (t === 'Tu pase vence' || t === 'Tu Premium vence')) { ugnCerrar(); switchTab('economia'); setTimeout(() => ecoCargarPlan(true), 500); return; }
  if (n.tipo === 'sistema' && t === 'En vivo') { location.href = `./live.html?u=${encodeURIComponent(n.emisor || '')}`; return; }
  if (n.tipo === 'seguidor') { location.href = `./perfil-publico.html?u=${encodeURIComponent(n.emisor || '')}`; return; }
  if (t === 'Revisión') { ugnCerrar(); switchTab('profile'); return; }
  if (ugnTexto(n).anuncio) return;   // el anuncio ya se lee completo en la tarjeta
  if (n.itemId) { ugnCerrar(); _abrirItemDesdeNotif(n.itemId); }
}
async function _abrirItemDesdeNotif(itemId) {
  if (!itemId) return;
  ugnCerrar();
  if (typeof currentTab !== 'undefined' && currentTab !== 'main' && typeof switchTab === 'function') switchTab('main');
  const item = todosLosItems.find(i => i._id === itemId);
  if (item) return openDetail(item);
  try { const r = await fetch(`${API_URL}/items/${itemId}`, { headers: LS.get('token') ? ugnAuth() : {} }); if (r.ok) { const d = await r.json(); if (d && d._id) openDetail(d); else toast('Esa publicación ya no está disponible'); } } catch (_) {}
}
async function ugnMarcarTodas() {
  const usuario = LS.get('user_admin'); if (!usuario) return;
  UGN.lista.forEach(n => { n.leida = true; }); ugnPintar(); _updateNotifBadge(0);
  fetch(`${API_URL}/notificaciones/marcar-leidas/${encodeURIComponent(usuario)}`, { method: 'PUT', headers: ugnAuth() }).catch(() => {});
}
const _marcarTodasLeidas = ugnMarcarTodas;
async function ugnEliminar(id) {
  const row = document.querySelector(`#notif-list [data-id="${CSS.escape(id)}"]`);
  if (row) { row.classList.add('bye'); }
  UGN.lista = UGN.lista.filter(n => n._id !== id);
  setTimeout(ugnPintar, 220); _updateNotifBadge(UGN.lista.filter(x => !x.leida).length);
  fetch(`${API_URL}/notificaciones/${id}`, { method: 'DELETE', headers: ugnAuth() }).catch(() => {});
}
async function ugnVaciar() {
  const usuario = LS.get('user_admin'); if (!usuario || !UGN.lista.length) return;
  if (!confirm('¿Borrar todas tus notificaciones?')) return;
  UGN.lista = []; ugnPintar(); _updateNotifBadge(0);
  fetch(`${API_URL}/notificaciones/todas/${encodeURIComponent(usuario)}`, { method: 'DELETE', headers: ugnAuth() }).catch(() => {});
}

function _updateNotifBadge(count) {
  for (const id of ['notif-badge', 'hdr-orb-badge']) {   // el orbe del menú también muestra el número
    const b = document.getElementById(id);
    if (b) { b.hidden = !(count > 0); b.textContent = count > 99 ? '99+' : count; }
  }
  document.getElementById('hdr-orb')?.setAttribute('aria-label', count > 0 ? `Abrir menú rápido · ${count} notificaciones sin leer` : 'Abrir menú rápido');
  try { if ('setAppBadge' in navigator) count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge(); } catch (_) {}
}
// Conteo periódico: si sube, trae las nuevas y las muestra en la isla
async function _pollNotifBadge() {
  const usuario = LS.get('user_admin'), token = LS.get('token');
  if (!usuario || !token) return;
  try {
    const r = await fetch(`${API_URL}/notificaciones/count/${encodeURIComponent(usuario)}`, { headers: ugnAuth() });
    const d = r.ok ? await r.json() : null; if (!d?.success) return;
    const c = d.noLeidas || 0;
    _updateNotifBadge(c);
    if (UGN.ultimoConteo !== null && c > UGN.ultimoConteo) {
      const lista = await _cargarNotificaciones();
      (lista || []).filter(n => !n.leida && !UGN.vistos.has(n._id) && new Date(n.fecha).getTime() > UGN.inicio - 5000)
        .slice(0, 3).reverse().forEach(n => ugnIsla(n));
    }
    if (UGN.ultimoConteo === null) { const l = await _cargarNotificaciones(); (l || []).forEach(n => UGN.vistos.add(n._id)); }
    UGN.ultimoConteo = c;
  } catch (_) {}
}
function _timeAgo(date) {
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'ahora';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)} d`;
  return date.toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

// ── Isla flotante ─────────────────────────────────────
function ugnIsla(n) {
  if (!n || UGN.vistos.has(n._id || n.id)) return;
  UGN.vistos.add(n._id || n.id);
  UGN.cola.push(n);
  if (!document.getElementById('ugn-island')?.classList.contains('show')) ugnSiguienteIsla();
}
function ugnSiguienteIsla() {
  const n = UGN.cola.shift(); if (!n) return;
  let isla = document.getElementById('ugn-island');
  if (!isla) {
    isla = document.createElement('div'); isla.id = 'ugn-island'; isla.className = 'ugn-island'; isla.setAttribute('role', 'status');
    document.body.appendChild(isla);
    let y0 = null;
    isla.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; }, { passive: true });
    isla.addEventListener('touchend', e => { if (y0 !== null && e.changedTouches[0].clientY - y0 < -25) ugnOcultarIsla(); y0 = null; }, { passive: true });
  }
  const meta = ugnMeta(n), tx = ugnTexto(n);
  isla.innerHTML = `${ugnAvatar(n, meta)}
    <div class="ugn-isla-tx"><b>${escH(tx.anuncio ? tx.quien : `${tx.quien} ${tx.accion}`)}</b><span>${escH(tx.sub || 'Toca para verla')}</span></div>
    <button class="ugn-isla-x" aria-label="Cerrar"><ion-icon name="close"></ion-icon></button><i class="ugn-isla-bar"></i>`;
  isla.onclick = e => {
    if (e.target.closest('.ugn-isla-x')) return ugnOcultarIsla();
    ugnOcultarIsla();
    if (n._onClick) return n._onClick();
    const real = n._id && UGN.lista.find(x => x._id === n._id);
    if (real) return ugnAbrir(real);
    const url = n._push?.url; if (url) location.href = url;
  };
  isla.classList.remove('show'); void isla.offsetWidth; isla.classList.add('show');
  if (navigator.vibrate) try { navigator.vibrate(30); } catch (_) {}
  clearTimeout(UGN.islaT); UGN.islaT = setTimeout(ugnOcultarIsla, 5500);
}
function ugnOcultarIsla() {
  const isla = document.getElementById('ugn-island'); clearTimeout(UGN.islaT);
  if (!isla) return; isla.classList.remove('show');
  setTimeout(ugnSiguienteIsla, 450);
}

// ── Push al móvil ─────────────────────────────────────
const ugnPushSoportado = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const ugnEsIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const ugnInstalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function ugnClaveBytes(b64) { const p = '='.repeat((4 - b64.length % 4) % 4); const raw = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...raw].map(c => c.charCodeAt(0))); }
async function ugnSuscribir(silencioso) {
  try {
    if (!ugnPushSoportado() || !LS.get('token')) return false;
    if (Notification.permission !== 'granted') {
      if (silencioso) return false;
      const p = await Notification.requestPermission();
      if (p !== 'granted') { ugnPintarPush(); return false; }
    }
    const reg = await navigator.serviceWorker.ready;
    const { publicKey } = await (await fetch(`${API_URL}/push/clave`)).json();
    if (!publicKey) return false;
    let sub = await reg.pushManager.getSubscription();
    // Si el servidor cambió de clave, la suscripción vieja ya no sirve
    if (sub && sub.options?.applicationServerKey) {
      const actual = btoa(String.fromCharCode(...new Uint8Array(sub.options.applicationServerKey))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      if (actual !== publicKey) { await sub.unsubscribe().catch(() => {}); sub = null; }
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: ugnClaveBytes(publicKey) });
    const r = await fetch(`${API_URL}/push/suscribir`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...ugnAuth() }, body: JSON.stringify({ subscription: sub.toJSON() }) });
    LS.set('ugn_push_on', r.ok ? '1' : '');
    ugnPintarPush();
    return r.ok;
  } catch (e) { console.warn('[push]', e); ugnPintarPush(); return false; }
}
async function ugnDesuscribir() {
  try {
    const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    if (sub) { fetch(`${API_URL}/push/desuscribir`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...ugnAuth() }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {}); await sub.unsubscribe(); }
  } catch (_) {}
  LS.set('ugn_push_on', ''); ugnPintarPush(); ugnAjustes(true);
}
function ugnPintarPush() {
  const box = document.getElementById('ugn-push'); if (!box) return;
  const activo = ugnPushSoportado() && Notification.permission === 'granted' && LS.get('ugn_push_on') === '1';
  if (activo) { box.innerHTML = ''; return; }
  let txt, btn = '<button class="ugn-push-btn" onclick="ugnSuscribir(false)">Activar</button>';
  if (ugnEsIOS() && !ugnInstalada()) { txt = 'En iPhone: toca <b>Compartir → Añadir a pantalla de inicio</b> y abre UpGames desde ahí para recibir avisos.'; btn = ''; }
  else if (!ugnPushSoportado()) { txt = 'Tu navegador no admite avisos push. Prueba con Chrome.'; btn = ''; }
  else if (Notification.permission === 'denied') { txt = 'Bloqueaste los avisos. Actívalos en el candado 🔒 de la barra de direcciones → Notificaciones → Permitir.'; btn = ''; }
  else txt = 'Entérate al instante cuando un creador que sigues publique, te escriban o haya novedades, aunque no estés en UpGames.';
  box.innerHTML = `<div class="ugn-push"><div class="ugn-push-ic"><ion-icon name="phone-portrait-outline"></ion-icon></div><div class="ugn-push-tx"><b>Avisos en tu móvil</b><span>${txt}</span></div>${btn}</div>`;
}
async function ugnAjustes(mostrar) {
  const main = document.getElementById('ugn-main'), set = document.getElementById('ugn-settings'); if (!main || !set) return;
  main.hidden = !!mostrar; set.hidden = !mostrar;
  if (!mostrar) return;
  set.innerHTML = '<div class="ugn-skel"></div>';
  let prefs = { publicaciones: true, mensajes: true, social: true, anuncios: true }, dispositivos = 0;
  try { const d = await (await fetch(`${API_URL}/push/prefs`, { headers: ugnAuth() })).json(); if (d.success) { prefs = d.prefs; dispositivos = d.dispositivos; } } catch (_) {}
  const activo = ugnPushSoportado() && Notification.permission === 'granted' && LS.get('ugn_push_on') === '1';
  const fila = (k, ic, t, s) => `<label class="ugn-set"><ion-icon name="${ic}"></ion-icon><span><b>${t}</b><small>${s}</small></span><input type="checkbox" data-k="${k}" ${prefs[k] !== false ? 'checked' : ''}><i class="ugn-sw"></i></label>`;
  set.innerHTML = `<button class="ugn-back" onclick="ugnAjustes(false)"><ion-icon name="chevron-back"></ion-icon> Notificaciones</button>
    <div class="ugn-set-card ${activo ? 'on' : ''}"><ion-icon name="${activo ? 'notifications' : 'notifications-off-outline'}"></ion-icon>
      <div><b>${activo ? 'Avisos activados en este dispositivo' : 'Avisos desactivados en este dispositivo'}</b><small>${dispositivos} dispositivo(s) recibiendo avisos</small></div></div>
    <div class="ugn-set-row">${activo ? '<button onclick="ugnProbar()">Enviar aviso de prueba</button><button class="ghost" onclick="ugnDesuscribir()">Desactivar aquí</button>' : '<button onclick="ugnSuscribir(false).then(()=>ugnAjustes(true))">Activar avisos aquí</button>'}</div>
    <div class="ugn-group">Qué quieres recibir en el móvil</div>
    ${fila('publicaciones', 'cloud-upload-outline', 'Nuevas publicaciones', 'Cuando un creador que sigues sube algo')}
    ${fila('mensajes', 'chatbubbles-outline', 'Mensajes', 'Mensajes privados del chat')}
    ${fila('social', 'heart-outline', 'Actividad social', 'Seguidores, me gusta, comentarios y logros')}
    ${fila('anuncios', 'megaphone-outline', 'Anuncios de UpGames', 'Novedades y actualizaciones')}
    <p class="ugn-note">Los avisos sobre la revisión de tus publicaciones siempre se envían.</p>`;
  set.querySelectorAll('input[data-k]').forEach(i => i.addEventListener('change', () =>
    fetch(`${API_URL}/push/prefs`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...ugnAuth() }, body: JSON.stringify({ [i.dataset.k]: i.checked }) }).then(() => toast('✓ Preferencias guardadas')).catch(() => {})));
}
async function ugnProbar() {
  try { const d = await (await fetch(`${API_URL}/push/prueba`, { method: 'POST', headers: ugnAuth() })).json(); toast(d.enviados ? '🔔 Aviso de prueba enviado' : 'No hay dispositivos suscritos'); } catch (_) {}
}
// Invitación suave (una vez por semana) para activar los avisos del móvil
function ugnInvitarPush() {
  if (!ugnPushSoportado() || Notification.permission !== 'default' || LS.get('ugn_push_on') === '1') return;
  if (Date.now() - parseInt(LS.get('ugn_push_ask') || '0') < 7 * 864e5) return;
  LS.set('ugn_push_ask', Date.now().toString());
  ugnIsla({ id: 'push-invite', _push: { title: 'Avisos en tu móvil', body: '🔔 ¿Te avisamos cuando tus creadores publiquen? Toca para activarlo.' }, _onClick: () => ugnSuscribir(false) });
}

// Mensajes del service worker: push recibido con la app abierta → isla
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => {
  if (e.data?.type !== 'UG_PUSH') return;
  const d = e.data.data || {};
  ugnIsla({ id: d.id || 'p' + Date.now(), _id: d.id || undefined, tipo: 'sistema', _push: d });
  _pollNotifBadge();
});

// Inicializar cuando el usuario esté logueado
function ugnArrancar() {
  if (!LS.get('user_admin') || !LS.get('token')) return;
  _initNotifUI(); _pollNotifBadge();
  if (!UGN.timer) UGN.timer = setInterval(() => { if (!document.hidden) _pollNotifBadge(); }, 30000);
  if (ugnPushSoportado() && Notification.permission === 'granted') ugnSuscribir(true);   // re-sincroniza la suscripción
  else setTimeout(ugnInvitarPush, 25000);
}
window.addEventListener('load', () => setTimeout(ugnArrancar, 1200));
document.addEventListener('visibilitychange', () => { if (!document.hidden && UGN.timer) _pollNotifBadge(); });
const _origSwitchTab = window.switchTab;
window.switchTab = function (tab) {
  if (typeof _origSwitchTab === 'function') _origSwitchTab(tab);
  if (tab === 'main') setTimeout(() => { if (!document.getElementById('notif-btn')) ugnArrancar(); }, 300);
};
Object.assign(window, { ugnSuscribir, ugnDesuscribir, ugnAjustes, ugnProbar, ugnMarcarTodas, ugnVaciar, ugnCerrar });

