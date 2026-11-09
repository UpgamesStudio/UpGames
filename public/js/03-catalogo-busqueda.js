// ── LOAD DATA ─────────────────────────────────────────────
// Helper: fetch con timeout configurable
function fetchTimeout(url, ms=10000, opts={}) {
  const ctrl = new AbortController();
  const tid = setTimeout(()=>ctrl.abort(), ms);
  return fetch(url, {...opts, signal:ctrl.signal})
    .finally(()=>clearTimeout(tid));
}

async function loadContent() {
  // ── PASO 1: Caché instantáneo — mostrar ANTES de red ──
  const cachedUsers = cacheGet(CACHE_KEY_USERS);
  if(Array.isArray(cachedUsers)) {   // (una respuesta de error guardada antes no rompe la carga)
    cachedUsers.forEach(u=>{ mapaUsuarios[u.usuario]=u.verificadoNivel||0; });
  }

  // Nexus ordena el catálogo para este usuario (public/upgames-ranking.js vía upgames-ux.js)
  const nexusOrdena = l => (window.UGUX?.ordenar ? window.UGUX.ordenar(l) : l);
  const cachedItems = cacheGet(CACHE_KEY_ITEMS);
  if(cachedItems && cachedItems.length) {
    todosLosItems = nexusOrdena(cachedItems);
    // ← FIX: nunca mostrar videos en "Todos" — filtrar igual que la red
    filteredItems = activeCategory
      ? todosLosItems.filter(i=>i.category===activeCategory)
      : todosLosItems.filter(i=>i.category!=='Video');
    // Mostrar caché y cerrar preloader de inmediato — no esperar la red
    render(filteredItems);
    window.closePreloader && window.closePreloader();
  }

  // ── PASO 3: Actualizar desde la red en background ──
  try {
    // Catálogo y usuarios EN PARALELO (antes uno esperaba al otro: ~1 RTT + consulta de más)
    const pUsers = fetchTimeout(`${API_URL}/auth/users/public`, 8000).then(ru => ru.json()).then(users => {
      if (!Array.isArray(users)) return;   // solo se guarda una lista válida, nunca un error del servidor
      cacheSet(CACHE_KEY_USERS, users);
      users.forEach(u=>{ mapaUsuarios[u.usuario]=u.verificadoNivel||0; });
    }).catch(()=>{});
    const r = await fetchTimeout(`${API_URL}/items`, 12000);
    const data = await r.json();
    if (!Array.isArray(data)) throw new Error('catálogo no disponible');   // un error del servidor no debe reemplazar el catálogo
    await pUsers;   // las insignias de verificado necesitan el mapa antes de pintar
    cacheSet(CACHE_KEY_ITEMS, data);

    const ordenados = nexusOrdena(data);
    const changed = ordenados.length !== todosLosItems.length ||
      ordenados.some((it,i) => !todosLosItems[i] || it._id !== todosLosItems[i]._id || it.descargasEfectivas !== todosLosItems[i].descargasEfectivas || it.likesCount !== todosLosItems[i].likesCount);
    todosLosItems = ordenados;
    filteredItems = activeCategory
      ? ordenados.filter(i=>i.category===activeCategory)
      : ordenados.filter(i=>i.category!=='Video');

    window.closePreloader && window.closePreloader();
    if(changed || !cachedItems) render(filteredItems);

    // Deep link
    const sid = new URLSearchParams(window.location.search).get('id');
    if(sid && /^[a-f\d]{24}$/i.test(sid)) {
      setTimeout(async ()=>{
        let item = todosLosItems.find(i=>i._id===sid);
        // Enlaces de Google o compartidos: la publicación puede no estar en la primera página
        if(!item) { try { const r = await fetch(`${API_URL}/items/${sid}`); if(r.ok) { const d = await r.json(); item = d && d._id ? d : (d.item || null); } } catch(_) {} }
        if(item) openDetail(item);
      }, 600);
    }

  } catch(e) {
    console.error(e);
    window.closePreloader && window.closePreloader();
    // Si no hay caché tampoco, mostrar error
    if(!cachedItems || !cachedItems.length) {
      const out = document.getElementById('output');
      const skel = document.getElementById('skeleton');
      if(skel) skel.remove();
      out.innerHTML=`<div class="empty-state">
        <ion-icon name="cloud-offline-outline"></ion-icon>
        <h3>Sin conexión</h3>
        <p>No se pudo conectar con el servidor.<br>El servidor puede estar despertando (30s).<br>Verifica tu internet e intenta de nuevo.</p>
        <button class="empty-action" onclick="location.reload()">🔄 Reintentar</button>
      </div>`;
    }
  }
}

// ── CACHE INVALIDATION ───────────────────────────────────
// Llamar esto cuando el usuario sube, edita o elimina contenido
function invalidateCache() {
  try {
    LS.remove(CACHE_KEY_ITEMS);
  } catch(_) {}
}

// ── SEARCH (con debounce 280ms para no filtrar en cada keystroke) ──────────
let _searchTimer = null;
document.getElementById('buscador').addEventListener('input', function(e) {
  if (this.value.trim().length >= 3) window.dispatchEvent(new CustomEvent('ug:guia', { detail: 'explorar' }));
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(() => {
    const q = e.target.value.toLowerCase().trim();
    // Nexus ya respondió a esta misma frase (upgames-nexus-plus.js): no pisar sus resultados
    if (q && window.UG_NEXUS_Q === q) return;
    if(q) {
      const res = todosLosItems.filter(i=>
        i.title.toLowerCase().includes(q) ||
        (i.description&&i.description.toLowerCase().includes(q)) ||
        i.usuario.toLowerCase().includes(q) ||
        (i.category&&i.category.toLowerCase().includes(q)) ||
        (i.tags&&i.tags.some(t=>t.toLowerCase().includes(q)))
      );
      // Frase sin coincidencias literales: Nexus la está interpretando, no mostrar "Sin resultados" mientras tanto
      // Sin coincidencias en lo cargado: se espera al servidor antes de decir "Sin resultados"
      // (con 3+ palabras Nexus la interpreta y tampoco se muestra el vacío)
      if (!res.length) { ugBuscarServidor(q, q.split(/\s+/).length < 3); return; }
      filteredItems = res;
      render(filteredItems);
      window.UGM?.busqueda(q, res.length);   // métricas: se queda con el último conteo (el del servidor)
      ugBuscarServidor(q);   // todo el catálogo, tolerante a errores ("gta san andres" → GTA SA)
      return;
    } else {
      _busqSeq++;   // cancela una búsqueda en el servidor que aún no respondió
      filteredItems = activeCategory
        ? todosLosItems.filter(i=>i.category===activeCategory)
        : todosLosItems.filter(i=>i.category!=='Video');
    }
    render(filteredItems);
  }, 280);
});

// Búsqueda en el servidor: todo el catálogo (no solo las 100 publicaciones de la portada),
// sin importar tildes, letras de más/menos o cambiadas, y reconociendo juegos ("gta sa").
let _busqSeq = 0;
async function ugBuscarServidor(q, vacioSiNada = false) {
  if (q.length < 2) return;
  const n = ++_busqSeq;
  try {
    const cat = activeCategory ? `&categoria=${encodeURIComponent(activeCategory)}` : '';
    const r = await fetchTimeout(`${API_URL}/search/query?q=${encodeURIComponent(q)}&limit=48${cat}`, 8000);
    const d = await r.json();
    const actual = document.getElementById('buscador').value.toLowerCase().trim();
    if (n !== _busqSeq || actual !== q || !d?.success || window.UG_NEXUS_Q === q) return;
    const srv = Array.isArray(d.items) ? d.items : [];
    if (!srv.length) { if (vacioSiNada) { filteredItems = []; render([]); window.UGM?.busqueda(q, 0); } return; }   // sin resultados: lo local (o Nexus)
    // Orden del servidor (relevancia), completando con los datos ya cargados de cada publicación
    const porId = new Map(todosLosItems.map(i => [i._id, i]));
    const vistos = new Set();
    const lista = srv.map(i => { vistos.add(i._id); return porId.get(i._id) ? { ...i, ...porId.get(i._id) } : i; });
    filteredItems.forEach(i => { if (!vistos.has(i._id)) lista.push(i); });
    filteredItems = lista;
    render(filteredItems);
    window.UGM?.busqueda(q, lista.length);
  } catch (_) { if (vacioSiNada && n === _busqSeq) { filteredItems = []; render([]); } }
}

// ── CATEGORY CHIPS ────────────────────────────────────────
document.querySelectorAll('.chip').forEach(c=>{
  c.addEventListener('click',function() {
    document.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));
    this.classList.add('active');
    activeCategory = this.dataset.cat;
    window.dispatchEvent(new CustomEvent('ug:guia', { detail: 'explorar' }));
    // Limpiar buscador al cambiar categoría para evitar doble filtro silencioso
    const buscEl = document.getElementById('buscador');
    buscEl.value = '';
    filteredItems = activeCategory
      ? todosLosItems.filter(i=>i.category===activeCategory)
      : todosLosItems.filter(i=>i.category!=='Video');
    render(filteredItems);
  });
});

// ── REGISTRAR VISTA (videos) ──────────────────────────────
// Usa PUT /items/vistas/:id — backend deduplica por IP (1/día, TTL 24h).
// Frontend deduplica por sessionStorage para no volver a llamar en la misma sesión.
// La vista se registra si el usuario permanece 60 segundos en el video.
let _vistaTimer = null;
const _vistasRegistradas = new Set(); // deduplicación en sesión

function toastVista(msg) {
  let el = document.getElementById('toast-vista-el');
  if(!el) {
    el = document.createElement('div');
    el.id = 'toast-vista-el';
    el.className = 'toast-vista';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3000);
}

// Vistas de un video: su propio contador (no son descargas ni generan ganancia).
// Los videos antiguos guardaban sus vistas en descargasEfectivas: se suman.
function vistasVideo(item) { return (item?.vistas || 0) + (item?.descargasEfectivas || 0); }

function registrarVista(item) {
  if(!item || !item._id) return;
  if(_vistaTimer) { clearTimeout(_vistaTimer); _vistaTimer = null; }

  _vistaTimer = setTimeout(async () => {
    _vistaTimer = null;
    // Deduplicación en sesión — no llamar si ya se registró en este tab
    if(_vistasRegistradas.has(item._id)) return;
    _vistasRegistradas.add(item._id);
    try {
      const r = await fetch(`${API_URL}/items/vistas/${item._id}`, { method: 'PUT' });
      if(r.ok) {
        const data = await r.json();
        if(data.duplicada) return; // IP ya contada hoy, no actualizar UI
        const newCount = data.vistas ?? (vistasVideo(item) + 1);
        item.vistas = newCount - (item.descargasEfectivas || 0);
        // Reflejar en stat del detail sheet
        const dlEl = document.getElementById('ds-dl');
        if(dlEl) dlEl.textContent = fmt(newCount);
        // Reflejar en tile de la lista
        const tile = document.querySelector(`.game-tile--video[data-id="${item._id}"]`);
        if(tile) {
          const viewsEl = tile.querySelector('.tile-yt-views');
          if(viewsEl) viewsEl.innerHTML = `<ion-icon name="eye-outline"></ion-icon>${fmt(newCount)}`;
        }
        // Toast feedback (punto 10)
        toastVista(`👁 +1 vista registrada`);
      }
    } catch(_) {}
  }, 60000);
}

