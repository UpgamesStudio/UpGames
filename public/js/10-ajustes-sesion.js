// ══════════════════════════════════════════════════
// PORTADA DEL PERFIL (imagen detrás del avatar)
// ══════════════════════════════════════════════════
const PF_BANNER_RE = /^https:\/\/[^\s"'<>`\\]+$/i;
function pfCssUrl(u) { return `url("${String(u).replace(/["\\\n]/g, '')}")`; }
function pfApplyBanner(url) {
  const cover = document.getElementById('pf-cover');
  const prev  = document.getElementById('pf-preview-banner');
  const rm    = document.getElementById('pf-bn-remove-btn');
  const inp   = document.getElementById('pf-input-banner-url');
  const ok = url && PF_BANNER_RE.test(url);
  const shown = ok ? cldOpt(url, CLD_BANNER) : '';
  if (cover) { cover.style.backgroundImage = ok ? pfCssUrl(shown) : ''; cover.classList.toggle('has-banner', !!ok); }
  if (prev)  { prev.style.backgroundImage  = ok ? pfCssUrl(shown) : ''; prev.classList.toggle('has-banner', !!ok); }
  if (rm) rm.style.display = ok ? '' : 'none';
  if (inp && ok) inp.value = url;
}
function pfPreviewBanner(url) {
  const prev = document.getElementById('pf-preview-banner');
  if (!prev) return;
  const ok = PF_BANNER_RE.test((url || '').trim());
  prev.style.backgroundImage = ok ? pfCssUrl(cldOpt(url.trim(), CLD_BANNER)) : '';
  prev.classList.toggle('has-banner', ok);
}
async function pfSaveBanner(url) {
  url = (url || '').trim();
  if (url && !PF_BANNER_RE.test(url)) { toast('⚠️ La URL debe empezar por https:// y no tener espacios'); return; }
  if (url && ugEsVideoArchivo(url)) { toast('⚠️ La portada debe ser una imagen, no un video'); return; }
  try {
    const res = await fetch(`${PF_API}/usuarios/update-banner`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LS.get('token')}` },
      body: JSON.stringify({ bannerUrl: url })
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.success) { toast('❌ ' + (d.error || 'No se pudo guardar la portada')); return; }
    pfApplyBanner(d.banner || '');
    if (!d.banner) { const inp = document.getElementById('pf-input-banner-url'); if (inp) inp.value = ''; }
    toast(d.banner ? '✅ Portada actualizada' : '🗑️ Portada eliminada');
    pfCloseSettings();
  } catch(e) { toast('❌ Error de conexión'); }
}
function pfRemoveBanner() {
  if (!confirm('¿Quitar tu imagen de portada?')) return;
  pfSaveBanner('');
}
async function pfUploadBanner() {
  const btn = document.getElementById('pf-bn-upload-btn');
  const orig = btn ? btn.innerHTML : '';
  try {
    const url = await pfImageUpload({ aspect: 3, transform: CLD_BANNER, folder: 'banners' });
    if (!url) return;                       // el usuario cerró el widget
    if (btn) { btn.innerHTML = '<ion-icon name="sync-outline" style="animation:spin .8s linear infinite"></ion-icon> Guardando...'; btn.disabled = true; }
    await pfSaveBanner(url);
  } catch(e) {
    toast('❌ ' + e.message);
  } finally {
    if (btn) { btn.innerHTML = orig; btn.disabled = false; }
  }
}

// ══════════════════════════════════════════════════
// SUBIR FOTO DE PERFIL / PORTADAS / MINIATURA
// Todo usa el widget universal (mismo que video)
// ══════════════════════════════════════════════════

// Avatar: cambia entre modo URL y modo Subir
function pfSwitchAvatarMode(mode) {
  const urlDiv = document.getElementById('pf-av-mode-url');
  const upDiv  = document.getElementById('pf-av-mode-upload');
  const tUrl   = document.getElementById('pf-av-tab-url');
  const tUp    = document.getElementById('pf-av-tab-upload');
  if(mode === 'url') {
    urlDiv.style.display = ''; upDiv.style.display = 'none';
    tUrl.classList.add('active'); tUp.classList.remove('active');
  } else {
    urlDiv.style.display = 'none'; upDiv.style.display = '';
    tUrl.classList.remove('active'); tUp.classList.add('active');
  }
}

// Avatar: subir foto vía widget y guardar
async function pfUploadAvatar() {
  const btn = document.getElementById('pf-av-upload-btn');
  const orig = btn ? btn.innerHTML : '';
  try {
    const url = await pfImageUpload({ aspect: 1, transform: CLD_AVATAR, folder: 'avatars' });
    if(!url) return;                        // el usuario cerró el widget
    const data = { success: true, url };
    // preview
    const prev = document.getElementById('pf-preview-avatar');
    if(prev) prev.innerHTML = `<img src="${ugEsc(data.url)}" alt="Avatar">`;
    if(btn) { btn.innerHTML = '<ion-icon name="sync-outline" style="animation:spin .8s linear infinite"></ion-icon> Guardando...'; btn.disabled = true; }
    // guardar en backend
    const token = LS.get('token');
    const res = await fetch(`${PF_API}/usuarios/update-avatar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ nuevaFoto: data.url })
    });
    if(res.ok) {
      toast('✅ Foto de perfil actualizada');
      const img = document.getElementById('pf-avatar-img');
      if(img){ img.src = data.url; img.style.display = 'block'; }
      const icon = document.getElementById('pf-avatar-icon');
      if(icon) icon.style.display = 'none';
      pfCloseSettings();
    } else toast('❌ Error al guardar avatar');
  } catch(e) {
    toast('❌ ' + e.message);
  } finally {
    if(btn) { btn.innerHTML = orig; btn.disabled = false; }
  }
}

// Portadas (slots 0-3): subir imagen o video
async function pfOpenCoverWidget(slot) {
  const ids = ['pf-addImage','pf-addImage2','pf-addImage3','pf-addImage4'];
  const btn = document.querySelector(`[onclick="pfOpenCoverWidget(${slot})"]`);
  const orig = btn ? btn.innerHTML : '';
  if(btn) { btn.innerHTML = '<ion-icon name="sync-outline" style="animation:spin .8s linear infinite"></ion-icon>'; btn.disabled = true; }
  try {
    const data = await pfWidgetUpload();
    if(data.success) {
      const inp = document.getElementById(ids[slot]);
      if(inp) { inp.value = data.url; inp.dispatchEvent(new Event('input')); }
      toast('✅ Media subida a la nube');
    }
  } catch(e) {
    toast('❌ ' + e.message);
  } finally {
    if(btn) { btn.innerHTML = orig; btn.disabled = false; }
  }
}

// Miniatura de video: subir imagen
async function pfOpenThumbnailWidget() {
  const btn = document.querySelector('[onclick="pfOpenThumbnailWidget()"]');
  const orig = btn ? btn.innerHTML : '';
  if(btn) { btn.innerHTML = '<ion-icon name="sync-outline" style="animation:spin .8s linear infinite"></ion-icon>'; btn.disabled = true; }
  try {
    const data = await pfWidgetUpload();
    if(data.success) {
      const inp = document.getElementById('pf-vid-thumbnail');
      if(inp) { inp.value = data.url; inp.dispatchEvent(new Event('input')); }
      toast('✅ Miniatura subida a la nube');
    }
  } catch(e) {
    toast('❌ ' + e.message);
  } finally {
    if(btn) { btn.innerHTML = orig; btn.disabled = false; }
  }
}

// ── EDITAR PUBLICACIÓN: subir imagen/video directo a la nube (no solo links) ──
async function pfOpenEditCoverWidget(slot) {
  const ids = ['pf-edit-image','pf-edit-image2','pf-edit-image3','pf-edit-image4'];
  const btn = document.querySelector(`[onclick="pfOpenEditCoverWidget(${slot})"]`);
  const orig = btn ? btn.innerHTML : '';
  if(btn) { btn.innerHTML = '<ion-icon name="sync-outline" style="animation:spin .8s linear infinite"></ion-icon>'; btn.disabled = true; }
  try {
    const data = await pfWidgetUpload();
    if(data.success) {
      const inp = document.getElementById(ids[slot]);
      if(inp) { inp.value = data.url; inp.dispatchEvent(new Event('input')); }
      toast('✅ Media subida a la nube');
    }
  } catch(e) {
    toast('❌ ' + e.message);
  } finally {
    if(btn) { btn.innerHTML = orig; btn.disabled = false; }
  }
}

// ── EDITAR VIDEO: subir miniatura directo a la nube ──
async function pfOpenEditVideoThumbWidget() {
  const btn = document.querySelector('[onclick="pfOpenEditVideoThumbWidget()"]');
  const orig = btn ? btn.innerHTML : '';
  if(btn) { btn.innerHTML = '<ion-icon name="sync-outline" style="animation:spin .8s linear infinite"></ion-icon>'; btn.disabled = true; }
  try {
    const data = await pfWidgetUpload();
    if(data.success) {
      const inp = document.getElementById('pf-edit-vid-thumb');
      if(inp) { inp.value = data.url; inp.dispatchEvent(new Event('input')); }
      toast('✅ Miniatura subida a la nube');
    }
  } catch(e) {
    toast('❌ ' + e.message);
  } finally {
    if(btn) { btn.innerHTML = orig; btn.disabled = false; }
  }
}
async function pfSaveBio() {
  const bio = document.getElementById('pf-input-bio').value.trim();
  if(!bio) { toast('⚠️ La bio no puede estar vacía'); return; }
  try {
    const _bioToken = LS.get('token');
    const res = await fetch(`${PF_API}/usuarios/update-bio`,{
      method:'PUT',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${_bioToken}`},
      body: JSON.stringify({ bio })
    });
    if(res.ok) {
      toast('✅ Bio actualizada');
      document.getElementById('pf-bio').textContent = bio;
      pfCloseSettings();
    } else toast('❌ Error al actualizar bio');
  } catch(e) { toast('❌ Error de conexión'); }
}

// ── Category info modal ──
function pfOpenCatInfo() {
  document.getElementById('pf-catModal').classList.add('show');
  document.body.style.overflow='hidden';
}
function pfCloseCatInfo() {
  document.getElementById('pf-catModal').classList.remove('show');
  document.body.style.overflow='';
}

// ── Tooltips ──
function pfToggleTooltip(id) {
  document.querySelectorAll('.pf-tooltip').forEach(t => { if(t.id!==id) t.classList.remove('active'); });
  document.getElementById(id)?.classList.toggle('active');
}
function pfCloseTooltip(id) {
  document.getElementById(id)?.classList.remove('active');
}

// ── Logout ──
async function pfLogout() {
  const ok = await customConfirm({
    icon: '👋',
    title: '¿Cerrar sesión?',
    msg: 'Tu sesión local se eliminará. Podrás volver a iniciar sesión en cualquier momento.',
    okText: 'Cerrar sesión',
    okDanger: true
  });
  if(!ok) return;
  ['user_admin','token','RefreshToken','user_avatar','user_verified','user_rol',
   'upgames_items_cache','upgames_users_cache'].forEach(k => LS.remove(k));
  // Limpiar los datos de la cuenta en este navegador (se conservan las preferencias del dispositivo)
  try { const keep = ['ug_vid', 'ug_tema', 'ug_mus_off', 'ug_mus_vol', 'ug_mus_ult', 'ug_ab_bienv', 'upgames_terms_v'], g = {};
    keep.forEach(k => { const v = localStorage.getItem(k); if (v !== null) g[k] = v; }); localStorage.clear(); Object.entries(g).forEach(([k, v]) => localStorage.setItem(k, v)); } catch(_) {}
  toast('👋 Sesión cerrada');
  // replace() elimina biblioteca.html del historial — el botón "atrás" no puede regresar
  setTimeout(()=>{ location.replace('../login.html'); }, 800);
}

// Close modals on overlay click
['pf-settingsModal','pf-editModal','pf-catModal'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', function(e) {
    if(e.target===this) {
      this.classList.remove('show');
      document.body.style.overflow='';
    }
  });
});
// Escape closes pf modals
document.addEventListener('keydown', e => {
  if(e.key==='Escape') {
    pfCloseSettings(); pfCloseEditModal(); pfCloseCatInfo();
    document.querySelectorAll('.pf-tooltip').forEach(t=>t.classList.remove('active'));
  }
});

