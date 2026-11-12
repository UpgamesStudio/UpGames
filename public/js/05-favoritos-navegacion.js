// ── FAVORITES ────────────────────────────────────────────
// Invitados: el favorito se guarda en este teléfono (favoritos + favoritos_inv) y, al
// crear la cuenta o iniciar sesión, se suben solos (ugSubirFavsInvitado). Al tercero se
// invita a crear la cuenta para no perderlos; antes no se interrumpe.
function ugPintarFav(id, on) {
  document.querySelectorAll(`[data-id="${id}"] .tile-fav-quick`).forEach(b => {
    b.className = 'tile-fav-quick' + (on ? ' active' : '');
    b.innerHTML = `<ion-icon name="${on ? 'heart' : 'heart-outline'}"></ion-icon>`;
  });
  const btnFav = document.getElementById('ds-btn-fav');
  if (btnFav && currentItem && currentItem._id === id) {
    btnFav.className = 'action-pill' + (on ? ' fav-active' : '');
    btnFav.innerHTML = `<ion-icon name="${on ? 'heart' : 'heart-outline'}"></ion-icon> ${on ? 'Guardado' : 'Favorito'}`;
  }
}
function ugFavInvitado(id) {
  let favs = LS.getJSON('favoritos_inv', []);
  const on = !favs.includes(id);
  favs = on ? [...favs, id].slice(-200) : favs.filter(f => f !== id);
  LS.setJSON('favoritos_inv', favs); LS.setJSON('favoritos', favs);
  ugPintarFav(id, on);
  if (!on) { toast('💔 Quitado de favoritos'); return; }
  window.dispatchEvent(new CustomEvent('ug:guia', { detail: 'favorito' }));
  if (favs.length >= 3 && !LS.get('ug_fav_aviso')) {
    LS.set('ug_fav_aviso', '1');
    setTimeout(() => ugPedirSesion(`no perder tus ${favs.length} favoritos`), 600);
  } else toast(favs.length === 1 ? '🔖 Guardado en Favoritos (en este teléfono)' : `🔖 Guardado · llevas ${favs.length} en Favoritos`);
}
async function ugSubirFavsInvitado() {
  const pend = LS.getJSON('favoritos_inv', []), token = LS.get('token');
  if (!pend.length || !token || !LS.get('user_admin')) return;
  const hechos = [];
  for (const itemId of pend) {
    try {
      const r = await fetch(`${API_URL}/favoritos/add`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ itemId }) });
      if (r.ok || r.status === 400 || r.status === 409) hechos.push(itemId);
    } catch (_) {}
  }
  const quedan = LS.getJSON('favoritos_inv', []).filter(f => !hechos.includes(f));
  if (quedan.length) LS.setJSON('favoritos_inv', quedan); else LS.remove('favoritos_inv');
  const local = LS.getJSON('favoritos', []); hechos.forEach(f => { if (!local.includes(f)) local.push(f); }); LS.setJSON('favoritos', local);
  if (hechos.length) toast(`🔖 ${hechos.length} favorito${hechos.length > 1 ? 's' : ''} guardado${hechos.length > 1 ? 's' : ''} en tu cuenta`);
}
setTimeout(ugSubirFavsInvitado, 2500);

async function fav(id) {
  const user = LS.get('user_admin');
  if(!user || !LS.get('token')) { ugFavInvitado(id); return; }
  try {
    const cr = await fetch(`${API_URL}/favoritos/${user}`);
    const favs = await cr.json();
    const isFav = Array.isArray(favs) && favs.some(f=>f._id===id);
    if(isFav) {
      await fetch(`${API_URL}/favoritos/remove`,{
        method:'DELETE',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${LS.get('token')}`},
        body:JSON.stringify({itemId:id})
      });
      toast('💔 Eliminado de favoritos');
      let local=LS.getJSON('favoritos', []);
      local=local.filter(f=>f!==id);
      LS.setJSON('favoritos', local);
    } else {
      await fetch(`${API_URL}/favoritos/add`,{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${LS.get('token')}`},
        body:JSON.stringify({itemId:id})
      });
      toast('🔖 Guardado en Favoritos');
      window.dispatchEvent(new CustomEvent('ug:guia', { detail: 'favorito' }));
      let local=LS.getJSON('favoritos', []);
      if(!local.includes(id)){local.push(id); LS.setJSON('favoritos', local);}
      // La notificación al autor ahora la crea el backend en /favoritos/add
    }
    // Update all heart buttons for this id
    document.querySelectorAll(`[data-id="${id}"] .tile-fav-quick`).forEach(b=>{
      const newFav=!isFav;
      b.className='tile-fav-quick'+(newFav?' active':'');
      b.innerHTML=`<ion-icon name="${newFav?'heart':'heart-outline'}"></ion-icon>`;
    });
    // Actualizar likesCount en el item local y reflejar en todas las tiles
    const newFavGlobal = !isFav;
    const localItem = todosLosItems.find(i => i._id === id);
    if(localItem) {
      localItem.likesCount = Math.max(0, (localItem.likesCount||0) + (newFavGlobal ? 1 : -1));
      // Reflejar el contador en tiles normales y featured
      document.querySelectorAll(`[data-id="${id}"] .tile-downloads, [data-id="${id}"] .ft-dl`).forEach(el => {
        el.innerHTML = `<ion-icon name="heart"></ion-icon>${fmt(localItem.likesCount)}`;
        el.style.display = localItem.likesCount > 0 ? '' : 'none';
      });
      // Reflejar en tile-yt-likes (video tiles)
      document.querySelectorAll(`[data-id="${id}"] .tile-yt-likes`).forEach(el => {
        el.innerHTML = `<ion-icon name="heart"></ion-icon>${fmt(localItem.likesCount)}`;
      });
    }
    // Actualizar tambien el boton del detail sheet si el item abierto es este
    const btnFav = document.getElementById('ds-btn-fav');
    if(btnFav && currentItem && currentItem._id === id) {
      btnFav.className = 'action-pill' + (newFavGlobal ? ' fav-active' : '');
      btnFav.innerHTML = `<ion-icon name="${newFavGlobal?'heart':'heart-outline'}"></ion-icon> ${newFavGlobal?'Guardado':'Favorito'}`;
    }
  } catch(e) { toast('❌ Error al guardar'); }
}

// ── SHARE ─────────────────────────────────────────────────
// Tarjeta para compartir: portada + título + descargas + marca, compuesta por Cloudinary
// (la misma que usan las páginas /p/ para WhatsApp y Facebook: modulos/seo.js → tarjeta)
function ugTarjeta(it) {
  const m = String(it?.image || '').match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)((?:[^/]+\/)*?)(v\d+\/.+)$/);
  if (!m || ugEsVideoArchivo(it.image)) return null;
  const enc = t => encodeURIComponent(String(t).replace(/[\u{10000}-\u{10FFFF}]/gu, '').replace(/\s+/g, ' ').trim())
    .replace(/%2C/g, '%252C').replace(/%2F/g, '%252F').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29');
  const corta = (t, n) => { t = String(t || '').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };
  const esV = it.category === 'Video', n = esV ? vistasVideo(it) : (it.descargasEfectivas || 0);
  const l2 = [n > 0 ? `${n.toLocaleString('es-CO')} ${esV ? 'vistas' : 'descargas'}` : catLabel(it.category), it.usuario ? '@' + it.usuario : ''].filter(Boolean).join(' · ');
  return m[1] + m[2] + ['c_fill,g_auto,w_1200,h_630', 'e_gradient_fade:40,y_-0.6,b_rgb:07080c',
    `l_text:Arial_60_bold:${enc(corta(it.title, 64))},co_white,c_fit,w_1080`, 'fl_layer_apply,g_south_west,x_60,y_120',
    `l_text:Arial_32_bold:${enc(l2)},co_rgb:32D583`, 'fl_layer_apply,g_south_west,x_60,y_62',
    'l_text:Arial_30_bold:UPGAMES,co_rgb:32D583,b_rgb:07080c,bo_14px_solid_rgb:07080c', 'fl_layer_apply,g_north_east,x_40,y_36',
    'q_auto:good,f_jpg'].join('/') + '/' + m[3];
}
// Enlace para compartir: la página estática (/p/…) si ya existe, que trae la vista previa lista
function ugUrlCompartir(it) {
  if (!it) return '';
  const slug = String(it.title || 'publicacion').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '') || 'publicacion';
  const estatica = (!it.status || it.status === 'aprobado') && it.createdAt && Date.now() - new Date(it.createdAt) > UG_PAGINA_LISTA_MS;
  return estatica ? `https://upgames.games/public/p/${slug}-${it._id}.html` : `https://upgames.games/public/biblioteca.html?id=${it._id}`;
}
async function share(id) {
  const it = (currentItem && currentItem._id === id) ? currentItem : todosLosItems.find(i => i._id === id);
  const url = it ? ugUrlCompartir(it) : `${location.origin}${location.pathname}?id=${id}`;
  const titulo = it ? `${it.title} en UpGames` : 'Mira este contenido en UpGames';
  if(navigator.share) {
    // En el celular se comparte la tarjeta como imagen + el enlace (WhatsApp, TikTok, historias…)
    let files;
    const img = ugTarjeta(it);
    if (img && navigator.canShare) {
      try {
        const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 4000);
        const blob = await (await fetch(img, { signal: ctl.signal })).blob(); clearTimeout(to);
        const f = new File([blob], 'upgames.jpg', { type: 'image/jpeg' });
        if (navigator.canShare({ files: [f] })) files = [f];
      } catch (_) {}
    }
    try {
      await navigator.share(files ? { files, title: titulo, text: `${titulo}\n${url}` } : { url, title: titulo, text: titulo });
      toast('✅ Compartido');
    } catch(e) { if (e?.name !== 'AbortError') copyToClipboard(url); }
  } else {
    copyToClipboard(url);
  }
}
function copyToClipboard(t) {
  if(navigator.clipboard) {
    navigator.clipboard.writeText(t).then(()=>toast('📋 Enlace copiado')).catch(()=>fallbackCopy(t));
  } else { fallbackCopy(t); }
}
function fallbackCopy(t) {
  const inp=document.createElement('input');
  inp.value=t; document.body.appendChild(inp);
  inp.select(); inp.setSelectionRange(0,99999);
  try{document.execCommand('copy');toast('📋 Enlace copiado');}catch(_){toast('❌ No se pudo copiar');}
  inp.remove();
}

// ── REPORT ────────────────────────────────────────────────
function openReportModal(id) {
  if (!ugPedirSesion('reportar contenido')) return;
  reportItemId=id;
  document.getElementById('report-modal').classList.add('show');
}
function closeReportModal() {
  document.getElementById('report-modal').classList.remove('show');
  reportItemId=null;
}
document.querySelectorAll('.report-opt').forEach(btn=>{
  btn.addEventListener('click',function() {
    const motivo=this.dataset.motivo;
    sendReport(reportItemId,motivo);
    closeReportModal();
  });
});

async function sendReport(id, motivo) {
  try {
    const user=LS.get('user_admin','Anónimo');
    const r=await fetch(`${API_URL}/items/report/${id}`,{
      method:'PUT',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${LS.get('token')}`},
      body:JSON.stringify({motivo,usuario:user})
    });
    const data=await r.json();
    if(r.ok) {
      const labels={caido:'Link caído',viejo:'Obsoleto',malware:'Malware'};
      toast(`✅ Reporte enviado: ${labels[motivo]||motivo}`);
      if(data.linkStatus==='revision') {
        document.querySelectorAll(`[data-id="${id}"] .tile-status`).forEach(s=>{
          s.className='tile-status revision';
          s.innerHTML='<span class="tile-status-dot"></span>Revisión';
        });
      }
    } else if(r.status===429) {
      toast('⏱️ Ya reportaste este contenido recientemente');
    } else { toast('❌ Error al reportar'); }
  } catch(e) { toast('❌ Error de conexión'); }
}

// ── PROFILE NAVIGATION ───────────────────────────────────
function visitarPerfil(usuario) {
  window.location.href=`./perfil-publico.html?usuario=${encodeURIComponent(usuario)}`;
}

// ── HANDLE MAIL (abuse) ─────────────────────────────────
function handleMail(e) {
  if(e) e.preventDefault();
  const email='upgames.games.up@gmail.com';
  const sub=encodeURIComponent('Soporte - UP GAMES');
  const body=encodeURIComponent('Hola, necesito ayuda con...\n\n[Describe tu problema aquí]');
  window.location.href=`mailto:${email}?subject=${sub}&body=${body}`;
}

// ── BOTTOM NAV TABS ───────────────────────────────────────
document.querySelectorAll('.nav-tab[data-tab]').forEach(tab=>{
  tab.addEventListener('click',function(){
    const t=this.dataset.tab;
    switchTab(t);
  });
});

function switchTab(t) {
  if (t === 'upload' && !ugPedirSesion('publicar contenido')) return;
  const abrirPublicar = t === 'upload';
  if(t==='upload') t='profile';
  if(abrirPublicar) setTimeout(() => pfOpenPublish && pfOpenPublish(true), 150);
  currentTab=t;
  window.dispatchEvent(new CustomEvent('ug:tab', { detail: t }));   // pistas de la guía (upgames-guia.js)
  document.querySelectorAll('.nav-tab').forEach(x=>x.classList.remove('active'));
  const navBtn = document.querySelector(`.nav-tab[data-tab="${t}"]`);
  if(navBtn) navBtn.classList.add('active');
  document.getElementById('main-view').style.display=t==='main'?'':'none';
  document.getElementById('category-row').style.display=t==='main'?'':'none';
  // Carousel: reanudar en main, pausar en otros tabs
  if(t==='main') heroStartAutoplay && heroStartAutoplay();
  else heroStop && heroStop();
  const favsView     = document.getElementById('favs-view');
  const economiaView = document.getElementById('economia-view');
  const profileView  = document.getElementById('profile-view');
  favsView.classList.toggle('active',     t==='favs');
  economiaView.classList.toggle('active', t==='economia');
  profileView.classList.toggle('active',  t==='profile');
  if(t==='favs')     renderFavs();
  if(t==='economia') { renderEconomia(); pfStartEcoPolling(); ecoCargarPlan(); window.UGX?.hub(); }
  else               { pfStopEcoPolling(); }
  if(t==='profile')  renderProfile();
}

// ── FAVORITES VIEW ────────────────────────────────────────
async function renderFavs() {
  const user = LS.get('user_admin');
  const cont = document.getElementById('favs-grid');
  if(!cont) return;
  if(!user && LS.getJSON('favoritos_inv', []).length) {
    const ids = LS.getJSON('favoritos_inv', []);
    const items = ids.map(id => todosLosItems.find(i => i._id === id)).filter(Boolean).reverse();
    cont.innerHTML = `<div class="ugx-fav-cta"><b>❤️ ${ids.length} favorito${ids.length > 1 ? 's' : ''} guardado${ids.length > 1 ? 's' : ''} en este teléfono</b><span>Crea tu cuenta gratis y tenlos en todos tus dispositivos.</span><a href="${ugUrlLogin(true)}" class="btn-login-action">Crear cuenta gratis</a></div>`;
    items.forEach(it => cont.appendChild(createTile(it, false)));
    window.UGX?.estilizarTiles?.(cont);
    return;
  }
  if(!user) {
    cont.innerHTML=`<div class="empty-state">
      <ion-icon name="person-circle-outline"></ion-icon>
      <h3>Inicia sesión</h3>
      <p>Guarda tus juegos favoritos y recíbelos en todos tus dispositivos.</p><a href="${ugUrlLogin(true)}" class="btn-login-action" style="margin-top:14px;display:inline-flex">Crear cuenta gratis</a><p style="margin-top:10px;font-size:.82rem"><a href="${ugUrlLogin(false)}" style="color:#32D583">Ya tengo cuenta</a></p>
    </div>`;
    return;
  }
  cont.innerHTML='<div class="pf-empty"><ion-icon name="sync-outline"></ion-icon><p>Cargando...</p></div>';
  try {
    const res = await fetch(`${API_URL}/favoritos/${user}`);
    const data = await res.json();
    const favs = Array.isArray(data) ? data : [];
    if(!favs.length) {
      cont.innerHTML=`<div class="empty-state">
        <ion-icon name="heart-outline"></ion-icon>
        <h3>Sin favoritos aún</h3>
        <p>Guarda contenido que te guste pulsando ❤️</p>
      </div>`;
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
  } catch(e) {
    cont.innerHTML='<div class="pf-empty" style="color:#ff4343"><p>Error al cargar favoritos</p></div>';
  }
}

// ── ECONOMIA VIEW ──────────────────────────────────────────
async function renderEconomia() {
  const user = LS.get('user_admin');
  if(!user) {
    const cont = document.getElementById('economia-view');
    if(cont) cont.innerHTML=`
      <div class="favs-header"><ion-icon name="cash-outline"></ion-icon> Mi Economía</div>
      <div class="empty-state" style="padding:40px 20px">
        <ion-icon name="person-circle-outline"></ion-icon>
        <h3>Inicia sesión</h3>
        <p>Con una cuenta ganas dinero con la publicidad que ven quienes abren lo que publicas (US$1,50 por cada 1.000 visualizaciones), recibes regalos en tus lives y ganas UpCoins (la moneda de UpGames) que puedes gastar o retirar, y puedes hacerte Premium: sin anuncios y NEXUS ilimitado.</p><a href="${ugUrlLogin(true)}" class="btn-login-action" style="margin-top:14px;display:inline-flex">Crear cuenta gratis</a><p style="margin-top:10px;font-size:.82rem"><a href="${ugUrlLogin(false)}" style="color:#32D583">Ya tengo cuenta</a></p>
      </div>`;
    return;
  }
  // Setear pfUser si aún no está seteado
  if(!pfUser) pfUser = user;
  // Registrar listeners de botones (por si es la primera vez que se abre esta vista)
  const btnPago   = document.getElementById('pf-btn-solicitar-pago');
  if(btnPago && !btnPago._listenerAdded) {
    btnPago.addEventListener('click', pfSolicitarPago);
    btnPago._listenerAdded = true;
  }
  pfStartEcoPolling();
}

// ── PROFILE TAB ──────────────────────────────────────────
function renderProfile() {
  const user = LS.get('user_admin');
  if(!user) {
    document.getElementById('pf-not-logged').style.display='';
    document.getElementById('pf-logged').style.display='none';
    return;
  }
  document.getElementById('pf-not-logged').style.display='none';
  document.getElementById('pf-logged').style.display='';
  pfInit(user);
}

