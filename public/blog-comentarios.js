/* UpGames Blogs · comentarios de una entrada (marco aislado dentro de la página del blog).
   Todo lo que escriben los usuarios se inserta con textContent: nunca como HTML. */
(() => {
'use strict';
const LOCAL = ['localhost', '127.0.0.1'].includes(location.hostname);
const Q = new URLSearchParams(location.search);
const API = (LOCAL && Q.get('api')) || window.UG_CONFIG?.API_URL || 'https://upgames-production.up.railway.app';
const EID = (Q.get('e') || '').match(/^[a-f0-9]{24}$/i)?.[0] || '';
const leer = k => { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } };
const TOKEN = leer('token'), YO = leer('user_admin').toLowerCase();
const app = document.getElementById('app');
if (/^[0-9a-f]{6}$/i.test(Q.get('c') || '')) { const c = Q.get('c'); const n = parseInt(c, 16); document.documentElement.style.setProperty('--acento', '#' + c); document.documentElement.style.setProperty('--sobre', ((n >> 16) * .299 + ((n >> 8) & 255) * .587 + (n & 255) * .114) > 150 ? '#0B0F14' : '#fff'); }
if (Q.get('t') === 'claro') document.documentElement.setAttribute('data-claro', '');

const el = (tag, props = {}, ...hijos) => { const e = Object.assign(document.createElement(tag), props); hijos.flat().forEach(h => e.append(h)); return e; };
const hace = f => { const s = (Date.now() - new Date(f)) / 1000; if (s < 60) return 'ahora'; if (s < 3600) return `hace ${Math.floor(s / 60)} min`; if (s < 86400) return `hace ${Math.floor(s / 3600)} h`; return `hace ${Math.floor(s / 86400)} d`; };
const api = async (ruta, metodo = 'GET', cuerpo) => {
  const r = await fetch(API + ruta, { method: metodo, headers: { 'Content-Type': 'application/json', ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}) }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const d = await r.json().catch(() => ({})); if (!r.ok || d.success === false) throw new Error(d.error || 'No se pudo completar.'); return d;
};

let dueno = '';
function tarjeta(c) {
  const foto = c.avatar && /^https:\/\//.test(c.avatar) ? el('img', { src: c.avatar, alt: '', loading: 'lazy' }) : el('div', { className: 'ini' }, (c.usuario || '?')[0].toUpperCase());
  const quitar = (YO && (YO === c.usuario.toLowerCase() || YO === dueno.toLowerCase())) ? el('button', { className: 'quitar', type: 'button', textContent: 'Borrar', onclick: async () => { try { await api(`/blogs/comentarios/${EID}/${c.id}`, 'DELETE'); cargar(); } catch (e) { alert(e.message); } } }) : '';
  return el('div', { className: 'c' }, foto, el('div', {}, el('b', {}, '@' + c.usuario), el('time', {}, hace(c.fecha)), quitar, el('p', {}, c.texto)));
}

function formulario(alEnviar) {
  if (!TOKEN) return el('div', { className: 'caja' }, el('p', { className: 'vacio', style: 'padding:6px 0' }, 'Inicia sesión en UpGames para comentar. '), el('div', { style: 'text-align:center' }, el('a', { className: 'boton', href: './login.html', target: '_blank', rel: 'noopener' }, 'Iniciar sesión')));
  const ta = el('textarea', { maxLength: 500, placeholder: 'Escribe un comentario respetuoso…' }), msg = el('div', { className: 'msg' }), n = el('small', {}, '0/500');
  const b = el('button', { type: 'button', textContent: 'Comentar' });
  ta.oninput = () => { n.textContent = `${ta.value.length}/500`; };
  b.onclick = async () => {
    const texto = ta.value.trim(); if (!texto) return; b.disabled = true; msg.textContent = '';
    try { await api(`/blogs/comentarios/${EID}`, 'POST', { texto }); ta.value = ''; n.textContent = '0/500'; alEnviar(); } catch (e) { msg.textContent = e.message; }
    b.disabled = false;
  };
  return el('div', { className: 'caja' }, ta, el('div', { className: 'fila' }, n, b), msg);
}

async function cargar() {
  if (!EID) { app.replaceChildren(el('p', { className: 'vacio' }, 'Comentarios no disponibles.')); return; }
  let d; try { d = await api(`/blogs/comentarios/${EID}`); } catch (_) { app.replaceChildren(el('p', { className: 'vacio' }, 'No se pudieron cargar los comentarios.')); return; }
  dueno = d.dueno || '';
  const lista = el('div', { className: 'lista' }, d.comentarios.length ? d.comentarios.map(tarjeta) : el('p', { className: 'vacio' }, 'Sé el primero en comentar.'));
  app.replaceChildren(el('h2', {}, `Comentarios · ${d.comentarios.length}`), formulario(cargar), lista);
}
cargar();
})();
