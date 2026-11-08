// ═══════════════════════════════════════════════════════════════
// SISTEMA DE DETECCIÓN DE JUEGOS — UpGames
// clientDetectGame() funciona sin depender de datos del servidor.
// ═══════════════════════════════════════════════════════════════

const _GAMESDB = [
  { n:'Grand Theft Auto V',         l:'https://store.steampowered.com/app/271590/',  kw:['gta v','gta5','gta 5','grand theft auto v','grand theft auto 5','gtav'] },
  { n:'GTA San Andreas',            l:'https://store.steampowered.com/app/12120/',   kw:['gta san andreas','san andreas','gtasa','gta sa'] },
  { n:'Red Dead Redemption 2',      l:'https://store.steampowered.com/app/1174180/', kw:['red dead redemption 2','rdr2','red dead 2','red dead'] },
  { n:'Dark Souls Remastered',      l:'https://store.steampowered.com/app/570940/',  kw:['dark souls','darksouls'] },
  { n:'Dark Souls II',              l:'https://store.steampowered.com/app/335300/',  kw:['dark souls 2','dark souls ii','ds2'] },
  { n:'Dark Souls III',             l:'https://store.steampowered.com/app/374320/',  kw:['dark souls 3','dark souls iii','ds3'] },
  { n:'Elden Ring',                 l:'https://store.steampowered.com/app/1245620/', kw:['elden ring','eldenring'] },
  { n:'Sekiro',                     l:'https://store.steampowered.com/app/814380/',  kw:['sekiro'] },
  { n:'NFS Most Wanted 2005',       l:'https://store.steampowered.com/app/13520/',   kw:['need for speed most wanted','nfsmw','nfs most wanted','nfs mw','most wanted 2005'] },
  { n:'NFS Underground 2',          l:'https://www.ea.com/games/need-for-speed/need-for-speed-underground-2', kw:['nfs underground 2','nfsu2','underground 2','need for speed underground'] },
  { n:'NFS Heat',                   l:'https://store.steampowered.com/app/1222680/', kw:['nfs heat','need for speed heat'] },
  { n:'NFS Unbound',                l:'https://store.steampowered.com/app/1846380/', kw:['nfs unbound','need for speed unbound'] },
  { n:'Minecraft',                  l:'https://www.minecraft.net/en-us/store/minecraft-java-bedrock-edition-pc', kw:['minecraft'] },
  { n:'pixARK',                     l:'https://store.steampowered.com/app/593380/',  kw:['pixark','pix ark'] },
  { n:'ARK Survival Evolved',       l:'https://store.steampowered.com/app/346110/',  kw:['ark survival evolved','ark survival','ark evolved'] },
  { n:'ARK Survival Ascended',      l:'https://store.steampowered.com/app/2399830/', kw:['ark survival ascended','ark ascended'] },
  { n:'Project Zomboid',            l:'https://store.steampowered.com/app/108600/',  kw:['project zomboid','zomboid','zomdroid'] },
  { n:'Terraria',                   l:'https://store.steampowered.com/app/105600/',  kw:['terraria'] },
  { n:'Stardew Valley',             l:'https://store.steampowered.com/app/413150/',  kw:['stardew valley','stardew'] },
  { n:'Valheim',                    l:'https://store.steampowered.com/app/892970/',  kw:['valheim'] },
  { n:'Rust',                       l:'https://store.steampowered.com/app/252490/',  kw:['rust survival','rust game'] },
  { n:'7 Days to Die',              l:'https://store.steampowered.com/app/251570/',  kw:['7 days to die','7dtd'] },
  { n:'Cyberpunk 2077',             l:'https://store.steampowered.com/app/1091500/', kw:['cyberpunk 2077','cyberpunk','cp2077'] },
  { n:'Skyrim',                     l:'https://store.steampowered.com/app/489830/',  kw:['skyrim','elder scrolls v','tesv'] },
  { n:'The Witcher 3',              l:'https://store.steampowered.com/app/292030/',  kw:['witcher 3','the witcher 3'] },
  { n:'Hogwarts Legacy',            l:'https://store.steampowered.com/app/990080/',  kw:['hogwarts legacy','harry potter game'] },
  { n:'Fortnite',                   l:'https://www.epicgames.com/fortnite/en-US/download', kw:['fortnite'] },
  { n:'PUBG',                       l:'https://store.steampowered.com/app/578080/',  kw:['pubg battlegrounds','pubg pc','pubg game'] },
  { n:'Valorant',                   l:'https://playvalorant.com/en-us/download/',    kw:['valorant'] },
  { n:'Counter-Strike 2',           l:'https://store.steampowered.com/app/730/',     kw:['counter-strike','cs2','csgo','cs go'] },
  { n:'Call of Duty',               l:'https://store.steampowered.com/app/2602690/', kw:['call of duty','cod warzone','warzone','modern warfare'] },
  { n:'Apex Legends',               l:'https://store.steampowered.com/app/1172470/', kw:['apex legends'] },
  { n:'Overwatch 2',                l:'https://playoverwatch.com/en-us/download/',   kw:['overwatch 2','overwatch'] },
  { n:'League of Legends',          l:'https://signup.leagueoflegends.com/en-us/signup/', kw:['league of legends'] },
  { n:'Dota 2',                     l:'https://store.steampowered.com/app/570/',     kw:['dota 2','dota2'] },
  { n:'Forza Horizon 5',            l:'https://store.steampowered.com/app/1551360/', kw:['forza horizon','fh5','forza 5'] },
  { n:'EA Sports FC',               l:'https://store.steampowered.com/app/2195250/', kw:['ea sports fc','ea fc','fifa','fc 25','fc25'] },
  { n:'BeamNG.drive',               l:'https://store.steampowered.com/app/284160/',  kw:['beamng','beam ng'] },
  { n:'Resident Evil',              l:'https://store.steampowered.com/franchise/residentevil', kw:['resident evil','re village','re4','re2','re3'] },
  { n:'Hollow Knight',              l:'https://store.steampowered.com/app/367520/',  kw:['hollow knight'] },
  { n:'Among Us',                   l:'https://store.steampowered.com/app/945360/',  kw:['among us'] },
  { n:'PUBG Mobile',                l:'https://play.google.com/store/apps/details?id=com.tencent.ig', kw:['pubg mobile'] },
  { n:'COD Mobile',                 l:'https://play.google.com/store/apps/details?id=com.activision.callofduty.shooter', kw:['cod mobile','codm','call of duty mobile'] },
  { n:'Mobile Legends',             l:'https://play.google.com/store/apps/details?id=com.mobile.legends', kw:['mobile legends','mlbb'] },
  { n:'Free Fire',                  l:'https://play.google.com/store/apps/details?id=com.dts.freefireth', kw:['free fire','freefire','garena free fire'] },
  { n:'Genshin Impact',             l:'https://genshin.hoyoverse.com/en/download',   kw:['genshin impact','genshin'] },
];

function clientDetectGame(title, description) {
  if (!title) return null;
  // palabras o frases completas: "apex legends" no salta con "APEX GP" ni "re4" dentro de otra palabra
  var norm = function (t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9':]+/g, ' ').trim(); };
  var text = ' ' + norm(title) + ' ' + norm(description) + ' ';
  for (var i = 0; i < _GAMESDB.length; i++) {
    var g = _GAMESDB[i];
    for (var j = 0; j < g.kw.length; j++) {
      if (text.indexOf(' ' + norm(g.kw[j]) + ' ') !== -1) {
        return { gameName: g.n, purchaseLink: g.l };
      }
    }
  }
  return null;
}

function showBuyModal(itemId, gameName, purchaseLink) {
  var existing = document.getElementById('buy-modal-overlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'buy-modal-overlay';

  var storeName = 'Tienda Oficial';
  if (purchaseLink.indexOf('steampowered.com') !== -1) storeName = 'Steam';
  else if (purchaseLink.indexOf('epicgames.com') !== -1) storeName = 'Epic Games';
  else if (purchaseLink.indexOf('rockstargames.com') !== -1) storeName = 'Rockstar Games';
  else if (purchaseLink.indexOf('play.google.com') !== -1) storeName = 'Google Play';
  else if (purchaseLink.indexOf('playstation.com') !== -1) storeName = 'PlayStation Store';
  else if (purchaseLink.indexOf('xbox.com') !== -1) storeName = 'Xbox Store';
  else if (purchaseLink.indexOf('minecraft.net') !== -1) storeName = 'Minecraft.net';

  overlay.innerHTML =
    '<div class="buy-modal">' +
      '<button class="buy-modal-close" onclick="document.getElementById(\'buy-modal-overlay\').remove()">' +
        '<ion-icon name="close"></ion-icon>' +
      '</button>' +
      '<div class="buy-modal-header">' +
        '<div class="buy-modal-icon">🎮</div>' +
        '<h2 class="buy-modal-title">' + gameName + '</h2>' +
        '<p class="buy-modal-sub">Disponible en <strong>' + storeName + '</strong></p>' +
      '</div>' +
      '<div class="buy-modal-benefits">' +
        '<div class="buy-modal-benefit"><ion-icon name="shield-checkmark"></ion-icon> Version 100% original y segura</div>' +
        '<div class="buy-modal-benefit"><ion-icon name="headset"></ion-icon> Soporte oficial del desarrollador</div>' +
        '<div class="buy-modal-benefit"><ion-icon name="refresh-circle"></ion-icon> Actualizaciones garantizadas</div>' +
        '<div class="buy-modal-benefit"><ion-icon name="heart"></ion-icon> Apoya a los creadores del juego</div>' +
      '</div>' +
      '<div class="buy-modal-actions">' +
        '<button class="buy-modal-btn-cancel" onclick="document.getElementById(\'buy-modal-overlay\').remove()">Cancelar</button>' +
        '<button class="buy-modal-btn-go" onclick="window.open(\'' + purchaseLink + '\',\'_blank\');document.getElementById(\'buy-modal-overlay\').remove();">' +
          '<ion-icon name="cart"></ion-icon> Ir a ' + storeName +
        '</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
}

// ═══════════════════════════════════════════════════════════
// PAGOS TAB — historial de retiros del creador
// ═══════════════════════════════════════════════════════════
let _pagosLoaded = false;
async function pfLoadHistorialPagos() {
  if(_pagosLoaded) return;
  _pagosLoaded = true;
  const el = document.getElementById('pf-pagos-content');
  if(!el) return;
  const token = LS.get('token');
  if(!token) { el.innerHTML = '<div class="pf-empty"><ion-icon name="lock-closed"></ion-icon><p>Inicia sesión para ver tus retiros</p></div>'; return; }
  try {
    const r = await fetch(`${PF_API}/economia/historial-pagos`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    if(!d.success || !d.historial.length) {
      el.innerHTML = '<div class="pf-empty"><ion-icon name="cash-outline"></ion-icon><p>Aún no tienes solicitudes de retiro</p></div>';
      return;
    }
    const colorEstado = { completado:'#32D583', pendiente:'#ffd23f', rechazado:'#ff4d6d', procesado:'#5AC8FA' };
    el.innerHTML = `
      <div style="display:grid;gap:10px;padding:4px 0">
        ${d.historial.map(p => `
          <div style="background:#1a1a28;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-weight:700;font-size:16px;color:#f0f0f8">$${parseFloat(p.monto).toFixed(2)} <span style="font-size:11px;color:#60607a">USD</span></div>
              <div style="font-size:11px;color:#60607a;margin-top:3px">${new Date(p.fecha).toLocaleDateString('es-ES',{year:'numeric',month:'short',day:'numeric'})}</div>
              ${(p.resumen || p.paypalEmail) ? `<div style="font-size:11px;color:#60607a">→ ${escH(p.resumen || p.paypalEmail)}</div>` : ''}
              ${p.referencia ? `<div style="font-size:11px;color:#32D583">Comprobante: ${escH(p.referencia)}</div>` : ''}
              ${p.notas ? `<div style="font-size:11px;color:#a0a0b8;margin-top:4px">${escH(p.notas)}</div>` : ''}
            </div>
            <span style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;background:rgba(0,0,0,.3);color:${colorEstado[p.estado]||'#aaa'};border:1px solid ${colorEstado[p.estado]||'#aaa'}">${(p.estado||'').toUpperCase()}</span>
          </div>`).join('')}
      </div>`;
  } catch(e) {
    el.innerHTML = '<div class="pf-empty"><ion-icon name="warning"></ion-icon><p>Error al cargar historial</p></div>';
    _pagosLoaded = false;
  }
}

// ═══════════════════════════════════════════════════════════
// LOGROS TAB — gamificación (XP, badges, level)
// ═══════════════════════════════════════════════════════════
let _logrosLoaded = false;
async function pfLoadLogros() {
  if(_logrosLoaded) return;
  _logrosLoaded = true;
  const el = document.getElementById('pf-logros-content');
  if(!el) return;
  const token = LS.get('token');
  const user  = LS.get('user_admin');
  if(!token || !user) { el.innerHTML = '<div class="pf-empty"><ion-icon name="lock-closed"></ion-icon><p>Inicia sesión para ver tus logros</p></div>'; return; }
  try {
    const r = await fetch(`${PF_API}/gamification/profile/${encodeURIComponent(user)}`, { headers: { Authorization: `Bearer ${token}` } });
    if(!r.ok) throw new Error('no-data');
    const d = await r.json();
    const g = d.gamification || d;
    const xp = g.xp || 0;
    const nivel = g.nivel || 1;
    const xpNext = nivel * 500;
    const pct = Math.min(100, Math.round((xp % xpNext) / xpNext * 100));
    const badges = g.badges || [];
    el.innerHTML = `
      <div style="display:grid;gap:16px;padding:4px 0">
        <div style="background:linear-gradient(135deg,#1a1a28,#0f0f18);border:1px solid rgba(50,213,131,.2);border-radius:14px;padding:20px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <div>
              <div style="font-size:11px;color:#60607a;letter-spacing:.1em">NIVEL</div>
              <div style="font-size:32px;font-weight:900;color:#32D583">${nivel}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:11px;color:#60607a">XP TOTAL</div>
              <div style="font-size:20px;font-weight:700;color:#f0f0f8">${xp.toLocaleString()}</div>
            </div>
          </div>
          <div style="background:rgba(255,255,255,.06);border-radius:8px;height:8px;overflow:hidden">
            <div style="background:linear-gradient(90deg,#32D583,#5AC8FA);height:100%;width:${pct}%;border-radius:8px;transition:width .5s"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11px;color:#60607a">
            <span>${xp % xpNext} XP</span><span>${xpNext} XP para nivel ${nivel+1}</span>
          </div>
        </div>
        ${g.racha > 0 ? `
        <div class="pf-info-box" style="border-color:rgba(255,210,63,.3)">
          <ion-icon name="flame" style="color:#ffd23f;font-size:28px"></ion-icon>
          <div><h4 style="color:#ffd23f">Racha: ${g.racha} días</h4><p>¡Sigue así! Cada día de actividad suma XP extra.</p></div>
        </div>` : ''}
        ${badges.length > 0 ? `
        <div class="pf-section-title"><ion-icon name="medal"></ion-icon> BADGES DESBLOQUEADOS (${badges.length})</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:10px">
          ${badges.map(b => `
            <div style="background:#1a1a28;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:12px 8px;text-align:center" title="${b.descripcion||b.id}">
              <div style="font-size:26px">${b.emoji||'🏅'}</div>
              <div style="font-size:10px;color:#a0a0b8;margin-top:4px;word-break:break-word">${b.nombre||b.id}</div>
            </div>`).join('')}
        </div>` : '<div class="pf-empty"><ion-icon name="medal-outline"></ion-icon><p>Aún no tienes badges. ¡Sube contenido y participa!</p></div>'}
      </div>`;
  } catch(e) {
    el.innerHTML = '<div class="pf-empty"><ion-icon name="trophy-outline"></ion-icon><p>Logros no disponibles aún.</p></div>';
    _logrosLoaded = false;
  }
}

// ═══════════════════════════════════════════════════════════
// SEARCH AUTOCOMPLETE
// ═══════════════════════════════════════════════════════════
(function initAutocomplete() {
  const input = document.getElementById('buscador');
  const drop  = document.getElementById('autocomplete-dropdown');
  if(!input || !drop) return;

  let _acTimer = null;

  function closeDropdown() { drop.style.display = 'none'; drop.innerHTML = ''; }

  input.addEventListener('input', function() {
    const q = this.value.trim();
    clearTimeout(_acTimer);
    if(q.length < 2) { closeDropdown(); return; }
    _acTimer = setTimeout(async () => {
      try {
        const r = await fetch(`${API_URL}/search/autocomplete?q=${encodeURIComponent(q)}&limit=6`);
        if(!r.ok) return;
        const d = await r.json();
        const sugs = d.suggestions || d.results || d.items || [];
        if(!sugs.length) { closeDropdown(); return; }
        // Construido con DOM: los títulos vienen de usuarios (antes se insertaban como HTML → XSS)
        drop.replaceChildren(...sugs.map(s => {
          const titulo = String((s && s.title) || s || '');
          const row = document.createElement('div');
          row.className = 'ac-item';
          row.style.cssText = 'padding:10px 16px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(255,255,255,.05);transition:background .15s';
          row.onmouseover = () => { row.style.background = 'rgba(50,213,131,.07)'; };
          row.onmouseout  = () => { row.style.background = ''; };
          row.onclick = () => {
            const b = document.getElementById('buscador');
            b.value = titulo; b.dispatchEvent(new Event('input'));
            drop.style.display = 'none';
          };
          const img = s && /^https:\/\//i.test(s.image || '') ? Object.assign(document.createElement('img'), { src: s.image, onerror() { this.style.display = 'none'; } }) : null;
          if (img) img.style.cssText = 'width:32px;height:32px;border-radius:6px;object-fit:cover';
          const ico = img || Object.assign(document.createElement('ion-icon'), { name: 'search-outline' });
          if (!img) ico.style.cssText = 'color:#60607a;font-size:18px';
          const txt = document.createElement('div');
          const t = document.createElement('div'); t.style.cssText = 'font-size:13px;color:#f0f0f8'; t.textContent = titulo;
          txt.appendChild(t);
          if (s && s.category) { const c = document.createElement('div'); c.style.cssText = 'font-size:10px;color:#60607a'; c.textContent = s.category; txt.appendChild(c); }
          row.append(ico, txt);
          return row;
        }));
        drop.style.display = 'block';
      } catch(_) {}
    }, 250);
  });

  document.addEventListener('click', function(e) {
    if(!drop.contains(e.target) && e.target !== input) closeDropdown();
  });

  input.addEventListener('keydown', function(e) {
    if(e.key === 'Escape') closeDropdown();
  });
})();


// ── Live: punto rojo en el header si hay alguien transmitiendo ──
(function ugLiveDot() {
  const dot = document.getElementById('hdr-live-dot');
  if (!dot) return;
  const revisar = () => {
    if (document.hidden) return;
    const tk = LS.get('token');
    fetch(`${API_URL}/live/activos`, tk ? { headers: { Authorization: `Bearer ${tk}` } } : {}).then(r => r.ok ? r.json() : null).then(d => {
      const n = d?.lives?.length || 0;
      ugPintarVivos(d?.lives || []);
      dot.hidden = !n;
      const orbLive = document.getElementById('hdr-orb-live'); if (orbLive) orbLive.hidden = !n;   // punto rojo también en el orbe
      dot.closest('button')?.setAttribute('aria-label', n ? `Transmisiones en vivo · ${n} en vivo ahora` : 'Transmisiones en vivo');
    }).catch(() => {});
  };
  setTimeout(revisar, 2500);
  setInterval(revisar, 60000);
})();
// Franja "En vivo ahora" en Explorar: los que sigues primero, después por puntaje del servidor
function ugPintarVivos(lives) {
  const box = document.getElementById('ug-vivos'); if (!box) return;
  const l = [...lives].sort((a, b) => (b.sigo - a.sigo) || (b.puntaje - a.puntaje)).slice(0, 12);
  box.hidden = !l.length; if (!l.length) { box.innerHTML = ''; return; }
  const av = x => /^https:\/\//.test(x.avatar || '') ? `style="background-image:url('${ugEsc(x.avatar)}')"` : '';
  box.innerHTML = `<div class="ug-vivos-h"><b>En vivo ahora · ${l.length}</b><a href="./live.html">Ver todos →</a></div>
    <div class="ug-vivos-l">${l.map(x => `<a class="ug-vivo${x.sigo ? ' sigo' : ''}" href="./live.html?u=${encodeURIComponent(x.creador)}">
      ${x.promocionado ? '<i>🚀</i>' : ''}<span class="av" ${av(x)}>${x.avatar ? '' : ugEsc(String(x.creador).slice(0, 1).toUpperCase())}</span>
      <b>@${ugEsc(x.creador)}</b><small>${x.sigo ? '💚 Lo sigues · ' : ''}👁 ${pfFmt(x.espectadores || 0)} · ${ugEsc(x.titulo || '')}</small></a>`).join('')}</div>`;
}


// ── Economía: tienda de UpCoins con tarjeta o PayPal (carga el procesador solo al abrirla) ──
let _ugPagosJs = null;
const ugPagosListo = () => (_ugPagosJs = _ugPagosJs || new Promise((ok, ko) => {
  if (window.UGPagos) return ok();
  const s = document.createElement('script');
  s.src = './upgames-pagos.js?v=20261108b'; s.onload = ok; s.onerror = () => { _ugPagosJs = null; ko(); };
  document.head.appendChild(s);
}));
function ecoAbrirTienda() {
  window.ecoSec?.('cobros');   // la tienda vive en la sección Cobros
  const box = document.getElementById('eco-tienda');
  if (!box) return;
  if (!LS.get('token')) { ugPedirSesion('conseguir UpCoins'); return; }
  box.innerHTML = '<div class="eco-spin"><ion-icon name="sync-outline"></ion-icon></div>';
  ugPagosListo().then(() => window.UGPagos.tienda(box, {
    alComprar: () => { pfLoadEconomia(); ugContadorUC(); },
  })).catch(() => { box.innerHTML = '<button type="button" class="eco-pay-open" onclick="ecoAbrirTienda()">Reintentar</button>'; });
}


// ── Verificación de email: aviso con reenvío (solo a quien aún no verificó) ──
(function ugVerif() {
  const box = document.getElementById('ug-verif');
  const token = LS.get('token');
  if (!box || !token) return;
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const forzado = new URLSearchParams(location.search).get('verificar') === '1';
  let oculto = false; try { oculto = Date.now() - (+localStorage.getItem('ug_verif_oculto') || 0) < 864e5; } catch (_) {}
  function mostrar(email) {
    if (email) document.getElementById('ug-verif-sub').textContent = `Te enviaremos un enlace a ${email} para proteger tu cuenta y desbloquear los retiros.`;
    box.hidden = false;
    if (forzado) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  window.ugVerifMostrar = () => fetch(`${API_URL}/auth/email-estado`, { headers: H }).then(r => r.json()).then(d => { if (d.success && !d.verificado) mostrar(d.email); else if (d.verificado && forzado) toast('✅ Tu email ya está verificado'); }).catch(() => {});   // el aviso solo si vino a verificar
  if (!oculto || forzado) setTimeout(window.ugVerifMostrar, 1800);
  document.getElementById('ug-verif-x').onclick = () => { box.hidden = true; try { localStorage.setItem('ug_verif_oculto', String(Date.now())); } catch (_) {} };
  document.getElementById('ug-verif-btn').onclick = async e => {
    const b = e.currentTarget; b.disabled = true; b.textContent = 'Enviando…';
    try {
      const d = await fetch(`${API_URL}/auth/email-reenviar`, { method: 'POST', headers: H }).then(r => r.json());
      if (d.yaVerificado) { box.hidden = true; toast('✅ Tu email ya estaba verificado'); return; }
      if (!d.success) throw new Error(d.error);
      box.classList.add('ok');
      document.getElementById('ug-verif-sub').textContent = `Listo: revisa ${d.email} (también la carpeta de spam) y toca el enlace.`;
      b.textContent = 'Enviado ✓';
      setTimeout(() => { b.disabled = false; b.textContent = 'Reenviar'; }, 120000);
    } catch (err) { toast(err.message || 'No se pudo enviar el correo'); b.disabled = false; b.textContent = 'Reintentar'; }
  };
  // Volver de verificar: avisar y ocultar
  if (new URLSearchParams(location.search).get('verif') === 'ok') { toast('✅ ¡Email verificado!'); box.hidden = true; }
})();


// ── Mi Premium (ver, renovar, cambiar, recordatorio, historial) ──
const ECO_METODO = { tarjeta_mp: 'Tarjeta', paypal: 'PayPal', saldo: 'UpCoins', monedas: 'UpCoins', upcoins: 'UpCoins', '': '—' };
async function ecoCargarPlan(desplazar) {
  const box = document.getElementById('eco-plan');
  if (!box || !LS.get('token')) return;
  try {
    await ugPagosListo();
    const d = await window.UGPagos.api('/tienda/mi-plan');
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fecha = f => new Date(f).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
    const p = d.plan;
    try { p ? localStorage.setItem('ug_pase_hasta', localStorage.getItem('user_admin') + '|' + (+new Date(p.hasta))) : localStorage.removeItem('ug_pase_hasta'); } catch (_) {}   // la página puente no carga anuncios con pase
    const concepto = h => h.tipo === 'plan' ? (d.planes.find(x => x.id === h.planId)?.nombre || 'Premium') : h.tipo === 'acceso' ? 'Acceso directo a un enlace'
      : /^ia:/.test(h.planId || '') ? 'Mensajes de NEXUS IA' : /^impulso:/.test(h.planId || '') ? 'Publicación destacada' : `${h.monedas} UpCoins`;
    const monto = h => ['monedas', 'saldo', 'upcoins'].includes(h.metodo) ? `🪙 ${h.monedas || Math.round((h.usd || 0) / 0.02)} UC` : `US$${(h.usd || 0).toFixed(2)}`;
    box.innerHTML = `
      <div class="eco-plan-h">
        <div class="eco-plan-ic">⭐</div>
        <div><b>${p ? esc(p.nombre) : 'No eres Premium'}</b><small>${p ? `Vence el ${fecha(p.hasta)} · ${p.diasRestantes} día${p.diasRestantes === 1 ? '' : 's'}` : (d.vencido ? `Tu ${esc(d.vencido.nombre || 'Premium')} venció el ${fecha(d.vencido.hasta)}` : 'Sin anuncios, NEXUS ilimitado y más visibilidad para tus publicaciones')}</small></div>
        <span class="eco-plan-estado ${p ? 'on' : 'off'}">${p ? 'ACTIVO' : 'INACTIVO'}</span>
      </div>
      ${p ? `<div class="eco-plan-bar"><i style="width:${Math.max(4, Math.min(100, p.diasRestantes / p.dias * 100))}%"></i></div>` : ''}
      ${`<ul class="eco-plan-ventajas">${(d.beneficios || []).map(x => `<li>✓ ${esc(x)}</li>`).join('')}<li>💚 Los creadores siguen cobrando por cada descarga</li></ul>`}
      <div class="eco-plan-acc">
        ${p ? `<button class="p" data-a="renovar">Renovar (+${p.dias} días)</button><button class="s" data-a="cambiar">Cambiar de plan</button>` : `<button class="p" data-a="cambiar">${d.vencido ? 'Renovar Premium' : 'Hazte Premium'}</button>`}
      </div>
      <div id="eco-plan-pago"></div>
      ${p ? `<div class="eco-plan-stats"><div><b>${d.descargasConPase30d}</b><small>Enlaces abiertos con Premium (30 días)</small></div><div><b>${d.accesosComprados}</b><small>Accesos directos comprados</small></div></div>` : ''}
      <label class="eco-plan-row"><span>Avisarme 2 días antes de que venza</span><input type="checkbox" id="eco-plan-rec" ${d.recordatorio ? 'checked' : ''}></label>
      <p class="eco-plan-nota">🔁 <b>Sin cobros automáticos:</b> nunca te cobramos sin que lo pidas. Renovar o cambiar de plan suma los días al vencimiento actual; si no renuevas, Premium simplemente vence y vuelves al modo gratuito.</p>
      ${d.historial.length ? `<details class="eco-plan-hist"><summary>Historial de compras (${d.historial.length})</summary><ul>${d.historial.map(h => `<li class="${h.estado === 'revertida' ? 'rev' : ''}"><span>${fecha(h.fecha)} · ${esc(concepto(h))} · ${esc(ECO_METODO[h.metodo] || h.metodo || '—')}</span><span>${monto(h)}</span></li>`).join('')}</ul></details>` : ''}`;
    const pago = document.getElementById('eco-plan-pago');
    const alComprar = () => { ecoCargarPlan(); pfLoadEconomia(); ugContadorUC(); };
    box.querySelectorAll('[data-a]').forEach(b => b.onclick = () => {
      box.querySelectorAll('[data-a]').forEach(x => x.classList.toggle('s', x !== b));
      if (b.dataset.a === 'renovar') window.UGPagos.pagar(pago, { producto: `plan:${p.id}`, estado: d, alExito: alComprar });
      else window.UGPagos.planes(pago, { estado: d, alComprar });
      pago.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    document.getElementById('eco-plan-rec').onchange = e => window.UGPagos.api('/tienda/mi-plan/recordatorio', { method: 'PUT', body: { activo: e.target.checked } })
      .then(() => toast(e.target.checked ? 'Te avisaremos antes de que venza' : 'Recordatorio desactivado')).catch(() => toast('No se pudo guardar'));
    if (desplazar) { window.ecoSec?.('cobros'); setTimeout(() => box.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); }   // Mi Premium vive en Cobros
  } catch (e) {
    box.innerHTML = '<p style="font-size:.82rem;color:#A3A8B6;text-align:center">No se pudo cargar tu plan. <a href="#" onclick="ecoCargarPlan();return false" style="color:#5AC8FA">Reintentar</a></p>';
  }
}
// Enlace directo a Mi plan: biblioteca.html?plan=1 (desde el puente o el aviso de vencimiento)
if (new URLSearchParams(location.search).get('plan') === '1') {
  setTimeout(() => { try { switchTab('economia'); } catch (_) {} setTimeout(() => ecoCargarPlan(true), 600); }, 1500);
}

// ── ?q=búsqueda (buscador de Google y enlaces compartidos) ──
(function buscarDesdeURL() {
  const q = (new URLSearchParams(location.search).get('q') || '').slice(0, 80);
  if (!q) return;
  const go = () => { const i = document.getElementById('buscador'); if (!i) return; i.value = q; i.dispatchEvent(new Event('input', { bubbles: true })); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(go, 800)); else setTimeout(go, 800);
})();


/* ═══════════════════════════════════════════════════════════
   ECONOMÍA — submenú por secciones + estadísticas reales
═══════════════════════════════════════════════════════════ */
const _ecoDiasStats = () => (_ecoPeriodDays === 7 ? 7 : _ecoPeriodDays === 30 ? 30 : 90);   // se guardan hasta 90 días por publicación

function _ecoMias() {
  const yo = LS.get('user_admin', '');
  const cat = (typeof todosLosItems !== 'undefined' ? todosLosItems : []).filter(i => i.usuario === yo);
  if (!_ecoStats) return cat;
  const rep = Object.fromEntries(cat.map(i => [i._id, i.reportes || 0]));
  return _ecoStats.publicaciones.map(p => ({ _id: p.id, title: p.title, category: p.category, image: p.image, status: p.status, descargasEfectivas: p.totalDescargas, reportes: rep[p.id] || 0 }));
}

async function ecoCargarStats(forzar) {
  const dias = _ecoDiasStats(), tok = LS.get('token');
  if (!tok || _ecoStatsCargando) return;
  if (!forzar && _ecoStats && _ecoStatsDias === dias && Date.now() - _ecoStatsT < 60000) return;
  _ecoStatsCargando = true;
  try {
    const r = await fetch(`${API_URL}/economia/mis-estadisticas?dias=${dias}`, { headers: { Authorization: `Bearer ${tok}` } });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.success) {
      _ecoStats = d; _ecoStatsT = Date.now(); _ecoStatsDias = dias;
      if (_ecoLastData) ecoUpdateDashboard(_ecoLastData);
      ecoRenderPubStats();
    }
  } catch (_) {} finally { _ecoStatsCargando = false; }
}

function ecoSec(nombre) {
  const nav = document.getElementById('eco-subnav'); if (!nav) return;
  if (!nav.querySelector(`[data-sec="${nombre}"]`)) nombre = 'resumen';
  nav.querySelectorAll('button').forEach(b => { const on = b.dataset.sec === nombre; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
  document.querySelectorAll('#economia-view .eco-sec').forEach(x => x.classList.toggle('active', x.dataset.sec === nombre));
  try { localStorage.setItem('ug_eco_sec', nombre); } catch (_) {}
  if (nombre === 'resumen' && _ecoLastData) setTimeout(() => ecoDrawChart(0, _ecoPeriodDays), 30);   // el canvas oculto mide 0 de ancho
  if (nombre === 'publicaciones') ecoRenderPubStats();
}
window.ecoSec = ecoSec;
document.getElementById('eco-subnav')?.addEventListener('click', e => {
  const b = e.target.closest('button[data-sec]'); if (!b) return;
  ecoSec(b.dataset.sec);
  const nav = document.getElementById('eco-subnav'), top = nav.getBoundingClientRect().top;
  if (top < 0 || top > innerHeight * .6) nav.scrollIntoView({ block: 'start', behavior: 'smooth' });
});
try { const q = new URLSearchParams(location.search).get('eco'), g = q || localStorage.getItem('ug_eco_sec'); if (g) ecoSec(g); } catch (_) {}   // ?eco=cobros abre directo esa sección
// El anillo "Meta retiro" lleva a Cobros (donde se pide el retiro)
document.querySelector('#economia-view .eco-hero-right')?.addEventListener('click', () => { ecoSec('cobros'); document.getElementById('pf-btn-solicitar-pago')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); });

function ecoAbrir(id) {
  const it = (typeof todosLosItems !== 'undefined' ? todosLosItems : []).find(x => x._id === id);
  if (it && typeof window.openDetail === 'function') window.openDetail(it);
}

function ecoPintarRetencion(uc, r) {
  const box = document.getElementById('eco-hero-extra'); if (!box) return;
  let info = document.getElementById('eco-ret-info');
  if (!uc) { info?.remove(); return; }
  if (!info) { info = document.createElement('div'); info.id = 'eco-ret-info'; info.className = 'eco-ret-info'; box.after(info); }
  const nombres = { regalo: 'regalos en lives', superchat: 'Super Chat', apoyo: 'apoyos', acceso: 'accesos directos y Premium' };
  const de = Object.entries(r?.origen || {}).filter(([, v]) => v > 0).map(([k, v]) => `${nombres[k] || k} ${v.toLocaleString('es-CO', { maximumFractionDigits: 2 })}`).join(' · ');
  const cuando = r?.proxima ? new Date(r.proxima).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  info.innerHTML = `<details><summary>🔒 Pasan solos a retirables en ${r?.dias || 7} días${cuando ? ` · próxima: <b>${ugEsc(cuando)}</b>` : ''} <span style="opacity:.6">ⓘ</span></summary>
    <div style="margin-top:4px">Lo que ganas con ${de ? ugEsc(de) : 'regalos, Super Chat, apoyos y accesos'} (UC) espera ${r?.dias || 7} días por seguridad, por si un pago se devuelve. No tienes que hacer nada.${cuando ? ` El próximo ingreso (${(r.proximaUC || 0).toLocaleString('es-CO', { maximumFractionDigits: 2 })} UC) se libera el ${ugEsc(cuando)}.` : ''}</div></details>`;
}

function ecoRenderPubStats() {
  const el = document.getElementById('eco-pubstats'); if (!el) return;
  const badge = document.getElementById('eco-pub-rango');
  if (!_ecoStats) { if (!LS.get('token')) el.innerHTML = '<div class="eco-ps-vacio">Inicia sesión para ver tus estadísticas</div>'; return; }
  if (badge) badge.textContent = `${_ecoStats.dias} días`;
  const reps = Object.fromEntries(_ecoMias().map(i => [i._id, i.reportes || 0]));
  const ps = _ecoStats.publicaciones.map(p => ({ ...p, reportes: reps[p.id] || 0 }));
  if (!ps.length) { el.innerHTML = '<div class="eco-ps-vacio">Publica tu primer contenido y aquí verás sus vistas, descargas, apoyos y ganancias día a día.</div>'; return; }
  const clave = { descargas: 'descargas', vistas: 'vistas', ganancias: 'gananciaUsd', apoyos: 'apoyos' }[_ecoPsOrden];
  const orden = [...ps].sort((a, b) => (b[clave] - a[clave]) || (b.totalDescargas - a.totalDescargas));
  const t = _ecoStats.totales, f = n => pfFmt(Math.round(n || 0)), uc = usd => (usd / 0.02).toLocaleString('es-CO', { maximumFractionDigits: usd < 0.2 ? 2 : 0 });
  const estado = { pendiente: ' · ⏳ en revisión', rechazado: ' · rechazada' };
  el.innerHTML = `
    <div class="eco-ps-m" style="padding:0 14px 10px">
      <div><b>${f(t.vistas)}</b><small>Vistas</small></div><div><b>${f(t.descargas)}</b><small>Descargas</small></div>
      <div><b>${f(t.apoyos)}</b><small>Apoyos</small></div><div class="gan"><b>${uc(t.gananciaUsd)}</b><small>UC ganados</small></div>
    </div>
    <div class="eco-ps-ord">${[['descargas', 'Más descargadas'], ['vistas', 'Más vistas'], ['ganancias', 'Más ganancias'], ['apoyos', 'Más apoyadas']].map(([k, l]) => `<button type="button" data-o="${k}" class="${k === _ecoPsOrden ? 'active' : ''}">${l}</button>`).join('')}</div>
    <div class="eco-ps-list">${orden.slice(0, 50).map(p => {
      const mx = Math.max(...p.serie, 1), conv = p.vistas ? Math.round(p.descargas / p.vistas * 100) : null;
      return `<div class="eco-ps" data-id="${ugEsc(p.id)}">
        ${p.image ? `<img src="${ugEsc(p.image)}" alt="" loading="lazy" onerror="this.outerHTML='<span class=&quot;eco-ps-ph&quot;>📦</span>'">` : '<span class="eco-ps-ph">📦</span>'}
        <div style="min-width:0"><div class="eco-ps-t">${ugEsc(p.title || 'Sin título')}</div>
          <div class="eco-ps-c">${ugEsc(catLabel(p.category))} · ${f(p.totalDescargas)} descargas en total${conv !== null ? ` · ${conv}% de las vistas descargan` : ''}${estado[p.status] || ''}${p.reportes ? ` · <span style="color:#ff6b6b">⚠ ${p.reportes} reporte(s)</span>` : ''}</div></div>
        <div class="eco-ps-m" style="grid-column:1/-1">
          <div><b>${f(p.vistas)}</b><small>Vistas</small></div><div><b>${f(p.descargas)}</b><small>Descargas</small></div>
          <div><b>${f(p.apoyos)}</b><small>Apoyos</small></div><div class="gan"><b>${uc(p.gananciaUsd)}</b><small>UC</small></div>
        </div>
        <div class="eco-ps-spark" title="Descargas por día"${p.serie.some(Boolean) ? '' : ' hidden'}>${p.serie.slice(-30).map(n => `<i style="height:${Math.max(6, n / mx * 100)}%;${n ? '' : 'opacity:.18'}"></i>`).join('')}</div>
      </div>`; }).join('')}</div>
    <p class="eco-ps-vacio" style="padding-top:0">Las vistas y descargas se cuentan una vez por persona al día. Las ganancias incluyen lo que aún está en retención.</p>`;
  el.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { _ecoPsOrden = b.dataset.o; ecoRenderPubStats(); });
  el.querySelectorAll('.eco-ps').forEach(x => x.onclick = () => ecoAbrir(x.dataset.id));
}


// ── Referidos: enlace de invitación ?ref=usuario (se recuerda 30 días para el registro) ──
(function ugRef() {
  try {
    const ref = (new URLSearchParams(location.search).get('ref') || '').replace(/[^\w.-]/g, '').slice(0, 40);
    if (!ref) return;
    localStorage.setItem('ug_ref', JSON.stringify({ c: ref, t: Date.now() }));
    if (window.UG_INVITADO) setTimeout(() => toast(`🎁 @${ref} te invitó: crea tu cuenta gratis y recibe UpCoins de bienvenida`, 5000), 2500);
  } catch (_) {}
})();

