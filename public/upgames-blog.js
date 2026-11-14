/* ══════════════════════════════════════════════════════════════════
   UpGames Blogs · panel del creador (public/blog.html)

   Una sola página con cuatro partes:
     1. Base: sesión, llamadas a la API, avisos y hojas (menús).
     2. Bienvenida, asistente para crear el blog y formulario de reporte.
     3. Panel: Entradas, Páginas, Estadísticas, Tema y Ajustes (con dominio propio).
     4. Editor por bloques.
   El servidor está en rutas/blogs.js. Lo que se guarda son bloques (JSON), no HTML.
   ══════════════════════════════════════════════════════════════════ */
(() => {
'use strict';

// ── 1. BASE ─────────────────────────────────────────────────────────
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
const API = (LOCAL && new URLSearchParams(location.search).get('api')) || window.UG_CONFIG?.API_URL || 'https://upgames-production.up.railway.app';
const leer = k => { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } };
const TOKEN = leer('token'), YO = leer('user_admin').toLowerCase();
const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ico = n => `<ion-icon name="${n}"></ion-icon>`;

const S = { blogs: [], blog: null, vista: 'entradas', temas: [], fuentes: [], fondos: [], cpm: 0, maximo: 3, premium: false };

async function api(ruta, { metodo = 'GET', cuerpo, publico } = {}) {
  let r;
  try {
    r = await fetch(API + ruta, { method: metodo, headers: { ...(cuerpo ? { 'Content-Type': 'application/json' } : {}), ...(publico ? {} : { Authorization: `Bearer ${TOKEN}` }) }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  } catch (_) { throw new Error('Sin conexión. Revisa tu internet e inténtalo de nuevo.'); }
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && !publico) { toast('Tu sesión expiró. Inicia sesión de nuevo.', true); setTimeout(() => location.replace('../login.html'), 1500); throw new Error('Sesión expirada'); }
  if (!r.ok || d.success === false) throw new Error(d.error || 'No se pudo completar. Inténtalo de nuevo.');
  return d;
}

let tToast;
function toast(msg, mal) {
  const t = $('#toast');
  t.textContent = msg; t.className = 'toast' + (mal ? ' mal' : ''); t.hidden = false;
  clearTimeout(tToast); tToast = setTimeout(() => { t.hidden = true; }, mal ? 4200 : 2600);
}

/** Hoja inferior: menús y diálogos. Devuelve la caja para enganchar eventos. */
function hoja(html) {
  const el = $('#hoja');
  el.innerHTML = `<div class="caja" role="dialog" aria-modal="true">${html}</div>`;
  el.hidden = false;
  el.onclick = e => { if (e.target === el) cerrarHoja(); };
  return el.firstElementChild;
}
function cerrarHoja() { const el = $('#hoja'); el.hidden = true; el.innerHTML = ''; }
function confirmar(titulo, texto, boton = 'Aceptar', rojo = false) {
  return new Promise(ok => {
    const c = hoja(`<h3>${h(titulo)}</h3><p>${h(texto)}</p><div class="fila"><button class="btn" data-no style="flex:1">Cancelar</button><button class="btn ${rojo ? 'rojo' : 'pri'}" data-si style="flex:1">${h(boton)}</button></div>`);
    $('[data-no]', c).onclick = () => { cerrarHoja(); ok(false); };
    $('[data-si]', c).onclick = () => { cerrarHoja(); ok(true); };
  });
}
async function ocupado(boton, tarea) {
  if (boton.disabled) return;
  const antes = boton.innerHTML;
  boton.disabled = true; boton.innerHTML = '<span class="giro" style="width:18px;height:18px;border-width:2px"></span>';
  try { return await tarea(); } catch (e) { toast(e.message, true); } finally { boton.disabled = false; boton.innerHTML = antes; }
}
const fechaCorta = d => d ? new Date(d).toLocaleDateString('es', { day: 'numeric', month: 'short', year: new Date(d).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }) : '';
const num = n => Number(n || 0).toLocaleString('es');
async function copiar(texto) { try { await navigator.clipboard.writeText(texto); toast('Enlace copiado'); } catch (_) { prompt('Copia el enlace:', texto); } }

/** Sube una imagen directo a Cloudinary con la firma del servidor (igual que las portadas de UpGames). */
function elegirImagen() {
  return new Promise(ok => {
    const inp = $('#archivo');
    inp.value = '';
    inp.onchange = () => ok(inp.files[0] || null);
    inp.click();
  });
}
async function subirImagen(archivo) {
  if (!archivo.type.startsWith('image/')) throw new Error('Ese archivo no es una imagen.');
  if (archivo.size > 12 * 1024 * 1024) throw new Error('La imagen pesa más de 12 MB. Elige una más ligera.');
  const f = await api('/upload/sign?folder=covers');
  const fd = new FormData();
  fd.append('file', archivo); fd.append('api_key', f.api_key); fd.append('timestamp', f.timestamp); fd.append('signature', f.signature); fd.append('folder', f.folder);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${f.cloud_name}/image/upload`, { method: 'POST', body: fd }).catch(() => null);
  const d = r && await r.json().catch(() => null);
  if (!d?.secure_url) throw new Error('No se pudo subir la imagen. Inténtalo de nuevo.');
  return d.secure_url;
}
const mini = (url, w) => String(url || '').replace(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(?!.*\/(?:w_|c_))/, `$1f_auto,q_auto,w_${w},c_limit/`);

// ── 2. BIENVENIDA, ASISTENTE Y REPORTE ──────────────────────────────
const LOGO = '<a class="logo" href="./biblioteca.html"><span><i>UP</i>GAMES</span><small>BLOGS</small></a>';

function bienvenida() {
  app.innerHTML = `<div class="portal">${LOGO}
    <section class="heroe">
      <h1>Tu sitio web,<br><em>hecho en UpGames</em></h1>
      <p>Elige un diseño, escribe y publica. Sin programar y gratis. Cuando quieras, conéctale tu propio dominio.</p>
      <a class="btn pri" href="../login.html">${ico('rocket-outline')} Entrar y crear mi blog</a>
    </section>
    <div class="ventajas">
      <div class="glass">${ico('color-palette-outline')}<b>Temas listos</b><span>Cinco diseños que puedes personalizar con tu color, tu logo y tu portada.</span></div>
      <div class="glass">${ico('create-outline')}<b>Editor fácil</b><span>Texto, imágenes, galerías, videos, botones y tus publicaciones de UpGames.</span></div>
      <div class="glass">${ico('globe-outline')}<b>Tu dominio</b><span>Empieza con una dirección gratis y conecta tu dominio cuando lo tengas.</span></div>
      <div class="glass">${ico('stats-chart-outline')}<b>Estadísticas</b><span>Mira cuántas visitas tienes cada día y qué entradas gustan más.</span></div>
    </div>
    <p class="guia-enlace"><a href="./blogs-guia.html">${ico('book-outline')} Lee la guía de UpGames Blogs: cómo funciona, cómo ganar y tus responsabilidades</a></p></div>`;
}

function tarjetasTema(elegido) {
  return `<div class="temas">${S.temas.map(t => `<button type="button" class="tema${t.id === elegido ? ' on' : ''}" data-tema="${h(t.id)}">${t.premium ? `<em class="pro">${S.premium ? 'PREMIUM' : '🔒 PREMIUM'}</em>` : ''}
    <div class="mini" style="background:${h(t.colores.bg)}"><i style="background:${h(t.colores.txt)};width:60%"></i><i style="background:${h(t.colores.acento)};width:34%"></i><u style="background:${h(t.colores.tarjeta)};border:1px solid ${h(t.colores.acento)}55"></u></div>
    <b>${h(t.nombre)}</b><span>${h(t.descripcion)}</span></button>`).join('')}</div>`;
}

function asistente(puedeVolver) {
  let tema = S.temas[0]?.id || 'neon', tDir, dirTocada = false;
  app.innerHTML = `<div class="portal">${LOGO}
    <form class="asistente glass" autocomplete="off">
      <h2>Crea tu blog</h2><p>Solo te toma un minuto. Todo se puede cambiar después.</p>
      <label class="campo"><span>Nombre del blog</span><input class="inp" name="titulo" maxlength="140" placeholder="Ej.: Mods y trucos de Kale" required></label>
      <label class="campo"><span>Dirección</span><div class="prefijo"><b>…/b/</b><input class="inp" name="direccion" maxlength="30" placeholder="mi-blog" required autocapitalize="off" spellcheck="false"></div><small id="dir-nota">Letras, números y guiones. Entre 3 y 30 caracteres.</small></label>
      <label class="campo"><span>De qué trata (opcional)</span><input class="inp" name="descripcion" maxlength="300" placeholder="Una frase que lo describa"></label>
      <div class="campo"><span>Elige un tema</span>${tarjetasTema(tema)}</div>
      <label class="acepto"><input type="checkbox" name="acepto" required><span>Soy el único responsable de todo lo que publique en mi blog (textos, imágenes, enlaces, descargas, dominio y comentarios que mantenga). UpGames solo presta la herramienta. Acepto los <a href="./terminos_condiciones.html#blogs" target="_blank" rel="noopener">Términos de UpGames Blogs</a> y la <a href="./politica-privacidad.html#blogs-datos" target="_blank" rel="noopener">Política de Privacidad</a>.</span></label>
      <button class="btn pri ancho" type="submit">${ico('sparkles-outline')} Crear mi blog</button>
      ${puedeVolver ? '<button class="btn ancho" type="button" data-volver>Cancelar</button>' : ''}
    </form></div>`;
  const f = $('form', app), nota = $('#dir-nota');
  const limpiar = v => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 30);
  const comprobar = () => {
    clearTimeout(tDir);
    const d = f.direccion.value.replace(/-+$/, '');
    if (d.length < 3) { nota.className = ''; nota.textContent = 'Letras, números y guiones. Entre 3 y 30 caracteres.'; return; }
    tDir = setTimeout(async () => {
      try { const r = await api(`/blogs/direccion-libre?d=${encodeURIComponent(d)}`); nota.className = r.libre ? 'ok' : 'mal'; nota.textContent = r.libre ? '✓ Disponible' : r.motivo; } catch (_) {}
    }, 350);
  };
  f.titulo.oninput = () => { if (!dirTocada) { f.direccion.value = limpiar(f.titulo.value).replace(/-+$/, ''); comprobar(); } };
  f.direccion.oninput = () => { dirTocada = true; f.direccion.value = limpiar(f.direccion.value); comprobar(); };
  f.onclick = e => { const b = e.target.closest('[data-tema]'); if (b && S.temas.find(x => x.id === b.dataset.tema)?.premium && !S.premium) return toast('Ese tema es exclusivo de Premium.', true); if (b) { tema = b.dataset.tema; f.querySelectorAll('.tema').forEach(x => x.classList.toggle('on', x === b)); } };
  if (puedeVolver) $('[data-volver]', f).onclick = () => panel();
  f.onsubmit = e => {
    e.preventDefault();
    ocupado($('[type=submit]', f), async () => {
      const r = await api('/blogs', { metodo: 'POST', cuerpo: { titulo: f.titulo.value, direccion: f.direccion.value.replace(/-+$/, ''), descripcion: f.descripcion.value, tema, aceptaTerminos: f.acepto.checked } });
      S.blogs.push({ ...r.blog, entradas: 0 }); S.blog = S.blogs[S.blogs.length - 1]; S.vista = 'entradas';
      JUEGO_INICIAL ? editor('entrada') : (panel(), toast('¡Tu blog está listo! Escribe tu primera entrada.'));
    });
  };
}

function reporte(direccion) {
  app.innerHTML = `<div class="portal">${LOGO}
    <form class="asistente glass">
      <h2>Reportar un blog</h2><p>Vas a reportar el blog <b>${h(direccion)}</b>. El equipo de UpGames lo revisará.</p>
      <label class="campo"><span>¿Qué pasa con este blog?</span><select class="inp" name="motivo">
        <option value="estafa">Es una estafa o intenta robar datos</option><option value="malware">Lleva a virus o descargas peligrosas</option>
        <option value="sexual">Contenido sexual</option><option value="odio">Odio o acoso</option><option value="copia">Copia contenido de otra persona</option><option value="otro">Otro motivo</option></select></label>
      <label class="campo"><span>Cuéntanos más (opcional)</span><textarea class="inp" name="detalle" maxlength="500"></textarea></label>
      <button class="btn pri ancho" type="submit">Enviar reporte</button>
    </form></div>`;
  const f = $('form', app);
  f.onsubmit = e => {
    e.preventDefault();
    ocupado($('[type=submit]', f), async () => {
      await api('/blogs/reportar', { metodo: 'POST', publico: true, cuerpo: { direccion, motivo: f.motivo.value, detalle: f.detalle.value } });
      f.innerHTML = `<h2>Gracias por avisar</h2><p>Recibimos tu reporte y lo vamos a revisar.</p><a class="btn ancho" href="./biblioteca.html">Ir a UpGames</a>`;
    });
  };
}

// ── 3. PANEL ────────────────────────────────────────────────────────
const SECCIONES = [['entradas', 'document-text', 'Entradas'], ['paginas', 'copy', 'Páginas'], ['estadisticas', 'stats-chart', 'Estadísticas'], ['ingresos', 'cash', 'Ingresos'], ['tema', 'color-palette', 'Tema'], ['ajustes', 'settings', 'Ajustes']];

function panel() {
  const b = S.blog;
  app.innerHTML = `<div class="panel">
    <header class="barra">
      <a class="ico" href="./biblioteca.html" aria-label="Volver a UpGames">${ico('chevron-back')}</a>
      <button class="quien" id="cambiar"><b><span>${h(b.titulo)}</span>${ico('chevron-down')}</b><small>${h(b.url.replace(/^https?:\/\//, ''))}</small></button>
      <a class="btn chico" href="${h(b.url)}" target="_blank" rel="noopener">${ico('open-outline')} Ver</a>
    </header>
    <nav class="nav" aria-label="Secciones">${SECCIONES.map(([id, i, n]) => `<button data-v="${id}" class="${S.vista === id ? 'on' : ''}">${ico(i + (S.vista === id ? '' : '-outline'))}<span>${n}</span></button>`).join('')}</nav>
    <main class="vista" id="vista"><div class="cargando"><span class="giro"></span></div></main>
  </div>`;
  $('.nav', app).onclick = e => { const x = e.target.closest('[data-v]'); if (x) { S.vista = x.dataset.v; panel(); } };
  $('#cambiar').onclick = menuBlogs;
  ({ entradas: () => vistaLista('entrada'), paginas: () => vistaLista('pagina'), estadisticas: vistaEstadisticas, ingresos: vistaIngresos, tema: vistaTema, ajustes: vistaAjustes })[S.vista]();
}

function menuBlogs() {
  const c = hoja(`<h3>Tus blogs</h3><div class="opciones">
    ${S.blogs.map(b => `<button data-b="${h(b.id)}">${ico(b.id === S.blog.id ? 'radio-button-on' : 'radio-button-off')}<span>${h(b.titulo)}<small>/b/${h(b.direccion)}</small></span></button>`).join('')}
    ${S.blogs.length < S.maximo ? `<button data-nuevo>${ico('add-circle-outline')}<span>Crear otro blog</span></button>` : ''}</div>`);
  c.onclick = e => {
    const x = e.target.closest('button'); if (!x) return;
    cerrarHoja();
    if (x.dataset.nuevo !== undefined) return asistente(true);
    S.blog = S.blogs.find(b => b.id === x.dataset.b) || S.blog; S.vista = 'entradas'; panel();
  };
}

const ESTADOS = { borrador: ['Borrador', ''], publicada: ['Publicada', 'verde'], programada: ['Programada', 'cian'] };

async function vistaLista(tipo) {
  const v = $('#vista'), esPag = tipo === 'pagina';
  let lista;
  try { lista = (await api(`/blogs/${S.blog.id}/entradas?tipo=${tipo}`)).entradas; } catch (e) { v.innerHTML = `<div class="vacio"><b>No se pudo cargar</b>${h(e.message)}</div>`; return; }
  const aviso = S.blog.estado !== 'activo' ? `<div class="seccion glass" style="border-color:rgba(255,204,0,.4)"><h2>${ico('warning-outline')} Blog en revisión</h2><p>Tu blog recibió reportes y no se muestra al público hasta que el equipo de UpGames lo revise.</p></div>` : '';
  v.innerHTML = `<h1>${esPag ? 'Páginas' : 'Entradas'}</h1><p class="sub">${esPag ? 'Páginas fijas que salen en el menú de tu blog: «Sobre mí», «Contacto»…' : 'Lo que publicas en tu blog, de lo más nuevo a lo más antiguo.'}</p>${aviso}
    ${lista.length ? `<div class="lista">${lista.map(e => {
      const [txt, color] = e.estado === 'programada' && new Date(e.publicadaEn) <= new Date() ? ESTADOS.publicada : ESTADOS[e.estado];
      return `<div class="item glass" data-e="${h(e.id)}" role="button" tabindex="0">
        <div class="mini" ${e.portada ? `style="background-image:url('${h(mini(e.portada, 200))}')"` : ''}>${e.portada ? '' : h((e.titulo[0] || '?').toUpperCase())}</div>
        <div class="cuerpo"><b>${h(e.titulo)}</b><div class="datos"><span class="chip ${color}">${txt}</span><span>${h(fechaCorta(e.estado === 'borrador' ? e.actualizada : e.publicadaEn))}</span>${e.estado !== 'borrador' ? `<span>${ico('eye-outline')} ${num(e.vistas)}</span>` : ''}</div></div>
        <button class="ico" data-menu="${h(e.id)}" aria-label="Más opciones">${ico('ellipsis-vertical')}</button></div>`;
    }).join('')}</div>`
    : `<div class="vacio">${ico(esPag ? 'copy-outline' : 'document-text-outline')}<b>${esPag ? 'Aún no tienes páginas' : 'Escribe tu primera entrada'}</b>Toca el botón <b style="display:inline;color:var(--g)">+</b> para empezar.</div>`}
    <button class="fab" id="nueva" aria-label="${esPag ? 'Crear página' : 'Crear entrada'}">${ico('add')}</button>`;
  $('#nueva').onclick = () => editor(tipo);
  v.onclick = e => {
    const m = e.target.closest('[data-menu]');
    if (m) return menuEntrada(lista.find(x => x.id === m.dataset.menu), tipo);
    const it = e.target.closest('[data-e]'); if (it) editor(tipo, it.dataset.e);
  };
}

function menuEntrada(e, tipo) {
  const url = `${S.blog.url}${tipo === 'pagina' ? 'p' : 'e'}/${e.slug}`, publica = e.estado !== 'borrador';
  const c = hoja(`<h3>${h(e.titulo)}</h3><div class="opciones">
    <button data-a="editar">${ico('create-outline')}<span>Editar</span></button>
    ${publica ? `<button data-a="ver">${ico('open-outline')}<span>Ver en el blog</span></button><button data-a="copiar">${ico('link-outline')}<span>Copiar enlace</span></button>` : ''}
    <button data-a="borrar" class="rojo">${ico('trash-outline')}<span>Borrar</span></button></div>`);
  c.onclick = async ev => {
    const a = ev.target.closest('[data-a]')?.dataset.a; if (!a) return;
    cerrarHoja();
    if (a === 'editar') return editor(tipo, e.id);
    if (a === 'ver') return window.open(url, '_blank', 'noopener');
    if (a === 'copiar') return copiar(url);
    if (!(await confirmar('¿Borrar?', `«${e.titulo}» se borrará para siempre.`, 'Borrar', true))) return;
    try { await api(`/blogs/${S.blog.id}/entradas/${e.id}`, { metodo: 'DELETE' }); toast('Borrada'); vistaLista(tipo); } catch (err) { toast(err.message, true); }
  };
}

async function vistaEstadisticas() {
  const v = $('#vista');
  let d;
  try { d = await api(`/blogs/${S.blog.id}/estadisticas`); } catch (e) { v.innerHTML = `<div class="vacio"><b>No se pudo cargar</b>${h(e.message)}</div>`; return; }
  const max = Math.max(1, ...d.serie.map(x => x.n));
  v.innerHTML = `<h1>Estadísticas</h1><p class="sub">Visitas a las entradas de tu blog.</p>
    <div class="cifras"><div class="cifra glass"><b>${num(d.hoy)}</b><span>Hoy</span></div><div class="cifra glass"><b>${num(d.mes)}</b><span>Últimos 30 días</span></div><div class="cifra glass"><b>${num(d.total)}</b><span>Desde siempre</span></div><div class="cifra glass"><b>${num(d.publicadas)}</b><span>Entradas publicadas</span></div></div>
    <section class="seccion glass"><h2>${ico('trending-up')} Visitas por día</h2>
      <div><div class="grafica" role="img" aria-label="Visitas de los últimos 30 días">${d.serie.map(x => `<i class="${x.n ? '' : 'cero'}" style="height:${Math.max(3, Math.round(x.n / max * 100))}%" title="${h(x.dia)}: ${x.n}"></i>`).join('')}</div>
      <div class="eje"><span>${h(fechaCorta(d.serie[0].dia + 'T12:00:00'))}</span><span>Hoy</span></div></div></section>
    <section class="seccion glass"><h2>${ico('flame')} Lo más leído</h2>
      ${d.top.length ? `<div class="top">${d.top.map(t => `<div><b>${h(t.titulo)}</b><span>${num(t.vistas)} visitas</span></div>`).join('')}</div>` : '<p>Cuando tus entradas reciban visitas aparecerán aquí.</p>'}</section>`;
}

async function vistaIngresos() {
  const v = $('#vista'), b = S.blog;
  let d;
  try { d = await api(`/blogs/${b.id}/estadisticas`); } catch (e) { v.innerHTML = `<div class="vacio"><b>No se pudo cargar</b>${h(e.message)}</div>`; return; }
  const usd = n => 'US$' + Number(n || 0).toLocaleString('es', { minimumFractionDigits: 2, maximumFractionDigits: Number(n) > 0 && Number(n) < 0.1 ? 4 : 2 });
  v.innerHTML = `<h1>Ingresos</h1><p class="sub">Tú decides si tu blog lleva publicidad. Si la activas, ganas dinero con cada anuncio que ven tus visitantes.</p>
    <section class="seccion glass"><h2>${ico('cash')} Monetizar con UpGames</h2>
      <label class="interruptor"><span><b>Mostrar publicidad en mi blog</b><br><small style="color:var(--txt3)">Un anuncio al final de cada entrada y del inicio.</small></span><input type="checkbox" id="monetizar"${b.monetizar ? ' checked' : ''}></label>
      <p>Ganas <b style="color:var(--g)">${usd(d.cpm)}</b> por cada 1.000 anuncios vistos. Se suma a tu saldo de UpGames, el mismo de tus publicaciones, y lo retiras desde <a href="./biblioteca.html">tu perfil → Economía</a>.</p>
      ${b.visibilidad !== 'publico' ? '<p style="color:var(--amber)">Tu blog está oculto: los anuncios solo se muestran en blogs públicos.</p>' : ''}
    </section>
    <div class="cifras"><div class="cifra glass"><b>${usd(d.ingresosMes)}</b><span>Últimos 30 días</span></div><div class="cifra glass"><b>${usd(d.ingresos)}</b><span>Desde siempre</span></div><div class="cifra glass"><b>${num(d.anunciosMes)}</b><span>Anuncios vistos (30 días)</span></div></div>
    <section class="seccion glass"><h2>${ico('shield-checkmark')} Cómo se cuenta</h2>
      <p>Un anuncio cuenta cuando una persona real lo tuvo a la vista unos segundos y no usa bloqueador. Cada visitante cuenta hasta 3 veces al día en tu blog. Las visitas falsas o hechas por ti mismo no pagan y pueden suspender la monetización.</p></section>`;
  $('#monetizar').onchange = async e => {
    const quiere = e.target.checked;
    if (quiere && !(await confirmar('¿Activar la publicidad?', 'Tus visitantes verán un anuncio al final de cada entrada. Puedes quitarla cuando quieras.', 'Activar'))) { e.target.checked = false; return; }
    try { await guardarBlog({ monetizar: quiere }, quiere ? 'Publicidad activada' : 'Publicidad desactivada'); } catch (err) { e.target.checked = !quiere; toast(err.message, true); }
  };
}

async function guardarBlog(cambios, mensaje = 'Guardado') {
  const r = await api(`/blogs/${S.blog.id}`, { metodo: 'PUT', cuerpo: cambios });
  ponerBlog(r.blog); toast(mensaje);
}
function ponerBlog(nuevo) {
  const i = S.blogs.findIndex(b => b.id === nuevo.id);
  S.blog = S.blogs[i] = { ...S.blogs[i], ...nuevo };
}

function vistaTema() {
  const v = $('#vista'), b = S.blog, a = b.ajustes || {}, g = a.gadgets || {};
  const tema = S.temas.find(t => t.id === b.tema) || S.temas[0];
  const foto = (clave, titulo, nota) => `<div class="campo"><span>${titulo}</span><div class="fila">
    ${a[clave] ? `<img src="${h(mini(a[clave], 240))}" alt="" style="height:64px;max-width:150px;border-radius:12px;object-fit:cover">` : ''}
    <button class="btn chico" data-subir="${clave}">${ico('image-outline')} ${a[clave] ? 'Cambiar' : 'Subir imagen'}</button>${a[clave] ? `<button class="btn chico rojo" data-quitar="${clave}">Quitar</button>` : ''}</div><small>${nota}</small></div>`;
  v.innerHTML = `<h1>Tema</h1><p class="sub">Cambia el aspecto de tu blog. Tus entradas no se pierden al cambiar de tema.</p>
    <section class="seccion glass"><h2>${ico('brush')} Diseño</h2>${tarjetasTema(b.tema)}</section>
    <section class="seccion glass"><h2>${ico('color-fill')} Personalizar</h2>
      <div class="campo"><span>Color principal</span><div class="fila"><input type="color" id="acento" value="${h(a.acento || tema.colores.acento)}" style="width:56px;height:46px;border-radius:12px;border:1px solid var(--bd2);background:none;padding:3px"><button class="btn chico" id="acento-ok">Aplicar color</button>${a.acento ? '<button class="btn chico" id="acento-no">Usar el del tema</button>' : ''}</div></div>
      <label class="campo"><span>Letra de los títulos</span><select class="inp" id="fuente"><option value="">La del tema</option>${S.fuentes.map(f => `<option value="${h(f.id)}"${a.fuente === f.id ? ' selected' : ''}>${h(f.nombre)}</option>`).join('')}</select></label>
      <label class="campo"><span>Fondo</span><select class="inp" data-aj="fondo"><option value="">El del tema</option>${S.fondos.map(f => `<option value="${h(f.id)}"${a.fondo === f.id ? ' selected' : ''}>${h(f.nombre)}</option>`).join('')}</select></label>
      <label class="campo"><span>Esquinas</span><select class="inp" data-aj="esquinas">${[['', 'Las del tema'], ['rectas', 'Rectas'], ['suaves', 'Suaves'], ['redondas', 'Muy redondas']].map(([k, n]) => `<option value="${k}"${(a.esquinas || '') === k ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="campo"><span>Cómo se ven las entradas en el inicio</span><select class="inp" data-aj="portadaForma">${[['', 'Como el tema'], ['rejilla', 'Tarjetas en rejilla'], ['lista', 'Lista con foto al lado'], ['revista', 'Revista: la última en grande']].map(([k, n]) => `<option value="${k}"${(a.portadaForma || '') === k ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      ${foto('logo', 'Logo', 'Sale junto al nombre del blog y como icono de la pestaña.')}
      ${foto('portada', 'Foto de portada', 'Fondo grande de la parte de arriba del inicio.')}
    </section>
    <section class="seccion glass"><h2>${ico('grid')} Barra lateral</h2><p>Elige qué se muestra al lado de tus entradas.</p><div>
      ${[['perfil', 'Tu perfil de UpGames'], ['populares', 'Lo más leído'], ['etiquetas', 'Etiquetas']].map(([k, n]) => `<label class="interruptor"><span>${n}</span><input type="checkbox" data-gadget="${k}"${g[k] !== false ? ' checked' : ''}></label>`).join('')}</div>
    </section>
    <section class="seccion glass"><h2>${ico('link')} Enlaces</h2><p>Tus redes u otros sitios (hasta 6). Salen en la barra lateral.</p>
      <div id="enlaces" style="display:grid;gap:8px">${[...(a.enlaces || []), { texto: '', url: '' }].slice(0, 6).map(e => `<div class="fila"><input class="inp" style="flex:1;min-width:110px" placeholder="Nombre (YouTube)" maxlength="40" value="${h(e.texto)}"><input class="inp" style="flex:2;min-width:160px" placeholder="https://…" value="${h(e.url)}" inputmode="url"></div>`).join('')}</div>
      <button class="btn chico" id="enlaces-ok">Guardar enlaces</button></section>`;
  const aplicar = (cambios, msg) => guardarBlog(cambios, msg).then(vistaTema).catch(e => toast(e.message, true));
  v.onclick = async e => {
    const t = e.target.closest('[data-tema]'); if (t && S.temas.find(x => x.id === t.dataset.tema)?.premium && !S.premium) return toast('Ese tema es exclusivo de Premium. Lo activas en Creator Studio → Premium.', true); if (t && t.dataset.tema !== b.tema) return aplicar({ tema: t.dataset.tema }, 'Tema cambiado');
    const s = e.target.closest('[data-subir]');
    if (s) { const f = await elegirImagen(); if (!f) return; return ocupado(s, async () => { const url = await subirImagen(f); await aplicar({ ajustes: { [s.dataset.subir]: url } }); }); }
    const q = e.target.closest('[data-quitar]'); if (q) return aplicar({ ajustes: { [q.dataset.quitar]: '' } });
    if (e.target.closest('#acento-ok')) return aplicar({ ajustes: { acento: $('#acento').value } }, 'Color aplicado');
    if (e.target.closest('#acento-no')) return aplicar({ ajustes: { acento: '' } });
    if (e.target.closest('#enlaces-ok')) {
      const enlaces = [...$('#enlaces').children].map(f => ({ texto: f.children[0].value.trim(), url: f.children[1].value.trim() })).filter(x => x.texto || x.url);
      if (enlaces.some(x => !x.texto || !/^https:\/\/\S+\.\S+/.test(x.url))) return toast('Cada enlace necesita un nombre y una dirección que empiece por https://', true);
      return aplicar({ ajustes: { enlaces } }, 'Enlaces guardados');
    }
  };
  v.onchange = e => {
    if (e.target.id === 'fuente') return aplicar({ ajustes: { fuente: e.target.value } });
    if (e.target.dataset.aj) return aplicar({ ajustes: { [e.target.dataset.aj]: e.target.value } }, 'Diseño actualizado');
    if (e.target.dataset.gadget) {
      const gadgets = Object.fromEntries([...v.querySelectorAll('[data-gadget]')].map(x => [x.dataset.gadget, x.checked]));
      guardarBlog({ ajustes: { gadgets } }).catch(err => toast(err.message, true));
    }
  };
}

function vistaAjustes() {
  const v = $('#vista'), b = S.blog, d = b.dominio;
  v.innerHTML = `<h1>Ajustes</h1><p class="sub">Los datos generales de tu blog.</p>
    <form class="seccion glass" id="f-datos"><h2>${ico('information-circle')} Datos</h2>
      <label class="campo"><span>Nombre del blog</span><input class="inp" name="titulo" maxlength="140" value="${h(b.titulo)}" required></label>
      <label class="campo"><span>Descripción</span><textarea class="inp" name="descripcion" maxlength="300">${h(b.descripcion)}</textarea><small>Sale en la portada y en Google.</small></label>
      <label class="campo"><span>Dirección</span><div class="prefijo"><b>…/b/</b><input class="inp" name="direccion" maxlength="30" value="${h(b.direccion)}" autocapitalize="off" spellcheck="false" required></div><small>Si la cambias, los enlaces que ya compartiste dejarán de funcionar.</small></label>
      <label class="campo"><span>Quién puede verlo</span><select class="inp" name="visibilidad"><option value="publico"${b.visibilidad === 'publico' ? ' selected' : ''}>Público: aparece en Google</option><option value="oculto"${b.visibilidad === 'oculto' ? ' selected' : ''}>Oculto: solo quien tenga el enlace</option></select></label>
      <label class="campo"><span>Idioma</span><select class="inp" name="idioma">${[['es', 'Español'], ['en', 'English'], ['pt', 'Português']].map(([k, n]) => `<option value="${k}"${(b.ajustes?.idioma || 'es') === k ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      <button class="btn pri" type="submit">Guardar cambios</button></form>
    <section class="seccion glass"><h2>${ico('share-social')} Tu enlace</h2>
      <div class="fila"><code style="flex:1;min-width:0;word-break:break-all;color:var(--cy)">${h(b.url)}</code><button class="btn chico" id="copiar-url">${ico('copy-outline')} Copiar</button></div></section>
    <section class="seccion glass" id="s-dominio"><h2>${ico('globe')} Dominio propio ${d ? `<span class="chip ${d.verificado ? 'verde' : 'ambar'}">${d.verificado ? 'Conectado' : 'Pendiente'}</span>` : ''}</h2>
      ${d ? `<p>${d.verificado ? `Tu blog responde en <b>${h(d.nombre)}</b>.` : `Para conectar <b>${h(d.nombre)}</b>, entra al panel donde compraste tu dominio (Namecheap, GoDaddy, Cloudflare, Hostinger…), busca la sección <b>DNS</b> y crea estos dos registros:`}</p>
        <div class="dns">${d.registros.map(r => `<div class="reg"><div><span>Tipo</span><b>${h(r.tipo)}</b></div><div><span>Nombre</span><code>${h(r.nombre)}</code></div><div><span>Valor</span><code>${h(r.valor)}</code></div>${r.nota ? `<small>${h(r.nota)}</small>` : ''}</div>`).join('')}</div>
        <p id="dns-msj">${d.verificado ? '' : 'Los cambios de DNS pueden tardar desde unos minutos hasta 24 horas.'}</p>
        <div class="fila"><button class="btn pri chico" id="dns-ver">${ico('refresh')} ${d.verificado ? 'Volver a comprobar' : 'Comprobar conexión'}</button><button class="btn chico rojo" id="dns-quitar">Quitar dominio</button></div>`
      : `<p>¿Ya tienes un dominio? Conéctalo y tu blog se abrirá en él, por ejemplo <b>www.misitio.com</b>.</p>
        <form class="fila" id="f-dominio"><input class="inp" name="dominio" style="flex:1;min-width:180px" placeholder="www.misitio.com" autocapitalize="off" spellcheck="false" required><button class="btn pri" type="submit">Conectar</button></form>`}
    </section>
    <section class="seccion glass" style="border-color:rgba(255,90,90,.25)"><h2 style="color:var(--red)">${ico('trash')} Borrar el blog</h2><p>Se borran el blog y todas sus entradas. No se puede deshacer.</p><div><button class="btn rojo chico" id="borrar-blog">Borrar este blog</button></div></section>`;
  const fd = $('#f-datos');
  fd.onsubmit = e => {
    e.preventDefault();
    ocupado($('[type=submit]', fd), async () => {
      await guardarBlog({ titulo: fd.titulo.value, descripcion: fd.descripcion.value, direccion: fd.direccion.value.trim().toLowerCase(), visibilidad: fd.visibilidad.value, ajustes: { idioma: fd.idioma.value } });
      panel();
    });
  };
  $('#copiar-url').onclick = () => copiar(b.url);
  const fDom = $('#f-dominio');
  if (fDom) fDom.onsubmit = e => {
    e.preventDefault();
    ocupado($('[type=submit]', fDom), async () => { const r = await api(`/blogs/${b.id}/dominio`, { metodo: 'POST', cuerpo: { dominio: fDom.dominio.value } }); ponerBlog(r.blog); vistaAjustes(); $('#s-dominio').scrollIntoView({ behavior: 'smooth' }); });
  };
  const ver = $('#dns-ver');
  if (ver) ver.onclick = () => ocupado(ver, async () => {
    const r = await api(`/blogs/${b.id}/dominio/verificar`, { metodo: 'POST' });
    ponerBlog(r.blog);
    if (r.verificado) { vistaAjustes(); panelCabecera(); toast(r.mensaje); } else { $('#dns-msj').textContent = r.mensaje; toast('Todavía no está listo', true); }
  });
  const quitar = $('#dns-quitar');
  if (quitar) quitar.onclick = async () => {
    if (!(await confirmar('¿Quitar el dominio?', 'Tu blog volverá a abrirse solo en su dirección de UpGames.', 'Quitar', true))) return;
    try { const r = await api(`/blogs/${b.id}/dominio`, { metodo: 'DELETE' }); ponerBlog(r.blog); panel(); } catch (e) { toast(e.message, true); }
  };
  $('#borrar-blog').onclick = async () => {
    if (!(await confirmar(`¿Borrar «${b.titulo}»?`, 'Se borrarán el blog y todas sus entradas y páginas. Esto no se puede deshacer.', 'Sí, borrar todo', true))) return;
    try {
      await api(`/blogs/${b.id}`, { metodo: 'DELETE' });
      S.blogs = S.blogs.filter(x => x.id !== b.id); S.blog = S.blogs[0] || null; S.vista = 'entradas';
      S.blog ? panel() : asistente(false); toast('Blog borrado');
    } catch (e) { toast(e.message, true); }
  };
}
function panelCabecera() { const s = $('.barra .quien small'); if (s) s.textContent = S.blog.url.replace(/^https?:\/\//, ''); const a = $('.barra a.btn'); if (a) a.href = S.blog.url; }

// ── 4. EDITOR POR BLOQUES ───────────────────────────────────────────
// Texto con formato ↔ marcas sencillas (**negrita**, *cursiva*, `código`, [texto](https://…), listas con «- »).
// Es el mismo formato que entiende el servidor (modulos/blogs/render.js).
function enLinea(t) {
  let x = h(t); const cod = [];
  x = x.replace(/`([^`\n]+)`/g, (_, c) => { cod.push(c); return `\u0001${cod.length - 1}\u0001`; });
  x = x.replace(/\[([^\]\n]+)\]\((https:\/\/[^\s()]+)\)/g, '<a href="$2">$1</a>');
  x = x.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<i>$2</i>');
  return x.replace(/\u0001(\d+)\u0001/g, (_, i) => `<code>${cod[+i]}</code>`);
}
function aHtml(md) {
  return String(md || '').split(/\n{2,}/).map(p => {
    const l = p.split('\n').filter(x => x.trim());
    if (!l.length) return '';
    if (l.every(x => /^\s*[-•]\s+/.test(x))) return `<ul>${l.map(x => `<li>${enLinea(x.replace(/^\s*[-•]\s+/, ''))}</li>`).join('')}</ul>`;
    if (l.every(x => /^\s*\d+[.)]\s+/.test(x))) return `<ol>${l.map(x => `<li>${enLinea(x.replace(/^\s*\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`;
    return `<p>${l.map(enLinea).join('<br>')}</p>`;
  }).join('');
}
function aMarcas(raiz) {
  const rec = n => {
    if (n.nodeType === 3) return n.nodeValue.replace(/\n/g, ' ');
    if (n.nodeType !== 1) return '';
    const t = n.tagName, dentro = () => [...n.childNodes].map(rec).join('');
    if (t === 'BR') return '\n';
    if (t === 'UL' || t === 'OL') return '\n\n' + [...n.children].filter(c => c.tagName === 'LI').map((li, i) => `${t === 'OL' ? `${i + 1}.` : '-'} ${rec(li).replace(/\n+/g, ' ').trim()}`).join('\n') + '\n\n';
    const x = dentro();
    if (!x.trim()) return /^(P|DIV)$/.test(t) ? '\n\n' : x;
    const envolver = (m) => { const [, a, c, z] = x.match(/^(\s*)([\s\S]*?)(\s*)$/); return `${a}${m}${c}${m}${z}`; };
    if (t === 'B' || t === 'STRONG') return envolver('**');
    if (t === 'I' || t === 'EM') return envolver('*');
    if (t === 'CODE') return envolver('`');
    if (t === 'A') { const u = n.getAttribute('href') || ''; return /^https:\/\/[^\s()]+$/.test(u) ? `[${x.replace(/[\[\]\n]/g, ' ')}](${u})` : x; }
    if (t === 'P' || t === 'DIV' || /^H\d$/.test(t)) return `\n\n${x}\n\n`;
    return x;
  };
  return rec(raiz).replace(/ /g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
const crecer = ta => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
const idYouTube = s => { s = String(s || '').trim(); if (/^[\w-]{11}$/.test(s)) return s; const m = s.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/); return m ? m[1] : ''; };

const TIPOS = [['texto', 'text', 'Texto'], ['titulo', 'reorder-two', 'Subtítulo'], ['imagen', 'image', 'Imagen'], ['galeria', 'images', 'Galería'], ['video', 'logo-youtube', 'Video'],
  ['cita', 'chatbox-ellipses', 'Cita'], ['aviso', 'alert-circle', 'Aviso'], ['ficha', 'list', 'Ficha / requisitos'], ['faq', 'help-circle', 'Preguntas'], ['audio', 'musical-notes', 'Spotify'], ['boton', 'radio-button-on', 'Botón'], ['juego', 'game-controller', 'Publicación de UpGames'], ['descarga', 'cloud-download-outline', 'Descarga'], ['codigo', 'code-slash', 'Código'], ['separador', 'remove', 'Separador']];
const NOMBRE_TIPO = Object.fromEntries(TIPOS.map(([id, , n]) => [id, n]));

let sucio = false, urlPreviaInicial = '';
// «Escribir sobre esto» (desde la ficha de una publicación): blog.html?juego=<id>
let JUEGO_INICIAL = (new URLSearchParams(location.search).get('juego') || '').match(/^[a-f0-9]{24}$/i)?.[0].toLowerCase() || '';
const tomarJuegoInicial = () => { const j = JUEGO_INICIAL; JUEGO_INICIAL = ''; if (j) try { history.replaceState(null, '', location.pathname); } catch (_) {} return j; };
window.addEventListener('beforeunload', e => { if (sucio) { e.preventDefault(); e.returnValue = ''; } });

// Plantillas: un punto de partida para no empezar con la hoja en blanco
const PLANTILLAS = [
  ['blanco', 'document-outline', 'En blanco', 'Empieza desde cero', []],
  ['resena', 'star-outline', 'Reseña de juego', 'Opinión, ficha y nota final', [{ tipo: 'texto', texto: 'Cuenta en dos frases de qué va el juego y por qué lo probaste.', grande: true }, { tipo: 'imagen' }, { tipo: 'titulo', texto: 'Lo mejor' }, { tipo: 'texto', texto: '- Punto fuerte 1\n- Punto fuerte 2\n- Punto fuerte 3' }, { tipo: 'titulo', texto: 'Lo peor' }, { tipo: 'texto', texto: '- Punto débil 1\n- Punto débil 2' }, { tipo: 'ficha', titulo: 'Ficha', filas: [{ k: 'Género', v: 'Acción' }, { k: 'Plataforma', v: 'Android' }, { k: 'Peso', v: '1,2 GB' }] }, { tipo: 'aviso', estilo: 'exito', texto: '**Nota final: 8/10.** Recomendado si te gusta…' }]],
  ['guia', 'construct-outline', 'Guía de instalación', 'Requisitos y pasos numerados', [{ tipo: 'texto', texto: 'Qué vas a conseguir con esta guía y cuánto tiempo toma.' }, { tipo: 'ficha', titulo: 'Requisitos', filas: [{ k: 'Android', v: '10 o superior' }, { k: 'RAM', v: '4 GB' }, { k: 'Espacio libre', v: '3 GB' }] }, { tipo: 'titulo', texto: 'Paso a paso' }, { tipo: 'texto', texto: '1. Descarga los archivos.\n2. Instala la APK.\n3. Copia la carpeta OBB.\n4. Abre el juego.' }, { tipo: 'aviso', estilo: 'alerta', texto: 'Haz una copia de tu partida antes de empezar.' }, { tipo: 'video' }, { tipo: 'faq', items: [{ p: '¿Sirve en mi celular?', r: 'Funciona en la mayoría de equipos con…' }, { p: 'Me sale pantalla negra, ¿qué hago?', r: 'Prueba a…' }] }]],
  ['noticia', 'megaphone-outline', 'Noticia', 'Titular, imagen y lo importante', [{ tipo: 'texto', texto: 'Lo más importante de la noticia en una o dos frases.', grande: true }, { tipo: 'imagen' }, { tipo: 'texto', texto: 'Desarrolla la noticia: qué pasó, cuándo y qué significa.' }, { tipo: 'cita', texto: 'Una frase destacada de la fuente.', autor: 'Fuente' }]],
  ['top', 'trophy-outline', 'Top 5', 'Una lista con tus favoritos', [{ tipo: 'texto', texto: 'Explica cómo elegiste esta lista.' }, ...[5, 4, 3, 2, 1].flatMap(n => [{ tipo: 'titulo', texto: `${n}. Nombre` }, { tipo: 'texto', texto: 'Por qué está en la lista.' }]), { tipo: 'boton', texto: 'Ver más en UpGames', url: 'https://upgames.games' }]],
];
function elegirPlantilla() {
  return new Promise(ok => {
    const c = hoja(`<h3>¿Cómo quieres empezar?</h3><div class="opciones">${PLANTILLAS.map(([id, i, n, d]) => `<button data-p="${id}">${ico(i)}<span>${n}<small>${d}</small></span></button>`).join('')}</div>`);
    $('#hoja').onclick = e => { if (e.target.id === 'hoja') { cerrarHoja(); ok(null); } };
    c.onclick = e => { const x = e.target.closest('[data-p]'); if (!x) return; cerrarHoja(); ok(PLANTILLAS.find(p => p[0] === x.dataset.p)[4]); };
  });
}

async function editor(tipo, id) {
  const esPag = tipo === 'pagina';
  let inicial = null;
  const juegoDesde = !id && !esPag ? tomarJuegoInicial() : '';
  if (!id && !esPag) { inicial = juegoDesde ? [{ tipo: 'juego', id: juegoDesde }, { tipo: 'texto', texto: '' }] : await elegirPlantilla(); if (inicial === null) return; }
  let E = { titulo: '', bloques: inicial?.length ? inicial : [{ tipo: 'texto', texto: '' }], etiquetas: [], portadaPropia: '', resumenPropio: '', estado: 'borrador', publicadaEn: null };
  urlPreviaInicial = '';
  app.innerHTML = '<div class="cargando"><span class="giro"></span></div>';
  if (id) { try { const r = await api(`/blogs/${S.blog.id}/entradas/${id}`); E = r.entrada; urlPreviaInicial = r.previa || ''; } catch (e) { toast(e.message, true); return panel(); } }
  const meta = { etiquetas: (E.etiquetas || []).join(', '), portada: E.portadaPropia || '', resumen: E.resumenPropio || '', programar: E.estado === 'programada' && new Date(E.publicadaEn) > new Date() ? E.publicadaEn : '' };
  sucio = false;
  const publica = () => E.estado !== 'borrador';

  app.innerHTML = `<div class="editor">
    <header class="barra"><button class="ico" id="salir" aria-label="Volver">${ico('chevron-back')}</button><b>${id ? 'Editar' : 'Nueva'} ${esPag ? 'página' : 'entrada'}</b><span class="chip estado" id="estado"></span><button class="btn chico nexus" id="nexus" style="margin-left:8px" aria-label="Nexus escribe un borrador"><b>✦</b><span>Nexus</span></button><button class="btn chico" id="previa" style="margin-left:8px" aria-label="Vista previa">${ico('eye-outline')}<span>Vista previa</span></button></header>
    <div class="lienzo">
      <textarea class="titulo-entrada" id="titulo" rows="1" maxlength="140" placeholder="${esPag ? 'Título de la página' : 'Título de la entrada'}">${h(E.titulo)}</textarea>
      <div id="bloques"></div>
      <button class="anadir" id="anadir">${ico('add-circle-outline')} Añadir bloque</button>
    </div>
    <footer class="pie-editor"><button class="ico" id="opciones" aria-label="Opciones de la entrada">${ico('options-outline')}</button><button class="btn" id="borrador">Guardar borrador</button><button class="btn pri" id="publicar"></button></footer>
  </div>`;
  const cont = $('#bloques'), tit = $('#titulo');
  const pintarEstado = () => {
    const [txt, color] = ESTADOS[E.estado];
    $('#estado').textContent = txt; $('#estado').className = `chip estado ${color}`;
    $('#publicar').innerHTML = meta.programar ? `${ico('time-outline')} Programar` : publica() ? `${ico('checkmark')} Actualizar` : `${ico('paper-plane-outline')} Publicar`;
    $('#borrador').textContent = publica() ? 'Pasar a borrador' : 'Guardar borrador';
  };
  pintarEstado();
  crecer(tit); tit.oninput = () => { tit.value = tit.value.replace(/\n/g, ' '); crecer(tit); sucio = true; };
  cont.addEventListener('input', () => { sucio = true; });

  // Cada bloque es un elemento con una función leer() que devuelve su JSON
  function crearBloque(b) {
    const el = document.createElement('div');
    el.className = `bloque b-${b.tipo}`;
    const barra = extra => `<div class="herr"><span class="tipo">${NOMBRE_TIPO[b.tipo]}</span>${extra || ''}<span class="sep"></span><button data-mover="-1" aria-label="Subir">${ico('arrow-up')}</button><button data-mover="1" aria-label="Bajar">${ico('arrow-down')}</button><button data-borrar aria-label="Borrar bloque">${ico('trash-outline')}</button></div>`;
    const subida = async (boton, hecho) => { const f = await elegirImagen(); if (!f) return; await ocupado(boton, async () => { hecho(await subirImagen(f)); sucio = true; }); };

    if (b.tipo === 'texto') {
      el.innerHTML = barra(`<button data-cmd="bold" aria-label="Negrita"><b>B</b></button><button data-cmd="italic" aria-label="Cursiva"><i>I</i></button><button data-cmd="link" aria-label="Enlace">${ico('link')}</button><button data-cmd="insertUnorderedList" aria-label="Lista">${ico('list')}</button><button data-op="centro" aria-label="Centrar">${ico('reorder-three')}</button><button data-op="grande" aria-label="Letra grande">${ico('text')}</button>`) + `<div class="rico" contenteditable="true" data-ph="Escribe aquí…"></div>`;
      const rico = $('.rico', el), op = { centro: !!b.centro, grande: !!b.grande };
      const pintarOp = () => { rico.style.textAlign = op.centro ? 'center' : ''; rico.style.fontSize = op.grande ? '1.3rem' : ''; el.querySelectorAll('[data-op]').forEach(x => { x.style.color = op[x.dataset.op] ? 'var(--g)' : ''; }); };
      el.querySelectorAll('[data-op]').forEach(x => { x.onmousedown = e => e.preventDefault(); x.onclick = () => { op[x.dataset.op] = !op[x.dataset.op]; sucio = true; pintarOp(); }; });
      pintarOp();
      rico.innerHTML = aHtml(b.texto);
      rico.addEventListener('paste', e => { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain')); });
      el.querySelectorAll('[data-cmd]').forEach(x => {
        x.onmousedown = e => e.preventDefault();   // no perder la selección al tocar el botón
        x.onclick = () => {
          rico.focus();
          if (x.dataset.cmd === 'link') {
            const u = prompt('Pega el enlace (debe empezar por https://):', 'https://');
            if (!u) return;
            if (!/^https:\/\/[^\s()]+\.[^\s()]+$/.test(u.trim())) return toast('El enlace debe empezar por https://', true);
            document.execCommand('createLink', false, u.trim());
          } else document.execCommand(x.dataset.cmd, false);
          sucio = true;
        };
      });
      el.leer = () => ({ tipo: 'texto', texto: aMarcas(rico), centro: op.centro, grande: op.grande });
    } else if (b.tipo === 'titulo') {
      let nivel = b.nivel === 3 ? 3 : 2, centro = !!b.centro;
      el.innerHTML = barra(`<button data-nivel aria-label="Cambiar tamaño">${ico('text')}</button><button data-centro aria-label="Centrar">${ico('reorder-three')}</button>`) + `<input maxlength="160" placeholder="Subtítulo" value="${h(b.texto || '')}">`;
      el.classList.toggle('n3', nivel === 3);
      $('[data-nivel]', el).onclick = () => { nivel = nivel === 2 ? 3 : 2; el.classList.toggle('n3', nivel === 3); sucio = true; };
      const pintarC = () => { $('input', el).style.textAlign = centro ? 'center' : ''; $('[data-centro]', el).style.color = centro ? 'var(--g)' : ''; };
      $('[data-centro]', el).onclick = () => { centro = !centro; sucio = true; pintarC(); }; pintarC();
      el.leer = () => ({ tipo: 'titulo', texto: $('input', el).value, nivel, centro });
    } else if (b.tipo === 'imagen') {
      let url = b.url || '';
      const pintar = () => {
        el.innerHTML = barra(url ? `<button data-cambiar aria-label="Cambiar imagen">${ico('swap-horizontal')}</button>` : '') + (url ? `<img src="${h(mini(url, 1000))}" alt=""><input data-pie maxlength="200" placeholder="Pie de foto (opcional)" value="${h(b.pie || '')}"><input data-enlace placeholder="Enlace al tocar la imagen (opcional): https://…" value="${h(b.enlace || '')}" inputmode="url">` : `<button class="subiendo" data-cambiar style="width:100%">${ico('cloud-upload-outline')}<span>Toca para subir una imagen</span></button>`);
        el.querySelectorAll('[data-cambiar]').forEach(x => { x.onclick = () => subida(x, u => { b.pie = $('[data-pie]', el)?.value || b.pie; b.enlace = $('[data-enlace]', el)?.value || b.enlace; url = u; pintar(); }); });
      };
      pintar();
      el.leer = () => url ? { tipo: 'imagen', url, pie: $('[data-pie]', el)?.value || '', enlace: ($('[data-enlace]', el)?.value || '').trim() } : null;
    } else if (b.tipo === 'galeria') {
      const urls = [...(b.urls || [])];
      const pintar = () => {
        el.innerHTML = barra() + `<div class="rej">${urls.map((u, i) => `<div style="background-image:url('${h(mini(u, 300))}')"><button data-quitar="${i}" aria-label="Quitar">${ico('close')}</button></div>`).join('')}${urls.length < 12 ? `<button class="mas" data-mas aria-label="Añadir imagen">${ico('add')}</button>` : ''}</div>`;
        el.querySelectorAll('[data-quitar]').forEach(x => { x.onclick = () => { urls.splice(+x.dataset.quitar, 1); sucio = true; pintar(); }; });
        const mas = $('[data-mas]', el); if (mas) mas.onclick = () => subida(mas, u => { urls.push(u); pintar(); });
      };
      pintar();
      el.leer = () => urls.length ? { tipo: 'galeria', urls } : null;
    } else if (b.tipo === 'video') {
      el.innerHTML = barra() + `<div class="marco">${ico('logo-youtube')}</div><input placeholder="Pega el enlace del video de YouTube" value="${b.id ? `https://youtu.be/${h(b.id)}` : ''}" inputmode="url">`;
      const inp = $('input', el), marco = $('.marco', el);
      const ver = () => { const v = idYouTube(inp.value); marco.style.backgroundImage = v ? `url('https://i.ytimg.com/vi/${v}/hqdefault.jpg')` : ''; };
      inp.oninput = ver; ver();
      el.leer = () => { const v = idYouTube(inp.value); return v ? { tipo: 'video', id: v } : null; };
    } else if (b.tipo === 'cita') {
      el.innerHTML = barra() + `<textarea rows="1" maxlength="1200" placeholder="Escribe la cita…">${h(b.texto || '')}</textarea><input maxlength="80" placeholder="Autor (opcional)" value="${h(b.autor || '')}">`;
      const ta = $('textarea', el); ta.oninput = () => crecer(ta); setTimeout(() => crecer(ta));
      el.leer = () => ({ tipo: 'cita', texto: ta.value, autor: $('input', el).value });
    } else if (b.tipo === 'boton') {
      el.innerHTML = barra() + `<div class="centro" style="text-align:center"><span class="muestra" contenteditable="true">${h(b.texto || 'Descargar')}</span></div><input placeholder="https://… a dónde lleva el botón" value="${h(b.url || '')}" inputmode="url">`;
      $('.muestra', el).addEventListener('paste', e => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\n/g, ' ')); });
      el.leer = () => ({ tipo: 'boton', texto: $('.muestra', el).textContent.trim(), url: $('input', el).value.trim() });
    } else if (b.tipo === 'juego' || b.tipo === 'descarga') {
      el.innerHTML = barra() + `<div class="tarj" hidden></div><input placeholder="Pega el enlace de una publicación de UpGames" value="${b.id ? h(b.id) : ''}">`;
      const inp = $('input', el), tarj = $('.tarj', el);
      const sacar = () => (inp.value.match(/[a-f0-9]{24}/i) || [''])[0].toLowerCase();
      let t; const ver = () => { clearTimeout(t); const jid = sacar(); if (!jid) { tarj.hidden = true; return; } t = setTimeout(async () => {
        try { const r = await fetch(`${API}/items/${jid}`).then(x => x.json()); const j = r && r._id ? r : (r.item || r);   // la publicación trae un campo «juego» (texto): no confundirlo
          if (!j?.title) throw 0;
          tarj.innerHTML = `${j.image ? `<img src="${h(mini(j.image, 200))}" alt="">` : ''}<span><b>${h(j.title)}</b><small>por @${h(j.usuario)}</small></span>`; tarj.hidden = false;
        } catch (_) { tarj.innerHTML = '<small>No encontramos esa publicación. Revisa el enlace.</small>'; tarj.hidden = false; } }, 400); };
      inp.oninput = ver; ver();
      el.leer = () => { const jid = sacar(); return jid ? { tipo: b.tipo, id: jid } : null; };
    } else if (b.tipo === 'aviso') {
      let estilo = ['info', 'exito', 'alerta', 'peligro'].includes(b.estilo) ? b.estilo : 'info';
      const COL = { info: '#3B9EFF', exito: '#2FBF71', alerta: '#F5A524', peligro: '#F04438' };
      el.innerHTML = barra(Object.keys(COL).map(k => `<button data-est="${k}" aria-label="Color ${k}"><span style="width:16px;height:16px;border-radius:50%;background:${COL[k]};display:block"></span></button>`).join('')) + `<textarea rows="1" maxlength="1500" placeholder="Un aviso importante: versión, advertencia, consejo…">${h(b.texto || '')}</textarea>`;
      const ta = $('textarea', el);
      const pintarA = () => { ta.style.borderLeftColor = COL[estilo]; ta.style.background = COL[estilo] + '18'; };
      el.querySelectorAll('[data-est]').forEach(x => { x.onclick = () => { estilo = x.dataset.est; sucio = true; pintarA(); }; });
      ta.oninput = () => crecer(ta); setTimeout(() => crecer(ta)); pintarA();
      el.leer = () => ({ tipo: 'aviso', texto: ta.value, estilo });
    } else if (b.tipo === 'faq' || b.tipo === 'ficha') {
      // Listas de pares: pregunta/respuesta (faq) o dato/valor (ficha de requisitos)
      const esFaq = b.tipo === 'faq';
      const filas = (esFaq ? (b.items || []).map(i => [i.p, i.r]) : (b.filas || []).map(f => [f.k, f.v]));
      if (!filas.length) filas.push(...(esFaq ? [['', '']] : [['Sistema', ''], ['RAM', ''], ['Almacenamiento', '']]));
      const leerFilas = () => [...el.querySelectorAll('.par')].map(p => [p.children[0].value, p.children[1].value]);
      const pintar = () => {
        el.innerHTML = barra() + (esFaq ? '' : `<input data-tit maxlength="80" placeholder="Título de la ficha (ej.: Requisitos)" value="${h(b.titulo || '')}" style="font-weight:800">`)
          + filas.map(([k, v], i) => `<div class="par${esFaq ? ' par-faq' : ''}"><input maxlength="${esFaq ? 200 : 60}" placeholder="${esFaq ? 'Pregunta' : 'Dato'}" value="${h(k)}">${esFaq ? `<textarea rows="2" maxlength="1500" placeholder="Respuesta">${h(v)}</textarea>` : `<input maxlength="200" placeholder="Valor" value="${h(v)}">`}<button data-fuera="${i}" aria-label="Quitar">${ico('close')}</button></div>`).join('')
          + (filas.length < 20 ? `<button class="btn chico" data-otra style="margin-top:8px">${ico('add')} ${esFaq ? 'Otra pregunta' : 'Otro dato'}</button>` : '');
        el.querySelectorAll('[data-fuera]').forEach(x => { x.onclick = () => { const f = leerFilas(); b.titulo = $('[data-tit]', el)?.value; f.splice(+x.dataset.fuera, 1); filas.splice(0, filas.length, ...f); sucio = true; pintar(); }; });
        const otra = $('[data-otra]', el); if (otra) otra.onclick = () => { const f = leerFilas(); b.titulo = $('[data-tit]', el)?.value; filas.splice(0, filas.length, ...f, ['', '']); sucio = true; pintar(); el.querySelectorAll('.par')[filas.length - 1].children[0].focus(); };
      };
      pintar();
      el.leer = () => esFaq ? { tipo: 'faq', items: leerFilas().filter(([p, r]) => p.trim() && r.trim()).map(([p, r]) => ({ p, r })) }
        : { tipo: 'ficha', titulo: $('[data-tit]', el).value, filas: leerFilas().filter(([k, v]) => k.trim() && v.trim()).map(([k, v]) => ({ k, v })) };
    } else if (b.tipo === 'audio') {
      el.innerHTML = barra() + `<div class="marco" style="aspect-ratio:auto;height:84px;font-size:2.2rem;background:#1DB95422;color:#1DB954">${ico('musical-notes')}</div><input placeholder="Pega el enlace de Spotify (canción, álbum, lista o podcast)" value="${b.id ? `https://open.spotify.com/${h(b.clase)}/${h(b.id)}` : ''}" inputmode="url">`;
      const inp = $('input', el);
      const ok = () => /^https:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(track|album|playlist|episode|show)\/[A-Za-z0-9]{22}/.test(inp.value.trim());
      el.leer = () => ok() ? { tipo: 'audio', url: inp.value.trim() } : null;
    } else if (b.tipo === 'codigo') {
      el.innerHTML = barra() + `<textarea rows="4" maxlength="8000" spellcheck="false" placeholder="Pega aquí el código o los comandos">${h(b.texto || '')}</textarea>`;
      el.leer = () => ({ tipo: 'codigo', texto: $('textarea', el).value });
    } else {
      el.innerHTML = barra() + '<hr>';
      el.leer = () => ({ tipo: 'separador' });
    }
    el.addEventListener('click', e => {
      cont.querySelectorAll('.bloque.activo').forEach(x => x !== el && x.classList.remove('activo'));
      el.classList.add('activo');
      const mv = e.target.closest('[data-mover]');
      if (mv) { const otro = +mv.dataset.mover < 0 ? el.previousElementSibling : el.nextElementSibling; if (otro) { +mv.dataset.mover < 0 ? cont.insertBefore(el, otro) : cont.insertBefore(otro, el); sucio = true; el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }
      if (e.target.closest('[data-borrar]')) { el.remove(); sucio = true; }
    });
    return el;
  }
  (E.bloques?.length ? E.bloques : [{ tipo: 'texto', texto: '' }]).forEach(b => cont.appendChild(crearBloque(b)));

  $('#anadir').onclick = () => {
    const c = hoja(`<h3>Añadir bloque</h3><div class="tipos">${TIPOS.map(([t, i, n]) => `<button data-t="${t}">${ico(i)}<span>${n}</span></button>`).join('')}</div>`);
    c.onclick = e => {
      const x = e.target.closest('[data-t]'); if (!x) return;
      cerrarHoja();
      if (cont.children.length >= 80) return toast('Llegaste al máximo de bloques de una entrada.', true);
      const el = crearBloque({ tipo: x.dataset.t });
      cont.appendChild(el); sucio = true;
      el.classList.add('activo'); el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      (el.querySelector('.rico, input, textarea') || el).focus?.();
      if (x.dataset.t === 'imagen') $('[data-cambiar]', el)?.click();
    };
  };

  $('#opciones').onclick = () => {
    const local = d => { const f = new Date(d); return isNaN(f) ? '' : new Date(f.getTime() - f.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
    const c = hoja(`<h3>Opciones de la ${esPag ? 'página' : 'entrada'}</h3>
      ${esPag ? '' : `<label class="campo"><span>Etiquetas</span><input class="inp" id="o-et" maxlength="260" placeholder="mods, android, guías" value="${h(meta.etiquetas)}"><small>Sepáralas con comas. Hasta 8.</small></label>`}
      <div class="campo"><span>Imagen de portada</span><div class="fila">${meta.portada ? `<img src="${h(mini(meta.portada, 240))}" alt="" style="height:60px;border-radius:10px">` : ''}<button class="btn chico" id="o-port">${ico('image-outline')} ${meta.portada ? 'Cambiar' : 'Subir'}</button>${meta.portada ? '<button class="btn chico rojo" id="o-port-no">Quitar</button>' : ''}</div><small>Si no subes una, se usa la primera imagen de la entrada.</small></div>
      <label class="campo"><span>Resumen</span><textarea class="inp" id="o-res" maxlength="300" placeholder="Una o dos frases. Si lo dejas vacío se toma del texto.">${h(meta.resumen)}</textarea></label>
      ${esPag ? '' : `<label class="campo"><span>Programar publicación</span><input class="inp" type="datetime-local" id="o-prog" value="${h(local(meta.programar))}"><small>Déjalo vacío para publicar al momento.</small></label>`}
      <button class="btn pri ancho" id="o-ok">Listo</button>`);
    const guardarCampos = () => { if (!esPag) { meta.etiquetas = $('#o-et', c).value; const p = $('#o-prog', c).value; meta.programar = p ? new Date(p).toISOString() : ''; } meta.resumen = $('#o-res', c).value; sucio = true; };
    $('#o-port', c).onclick = async ev => { const f = await elegirImagen(); if (!f) return; guardarCampos(); await ocupado(ev.currentTarget, async () => { meta.portada = await subirImagen(f); }); $('#opciones').click(); };
    const no = $('#o-port-no', c); if (no) no.onclick = () => { guardarCampos(); meta.portada = ''; $('#opciones').click(); };
    $('#o-ok', c).onclick = () => { guardarCampos(); cerrarHoja(); pintarEstado(); };
  };

  // ✦ Nexus escritor: arma el borrador con bloques a partir de una publicación de UpGames
  $('#nexus').onclick = () => {
    const actual = [...cont.children].map(x => x.leer?.()).find(b => b && (b.tipo === 'juego' || b.tipo === 'descarga'))?.id || juegoDesde || '';
    const c = hoja(`<h3>✦ Nexus escribe por ti</h3><p style="color:var(--txt2)">Elige la publicación y qué quieres escribir. Nexus arma un borrador con bloques; tú lo revisas, lo completas con tu experiencia y lo publicas.</p>
      <label class="campo"><span>Publicación de UpGames</span><input class="inp" id="n-id" placeholder="Pega el enlace de la publicación" value="${h(actual)}"></label>
      <label class="campo"><span>Qué escribir</span><select class="inp" id="n-tipo"><option value="resena">Reseña</option><option value="guia">Guía de instalación</option><option value="noticia">Noticia</option></select></label>
      <label class="campo"><span>Enfoque (opcional)</span><input class="inp" id="n-nota" maxlength="200" placeholder="Ej.: rendimiento en celulares de gama baja"></label>
      <button class="btn pri ancho" id="n-ok">${ico('sparkles-outline')} Escribir borrador</button>`);
    $('#n-ok', c).onclick = async ev => {
      const jid = ($('#n-id', c).value.match(/[a-f0-9]{24}/i) || [''])[0].toLowerCase();
      if (!jid) return toast('Pega el enlace de una publicación de UpGames.', true);
      const hayTexto = [...cont.children].some(x => { const b = x.leer?.(); return b && b.tipo === 'texto' && String(b.texto || '').trim(); });
      if (hayTexto && !(await confirmar('¿Reemplazar lo escrito?', 'El borrador de Nexus sustituirá los bloques que ya tienes.', 'Reemplazar', true))) return;
      try {
        await ocupado(ev.currentTarget, async () => {
          const r = await api('/blogs/nexus/escribir', { metodo: 'POST', cuerpo: { juegoId: jid, tipo: $('#n-tipo', c).value, nota: $('#n-nota', c).value } });
          cerrarHoja();
          cont.innerHTML = ''; r.bloques.forEach(b => cont.appendChild(crearBloque(b)));
          if (!tit.value.trim()) { tit.value = r.titulo; crecer(tit); }
          meta.etiquetas = (r.etiquetas || []).join(', '); meta.resumen = r.resumen || ''; sucio = true;
          toast('Borrador listo. Revísalo y complétalo con tu experiencia ✦');
        });
      } catch (e) { toast(e.message, true); }
    };
  };
  if (juegoDesde) setTimeout(() => $('#nexus').click(), 350);

  let urlPrevia = urlPreviaInicial;
  async function guardar(estado, boton, callado) {
    const bloques = [...cont.children].map(el => el.leer()).filter(b => b && (b.tipo === 'separador' || [b.texto, b.url, b.id].some(v => String(v || '').trim()) || [b.urls, b.items, b.filas].some(a => a?.length)));
    const titulo = tit.value.trim();
    if (!titulo) { tit.focus(); return toast('Ponle un título.', true); }
    if (estado !== 'borrador' && !bloques.length) return toast('La entrada está vacía. Escribe algo antes de publicar.', true);
    const malBoton = bloques.find(b => b.tipo === 'boton' && !/^https:\/\/\S+\.\S+/.test(b.url));
    if (malBoton) return toast('El botón necesita un enlace que empiece por https://', true);
    const programar = estado !== 'borrador' && meta.programar && new Date(meta.programar) > new Date();
    const cuerpo = { tipo, titulo, bloques, etiquetas: meta.etiquetas, portada: meta.portada, resumen: meta.resumen, estado: programar ? 'programada' : estado, publicadaEn: programar ? meta.programar : undefined };
    await ocupado(boton, async () => {
      const r = await api(`/blogs/${S.blog.id}/entradas${id ? '/' + id : ''}`, { metodo: id ? 'PUT' : 'POST', cuerpo });
      const antes = E.estado;
      E = r.entrada; id = E.id; urlPrevia = r.previa || ''; sucio = false; pintarEstado();
      if (callado) return;
      if (E.estado === 'publicada' && antes !== 'publicada') {
        const c = hoja(`<h3>¡Publicada! 🎉</h3><p>Tu ${esPag ? 'página' : 'entrada'} ya está en internet.</p><code style="word-break:break-all;color:var(--cy);font-size:.86rem">${h(r.url)}</code>
          <div class="fila"><button class="btn" data-c style="flex:1">${ico('copy-outline')} Copiar enlace</button><a class="btn pri" style="flex:1" href="${h(r.url)}" target="_blank" rel="noopener">${ico('open-outline')} Verla</a></div><button class="btn ancho" data-l>Volver a la lista</button>`);
        $('[data-c]', c).onclick = () => copiar(r.url);
        $('[data-l]', c).onclick = () => { cerrarHoja(); panel(); };
      } else toast(E.estado === 'programada' ? `Programada para el ${new Date(E.publicadaEn).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' })}` : E.estado === 'borrador' ? 'Borrador guardado' : 'Cambios publicados');
    });
  }
  $('#publicar').onclick = e => guardar('publicada', e.currentTarget);
  // Vista previa: guarda lo que hay (sin cambiar si está publicada o no) y abre el enlace privado
  $('#previa').onclick = async e => {
    const boton = e.currentTarget, w = window.open('', '_blank');
    // Un borrador se guarda antes de verlo. Lo ya publicado no: guardarlo publicaría los cambios.
    if (E.estado === 'borrador') await guardar('borrador', boton, true);
    else if (sucio) toast('Se muestra lo último guardado. Toca «Actualizar» para ver tus cambios.');
    if (urlPrevia && (E.estado !== 'borrador' || !sucio)) { if (w) w.location = urlPrevia; else location.href = urlPrevia; } else w?.close();
  };
  $('#borrador').onclick = async e => {
    const boton = e.currentTarget;
    if (publica() && !(await confirmar('¿Pasar a borrador?', 'Dejará de verse en tu blog hasta que la publiques otra vez.', 'Pasar a borrador'))) return;
    guardar('borrador', boton);
  };
  $('#salir').onclick = async () => {
    if (sucio && !(await confirmar('¿Salir sin guardar?', 'Hay cambios que no has guardado.', 'Salir', true))) return;
    sucio = false; S.vista = esPag ? 'paginas' : 'entradas'; panel();
  };
  if (!id) tit.focus();
}

// ── ARRANQUE ────────────────────────────────────────────────────────
(async function iniciar() {
  const q = new URLSearchParams(location.search);
  const rep = (q.get('reportar') || '').toLowerCase();
  if (/^[a-z0-9-]{3,30}$/.test(rep)) return reporte(rep);
  if (!TOKEN || !YO) return bienvenida();
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (_) {}
  try {
    const [t, m] = await Promise.all([api('/blogs/temas', { publico: true }), api('/blogs/mios')]);
    S.temas = t.temas; S.fuentes = t.fuentes; S.fondos = t.fondos || []; S.cpm = t.cpm || 0; S.blogs = m.blogs; S.maximo = m.maximo; S.premium = !!m.premium;
    S.blog = S.blogs[0] || null;
    S.blog ? (JUEGO_INICIAL ? editor('entrada') : panel()) : asistente(false);
  } catch (e) {
    app.innerHTML = `<div class="portal">${LOGO}<div class="vacio" style="margin-top:40px"><b>No se pudo cargar</b>${h(e.message)}<br><br><button class="btn" onclick="location.reload()">Reintentar</button></div></div>`;
  }
})();
})();
