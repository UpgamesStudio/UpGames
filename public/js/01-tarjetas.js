// ── YOUTUBE HELPERS ──────────────────────────────────────
function getYouTubeId(url) {
  if(!url) return null;
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/))([-\w]{11})/i);
  return m ? m[1] : null;
}
function isYouTubeUrl(url) { return !!getYouTubeId(url); }
// ── Videos subidos ──
// Los teléfonos graban en formatos que el navegador no reproduce (3gp en Android, mov/hevc en iPhone…).
// Todo lo que está en /video/upload/ de Cloudinary es video, tenga la extensión que tenga, y se pide
// convertido a MP4 (H.264) cambiando la extensión: Cloudinary lo transcodifica y lo guarda.
const UG_VIDEO_EXT = /\.(mp4|webm|mov|m4v|avi|3gp|3g2|mkv|ogv|mpe?g|wmv|flv)(\?.*)?$/i;
const UG_CLD_VIDEO = /^https:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\//i;
function ugEsVideoArchivo(url) { return !!url && (UG_VIDEO_EXT.test(url) || UG_CLD_VIDEO.test(url)); }
function ugVideoSrc(url) {
  const u = String(url || '');
  if (!UG_CLD_VIDEO.test(u) || /\.(mp4|webm)(\?.*)?$/i.test(u)) return u;
  return /\/[^/?]+\.[a-z0-9]{2,4}(\?.*)?$/i.test(u) ? u.replace(/\.[a-z0-9]{2,4}(\?.*)?$/i, '.mp4$1') : u + '.mp4';
}
// Miniatura de un video de Cloudinary (fotograma en el segundo 1)
function ugVideoThumb(url) {
  const u = String(url || '');
  if (!UG_CLD_VIDEO.test(u)) return '';
  const base = /\/[^/?]+\.[a-z0-9]{2,4}(\?.*)?$/i.test(u) ? u.replace(/\.[a-z0-9]{2,4}(\?.*)?$/i, '.jpg') : u + '.jpg';
  return base.replace('/video/upload/', '/video/upload/so_1,c_limit,w_960,q_auto/');
}
function isVideoUrl(url) {
  if(!url) return false;
  return ugEsVideoArchivo(url) || isYouTubeUrl(url);
}
function getYouTubeThumbnail(url) {
  const id = getYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}
function getYouTubeEmbed(url, autoplay=0) {
  const id = getYouTubeId(url);
  return id ? `https://www.youtube.com/embed/${id}?autoplay=${autoplay}&mute=1&loop=1&playlist=${id}&controls=1&rel=0&playsinline=1` : null;
}

// ── TILE EXTRA BADGES — info por categoría ───────────────
function getTileExtras(item) {
  const ex = item.extraData || {};
  const cat = item.category || '';
  const badges = [];

  if(cat === 'Juego') {
    if(ex.plataforma) badges.push({ icon:'desktop-outline', text: ex.plataforma });
    if(ex.size)       badges.push({ icon:'archive-outline',  text: ex.size });
  } else if(cat === 'Mod') {
    if(ex['juego-base']) badges.push({ icon:'game-controller-outline', text: ex['juego-base'] });
    if(ex.version)       badges.push({ icon:'git-branch-outline', text: 'v' + ex.version });
  } else if(cat === 'Apps') {
    if(ex.so)      badges.push({ icon:'phone-portrait-outline', text: ex.so });
    if(ex.version) badges.push({ icon:'code-working-outline',   text: 'v' + ex.version });
    if(ex.size)    badges.push({ icon:'archive-outline',         text: ex.size });
  } else if(cat === 'Software') {
    if(ex.licencia) badges.push({ icon:'document-text-outline', text: ex.licencia });
    if(ex.so)       badges.push({ icon:'desktop-outline',        text: ex.so });
  } else if(cat === 'Ajustes') {
    if(ex['tipo-herramienta']) badges.push({ icon:'construct-outline', text: ex['tipo-herramienta'] });
    if(ex.compatible)          badges.push({ icon:'checkmark-circle-outline', text: ex.compatible });
  } else if(cat === 'Optimizacion') {
    if(ex['tipo-opt'])  badges.push({ icon:'speedometer-outline', text: ex['tipo-opt'] });
    if(ex.compatible)   badges.push({ icon:'checkmark-circle-outline', text: ex.compatible });
  } else if(cat === 'Video') {
    if(item.videoType) badges.push({ icon:'film-outline', text: item.videoType });
  }

  if(!badges.length) return '';
  return `<div class="tile-extras">
    ${badges.slice(0,2).map(b =>
      `<span class="tile-extra-badge"><ion-icon name="${b.icon}"></ion-icon>${escH(b.text)}</span>`
    ).join('')}
  </div>`;
}

// Nombre visible de cada categoría (el valor guardado en la BD no cambia)
const CAT_LABEL = { Ajustes:'Herramientas', Optimizacion:'Optimización', Juego:'Juego', Mod:'Mod', Apps:'App', Software:'Software', Video:'Video' };
const catLabel = c => CAT_LABEL[c] || c || 'General';

// ── SERIES POR PARTES ─────────────────────────────────────
// Un mod grande se publica en partes ("… parte 1", "… parte 2"). En el detalle
// se ve la parte siguiente; al descargar una parte se desbloquea la próxima.
// Cada parte es su propia publicación: cada descarga cuenta para el autor.
const SERIE_CACHE = new Map();
function partesDescargadas() { try { return new Set(JSON.parse(localStorage.getItem('ug_descargadas') || '[]')); } catch (_) { return new Set(); } }
function marcarDescargada(id) {
  try { const s = [...partesDescargadas()]; if (!s.includes(id)) { s.push(id); localStorage.setItem('ug_descargadas', JSON.stringify(s.slice(-3000))); } } catch (_) {}
}
const pareceParte = it => !!(it.serie?.clave || it.serieInfo || /\b(parte|part|pt|disco|disc|cd|vol)\.?\s*#?\s*(\d{1,3}|[ivx]{1,4})\b|[([]\s*\d{1,3}\s*(\/|de|of)\s*\d{1,3}\s*[)\]]/i.test(it.title || ''));
async function renderSerieDetalle(item) {
  const box = document.getElementById('ds-serie'); if (!box) return;
  box.style.display = 'none'; box.innerHTML = '';
  if (!item?._id || !pareceParte(item)) return;
  const clave = item.serie?.clave;
  let serie = clave && SERIE_CACHE.get(clave);
  if (!serie) {
    try { const r = await fetchTimeout(`${API_URL}/items/${item._id}/serie`, 8000); if (r.ok) serie = (await r.json()).serie; } catch (_) {}
    if (serie) SERIE_CACHE.set(serie.clave, serie);
  }
  if (!serie || currentItem?._id !== item._id) return;
  const partes = serie.partes, idx = partes.findIndex(p => p._id === item._id);
  if (idx < 0) return;
  const desc = partesDescargadas();
  const hechas = partes.filter(p => desc.has(p._id)).length;
  let ultima = -1; partes.forEach((p, i) => { if (desc.has(p._id)) ultima = i; });
  const visibleHasta = Math.min(partes.length - 1, Math.max(idx, ultima) + 1);
  const pct = Math.round(hechas / partes.length * 100);
  const filas = partes.slice(0, visibleHasta + 1).map((p, i) => {
    const n = p.serie?.parte || i + 1, hecha = desc.has(p._id), actual = i === idx, siguiente = i === visibleHasta && !hecha && !actual;
    const estado = actual ? '<span class="ds-serie-tag cur">Estás aquí</span>' : hecha ? '<span class="ds-serie-tag ok">✓ Descargada</span>' : siguiente ? '<span class="ds-serie-tag next">Siguiente</span>' : '';
    return `<button class="ds-serie-row ${actual ? 'cur' : ''} ${siguiente ? 'next' : ''}" data-i="${i}" ${actual ? 'disabled' : ''}>
      <span class="ds-serie-n">${hecha ? '✓' : n}</span><span class="ds-serie-t">Parte ${n}${p.linkStatus === 'caido' ? ' · ⚠️ enlace caído' : ''}</span>${estado}${actual ? '' : '<ion-icon name="chevron-forward"></ion-icon>'}</button>`;
  }).join('');
  const bloqueadas = partes.length - 1 - visibleHasta;
  box.innerHTML = `<div class="ds-serie">
    <div class="ds-serie-h"><ion-icon name="folder-open"></ion-icon><div><b>${escH(serie.base || 'Serie')}</b><small>Contenido dividido en ${partes.length} partes · ${fmt(serie.descargas || 0)} descargas en total</small></div></div>
    <div class="ds-serie-bar"><i style="width:${pct}%"></i></div><div class="ds-serie-prog">Has descargado ${hechas} de ${partes.length} partes</div>
    <div class="ds-serie-list">${filas}</div>
    ${bloqueadas > 0 ? `<div class="ds-serie-lock"><ion-icon name="lock-closed-outline"></ion-icon> ${bloqueadas} parte${bloqueadas > 1 ? 's' : ''} más: se desbloquean a medida que descargas</div>` : `<div class="ds-serie-lock ok"><ion-icon name="checkmark-done-outline"></ion-icon> Todas las partes disponibles</div>`}
  </div>`;
  box.style.display = '';
  box.querySelectorAll('.ds-serie-row:not([disabled])').forEach(b => b.addEventListener('click', () => {
    const p = partes[+b.dataset.i]; if (p) openDetail(todosLosItems.find(x => x._id === p._id) || p);
    document.querySelector('#detail-sheet .sheet-scroll')?.scrollTo?.({ top: 0, behavior: 'smooth' });
  }));
}

// Escapa texto de usuarios antes de meterlo en HTML (títulos, autores, URLs…).
// Antes los títulos se insertaban tal cual: un título con <img onerror> ejecutaba código en el catálogo.
const escH = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ── CREATE TILE ───────────────────────────────────────────
function createTile(item, isFeatured=false) {
  const ls = item.linkStatus || (item.reportes>=3?'revision':'online');
  // Serie por partes: el catálogo muestra el título base + "📁 N partes"
  const tituloT = item.serieInfo?.base || item.title;
  const isOnline = ls==='online';
  const statusLabel = ls==='online'?'Online':ls==='revision'?'Revisión':'Caído';
  const cat = item.category || 'General';
  const isVideo = cat === 'Video';

  // Para video: la imagen es la miniatura, el link es el video real
  const imgSrc = item.image || '';
  const isVid = !isVideo && ugEsVideoArchivo(imgSrc);
  // Portadas al tamaño de la tarjeta (antes se bajaba la imagen original completa)
  const media = isVid
    ? `<video data-src="${escH(ugVideoSrc(imgSrc))}" muted loop playsinline preload="none" class="lazy-vid"></video>`
    : `<img src="${escH(cldOpt(imgSrc, CLD_TILE_FEED))}"${cldSrcset(imgSrc, UG_SS_TILE, UG_SIZES_TILE)} alt="${escH(tituloT)}" loading="lazy" decoding="async" onerror="this.onerror=null;this.removeAttribute('srcset');this.src=window.UG_PH">`;

  const favIds = LS.getJSON('favoritos', []);
  const isFav = favIds.includes(item._id);
  const dl = item.descargasEfectivas||0;
  const lk = item.likesCount||0;
  const extraBadges = (item.serieInfo ? `<span class="tile-extra-badge tile-serie-badge"><ion-icon name="folder-open"></ion-icon>${item.serieInfo.partes} partes</span>` : '') + getTileExtras(item);
  // Siempre hay una fila de etiquetas (vacía si no tiene): todas las tarjetas miden lo mismo
  const insignias = extraBadges.replace(/<div class="tile-extras">([\s\S]*)<\/div>\s*$/, '$1').trim();
  const extrasFila = insignias ? `<div class="tile-extras">${insignias}</div>` : '<div class="tile-extras tile-extras--vacia" aria-hidden="true"></div>';

  if(isFeatured) {
    const el = document.createElement('div');
    el.className='featured-tile';
    el.dataset.id=item._id;
    const ftMedia = isVid
      ? `<video data-src="${escH(ugVideoSrc(imgSrc))}" muted loop playsinline preload="none" class="lazy-vid"></video>`
      : `<img src="${escH(cldOpt(imgSrc, CLD_DESTACADA))}"${cldSrcset(imgSrc, UG_SS_GRANDE, '100vw')} alt="${escH(tituloT)}" loading="lazy" decoding="async" onerror="this.onerror=null;this.removeAttribute('srcset');this.src=window.UG_PH">`;
    el.innerHTML=`
      <div class="thumb-wrap">${ftMedia}
        ${isVideo?'<div class="tile-video-overlay"><ion-icon name="play-circle"></ion-icon></div>':''}
      </div>
      <div class="ft-info">
        <div class="ft-badge">${isVideo?'▶ '+( item.videoType||'Video'):'⭐ Destacado'}</div>
        <div class="ft-title">${escH(tituloT)}</div>
        <div class="ft-meta">
          <div class="ft-user">@${escH(item.usuario||'Cloud')}${getBadge(item.usuario)}</div>
          ${lk?`<div class="ft-dl"><ion-icon name="heart"></ion-icon>${fmt(lk)}</div>`:''}
        </div>
      </div>`;
    el.addEventListener('click',()=>openDetail(item));
    return el;
  }

  const el = document.createElement('div');
  const catClass = cat.toLowerCase().replace('ó','o').replace('ó','o').replace(/[^a-z]/g,'');
  el.className = 'game-tile game-tile--' + catClass + (isVideo?' game-tile--video':'');
  el.dataset.id=item._id;
  if(item.usuario) el.dataset.u=String(item.usuario).toLowerCase();

  if(isVideo) {
    // Badge de duración — se guarda en extraData.duracion (formato "12:34")
    const duracion = item.extraData?.duracion || '';
    // YouTube-style card: thumbnail arriba, info abajo con avatar a la izquierda
    el.innerHTML=`
      <div class="thumb-wrap">
        ${media}
        <div class="tile-video-overlay"><ion-icon name="play-circle"></ion-icon></div>
        <div class="tile-status ${ls}"><span class="tile-status-dot"></span>${statusLabel}</div>
        <button class="tile-fav-quick ${isFav?'active':''}" data-id="${item._id}" title="Favorito" aria-label="${isFav?'Quitar de favoritos':'Añadir a favoritos'}">
          <ion-icon name="${isFav?'heart':'heart-outline'}"></ion-icon>
        </button>
        ${item.videoType?`<div class="tile-vid-type-badge">${escH(item.videoType)}</div>`:''}
        ${duracion?`<div class="tile-duration-badge">${duracion}</div>`:''}
      </div>
      <div class="tile-info tile-info--yt">
        <div class="tile-yt-avatar">${avatarLetter(item.usuario)}</div>
        <div class="tile-yt-body">
          <div class="tile-title">${escH(tituloT)}</div>
          <div class="tile-yt-meta">
            <span class="tile-user">@${escH(item.usuario||'Cloud')}${getBadge(item.usuario)}</span>
            ${vistasVideo(item)?`<span class="tile-yt-dot">·</span><span class="tile-yt-views"><ion-icon name="eye-outline"></ion-icon>${fmt(vistasVideo(item))}</span>`:''}
            ${lk?`<span class="tile-yt-dot">·</span><span class="tile-yt-likes"><ion-icon name="heart"></ion-icon>${fmt(lk)}</span>`:''}
            ${window.UGR?.estrellasTile(item)||''}
          </div>
        </div>
      </div>`;
  } else {
    el.innerHTML=`
      <div class="thumb-wrap">
        ${media}
        <div class="tile-status ${ls}">
          <span class="tile-status-dot"></span>${statusLabel}
        </div>
        <button class="tile-fav-quick ${isFav?'active':''}" data-id="${item._id}" title="Favorito" aria-label="${isFav?'Quitar de favoritos':'Añadir a favoritos'}">
          <ion-icon name="${isFav?'heart':'heart-outline'}"></ion-icon>
        </button>

      </div>
      <div class="tile-info">
        <div class="tile-cat">${catLabel(cat)}${item.promocionado ? ' <span class="tile-promo" title="Su autor pagó para destacarla">Promocionado</span>' : ''}</div>
        ${extrasFila}
        <div class="tile-title">${escH(tituloT)}</div>
        <div class="tile-meta">
          <div class="tile-avatar">${avatarLetter(item.usuario)}</div>
          <div class="tile-user">@${escH(item.usuario||'Cloud')}</div>
          ${dl?`<div class="tile-dl-count" title="${dl} descargas"><ion-icon name="cloud-download-outline"></ion-icon>${fmt(dl)}</div>`:''}
          ${lk?`<div class="tile-downloads"><ion-icon name="heart"></ion-icon>${fmt(lk)}</div>`:''}
          ${window.UGR?.estrellasTile(item)||''}
        </div>
      </div>`;
  }

  el.addEventListener('click',(e)=>{
    if(e.target.closest('.tile-fav-quick')) return;
    openDetail(item);
  });
  el.querySelector('.tile-fav-quick').addEventListener('click',(e)=>{
    e.stopPropagation();
    fav(item._id);
  });
  return el;
}

// ── VIDEO CARD — siempre abre el detail sheet ────────────
function toggleVideoCard(el, item) { openDetail(item); }
function expandVideoCard(el, item) { openDetail(item); }
function collapseVideoCard(el) { el.classList.remove('expanded'); }


