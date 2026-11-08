// ── OPEN DETAIL SHEET ─────────────────────────────────────
// ── SEO por publicación: título, descripción, imagen y datos estructurados ──
// Las páginas estáticas /p/ se generan cada hora y al aprobar una publicación (ver sitemap.yml):
// pasadas 3 h ya existen seguro.
const UG_PAGINA_LISTA_MS = 3 * 3600e3;
const UG_SEO_BASE = { title: document.title, url: 'https://upgames.games/public/biblioteca.html' };
function ugMeta(attr, key, val) {
  let m = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!m) { m = document.createElement('meta'); m.setAttribute(attr, key); document.head.appendChild(m); }
  m.setAttribute('content', val);
}
function ugSeo(item) {
  try {
    const canon = document.head.querySelector('link[rel="canonical"]') || document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'canonical' }));
    let ld = document.getElementById('ug-ld-item');
    if (!item) {
      document.title = UG_SEO_BASE.title; canon.href = UG_SEO_BASE.url; if (ld) ld.remove();
      try { const u = new URL(location.href); if (u.searchParams.has('id')) { u.searchParams.delete('id'); history.replaceState(null, '', u.pathname + u.search); } } catch(_) {}
      return;
    }
    // Si ya tiene su página estática (public/p/, se genera a diario) esa es la canónica: evita contenido duplicado
    const slug = String(item.title || 'publicacion').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '') || 'publicacion';
    const estatica = (!item.status || item.status === 'aprobado') && item.createdAt && Date.now() - new Date(item.createdAt) > UG_PAGINA_LISTA_MS;
    const url = estatica ? `https://upgames.games/public/p/${slug}-${item._id}.html` : `${UG_SEO_BASE.url}?id=${item._id}`;
    const desc = String(item.description || `${item.category || 'Contenido'} compartido por @${item.usuario} en UpGames.`).replace(/\s+/g, ' ').slice(0, 160);
    const img = ugTarjeta(item) || (/^https:\/\//.test(item.image || '') ? item.image : 'https://upgames.games/public/og-cover.png');
    document.title = `${item.title} — ${item.category || 'Descargar'} | UpGames`;
    canon.href = url;
    ugMeta('name', 'description', desc);
    ugMeta('property', 'og:title', `${item.title} | UpGames`); ugMeta('property', 'og:description', desc);
    ugMeta('property', 'og:image', img); ugMeta('property', 'og:url', url); ugMeta('property', 'og:type', 'website');
    ugMeta('name', 'twitter:card', 'summary_large_image');
    const tipo = item.category === 'Video' ? 'VideoObject' : (item.category === 'Juego' ? 'VideoGame' : 'SoftwareApplication');
    const datos = { '@context': 'https://schema.org', '@type': tipo, name: item.title, description: desc, image: img, url,
      author: { '@type': 'Person', name: item.usuario, url: `https://upgames.games/public/perfil-publico.html?usuario=${encodeURIComponent(item.usuario)}` },
      ...(item.createdAt ? { datePublished: item.createdAt } : {}),
      ...(tipo === 'VideoObject' ? { thumbnailUrl: img, uploadDate: item.createdAt || undefined, contentUrl: item.link } : { applicationCategory: tipo === 'VideoGame' ? 'Game' : 'Utilities', operatingSystem: 'Windows, Android', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } }),
      interactionStatistic: { '@type': 'InteractionCounter', interactionType: 'https://schema.org/DownloadAction', userInteractionCount: item.descargasEfectivas || 0 } };
    if (!ld) { ld = document.createElement('script'); ld.type = 'application/ld+json'; ld.id = 'ug-ld-item'; document.head.appendChild(ld); }
    ld.textContent = JSON.stringify(datos).replace(/</g, '\\u003c');
    // URL propia para compartir y para que Google la asocie a esta publicación
    try { const u = new URL(location.href); if (u.searchParams.get('id') !== item._id) { u.searchParams.set('id', item._id); history.replaceState(null, '', u.pathname + u.search); } } catch(_) {}
  } catch (_) {}
}

function openDetail(item) {
  currentItem = item;
  ugSeo(item);
  const ls = item.linkStatus||(item.reportes>=3?'revision':'online');
  const isVideoItem = item.category === 'Video';

  // Para videos: el link ES el video; para otros: medias son imágenes/previews
  const rawMedias = [item.image, ...(item.images||[])].filter(m=>m&&m.trim());
  const allMedias = isVideoItem && item.link
    ? [item.link, ...rawMedias.filter(m=>m!==item.link)]
    : rawMedias;

  const firstVideo = isVideoItem
    ? (item.link || allMedias[0] || '')
    : (allMedias.find(m=>isYouTubeUrl(m)||ugEsVideoArchivo(m)) || allMedias[0] || '');
  const primaryMedia = firstVideo || allMedias[0] || '';

  function loadSheetMedia(mediaUrl) {
    const img2 = document.getElementById('ds-media-img');
    const vid2 = document.getElementById('ds-media-vid');
    const sheetMedia = document.querySelector('.sheet-media');
    const overlay = sheetMedia.querySelector('.sheet-media-overlay');

    // Limpiar inyecciones previas
    const oldIf  = document.getElementById('ds-yt-iframe');
    const oldVid = document.getElementById('ds-injected-vid');
    if(oldIf)  oldIf.remove();
    if(oldVid) oldVid.remove();

    const isYT2  = isYouTubeUrl(mediaUrl);
    const isMp42 = ugEsVideoArchivo(mediaUrl);

    if(isYT2) {
      img2.style.display='none'; vid2.style.display='none'; vid2.src='';
      if(overlay) overlay.style.display = isVideoItem ? 'none' : '';

      const yti = document.createElement('iframe');
      yti.id = 'ds-yt-iframe';
      const autoplay = isVideoItem ? 1 : 0;
      const mute     = isVideoItem ? 0 : 1;
      const ytId = getYouTubeId(mediaUrl);
      yti.src = `https://www.youtube.com/embed/${ytId}?autoplay=${autoplay}&mute=${mute}&controls=1&rel=0&playsinline=1${isVideoItem ? '' : ('&loop=1&playlist=' + ytId)}`;
      yti.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      yti.allowFullscreen = true;
      yti.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;border-radius:16px;';
      sheetMedia.appendChild(yti);

    } else if(isMp42) {
      img2.style.display = 'none';

      if(isVideoItem) {
        // Video item: inyectar <video> limpio con controls, igual que el iframe de YT
        vid2.style.display = 'none'; vid2.src = '';
        if(overlay) overlay.style.display = 'none';

        const nv = document.createElement('video');
        nv.id = 'ds-injected-vid';
        nv.src = ugVideoSrc(mediaUrl);
        if (ugVideoThumb(mediaUrl)) nv.poster = ugVideoThumb(mediaUrl);
        nv.controls = true;
        nv.autoplay  = true;
        nv.playsInline = true;
        // Sin border-radius en el elemento video — Android WebView lo bloquea al hacer fullscreen
        nv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:none;background:#000;object-fit:contain;';
        sheetMedia.appendChild(nv);

        // Botón de fullscreen explícito (usa la API del navegador, no el control nativo)
        // para evitar que overflow:hidden/clip del contenedor lo bloquee
        const fsBtn = document.createElement('button');
        fsBtn.id = 'ds-vid-fs-btn';
        fsBtn.setAttribute('aria-label','Pantalla completa');
        fsBtn.innerHTML = '<ion-icon name="expand-outline"></ion-icon>';
        fsBtn.style.cssText = [
          'position:absolute','bottom:10px','right:10px','z-index:20',
          'background:rgba(0,0,0,.6)','backdrop-filter:blur(6px)',
          'border:1px solid rgba(90,200,250,.35)','border-radius:8px',
          'color:#5AC8FA','font-size:1.05rem',
          'width:34px','height:34px',
          'display:flex','align-items:center','justify-content:center',
          'cursor:pointer','transition:opacity .15s'
        ].join(';');
        fsBtn.onclick = (e) => {
          e.stopPropagation();
          if      (nv.requestFullscreen)        nv.requestFullscreen();
          else if (nv.webkitRequestFullscreen)  nv.webkitRequestFullscreen();
          else if (nv.webkitEnterFullscreen)    nv.webkitEnterFullscreen(); // iOS/Safari
        };
        sheetMedia.appendChild(fsBtn);

        // Ocultar botón cuando el browser ya está en fullscreen
        const onFsChange = () => {
          const inFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
          fsBtn.style.display = inFs ? 'none' : 'flex';
        };
        document.addEventListener('fullscreenchange',       onFsChange);
        document.addEventListener('webkitfullscreenchange', onFsChange);
        // Limpiar listeners al cerrar
        nv._fsCleanup = () => {
          document.removeEventListener('fullscreenchange',       onFsChange);
          document.removeEventListener('webkitfullscreenchange', onFsChange);
        };
      } else {
        // Preview de juego: usar el <video> existente muted loop
        if(overlay) overlay.style.display = '';
        vid2.style.display = 'block';
        vid2.muted = true; vid2.loop = true;
        vid2.removeAttribute('controls');
        vid2.src = mediaUrl;
      }

    } else {
      // Imagen estática
      vid2.style.display = 'none'; vid2.src = '';
      if(overlay) overlay.style.display = '';
      // Tamaño justo para la pantalla (antes se bajaba la imagen original completa)
      const ss = cldSrcset(mediaUrl, UG_SS_GRANDE, '(min-width: 700px) 640px, 100vw', true);
      if (ss) { img2.srcset = ss.srcset; img2.sizes = ss.sizes; } else { img2.removeAttribute('srcset'); img2.removeAttribute('sizes'); }
      img2.style.display = 'block'; img2.src = cldOpt(mediaUrl, 'c_limit,w_1280,q_auto,f_auto');
      img2.onerror = () => { img2.onerror = null; img2.removeAttribute('srcset'); img2.src = window.UG_PH; };
    }
  }
  loadSheetMedia(primaryMedia);

  // Galería de miniaturas
  const galleryEl = document.getElementById('ds-gallery');
  if(allMedias.length > 1) {
    galleryEl.style.display='flex'; galleryEl.innerHTML='';
    allMedias.forEach((m,i)=>{
      const th=document.createElement('div');
      th.className='gallery-thumb'+(m===primaryMedia?' active':'');
      const isYTt=isYouTubeUrl(m);
      const isMp4t=ugEsVideoArchivo(m);

      if(isMp4t) {
        // Punto 9: auto-capturar frame del video via canvas
        th.innerHTML=`<img src="${window.UG_PH}" alt="media ${i+1}">
          <div class="gallery-yt-icon"><ion-icon name="play-circle"></ion-icon></div>`;
        // Cloudinary da el fotograma ya hecho (antes se bajaba el video entero para capturarlo)
        const thC = ugVideoThumb(m);
        if (thC) { th.querySelector('img').src = thC.replace('c_limit,w_960', 'c_fill,w_288,h_208'); }
        // Otros servidores: captura de frame en segundo plano
        const tmpVid = thC ? null : document.createElement('video');
        if (tmpVid) {
        tmpVid.src = ugVideoSrc(m); tmpVid.crossOrigin = 'anonymous';
        tmpVid.muted = true; tmpVid.preload = 'metadata';
        tmpVid.currentTime = 1;
        tmpVid.addEventListener('loadeddata', () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 144; canvas.height = 104;
            canvas.getContext('2d').drawImage(tmpVid, 0, 0, 144, 104);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
            const imgEl = th.querySelector('img');
            if(imgEl) imgEl.src = dataUrl;
            tmpVid.src = '';
          } catch(_) { tmpVid.src = ''; }
        }, { once: true });
        }
      } else {
        const tSrc=isYTt?getYouTubeThumbnail(m):m;
        th.innerHTML=`<img src="${tSrc}" alt="media ${i+1}" onerror="this.onerror=null;this.src=window.UG_PH">
          ${isYTt?'<div class="gallery-yt-icon"><ion-icon name="play-circle"></ion-icon></div>':''}`;
      }
      th.onclick=()=>{
        document.querySelectorAll('.gallery-thumb').forEach(t2=>t2.classList.remove('active'));
        th.classList.add('active'); loadSheetMedia(m);
      };
      galleryEl.appendChild(th);
    });
  } else { galleryEl.style.display='none'; galleryEl.innerHTML=''; }

  document.getElementById('ds-cat').textContent=catLabel(item.category);
  document.getElementById('ds-title').textContent=item.title;
  document.getElementById('ds-dl').textContent=fmt(item.category === 'Video' ? vistasVideo(item) : item.descargasEfectivas||0);
  const repEl = document.getElementById('ds-rep'); if (repEl) repEl.textContent = item.reportes||0;
  const updEl = document.getElementById('ds-upd');
  if (updEl) { const f = item.updatedAt || item.createdAt; updEl.textContent = f ? ugHace(f) : '—'; updEl.title = f ? new Date(f).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' }) : ''; }
  document.getElementById('ds-desc').textContent=item.description||'Sin descripción.';
  renderSerieDetalle(item);
  window.UGUX?.guiaDetalle(item);
  const askBtn = document.getElementById('ds-btn-nexus');
  if (askBtn) askBtn.onclick = () => nexusPreguntar(item.category === 'Video'
    ? `Cuéntame sobre el video "${item.title}" de @${item.usuario} y qué contenido relacionado hay en UpGames.`
    : `¿Qué es "${item.title}" (${catLabel(item.category)}) de @${item.usuario}? ¿Cómo lo instalo y qué necesito? ¿Hay algo parecido en UpGames?`);

  // ── Entrada destacada (solo para videos) ───────────────
  const featEl = document.getElementById('ds-featured-entry');
  if(featEl) {
    if(isVideoItem && item.featuredItemId) {
      featEl.style.display = '';
      featEl.innerHTML = '<div class="ds-featured-entry"><div class="ds-featured-label"><ion-icon name="sync-outline" style="animation:spinAnim .8s linear infinite"></ion-icon> Cargando entrada\u2026</div></div>';
      const cached = todosLosItems.find(i => i._id === item.featuredItemId);
      if(cached) {
        renderFeaturedEntry(featEl, cached);
      } else {
        fetch(`${API_URL}/items/${item.featuredItemId}`)
          .then(r => r.ok ? r.json() : null)
          .then(d => { if(d && d._id) renderFeaturedEntry(featEl, d); else featEl.style.display = 'none'; })
          .catch(() => { featEl.style.display = 'none'; });
      }
    } else {
      featEl.style.display = 'none';
      featEl.innerHTML = '';
    }
  }

  // ← FIX bug 2: actualizar el stat-box de FAVS/likes con el número real
  const dsLikesEl = document.getElementById('ds-likes');
  if(dsLikesEl) {
    dsLikesEl.textContent = fmt(item.likesCount||0);
  } else {
    // Fallback: buscar el tercer stat-box y rellenar su stat-val
    const statBoxes = document.querySelectorAll('.sheet-stats .stat-box');
    if(statBoxes[2]) {
      const val = statBoxes[2].querySelector('.stat-val');
      if(val) val.textContent = fmt(item.likesCount||0);
    }
  }

  // Etiquetas adaptadas por tipo
  const dlStatLbl = document.querySelector('#ds-dl')?.closest?.('.stat-box')?.querySelector?.('.stat-lbl');
  if(dlStatLbl) dlStatLbl.textContent = isVideoItem ? 'Vistas' : 'Descargas';

  // Author
  document.getElementById('ds-av-letter').textContent=avatarLetter(item.usuario);
  document.getElementById('ds-author-name').innerHTML=`@${escH(item.usuario||'Cloud')} ${getBadge(item.usuario)}`;
  document.getElementById('ds-author').onclick=()=>visitarPerfil(item.usuario);

  // Status
  const sb = document.getElementById('ds-status');
  const st = document.getElementById('ds-status-text');
  sb.className='sheet-status-bar '+ls;
  st.textContent=ls==='online'?'✓ Link Activo':ls==='revision'?'⚠️ En Revisión':'✗ Link Caído';

  // Download / Ver video
  const dlBtn = document.getElementById('ds-download');
  if(isVideoItem) {
    // Video: el player está embebido arriba — ningún botón de acción aplica
    dlBtn.style.display = 'none';
    dlBtn.onclick = null;
    // Limpiar wrap y botón comprar que puedan haber quedado de una card anterior
    const _vWrap = document.getElementById('ds-action-wrap');
    if(_vWrap) _vWrap.remove();
    const _vBuy = document.getElementById('ds-buy-btn');
    if(_vBuy) _vBuy.remove();
  } else {
    dlBtn.style.display = '';
    const _puenteMedia = [item.image, ...(item.images||[])].filter(m=>m&&m.trim()).find(m=>
      /youtu/i.test(m)||/\.mp4|\.webm|\.mov/i.test(m)
    ) || item.image || '';
    const _puenteTitle = encodeURIComponent(item.title||'');
    const _puenteMediaEnc = encodeURIComponent(_puenteMedia);
    dlBtn.href = `puente.html?id=${item._id}&media=${_puenteMediaEnc}&title=${_puenteTitle}`;
    dlBtn.innerHTML = '<ion-icon name="cloud-download-outline"></ion-icon> OBTENER LINK';
    dlBtn.onclick = async function(e) {
      marcarDescargada(item._id);
      if(ls === 'caido') {
        e.preventDefault();
        if(await customConfirm({ icon: '⚠️', title: 'Enlace reportado como caído', msg: 'Otros usuarios dicen que este enlace ya no funciona. ¿Quieres intentarlo de todas formas?', okText: 'Intentar' })) {
          window.open(`puente.html?id=${item._id}&media=${_puenteMediaEnc}&title=${_puenteTitle}`, '_blank');
        }
      }
    };

    // Botones Acceder + Comprar lado a lado
    const _existWrap = document.getElementById('ds-action-wrap');
    if(_existWrap) { _existWrap.parentNode.insertBefore(dlBtn, _existWrap); _existWrap.remove(); }
    const _existBuy = document.getElementById('ds-buy-btn');
    if(_existBuy) _existBuy.remove();

    const _det = item.extraData && item.extraData.detectedGame
      ? item.extraData.detectedGame
      : clientDetectGame(item.title, item.description);

    if(_det && _det.purchaseLink) {
      // Crear wrapper flex que contiene ambos botones
      const _wrap = document.createElement('div');
      _wrap.id = 'ds-action-wrap';
      _wrap.className = 'ds-action-wrap';

      // Clonar dlBtn dentro del wrapper
      const _cloudBtn = dlBtn.cloneNode(true);
      _cloudBtn.onclick = dlBtn.onclick;
      _wrap.appendChild(_cloudBtn);

      // Botón comprar
      const _buyBtn = document.createElement('button');
      _buyBtn.id = 'ds-buy-btn';
      _buyBtn.className = 'sheet-buy-btn';
      _buyBtn.innerHTML = '<ion-icon name="cart-outline"></ion-icon> COMPRAR';
      _buyBtn.onclick = function() { showBuyModal(item._id, _det.gameName, _det.purchaseLink); };
      _wrap.appendChild(_buyBtn);

      // Reemplazar dlBtn con el wrapper
      dlBtn.parentNode.insertBefore(_wrap, dlBtn);
      dlBtn.style.display = 'none';
    }
  }

  // Fav button
  const favIds = LS.getJSON('favoritos', []);
  const isFav = favIds.includes(item._id);
  const btnFav = document.getElementById('ds-btn-fav');
  btnFav.className='action-pill'+(isFav?' fav-active':'');
  btnFav.innerHTML=`<ion-icon name="${isFav?'heart':'heart-outline'}"></ion-icon> ${isFav?'Guardado':'Favorito'}`;
  btnFav.onclick=()=>{ fav(item._id); };

  document.getElementById('ds-btn-share').onclick=()=>share(item._id);
  document.getElementById('ds-btn-report').onclick=()=>openReportModal(item._id);

  // Comments
  document.getElementById('ds-comments-list').innerHTML='<div class="no-comments">Cargando...</div>';
  loadComments(item._id);
  document.getElementById('ds-comment-post').onclick=()=>postComment(item._id);
  document.getElementById('ds-comment-input').onkeypress=e=>{
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();postComment(item._id);}
  };

  // Open sheet
  document.getElementById('detail-overlay').classList.add('show');
  document.getElementById('detail-sheet').classList.add('open');
  document.body.style.overflow='hidden';
  window.UGX?.alAbrirDetalle(item);   // botón "Apoyar" (usos extra de los UpCoins)
  window.UGR?.resenas(item);          // reseñas con estrellas + colecciones donde aparece
  window.dispatchEvent(new CustomEvent('ug:detalle', { detail: item._id }));   // guía de inicio

  // Registrar vista si es un video (usa ruta dedicada /items/vistas/:id con dedup IP)
  if(isVideoItem) {
    registrarVista(item);
    // Punto 12: inyectar botón teatro en .sheet-media
    const sheetMediaEl = document.querySelector('.sheet-media');
    if(sheetMediaEl && !document.getElementById('ds-btn-theater')) {
      const theatBtn = document.createElement('button');
      theatBtn.id = 'ds-btn-theater';
      theatBtn.setAttribute('aria-label', 'Modo teatro');
      theatBtn.title = 'Modo teatro';
      theatBtn.innerHTML = '<ion-icon name="tv-outline"></ion-icon>';
      theatBtn.onclick = (e) => { e.stopPropagation(); openTheater(item); };
      sheetMediaEl.appendChild(theatBtn);
    }
    // Punto 6: escuchar evento ended en el video inyectado o iframe
    setTimeout(() => { attachAutoplayListener(item); }, 800);
  }
}

// ── Renderiza la entrada destacada en el detail sheet ─────
function renderFeaturedEntry(container, item) {
  const cat   = item.category || 'General';
  const title = item.title    || 'Sin título';
  const img   = item.image    || '';
  const dl    = fmt(item.descargasEfectivas || 0);
  const ls    = item.linkStatus || 'online';
  const lsColor = ls === 'online' ? 'var(--g)' : ls === 'revision' ? '#ffcc00' : '#ff4343';
  const lsDot   = `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${lsColor};margin-right:4px;vertical-align:middle"></span>`;

  container.innerHTML = `
    <div class="ds-featured-entry">
      <div class="ds-featured-label">
        <ion-icon name="pin"></ion-icon>
        Entrada del autor
      </div>
      <div class="ds-featured-card">
        <img src="${img}" alt="${title}"
             onerror="this.onerror=null;this.src=window.UG_PH">
        <div class="ds-featured-info">
          <div class="ds-featured-cat">${catLabel(cat)}</div>
          <div class="ds-featured-title">${title}</div>
          <div class="ds-featured-meta">
            ${lsDot}
            <ion-icon name="cloud-download-outline"></ion-icon>${dl} descargas
          </div>
        </div>
        <div class="ds-featured-arrow">
          <ion-icon name="chevron-forward-outline"></ion-icon>
        </div>
      </div>
    </div>`;

  container.querySelector('.ds-featured-card').addEventListener('click', () => openDetail(item));
}

// "hoy", "hace 3 días", "hace 2 meses"… (fecha de actualización en la ficha)
function ugHace(f) {
  const d = Math.floor((Date.now() - new Date(f)) / 864e5);
  if (!(d >= 0)) return '—';
  if (d < 1) return 'Hoy'; if (d < 2) return 'Ayer'; if (d < 7) return `Hace ${d} días`;
  if (d < 30) { const s = Math.floor(d / 7); return `Hace ${s} sem.`; }
  if (d < 365) { const m = Math.floor(d / 30); return `Hace ${m} ${m === 1 ? 'mes' : 'meses'}`; }
  const a = Math.floor(d / 365); return `Hace ${a} ${a === 1 ? 'año' : 'años'}`;
}

function closeDetail() {
  window.dispatchEvent(new Event('ug:detalle-cerrado'));
  ugSeo(null);
  // Cancelar vista pendiente si el usuario cierra antes del minuto
  if(_vistaTimer) { clearTimeout(_vistaTimer); _vistaTimer = null; }
  document.getElementById('detail-overlay').classList.remove('show');
  document.getElementById('detail-sheet').classList.remove('open');
  if(!tutActive && !nxOpen) document.body.style.overflow='';
  currentItem=null;
  const vid=document.getElementById('ds-media-vid'); vid.src=''; vid.style.display='none';
  const ytIf=document.getElementById('ds-yt-iframe'); if(ytIf) ytIf.remove();
  const injVid=document.getElementById('ds-injected-vid');
  if(injVid){ if(injVid._fsCleanup) injVid._fsCleanup(); injVid.remove(); }
  const fsBtn=document.getElementById('ds-vid-fs-btn'); if(fsBtn) fsBtn.remove();
  const theatBtn2=document.getElementById('ds-btn-theater'); if(theatBtn2) theatBtn2.remove();
  const apPanel=document.getElementById('autoplay-panel'); if(apPanel) apPanel.remove();
  if(_autoplayTimer){ clearTimeout(_autoplayTimer); _autoplayTimer=null; }
  // Restaurar overlay
  const overlay = document.querySelector('.sheet-media .sheet-media-overlay');
  if(overlay) overlay.style.display = '';
  const gal=document.getElementById('ds-gallery');
  if(gal){ gal.innerHTML=''; gal.style.display='none'; }
}

document.getElementById('ds-close').addEventListener('click', closeDetail);
document.getElementById('detail-overlay').addEventListener('click', closeDetail);

// ── SWIPE DOWN para cerrar el detail sheet ────────────────
(function initSheetSwipe() {
  const sheet = document.getElementById('detail-sheet');
  const handle = sheet.querySelector('.sheet-handle');
  let startY = 0, startScroll = 0, dragging = false;
  const THRESHOLD = 90; // px hacia abajo para cerrar

  function onStart(e) {
    const scroll = sheet.querySelector('.sheet-scroll');
    // Solo iniciar swipe si el scroll interno está en top=0
    if(scroll && scroll.scrollTop > 4) return;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    startScroll = scroll ? scroll.scrollTop : 0;
    dragging = true;
    sheet.style.transition = 'none';
  }
  function onMove(e) {
    if(!dragging) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const dy = y - startY;
    if(dy > 0) {
      e.preventDefault();
      sheet.style.transform = `translateY(${dy}px)`;
    }
  }
  function onEnd(e) {
    if(!dragging) return;
    dragging = false;
    sheet.style.transition = '';
    const y = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    const dy = y - startY;
    if(dy > THRESHOLD) {
      sheet.style.transform = '';
      closeDetail();
    } else {
      sheet.style.transform = '';
    }
  }
  handle.addEventListener('touchstart', onStart, {passive:true});
  sheet.addEventListener('touchmove', onMove, {passive:false});
  sheet.addEventListener('touchend', onEnd, {passive:true});
})();

// ── COMMENTS ─────────────────────────────────────────────
async function loadComments(id) {
  const list = document.getElementById('ds-comments-list');
  try {
    const r = await fetch(`${API_URL}/comentarios/${id}`);
    const comms = await r.json();
    if(!comms.length) {
      list.innerHTML='<div class="no-comments">Sé el primero en comentar</div>';
      return;
    }
    list.innerHTML=comms.map(c=>`
      <div class="comment-item" data-u="${escH(c.usuario)}">
        <div class="comment-head">
          <div class="comment-avatar">${escH(avatarLetter(c.usuario))}</div>
          <div class="comment-user"><span class="cu-n">@${escH(c.usuario)}</span>${getBadge(c.usuario)}</div>
          <div class="comment-time">${timeAgo(c.fecha)}</div>
        </div>
        <div class="comment-text">${escH(c.texto)}</div>
      </div>`).join('');
    window.UGX?.estilizarComentarios?.(list);   // foto, marco, color e insignias de cada autor
  } catch(e) {
    list.innerHTML='<div class="no-comments" style="color:#ff4343">Error al cargar</div>';
  }
}

async function postComment(id) {
  const user = LS.get('user_admin');
  if(!user) { ugPedirSesion('comentar'); return; }
  const input = document.getElementById('ds-comment-input');
  const texto = input.value.trim();
  if(!texto) return;
  try {
    const r = await fetch(`${API_URL}/comentarios`,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${LS.get('token')}`},
      body:JSON.stringify({itemId:id,texto})
    });
    if(r.ok) {
      input.value='';
      loadComments(id);
      toast('✅ Comentario publicado');
    } else {
      const d = await r.json().catch(() => ({}));   // antes un error no mostraba nada
      toast('❌ ' + (d.error || (r.status === 401 ? 'Inicia sesión de nuevo para comentar' : 'No se pudo publicar el comentario')));
    }
  } catch(e) { toast('❌ Error al comentar'); }
}

