// ═══════════════════════════════════════════════════════════
// PERFIL INTEGRADO — FULL LOGIC
// ═══════════════════════════════════════════════════════════
const PF_API = "https://upgames-production.up.railway.app";
let pfUser = null;
let pfInitialized = false;
let pfCurrentEditId = null;

function pfInit(user) {
  pfUser = user;
  if(pfInitialized) {
    // Refresh data
    pfChatBadge();
    pfLoadUserData();
    pfLoadHistorial();
    pfLoadEconomia();
    pfLoadTarjetas();
    return;
  }
  pfInitialized = true;
  pfChatBadge();
  pfLoadUserData();
  pfLoadHistorial();
  pfLoadBoveda();
  pfLoadEconomia();
  pfLoadTarjetas();
  pfInitForm();
}

// ── Load user data (badge, bio, avatar, stats) ──
async function pfLoadUserData() {
  if(!pfUser) return;
  document.getElementById('pf-username').textContent = '@' + pfUser;

  try {
    // Solo MI perfil (antes se descargaba la lista de TODOS los usuarios para buscarlo)
    const res = await fetch(`${PF_API}/usuarios/perfil-publico/${encodeURIComponent(pfUser)}`);
    const pd  = await res.json();
    const ud  = pd && pd.usuario;
    if(!ud) return;
    pfApplyBanner(ud.banner || '');

    const nivel = ud.verificadoNivel || 0;
    if(nivel > 0) {
      const cls = ['','lv1','lv2','lv3'][nivel]||'lv3';
      const ico = nivel === 3 ? 'checkmark-done-circle-sharp' : 'checkmark-circle';
      document.getElementById('pf-badge').innerHTML =
        `<ion-icon name="${ico}" class="verificado-badge ${cls}" title="Verificado nivel ${nivel}"></ion-icon>`;
    }

    if(ud.avatar && ud.avatar.trim()) {
      const img = document.getElementById('pf-avatar-img');
      const ico = document.getElementById('pf-avatar-icon');
      img.src = cldOpt(ud.avatar, CLD_AVATAR); img.style.display='block'; ico.style.display='none';
      const prev = document.getElementById('pf-preview-avatar');
      if(prev) { prev.innerHTML=''; const pi=document.createElement('img'); pi.src=ud.avatar; pi.alt='Avatar'; prev.appendChild(pi); }
      const inp = document.getElementById('pf-input-avatar-url');
      if(inp) inp.value = ud.avatar;
    }
    if(ud.bio && ud.bio.trim()) {
      document.getElementById('pf-bio').textContent = ud.bio;
      const inp = document.getElementById('pf-input-bio');
      if(inp) { inp.value = ud.bio; document.getElementById('pf-bio-count').textContent = ud.bio.length; }
    }
  } catch(e) { console.error('pfLoadUserData', e); }

  // Stats
  try {
    const sr = await fetch(`${PF_API}/usuarios/stats-seguimiento/${pfUser}`);
    if(sr.ok) {
      const sd = await sr.json();
      if(sd.stats) {
        document.getElementById('pf-stat-followers').textContent = sd.stats.seguidores || 0;
        document.getElementById('pf-stat-following').textContent = sd.stats.siguiendo || 0;
      }
    } else {
      // fallback
      const ur = await fetch(`${PF_API}/auth/users/public`);
      const us = await ur.json();
      const uu = us.find(u => u.usuario === pfUser);
      if(uu) {
        const seg = uu.listaSeguidores ? uu.listaSeguidores.length : (uu.seguidores ? uu.seguidores.length : 0);
        const sig = uu.siguiendo ? uu.siguiendo.length : 0;
        document.getElementById('pf-stat-followers').textContent = seg;
        document.getElementById('pf-stat-following').textContent = sig;
      }
    }
  } catch(e) {}

  // (El contador de publicaciones lo actualiza pfLoadHistorial: evita descargar dos veces la lista)

  // Gamificación — XP y nivel en header de perfil
  try {
    const token = LS.get('token');
    if(token) {
      const gr = await fetch(`${PF_API}/gamification/profile/${encodeURIComponent(pfUser)}`, { headers: { Authorization: `Bearer ${token}` } });
      if(gr.ok) {
        const gd = await gr.json();
        const g = gd.gamification || gd;
        if(g && g.nivel) {
          const xpEl = document.getElementById('pf-stat-xp');
          if(xpEl) { xpEl.textContent = `Nv.${g.nivel} · ${(g.xp||0).toLocaleString()} XP`; }
        }
      }
    }
  } catch(_) {}
}

// ── Inner tab switching ──
function pfSwitchTab(tabName, el) {
  if (tabName === 'publicar') { pfOpenPublish(true); return; }
  document.querySelectorAll('.perfil-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.perfil-tab-content').forEach(c => c.classList.remove('active'));
  if(el) el.classList.add('active');
  else document.querySelector(`[data-pftab="${tabName}"]`)?.classList.add('active');
  const tc = document.getElementById(`pf-tab-${tabName}`);
  if(tc) tc.classList.add('active');
  if(tabName === 'historial') pfLoadHistorial();
  if(tabName === 'boveda') pfLoadBoveda();
  if(tabName === 'reportes') pfLoadReportes();
  if(tabName === 'pagos') pfLoadHistorialPagos();
  if(tabName === 'logros') pfLoadLogros();
  if(tabName === 'colecciones') window.UGR?.colecciones(localStorage.getItem('user_admin') || '', document.getElementById('pf-colecciones'), { propio: true });
  if(tabName === 'economia') pfStartEcoPolling();
  else pfStopEcoPolling();
}

// ── Historial sub-nav ──
function histSwitchSubTab(tab, el) {
  document.querySelectorAll('.hist-subnav-tab').forEach(t => t.classList.remove('active'));
  if(el) el.classList.add('active');
  const panelPub = document.getElementById('hist-panel-publicaciones');
  const panelVid = document.getElementById('hist-panel-videos');
  if(panelPub) panelPub.style.display = tab === 'publicaciones' ? 'block' : 'none';
  if(panelVid) panelVid.style.display = tab === 'videos' ? 'block' : 'none';
}

// ── Publicaciones / Videos (pestañas superiores tipo Instagram) ──
function pfShowPosts(sub, el) {
  sub = sub === 'videos' ? 'videos' : 'publicaciones';
  const btn = el || document.querySelector(`.perfil-tab[data-sub="${sub}"]`);
  pfSwitchTab('historial', btn);
  histSwitchSubTab(sub);
  if (!el) document.getElementById('pf-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── "Crear publicación": botón que despliega todo el formulario ──
function pfOpenPublish(open) {
  const wrap = document.getElementById('pf-publish-wrap');
  const btn  = document.getElementById('pf-create-btn');
  if (!wrap || !btn) return;
  const abrir = open === undefined ? wrap.hidden : !!open;
  wrap.hidden = !abrir;
  btn.setAttribute('aria-expanded', String(abrir));
  btn.classList.toggle('open', abrir);
  if (typeof pfpVigilar === 'function') pfpVigilar(abrir);   // vista previa en vivo solo con el formulario abierto
  if (abrir) {
    wrap.classList.remove('pf2-publish-in'); void wrap.offsetWidth; wrap.classList.add('pf2-publish-in');
    setTimeout(() => btn.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }
}
function pfTogglePublish() { pfOpenPublish(); }

// ── Mensajes sin leer (botón Chats del perfil) ──
async function pfChatBadge() {
  const el = document.getElementById('pf-chat-n');
  const token = LS.get('token');
  if (!el || !token) return;
  try {
    // Chats privados + grupos (si el servidor aún no tiene grupos, cuenta 0)
    const h = { headers: { Authorization: `Bearer ${token}` } };
    const [d, g] = await Promise.all([fetch(`${PF_API}/chat/no-leidos`, h), fetch(`${PF_API}/grupos/no-leidos`, h)].map(p => p.then(r => r.ok ? r.json() : null).catch(() => null)));
    const n = (d && d.noLeidos || 0) + (g && g.noLeidos || 0);
    el.textContent = n > 99 ? '99+' : n; el.hidden = !n;
  } catch (_) {}
}
setInterval(() => { if (!document.hidden && currentTab === 'profile') pfChatBadge(); }, 30000);

// ── Compartir el perfil público ──
async function pfShareProfile() {
  if (!pfUser) return;
  const url = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}perfil-publico.html?usuario=${encodeURIComponent(pfUser)}`;
  try {
    if (navigator.share) { await navigator.share({ title: `@${pfUser} en UpGames`, url }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); toast('🔗 Enlace de tu perfil copiado'); }
  catch (_) { prompt('Copia el enlace de tu perfil:', url); }
}

// ── Form: upload ──
function pfInitForm() {
  ['pf-addTitle','pf-addDescription','pf-addLink','pf-addImage'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('input', pfUpdatePreview);
    if(id === 'pf-addTitle' && el) el.addEventListener('input', pfValidateTitle);
  });
  const btn = document.getElementById('pf-subirBtn');
  if(btn) btn.addEventListener('click', pfSubirJuego);
  const btnV = document.getElementById('pf-subirVideoBtn');
  if(btnV) btnV.addEventListener('click', pfSubirVideo);
  // Video preview live update
  const vidTitle = document.getElementById('pf-vid-title');
  if(vidTitle) vidTitle.addEventListener('input', pfUpdateVideoPreview);
  document.addEventListener('click', e => {
    if(!e.target.closest('.pf-info-icon') && !e.target.closest('.pf-tooltip')) {
      document.querySelectorAll('.pf-tooltip').forEach(t => t.classList.remove('active'));
    }
  });
  // PayPal
  document.getElementById('pf-btn-solicitar-pago')?.addEventListener('click', pfSolicitarPago);
  // Edit save
  document.getElementById('pf-edit-save-btn')?.addEventListener('click', pfSaveEdit);
  // Init category form state
  pfOnCategoryChange('Juego', document.querySelector('.pf-cat-btn[data-cat="Juego"]'));
}

const PF_BANNED = ['crack','cracked','crackeado','crackeo','pirata','pirateado','piratear',
  'gratis','free','gratuito','full','completo','complete','premium gratis','pro gratis',
  'descargar gratis','download free'];
const PF_BANNED_VISUAL = ['crack','cracked','crackeado','crackeo','pirata','pirateado',
  'gratis','free','gratuito','full','completo','complete','premium','pro','descargar','download'];
const PF_ALLOWED_LINKS = ['mediafire.com','mega.nz','mega.co.nz','drive.google.com',
  'gofile.io','onedrive.live.com','icloud.com','proton.me','pcloud.com',
  'pixeldrain.com','1fichier.com','qiwi.gg','krakenfiles.com','dropbox.com','github.com','github.io','sto.romsfast.com','clarodrive.com',
  'upgames-production.up.railway.app'];

function pfAnalizarLink(url) {
  if(!url) return { ok: null };
  try {
    const h = new URL(url).hostname.replace('www.','');
    const ok = PF_ALLOWED_LINKS.some(d => h === d || h.endsWith('.'+d));
    if(!ok) return { ok:false, msg:'❌ Solo se permite MediaFire, Mega, Drive, etc. Sin acortadores.' };
    if(url.toLowerCase().endsWith('.exe')||url.toLowerCase().endsWith('.msi'))
      return { ok:false, msg:'⚠️ No enlaces directos a .exe. Usa .zip o .rar' };
    return { ok:true };
  } catch(e) { return { ok:false, msg:'❌ Formato de enlace inválido.' }; }
}

function pfPreviewSlot(slotIdx) {
  const ids = ['pf-addImage','pf-addImage2','pf-addImage3','pf-addImage4'];
  const url = document.getElementById(ids[slotIdx])?.value.trim();
  const prev = document.getElementById('pf-slot-prev-' + slotIdx);
  if(!prev) return;
  if(!url) { prev.classList.remove('show'); return; }
  const img = prev.querySelector('img');
  const displaySrc = isYouTubeUrl(url) ? getYouTubeThumbnail(url) : url;
  img.src = displaySrc;
  img.onerror = () => { prev.classList.remove('show'); prev.classList.add('rota'); };   // (via.placeholder.com ya no existe)
  img.onload = () => prev.classList.remove('rota');
  prev.classList.add('show');
  if (slotIdx === 0) pfpRender();
}

function pfUpdatePreview() {
  pfpRender();
  const linkEl = document.getElementById('pf-addLink');
  if(linkEl && linkEl.value.trim()) {
    const r = pfAnalizarLink(linkEl.value.trim());
    linkEl.classList.toggle('valid', r.ok === true);
    linkEl.classList.toggle('invalid', r.ok === false);
  } else if(linkEl) { linkEl.classList.remove('valid','invalid'); }
}

/* ── Vista previa fiel de la publicación: como la tarjeta del catálogo, con tu estilo ──
   Antes usaba via.placeholder.com (ya no existe: imagen rota) y solo cambiaba al pegar la portada. */
let _pfpSnap = '', _pfpTimer = null;
function pfpRender() {
  const v = id => (document.getElementById(id)?.value || '').trim();
  const titulo = v('pf-addTitle'), cat = v('pf-addCategory') || 'Juego', img = v('pf-addImage'), link = v('pf-addLink'), desc = v('pf-addDescription');
  const snap = [titulo, cat, img, link, desc.length].join('|'); if (snap === _pfpSnap) return; _pfpSnap = snap;
  const t = document.getElementById('pf-prev-title'); if (t) t.textContent = titulo || 'Título de tu publicación';
  const tag = document.getElementById('pf-prev-tag'); if (tag) tag.textContent = catLabel(cat).toUpperCase();
  const box = document.getElementById('pfp-prev-img');
  if (box) {
    const src = img ? (isYouTubeUrl(img) ? getYouTubeThumbnail(img) : img) : '';
    if (src) { box.innerHTML = `<img src="${ugEsc(src)}" alt="">${isYouTubeUrl(img) ? '<i class="pfp-play">▶</i>' : ''}`; box.querySelector('img').onerror = () => { box.innerHTML = '<span>⚠️ No se pudo cargar la imagen</span>'; }; }
    else box.innerHTML = '<span>Sin portada</span>';
  }
  document.getElementById('pfp-portada')?.classList.toggle('con', !!img);
  const yo = LS.get('user_admin', ''), au = document.getElementById('pfp-prev-autor');
  if (au && !au.dataset.ok && yo) { au.dataset.ok = '1'; au.innerHTML = `<span class="pfp-prev-av"></span><span class="pfp-prev-n">@${ugEsc(yo)}</span>`; window.UGX?.tarjetas?.([yo]).then(ts => { const tj = ts[yo.toLowerCase()]; window.UGX?.pintarAvatar?.(au.querySelector('.pfp-prev-av'), tj, yo[0].toUpperCase()); window.UGX?.aplicarEstilo?.(tj?.estilo || {}, { nombre: au.querySelector('.pfp-prev-n') }); }); }
  // Lista de lo que falta (simple y en lenguaje claro)
  const lk = link ? pfAnalizarLink(link) : { ok: null };
  const items = [
    [titulo.length >= 5, titulo ? (titulo.length >= 5 ? 'Título listo' : 'El título es muy corto') : 'Escribe un título'],
    [lk.ok === true, !link ? 'Pega el enlace de descarga' : lk.ok ? 'Enlace permitido' : (lk.msg || 'Revisa el enlace').replace(/^\W+\s*/, '')],
    [!!img, img ? 'Portada lista' : 'Agrega una portada (las publicaciones con portada se descargan mucho más)'],
    [desc.length >= 30, desc.length >= 30 ? 'Descripción lista' : 'Opcional: una descripción ayuda a que te encuentren'],
  ];
  const ul = document.getElementById('pfp-check');
  if (ul) ul.innerHTML = items.map(([ok, txt], i) => `<li class="${ok ? 'ok' : i === 3 ? 'opc' : 'falta'}">${ok ? '✓' : i === 3 ? '○' : '•'} ${ugEsc(txt)}</li>`).join('');
}
// Plantillas de descripción por categoría (modulos/plantillas.js) y "Que NEXUS la escriba"
let _pfpPlantillas = null;
// modo 'edit' = mismos botones dentro del modal Editar publicación
const pfpIds = modo => modo === 'edit'
  ? { desc: 'pf-edit-description', title: 'pf-edit-title', cat: 'pf-edit-category', btn: 'pfe-nexus-desc', extras: 'pf-edit-extra-fields' }
  : { desc: 'pf-addDescription', title: 'pf-addTitle', cat: 'pf-addCategory', btn: 'pfp-nexus-desc', extras: 'pf-extra-fields' };
async function pfpPlantilla(modo) {
  const I = pfpIds(modo);
  const ta = document.getElementById(I.desc); if (!ta) return;
  try { if (!_pfpPlantillas) _pfpPlantillas = (await (await fetch(`${API_URL}/items/plantillas`)).json()).plantillas || {}; } catch (_) { return toast('⚠️ No se pudo cargar la plantilla'); }
  const cat = document.getElementById(I.cat)?.value || 'Juego', tpl = _pfpPlantillas[cat] || _pfpPlantillas.Juego || '';
  if (ta.value.trim() && !(await customConfirm({ icon: '📋', title: '¿Usar la plantilla?', msg: 'Reemplazará lo que ya escribiste en la descripción.', okText: 'Reemplazar' }))) return;
  ta.value = tpl; ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus();
  const i = tpl.indexOf('• \n'); if (i >= 0) ta.setSelectionRange(i + 2, i + 2);   // cursor en el primer espacio por llenar
}
async function pfpNexusDescribe(modo) {
  const I = pfpIds(modo);
  const ta = document.getElementById(I.desc), b = document.getElementById(I.btn); if (!ta || !b) return;
  const title = (document.getElementById(I.title)?.value || '').trim();
  if (title.length < 3) return toast('✏️ Escribe primero el título');
  const tk = LS.get('token'); if (!tk) return ugPedirSesion('usar NEXUS');
  if (ta.value.trim() && !(await customConfirm({ icon: '✦', title: '¿Que NEXUS la escriba?', msg: 'NEXUS reemplazará lo que escribiste en la descripción.', okText: 'Continuar' }))) return;
  const extras = pfLeerExtras(document.getElementById(I.extras));
  b.disabled = true; const txt = b.textContent; b.textContent = '✦ Escribiendo…';
  try {
    const r = await fetch(`${API_URL}/items/describir`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` },
      body: JSON.stringify({ title, category: document.getElementById(I.cat)?.value || 'Juego', extras }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.success) return toast('⚠️ ' + (d.error || 'NEXUS no pudo escribirla ahora'));
    ta.value = d.descripcion; ta.dispatchEvent(new Event('input', { bubbles: true }));
    toast(d.fuente === 'nexus' ? '✦ Lista. Revísala y completa lo que diga "(complétalo)"' : '📋 Te dejamos la plantilla con lo que sabemos del título');
  } catch (_) { toast('⚠️ Error de conexión'); }
  finally { b.disabled = false; b.textContent = txt; }
}

// Los campos que llenan la nube o NEXUS cambian sin evento "input": se revisa cada 700 ms solo con el formulario abierto
function pfpVigilar(on) { clearInterval(_pfpTimer); _pfpTimer = on ? setInterval(() => { if (!document.hidden) pfpRender(); }, 700) : null; if (on) { _pfpSnap = ''; pfpRender(); } }
document.getElementById('pf-tab-publicar')?.addEventListener('input', () => pfpRender());

function pfValidateTitle() {
  const el = document.getElementById('pf-addTitle');
  if(!el) return;
  const txt = el.value.toLowerCase();
  const bad = PF_BANNED_VISUAL.some(k => new RegExp('\\b'+k+'\\b','i').test(txt));
  el.classList.toggle('invalid', bad && txt.length > 0);
  if(bad && txt.length > 0) el.classList.remove('valid');
}

