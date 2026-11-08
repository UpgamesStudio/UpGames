// ══════════════════════════════════════════════════════
// FORMULARIO DINÁMICO POR CATEGORÍA
// ══════════════════════════════════════════════════════

const CLOUDINARY_CLOUD_NAME = 'dd4w2plxn';
const CLOUDINARY_UPLOAD_PRESET = 'upgames_videos';

// Config por categoría: icono, label, campos extra
const CAT_CONFIG = {
  Juego: {
    icon: 'game-controller', label: 'SUBIR JUEGO',
    extras: [
      { id:'pf-ex-plataforma', label:'Plataforma', type:'select',
        options:['PC','Android','iOS','PlayStation','Xbox','Nintendo Switch','Multi-plataforma'] },
      { id:'pf-ex-size', label:'Tamaño del archivo', type:'text', placeholder:'Ej: 25 GB' },
      { id:'pf-ex-requisitos', label:'Requisitos mínimos (opcional)', type:'textarea', placeholder:'CPU, RAM, GPU...' },
    ]
  },
  Mod: {
    icon: 'construct', label: 'SUBIR MOD',
    extras: [
      { id:'pf-ex-juego-base', label:'Juego base', type:'text', placeholder:'Ej: GTA V, Minecraft...' },
      { id:'pf-ex-version', label:'Versión compatible', type:'text', placeholder:'Ej: v1.0.3' },
    ]
  },
  Apps: {
    icon: 'phone-portrait', label: 'SUBIR APP',
    extras: [
      { id:'pf-ex-so', label:'Sistema Operativo', type:'select',
        options:['Android','iOS','Windows','macOS','Linux','Multi-plataforma'] },
      { id:'pf-ex-version', label:'Versión de la app', type:'text', placeholder:'Ej: 2.4.1' },
      { id:'pf-ex-size', label:'Tamaño', type:'text', placeholder:'Ej: 120 MB' },
    ]
  },
  Software: {
    icon: 'code-slash', label: 'SUBIR SOFTWARE',
    extras: [
      { id:'pf-ex-licencia', label:'Licencia', type:'select',
        options:['Open Source','Freeware','Shareware','MIT','GPL','Apache 2.0','Otro'] },
      { id:'pf-ex-so', label:'Sistema Operativo', type:'select',
        options:['Windows','macOS','Linux','Multi-plataforma'] },
      { id:'pf-ex-version', label:'Versión', type:'text', placeholder:'Ej: 3.2.0' },
    ]
  },
  Ajustes: {
    icon: 'settings', label: 'SUBIR HERRAMIENTA',
    extras: [
      { id:'pf-ex-tipo-herramienta', label:'Tipo de herramienta', type:'select',
        options:['Config / CFG','Script','Plugin','Extension','Pack de texturas','Otro'] },
      { id:'pf-ex-compatible', label:'Compatible con', type:'text', placeholder:'Ej: Windows 10/11, GTA V...' },
    ]
  },
  Optimizacion: {
    icon: 'speedometer', label: 'SUBIR OPTIMIZACIÓN',
    extras: [
      { id:'pf-ex-tipo-opt', label:'Tipo de mejora', type:'select',
        options:['Mejora de FPS','Reducción de lag','Visual/Gráficos','Audio','Red / Latencia','Otro'] },
      { id:'pf-ex-compatible', label:'Compatible con', type:'text', placeholder:'Ej: Windows 10/11...' },
    ]
  }
};

let pfCurrentCategory = 'Juego';
let pfCloudinaryWidget = null;
let pfVideoUrl = '';
let pfVideoSelectedType = 'Tutorial';

function pfOnCategoryChange(cat, btnEl) {
  pfCurrentCategory = cat;
  // Update hidden input
  const catInput = document.getElementById('pf-addCategory');
  if(catInput) catInput.value = cat;

  // Update category button styles
  document.querySelectorAll('#pf-cat-grid .pf-cat-btn').forEach(b => b.classList.remove('active'));
  if(btnEl) btnEl.classList.add('active');

  const formStd = document.getElementById('pf-form-standard');
  const formVid = document.getElementById('pf-form-video');

  if(cat === 'Video') {
    if(formStd) formStd.style.display = 'none';
    if(formVid) formVid.style.display = 'block';
    pfLoadFeaturedSelector();
    return;
  }

  if(formStd) formStd.style.display = 'block';
  if(formVid) formVid.style.display = 'none';

  const cfg = CAT_CONFIG[cat] || CAT_CONFIG['Juego'];

  // Update header icon + label
  const icon  = document.getElementById('pf-form-icon');
  const label = document.getElementById('pf-form-cat-label');
  if(icon)  icon.setAttribute('name', cfg.icon);
  if(label) label.textContent = cfg.label;

  // Render extra fields
  pfRenderExtras(document.getElementById('pf-extra-fields'), cat, 'pf-ex-');
}

// Campos extra de una categoría (plataforma, tamaño, consola…). Los usa Publicar
// (prefijo pf-ex-) y Editar (prefijo pf-edit-ex-, con los valores que ya tenía).
const pfExKey = id => id.replace(/^pf-ex-/, '');
function pfRenderExtras(zone, cat, prefijo, valores) {
  if(!zone) return;
  const cfg = CAT_CONFIG[cat] || CAT_CONFIG['Juego'];
  valores = valores || {};
  zone.innerHTML = '';
  (cfg.extras || []).forEach(field => {
    const key = pfExKey(field.id), id = prefijo + key, val = valores[key] != null ? String(valores[key]) : '';
    const group = document.createElement('div');
    group.className = 'pf-form-group';
    let inputHTML = '';
    if(field.type === 'select') {
      const opts = val && !field.options.includes(val) ? [...field.options, val] : field.options;
      inputHTML = `<select id="${id}" class="pf-select" data-key="${key}">
        <option value="">— Sin especificar —</option>
        ${opts.map(o=>`<option value="${ugEsc(o)}"${o === val ? ' selected' : ''}>${ugEsc(o)}</option>`).join('')}
      </select>`;
    } else if(field.type === 'textarea') {
      inputHTML = `<textarea id="${id}" class="pf-textarea" data-key="${key}" maxlength="600" placeholder="${ugEsc(field.placeholder||'')}">${ugEsc(val)}</textarea>`;
    } else {
      inputHTML = `<input type="text" id="${id}" class="pf-input" data-key="${key}" maxlength="120" placeholder="${ugEsc(field.placeholder||'')}" value="${ugEsc(val)}">`;
    }
    group.innerHTML = `<label class="pf-label" for="${id}">${field.label}</label>${inputHTML}`;
    zone.appendChild(group);
  });
}
function pfLeerExtras(zone) {
  const out = {};
  zone?.querySelectorAll('[data-key]').forEach(x => { const v = (x.value || '').trim(); if (v) out[x.dataset.key] = v; });
  return out;
}

// ── Video type selector ──
function pfSelectVidType(type, btnEl) {
  pfVideoSelectedType = type;
  document.querySelectorAll('.pf-vid-type-btn').forEach(b => b.classList.remove('active'));
  if(btnEl) btnEl.classList.add('active');
  document.getElementById('pf-vid-type').value = type;
  pfUpdateVideoPreview();
}

// ══════════════════════════════════════════════════════
// FEATURED ENTRY SELECTOR — Video Form
// ══════════════════════════════════════════════════════
let pfFeaturedItems = [];   // cache of non-video items for the selector

async function pfLoadFeaturedSelector() {
  if(!pfUser) return;

  // If an item is already selected, don't re-render the list
  const alreadySelected = document.getElementById('pf-vid-featured-id')?.value;
  if(alreadySelected) return;

  const list    = document.getElementById('pf-featured-list');
  const loading = document.getElementById('pf-featured-loading');
  if(!list) return;

  if(loading) { loading.style.display = 'flex'; list.innerHTML = ''; list.appendChild(loading); }

  try {
    const token = LS.get('token');
    const res = await fetch(`${PF_API}/items/user/${pfUser}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    const data = await res.json();
    const items = Array.isArray(data) ? data : [];
    // Only approved, non-video items
    pfFeaturedItems = items.filter(i => i.category !== 'Video' && i.status !== 'pendiente' && i.status !== 'pending');
    pfRenderFeaturedList(pfFeaturedItems);
  } catch(e) {
    if(list) list.innerHTML = '<div style="padding:14px;color:var(--txt3);font-size:.75rem;text-align:center">Error al cargar publicaciones</div>';
  }
}

function pfRenderFeaturedList(items) {
  const list = document.getElementById('pf-featured-list');
  if(!list) return;

  if(!items.length) {
    list.innerHTML = `<div style="padding:16px;color:var(--txt3);font-size:.75rem;text-align:center;display:flex;flex-direction:column;gap:6px;align-items:center">
      <ion-icon name="cloud-offline-outline" style="font-size:1.4rem"></ion-icon>
      <span>No tienes publicaciones aprobadas disponibles</span>
    </div>`;
    return;
  }

  list.innerHTML = items.map(item => {
    const safeTitle = (item.title || '').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
    const safeImg   = (item.image || '').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
    const safeCat   = (item.category || 'General').replace(/'/g, '&#39;');
    return `
      <div class="pf-featured-item" onclick="pfSelectFeaturedItem('${item._id}','${safeTitle}','${safeImg}','${safeCat}')">
        <img src="${item.image || window.UG_PH}"
             alt="" loading="lazy"
             onerror="this.onerror=null;this.src=window.UG_PH">
        <div class="pf-featured-item-info">
          <div class="pf-featured-item-cat">${catLabel(item.category)}</div>
          <div class="pf-featured-item-title">${(item.title || 'Sin título').substring(0, 52)}</div>
        </div>
        <ion-icon name="pin-outline" class="pf-featured-item-add"></ion-icon>
      </div>`;
  }).join('');
}

function pfFilterFeaturedItems(query) {
  if(!query.trim()) { pfRenderFeaturedList(pfFeaturedItems); return; }
  const q = query.toLowerCase();
  const filtered = pfFeaturedItems.filter(i =>
    (i.title    || '').toLowerCase().includes(q) ||
    (i.category || '').toLowerCase().includes(q)
  );
  pfRenderFeaturedList(filtered);
}

function pfSelectFeaturedItem(id, title, image, cat) {
  document.getElementById('pf-vid-featured-id').value = id;
  const img = document.getElementById('pf-featured-sel-img');
  img.src = image || window.UG_PH;
  img.onerror = () => { img.src = window.UG_PH; };
  document.getElementById('pf-featured-sel-title').textContent = title;
  document.getElementById('pf-featured-sel-cat').textContent   = cat;
  document.getElementById('pf-featured-selected').style.display = 'flex';
  // Hide search + list
  const wrap = document.getElementById('pf-featured-search-wrap');
  const list = document.getElementById('pf-featured-list');
  if(wrap) wrap.style.display = 'none';
  if(list) list.style.display = 'none';
  toast('📌 Entrada anclada al video');
}

function pfClearFeaturedItem() {
  document.getElementById('pf-vid-featured-id').value = '';
  document.getElementById('pf-featured-selected').style.display = 'none';
  const wrap = document.getElementById('pf-featured-search-wrap');
  const list = document.getElementById('pf-featured-list');
  if(wrap) { wrap.style.display = ''; const inp = document.getElementById('pf-featured-search'); if(inp) inp.value = ''; }
  if(list) list.style.display = '';
  pfRenderFeaturedList(pfFeaturedItems);
}

// ── Cloudinary Widget UNIVERSAL (imágenes y videos) ──
// Usa sources:['local'] → abre directo el selector de archivos del teléfono (rápido).
// El widget maneja el preset correctamente (por eso no da "cloud_name is disabled").
let pfUniversalWidget = null;
let pfWidgetCallback  = null;

function pfGetUniversalWidget() {
  if(!pfUniversalWidget) {
    pfUniversalWidget = cloudinary.createUploadWidget({
      cloudName: CLOUDINARY_CLOUD_NAME,
      uploadPreset: CLOUDINARY_UPLOAD_PRESET,
      sources: ['local'],
      resourceType: 'auto',
      maxFileSize: 1610612736, // 1,5 GB (el plan de Cloudinary puede fijar un tope menor: ver el mensaje de error abajo)
      maxChunkSize: 20000000,  // sube por partes de 20 MB: aguanta mejor los datos móviles
      multiple: false,
      cropping: false,
      showAdvancedOptions: false,
      showSkipCropButton: false,
      styles: {
        palette: {
          window: '#0A0B0F', windowBorder: '#32D583', tabIcon: '#32D583',
          menuIcons: '#9090aa', textDark: '#f0f0f8', textLight: '#f0f0f8',
          link: '#32D583', action: '#32D583', inactiveTabIcon: '#555570',
          error: '#ff4343', inProgress: '#5AC8FA', complete: '#32D583', sourceBg: '#0d0d1a'
        }
      }
    }, (error, result) => {
      if(error) {
        const msg = String(error.message || error.statusText || error || 'Error');
        // El plan de almacenamiento rechaza archivos más pesados que su tope: explicar qué hacer
        const tope = /exceeds maximum|too large|maximum allowed/i.test(msg);
        if(pfWidgetCallback) pfWidgetCallback({ error: tope ? 'Ese archivo pesa más de lo que hoy acepta la nube de UpGames (100 MB por video). Comprímelo (p. ej. a 720p) o súbelo a YouTube y pega el enlace.' : msg });
        return;
      }
      if(result.event === 'progress' && pfWidgetCallback) {
        pfWidgetCallback({ progress: Math.round(result.info.progress || 0) });
      }
      if(result.event === 'success' && pfWidgetCallback) {
        pfWidgetCallback({ url: result.info.secure_url });
      }
    });
  }
  return pfUniversalWidget;
}

// Abre el widget y resuelve con la URL subida
// ── Widget de IMAGEN con recorte (portada 3:1, foto 1:1) ──
// Devuelve una URL de Cloudinary ya recortada y optimizada (formato y tamaño
// automáticos), así una foto de 4000px o HEIC del móvil se ve bien y carga rápido.
const _pfImgWidgets = {};
// El widget de Cloudinary se descarga en segundo plano (biblioteca.html → ugCargarCloudinary);
// si el usuario publica antes de que termine, se espera aquí.
function ugCloudinaryListo() {
  if (window.cloudinary) return Promise.resolve();
  const p = window.ugCargarCloudinary && window.ugCargarCloudinary();
  return p ? p.catch(() => { throw new Error('No se pudo cargar el subidor. Revisa tu conexión.'); })
           : Promise.reject(new Error('No se pudo cargar el subidor. Revisa tu conexión.'));
}

function pfImageUpload(opts = {}) {
  return ugCloudinaryListo().then(() => pfImageUploadListo(opts));
}
function pfImageUploadListo({ aspect = 1, transform = CLD_AVATAR, folder = 'avatars' } = {}) {
  return new Promise((resolve, reject) => {
    const key = String(aspect);
    let done = false;
    const finish = (fn, v) => { if (!done) { done = true; fn(v); } };
    _pfImgWidgets[key + '_cb'] = { resolve: v => finish(resolve, v), reject: e => finish(reject, e) };
    if (!_pfImgWidgets[key]) {
      _pfImgWidgets[key] = cloudinary.createUploadWidget({
        cloudName: CLOUDINARY_CLOUD_NAME,
        uploadPreset: CLOUDINARY_UPLOAD_PRESET,
        folder,
        sources: ['local', 'camera', 'url'],
        resourceType: 'image',
        clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif', 'avif'],
        maxImageFileSize: 25 * 1024 * 1024,
        multiple: false,
        cropping: true,
        croppingAspectRatio: aspect,
        croppingCoordinatesMode: 'custom',
        croppingShowDimensions: true,
        showSkipCropButton: false,
        language: 'es',
        text: { es: { crop: { title: aspect === 1 ? 'Recorta tu foto' : 'Recorta tu portada', crop_btn: 'Listo' } } },
        styles: { palette: { window: '#0A0B0F', windowBorder: '#32D583', tabIcon: '#32D583', menuIcons: '#9090aa', textDark: '#f0f0f8', textLight: '#f0f0f8', link: '#32D583', action: '#32D583', inactiveTabIcon: '#555570', error: '#ff4343', inProgress: '#5AC8FA', complete: '#32D583', sourceBg: '#0d0d1a' } }
      }, (error, result) => {
        const cb = _pfImgWidgets[key + '_cb'];
        if (!cb) return;
        if (error) { cb.reject(new Error(error.message || error.statusText || 'No se pudo subir la imagen')); return; }
        if (result.event === 'success') {
          const info = result.info || {};
          let url = info.secure_url || '';
          const c = info.coordinates && info.coordinates.custom && info.coordinates.custom[0];
          const crop = c ? `c_crop,x_${Math.round(c[0])},y_${Math.round(c[1])},w_${Math.round(c[2])},h_${Math.round(c[3])}/` : '';
          url = url.replace('/image/upload/', `/image/upload/${crop}${transform}/`).replace(/\.(heic|heif)$/i, '.jpg');
          cb.resolve(url);
          try { _pfImgWidgets[key].close(); } catch (_) {}
        }
        if (result.event === 'close') cb.resolve(null);   // cerró sin subir
      });
    }
    _pfImgWidgets[key].open();
  });
}

function pfWidgetUpload(onProgress) {
  return new Promise((resolve, reject) => {
    pfWidgetCallback = (res) => {
      if(res.error) { reject(new Error(res.error)); pfWidgetCallback = null; }
      else if(res.progress !== undefined && onProgress) onProgress(res.progress);
      else if(res.url) { resolve({ success: true, url: res.url }); pfWidgetCallback = null; }
    };
    ugCloudinaryListo().then(() => pfGetUniversalWidget().open(), e => { pfWidgetCallback = null; reject(e); });
  });
}

// ── Video form: usa el widget universal ──
function pfOpenCloudinaryWidget() { pfOpenVideoUpload(); }

async function pfOpenVideoUpload() {
  pfCldShowUploading();
  try {
    const data = await pfWidgetUpload((pct) => {
      const fill = document.getElementById('pf-cld-progress-fill');
      if(fill) fill.style.width = pct + '%';
    });
    if(data.success) {
      pfVideoUrl = data.url;
      document.getElementById('pf-vid-url').value = pfVideoUrl;
      pfCldShowDone(pfVideoUrl);
      toast('✅ Video subido a la nube');
    }
  } catch(e) {
    toast('❌ ' + e.message);
    pfCldShowIdle();
  }
}

function pfCldShowIdle() {
  document.getElementById('pf-cld-idle').style.display = '';
  document.getElementById('pf-cld-uploading').style.display = 'none';
  document.getElementById('pf-cld-done').style.display = 'none';
}
function pfCldShowUploading() {
  document.getElementById('pf-cld-idle').style.display = 'none';
  document.getElementById('pf-cld-uploading').style.display = '';
  document.getElementById('pf-cld-done').style.display = 'none';
}
function pfCldShowDone(url) {
  document.getElementById('pf-cld-idle').style.display = 'none';
  document.getElementById('pf-cld-uploading').style.display = 'none';
  document.getElementById('pf-cld-done').style.display = '';
  const vid = document.getElementById('pf-vid-preview');
  if(vid) { vid.src = ugVideoSrc(url); }
  pfUpdateVideoPreview();
}

// ── Video card preview update ──
function pfUpdateVideoPreview() {
  const title = document.getElementById('pf-vid-title')?.value || 'Título del Video';
  const thumb = document.getElementById('pf-vid-thumbnail')?.value || '';
  const type  = pfVideoSelectedType || 'Tutorial';

  document.getElementById('pf-vpc-title').textContent = title;
  document.getElementById('pf-vpc-type').textContent  = type;

  const img = document.getElementById('pf-vpc-img');
  if(thumb) {
    img.src = thumb;
    const prev = document.getElementById('pf-vid-thumb-prev');
    if(prev) { prev.querySelector('img').src = thumb; prev.classList.add('show'); }
  } else if(pfVideoUrl) {
    // Auto-generate thumbnail from Cloudinary (replace extension with .jpg)
    img.src = ugVideoThumb(pfVideoUrl) || pfVideoUrl.replace(/\.(mp4|webm|mov|avi)/i, '.jpg');
  }
}

// ── Upload Video to backend ──
async function pfSubirVideo() {
  if(!pfUser) return toast('⚠️ Debes iniciar sesión.');
  const ahora = Date.now();
  const ult = LS.get('ultima_publicacion');
  if(ult && ahora - parseInt(ult) < 30000) {
    const s = Math.ceil((30000-(ahora-parseInt(ult)))/1000);
    return toast(`⏱️ Anti-spam: Espera ${s}s antes de publicar.`);
  }

  const titulo = document.getElementById('pf-vid-title')?.value.trim();
  const desc   = document.getElementById('pf-vid-description')?.value.trim();
  const vidUrl = document.getElementById('pf-vid-url')?.value.trim();
  const thumb  = document.getElementById('pf-vid-thumbnail')?.value.trim();
  const type   = document.getElementById('pf-vid-type')?.value || 'Tutorial';
  const duracion = document.getElementById('pf-vid-duracion')?.value.trim() || '';
  const featuredItemId = document.getElementById('pf-vid-featured-id')?.value.trim() || '';

  if(!titulo)  return toast('⚠️ El título es obligatorio.');
  if(!vidUrl)  return toast('⚠️ Debes subir un video primero.');

  // Auto-thumb desde Cloudinary si no hay manual
  // Sin portada manual: fotograma del video (antes, con un .3gp quedaba el mismo video como "imagen")
  const thumbFinal = thumb || ugVideoThumb(vidUrl) || (ugEsVideoArchivo(vidUrl) ? '' : vidUrl);

  const token = LS.get('token');
  if(!token) { toast('⚠️ Tu sesión expiró. Vuelve a entrar.'); setTimeout(() => { location.href='../login.html'; }, 1200); return; }

  const btn = document.getElementById('pf-subirVideoBtn');
  btn.textContent = 'Publicando...'; btn.disabled = true;
  try {
    const res = await fetch(`${PF_API}/items/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        title:    titulo,
        description: desc,
        link:     vidUrl,
        image:    thumbFinal,
        images:   [],
        category: 'Video',
        videoType: type,
        extraData: duracion ? { duracion } : {},
        featuredItemId: featuredItemId || undefined,
        usuario:  pfUser,
        status:   'pendiente'
      })
    });
    if(res.ok) {
      LS.set('ultima_publicacion', Date.now().toString());
      window.dispatchEvent(new CustomEvent('ug:guia', { detail: 'publicar' }));
      toast('✅ Video publicado. Esperando aprobación.');
      window.UGPublicar?.reiniciar();
      // Reset form
      document.getElementById('pf-vid-title').value = '';
      document.getElementById('pf-vid-description').value = '';
      document.getElementById('pf-vid-thumbnail').value = '';
      document.getElementById('pf-vid-url').value = '';
      pfVideoUrl = '';
      pfCldShowIdle();
      pfCloudinaryWidget = null;
      pfUpdateVideoPreview();
      // Reset featured selector
      pfFeaturedItems = [];
      pfClearFeaturedItem();
      pfLoadHistorial();
      pfLoadUserData();
    } else {
      const err = await res.json();
      toast('❌ ' + (err.error || err.message || 'Error al publicar'));
    }
  } catch(e) { toast('❌ Error de conexión'); }
  finally { btn.innerHTML='<ion-icon name="cloud-upload"></ion-icon> PUBLICAR VIDEO'; btn.disabled=false; }
}

// ── NEXUS: revisar la publicación antes de enviarla ──
let _pfNx = null;   // { firma, res } — última revisión hecha
function pfFormPublicacion() {
  const v = id => (document.getElementById(id)?.value || '').trim();
  return { title: v('pf-addTitle'), description: v('pf-addDescription'), link: v('pf-addLink'), image: v('pf-addImage'),
    images: ['pf-addImage2', 'pf-addImage3', 'pf-addImage4'].map(v).filter(Boolean), category: document.getElementById('pf-addCategory')?.value || pfCurrentCategory };
}
async function pfRevisarConNexus(conIA) {
  const d = pfFormPublicacion(), out = document.getElementById('pf-nexus-res'), btn = document.getElementById('pf-nexus-btn');
  if (!d.title || !d.link) { if (conIA) toast('✦ Escribe al menos el título y el enlace para que Nexus lo revise'); return null; }
  const token = LS.get('token'); if (!token) return null;
  if (conIA && out) {
    out.innerHTML = `<div class="pf-nx-load"><span class="pf-nx-orb"></span><div><b>Nexus está revisando tu publicación…</b><small>Abriendo tu enlace, comprobando la portada y el texto</small></div></div>`;
    if (btn) btn.disabled = true;
  }
  try {
    const r = await fetch(`${PF_API}/items/precheck`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ ...d, ia: !!conIA }) });
    const res = await r.json().catch(() => ({}));
    if (!r.ok || !res.success) { if (out && conIA) out.innerHTML = `<div class="pf-nx-res warn">${ugEsc(res.error || 'Nexus no pudo revisar ahora. Puedes publicar igualmente.')}</div>`; return null; }
    _pfNx = { firma: [d.title, d.link, d.image, d.description.length].join('|'), res };
    if (out) pfPintarNexus(res, out);
    return res;
  } catch (_) { return null; } finally { if (btn) btn.disabled = false; }
}
function pfPintarNexus(r, out) {
  const ic = { ok: '✅', info: 'ℹ️', warn: '⚠️', bad: '❌' };
  const orden = { bad: 0, warn: 1, info: 2, ok: 3 };
  const hechos = [...r.hechos].sort((a, b) => orden[a.tipo] - orden[b.tipo]);
  out.innerHTML = `<div class="pf-nx-res ${r.problemas ? 'bad' : r.avisos ? 'warn' : 'ok'}">
    <div class="pf-nx-h"><span class="pf-nexus-ic">✦</span><b>${r.problemas ? `${r.problemas} problema(s) por corregir` : r.avisos ? 'Casi lista: revisa los avisos' : '¡Lista para publicar!'}</b></div>
    <p>${ugEsc(r.resumen || '')}</p>
    <ul>${hechos.map(h => `<li class="${h.tipo}"><span>${ic[h.tipo] || '•'}</span>${ugEsc(h.texto)}</li>`).join('')}</ul>
    ${(r.sugerencias || []).length ? `<div class="pf-nx-sug"><b>Sugerencias de Nexus</b>${r.sugerencias.slice(0, 4).map(x => `<div>💡 ${ugEsc(x)}</div>`).join('')}</div>` : ''}
    <small class="pf-nx-src">${r.fuente ? 'Analizado por ' + ugEsc(r.fuente) : 'Comprobaciones automáticas de Nexus'}</small>
  </div>`;
}

async function pfSubirJuego() {
  if(!pfUser) return toast('🔒 Debes iniciar sesión para publicar.');
  const ahora = Date.now();
  const ult = LS.get('ultima_publicacion');
  if(ult && ahora - parseInt(ult) < 30000) {
    const s = Math.ceil((30000-(ahora-parseInt(ult)))/1000);
    return toast(`⏱️ Anti-spam: Espera ${s}s antes de publicar.`);
  }
  const titulo = document.getElementById('pf-addTitle').value.trim();
  const desc = document.getElementById('pf-addDescription').value.trim();
  const link = document.getElementById('pf-addLink').value.trim();
  const imagen = document.getElementById('pf-addImage').value.trim();
  const cat = document.getElementById('pf-addCategory')?.value || pfCurrentCategory;
  // Recoger campos extra dinámicos
  const extraData = pfLeerExtras(document.getElementById('pf-extra-fields'));
  // Recoger medias adicionales slots 2-4 (opcionales)
  const imagesExtra = [
    document.getElementById('pf-addImage2')?.value.trim() || '',
    document.getElementById('pf-addImage3')?.value.trim() || '',
    document.getElementById('pf-addImage4')?.value.trim() || '',
  ].filter(u => u.length > 0);

  const bad = PF_BANNED.find(k => new RegExp('\\b'+k+'\\b','i').test(titulo.toLowerCase()));
  if(bad) return toast(`🚫 Palabra prohibida: "${bad}"`);
  const vLink = pfAnalizarLink(link);
  if(vLink.ok === false) return toast(vLink.msg);
  if(!titulo || !link) return toast('⚠️ Completa Título y Enlace.');
  if(!imagen) return toast('⚠️ La portada es obligatoria. Agrega al menos una imagen o video.');
  // Validar que sea URL válida de imagen o video (acepta URLs sin extensión como Google Drive, Imgur, etc.)
  function esMediaValida(url) {
    if(!url) return false;
    try { new URL(url); } catch(_) { return false; }
    // Extensión de imagen
    if(/\.(jpg|jpeg|png|webp|gif|avif|svg)(\?.*)?$/i.test(url)) return true;
    // Extensión de video
    if(ugEsVideoArchivo(url)) return true;
    // URLs de servicios conocidos que no terminan en extensión
    const knownHosts = ['imgur.com','i.imgur.com','drive.google.com','lh3.googleusercontent.com',
      'googleusercontent.com','pbs.twimg.com','cdn.discordapp.com','media.discordapp.net',
      'i.redd.it','preview.redd.it','images.unsplash.com','raw.githubusercontent.com',
      'user-images.githubusercontent.com','postimg.cc','i.postimg.cc','ibb.co','i.ibb.co',
      'upload.wikimedia.org','media.tenor.com','c.tenor.com','giphy.com','media.giphy.com',
      'cloudinary.com','res.cloudinary.com','media1.tenor.com','media2.tenor.com',
      'via.placeholder.com','placehold.co','picsum.photos'];
    try {
      const host = new URL(url).hostname.replace('www.','');
      if(knownHosts.some(h => host === h || host.endsWith('.'+h))) return true;
    } catch(_) {}
    // Si no reconocemos el host, igual la aceptamos (el creador es responsable)
    return true;
  }
  if(imagen && !esMediaValida(imagen)) return toast('⚠️ El enlace de imagen no parece válido. Usa una URL directa de imagen o video.');
  // Categoría Juego: declaración obligatoria (soy el autor o tengo permiso; no es un juego comercial completo)
  const declara = !!document.getElementById('pf-declara')?.checked;
  if(cat === 'Juego' && !declara) { document.getElementById('pfw-declara')?.classList.add('pfw-falta'); return toast('☑️ Marca la declaración para publicar en Juegos'); }

  const token = LS.get('token');
  if(!token) { toast('⚠️ Tu sesión expiró. Vuelve a entrar.'); setTimeout(() => { location.href='../login.html'; }, 1200); return; }

  const btn = document.getElementById('pf-subirBtn');
  // Nexus revisa rápido (sin IA) antes de enviar, salvo que ya lo hayas revisado con estos datos
  const firma = [titulo, link, imagen, desc.length].join('|');
  let rev = _pfNx && _pfNx.firma === firma ? _pfNx.res : null;
  if(!rev) {
    btn.innerHTML = '<span class="pf-nexus-ic">✦</span> Nexus está revisando…'; btn.disabled = true;
    rev = await pfRevisarConNexus(false);
    btn.innerHTML = '<ion-icon name="cloud-upload"></ion-icon> ENVIAR A REVISIÓN'; btn.disabled = false;
  }
  if(rev && rev.problemas > 0) {
    const lista = rev.hechos.filter(h => h.tipo === 'bad').map(h => '• ' + h.texto).join('\n');
    if(!(await customConfirm({ icon: '✦', title: `Nexus encontró ${rev.problemas} problema(s)`, msg: `Podrían hacer que rechacen tu publicación:\n\n${lista}\n\n¿Publicar igualmente?`, okText: 'Publicar igual', okDanger: true }))) return;
  }
  btn.textContent = 'Enviando...'; btn.disabled = true;
  try {
    const res = await fetch(`${PF_API}/items/add`, {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},
      body: JSON.stringify({ title:titulo, description:desc, link, image:imagen, images:imagesExtra, category:cat, extraData, usuario:pfUser, status:'pendiente', declaraDerechos: cat === 'Juego' ? declara : undefined, ...(window.UGUX?.leerGuia('pf') || {}) })
    });
    if(res.ok) {
      const dataPub = await res.json().catch(() => ({}));
      LS.set('ultima_publicacion', Date.now().toString());
      window.dispatchEvent(new CustomEvent('ug:guia', { detail: 'publicar' }));
      if (dataPub.sospecha) {
        // Nombre de un juego comercial que no parece un mod: publicada, con anuncios, sin UpCoins hasta revisar
        customConfirm({ icon: '🔎', title: 'Publicada · en verificación', okText: 'Entendido', cancelText: '',
          msg: `"${titulo}" coincide con el juego comercial ${dataPub.sospecha.juego}.\n\nYa está publicada y visible, pero no generará UpCoins mientras el equipo verifica que no sea el juego completo.\n\nSi es un mod, parche o configuración, edita el título para indicarlo.` });
      } else toast('✅ Publicado. Aparecerá como "En revisión" hasta verificar el enlace.');
      const decl = document.getElementById('pf-declara'); if (decl) decl.checked = false;
      window.UGPublicar?.reiniciar();
      document.getElementById('pf-addTitle').value='';
      document.getElementById('pf-addDescription').value='';
      window.UGUX?.limpiarGuia('pf');
      document.getElementById('pf-addLink').value='';
      document.getElementById('pf-addImage').value='';
      ['pf-addImage2','pf-addImage3','pf-addImage4'].forEach(id=>{
        const el=document.getElementById(id); if(el) el.value='';
      });
      [0,1,2,3].forEach(i=>{
        const p=document.getElementById('pf-slot-prev-'+i); if(p) p.classList.remove('show');
      });
      pfUpdatePreview();
      pfLoadHistorial();
      pfLoadUserData();
    } else {
      const err = await res.json();
      toast('❌ ' + (err.error || err.message || 'Error al publicar'));
    }
  } catch(e) { toast('❌ Error de conexión'); }
  finally { btn.innerHTML='<ion-icon name="cloud-upload"></ion-icon> ENVIAR A REVISIÓN'; btn.disabled=false; }
}

