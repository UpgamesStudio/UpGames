// ══════════════════════════════════════════════════
// HERO CAROUSEL — muestra los 10 primeros items
// ══════════════════════════════════════════════════
let heroItems = [];
let heroIdx = 0;
let heroTimer = null;
let heroTouchStartX = 0;
let heroAutoplayPaused = false;

function initHeroCarousel(items, isVideoMode) {
  // En modo video: top 10 más vistos. En modo normal: primeros 6
  heroItems = items.slice(0, isVideoMode ? 10 : 6);
  if(heroItems.length < 2) {
    // Ocultar carousel cuando no hay suficientes items
    const carousel = document.getElementById('hero-carousel');
    if(carousel) carousel.style.display = 'none';
    return;
  }
  
  const carousel = document.getElementById('hero-carousel');
  const track    = document.getElementById('hero-track');
  const dotsEl   = document.getElementById('hero-dots');
  
  carousel.style.display = 'block';
  // Marcar visualmente el carousel según el modo
  carousel.classList.toggle('hero-video-mode', !!isVideoMode);
  track.innerHTML = '';
  dotsEl.innerHTML = '';

  heroItems.forEach((item, i) => {
    const slide = document.createElement('div');
    slide.className = 'hero-slide' + (isVideoMode ? ' hero-slide--video' : '');
    slide.dataset.id = item._id;

    const isYT  = isYouTubeUrl(item.image);
    const isMp4 = ugEsVideoArchivo(item.image);
    let mediaSrc = item.image;
    if(isYT) mediaSrc = getYouTubeThumbnail(item.image);

    const lk = item.likesCount || 0;
    const vistas = vistasVideo(item);

    // Badge: video mode usa icono play + cyan, normal usa estrella
    const badgeHTML = isVideoMode
      ? `<div class="hero-badge hero-badge--video"><ion-icon name="play-circle"></ion-icon> TOP ${i+1}</div>`
      : `<div class="hero-badge">⭐ Top ${i+1}</div>`;

    // Tipo de video (Tutorial, Gameplay, etc.)
    const vidTypeHTML = isVideoMode && item.videoType
      ? `<div class="hero-vid-type">${escH(item.videoType)}</div>`
      : '';

    slide.innerHTML = `
      <img src="${escH(cldOpt(mediaSrc, CLD_DESTACADA))}"${cldSrcset(mediaSrc, UG_SS_GRANDE, '(min-width: 1100px) 1100px, 100vw')} alt="${escH(item.title)}" loading="${i===0?'eager':'lazy'}"${i===0?' fetchpriority="high"':''} decoding="async"
           onerror="this.onerror=null;this.src=window.UG_PH">
      ${isYT || isMp4 || isVideoMode ? '<div class="yt-play-badge large"><ion-icon name="play-circle"></ion-icon></div>' : ''}
      <div class="hero-info">
        ${badgeHTML}
        ${vidTypeHTML}
        <div class="hero-title">${escH(item.title)}</div>
        <div class="hero-meta">
          <span class="hero-user">@${escH(item.usuario||'Cloud')}${getBadge(item.usuario)}</span>
          ${isVideoMode && vistas ? `<span class="hero-dl"><ion-icon name="eye-outline"></ion-icon>${fmt(vistas)}</span>` : ''}
          ${lk ? `<span class="hero-dl"><ion-icon name="heart"></ion-icon>${fmt(lk)}</span>` : ''}
        </div>
      </div>`;

    // Click: video mode abre player inline en el output grid, normal abre detail
    slide.addEventListener('click', () => {
      if(isVideoMode) {
        const tileEl = document.querySelector(`.game-tile--video[data-id="${item._id}"]`);
        if(tileEl) {
          tileEl.scrollIntoView({ behavior:'smooth', block:'center' });
          setTimeout(() => expandVideoCard(tileEl, item), 400);
        } else {
          openDetail(item);
        }
      } else {
        openDetail(item);
      }
    });
    track.appendChild(slide);

    // Dot
    const dot = document.createElement('span');
    dot.className = 'hero-dot' + (i===0?' active':'');
    dot.addEventListener('click', (e) => { e.stopPropagation(); heroGoTo(i); });
    dotsEl.appendChild(dot);
  });

  heroGoTo(0);
  heroStartAutoplay();

  // Flechas
  document.getElementById('hero-prev').onclick = (e) => { e.stopPropagation(); heroPrev(); };
  document.getElementById('hero-next').onclick = (e) => { e.stopPropagation(); heroNext(); };

  // Swipe táctil
  carousel.addEventListener('touchstart', e => {
    heroTouchStartX = e.touches[0].clientX;
    heroAutoplayPaused = true;
  }, {passive:true});
  carousel.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - heroTouchStartX;
    if(Math.abs(dx) > 40) { dx < 0 ? heroNext() : heroPrev(); }
    setTimeout(() => { heroAutoplayPaused = false; }, 3000);
  }, {passive:true});
  
  // Pausar al tocar
  carousel.addEventListener('touchstart', () => { heroAutoplayPaused = true; }, {passive:true});
}

function heroGoTo(idx) {
  heroIdx = ((idx % heroItems.length) + heroItems.length) % heroItems.length;
  document.getElementById('hero-track').style.transform = `translateX(-${heroIdx * 100}%)`;
  document.querySelectorAll('.hero-dot').forEach((d,i) => d.classList.toggle('active', i===heroIdx));
}
function heroNext() { heroGoTo(heroIdx + 1); }
function heroPrev() { heroGoTo(heroIdx - 1); }

function heroStartAutoplay() {
  if(heroTimer) clearInterval(heroTimer);
  heroTimer = setInterval(() => {
    // No animar si la página no es visible
    if(!heroAutoplayPaused && !document.hidden) heroNext();
  }, 5000);
}

function heroStop() {
  if(heroTimer) { clearInterval(heroTimer); heroTimer = null; }
}

// ── LAZY VIDEO LOADER ─────────────────────────────────────
// Solo carga y reproduce videos cuando entran al viewport
let _vidObserver = null;
function initLazyVideos() {
  if(!('IntersectionObserver' in window)) {
    document.querySelectorAll('video.lazy-vid[data-src]').forEach(v=>{
      if(v.dataset.loaded) return;
      v.dataset.loaded='1'; v.src=v.dataset.src; v.play().catch(()=>{});
    });
    return;
  }
  if(!_vidObserver) {
    _vidObserver = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        const v = e.target;
        if(e.isIntersecting) {
          if(!v.dataset.loaded && v.dataset.src) {
            v.dataset.loaded='1'; v.src=v.dataset.src; v.play().catch(()=>{});
          } else if(v.dataset.loaded) { v.play().catch(()=>{}); }
        } else { if(v.dataset.loaded) v.pause(); }
      });
    },{rootMargin:'150px'});
  }
  document.querySelectorAll('video.lazy-vid[data-src]').forEach(v=>{
    if(!v.dataset.observed){ v.dataset.observed='1'; _vidObserver.observe(v); }
  });
}

// ── RENDER — todo de una vez, sin scroll infinito ────────
function render(list, reset=true) {
  const out = document.getElementById('output');
  const skel = document.getElementById('skeleton');
  if(skel) skel.remove();
  if(currentObserver){ currentObserver.disconnect(); currentObserver=null; }
  if(!reset) return;
  if(typeof _vidObserver!=='undefined'&&_vidObserver){ _vidObserver.disconnect(); _vidObserver=null; }
  out.innerHTML='';
  if(list.length>0 && typeof initHeroCarousel==='function') {
    const isVideoMode = activeCategory === 'Video';
    const carouselSource = isVideoMode
      ? [...list].filter(i=>i.category==='Video').sort((a,b)=>(b.likesCount||0)-(a.likesCount||0))
      : [...list].filter(i=>i.category!=='Video').sort((a,b)=>(b.likesCount||0)-(a.likesCount||0));
    if(carouselSource.length) initHeroCarousel(carouselSource, isVideoMode);
  }
  if(!list.length) {
    out.innerHTML=`<div class="empty-state">
      <ion-icon name="cloud-offline-outline"></ion-icon>
      <h3>Sin resultados</h3>
      <p>No hay coincidencias en la nube.</p>
      <button type="button" class="empty-action empty-action--nexus" id="empty-ask-nexus"><span>✦</span> Pregúntale a Nexus</button>
      <button type="button" class="empty-action" onclick="switchTab('profile');setTimeout(()=>window.pfOpenPublish&&pfOpenPublish(),300)">Subir ahora</button>
    </div>`;
    const qBusq = document.getElementById('buscador')?.value?.trim();
    document.getElementById('empty-ask-nexus')?.addEventListener('click', () =>
      nexusPreguntar(qBusq ? `Busco "${qBusq}" en UpGames y no aparece. ¿Hay algo parecido o qué me recomiendas?` : '¿Qué me recomiendas descargar hoy en UpGames?'));
    return;
  }
  const frag = document.createDocumentFragment();
  const enPortada = !activeCategory && !document.getElementById('buscador')?.value?.trim();
  const conFilas = enPortada && window.UGUX?.filas ? window.UGUX.filas(frag, list) : 0;
  list.forEach((item, idx) => {
    if(idx === 0 && conFilas) {
      const sh = document.createElement('div');
      sh.className = 'section-header';
      sh.innerHTML = window.UGUX?.personalizado?.()
        ? `<span class="section-title">✦ Para ti</span><span class="section-count">Nexus lo ordena según tus gustos</span>`
        : `<span class="section-title">Todo el catálogo</span><span class="section-count">${list.length} publicaciones</span>`;
      frag.appendChild(sh);
    }
    if(idx > 0 && idx % 12 === 0) {
      const sh = document.createElement('div');
      sh.className = 'section-header';
      sh.innerHTML = `<span class="section-title">Más Contenido</span><span class="section-count">${list.length} publicaciones</span>`;
      frag.appendChild(sh);
    }
    frag.appendChild(createTile(item, false));
  });
  out.appendChild(frag);
  initLazyVideos();
  window.UGX?.estilizarTiles?.(out);
}


