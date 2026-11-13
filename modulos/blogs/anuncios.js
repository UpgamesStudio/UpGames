/**
 * UpGames Blogs · anuncios (monetización opcional)
 *
 * Si el creador activa «Monetizar», sus páginas llevan un espacio de publicidad. El anuncio
 * NO se carga dentro de la página del blog (que sigue sin scripts): va en un marco aislado
 * (iframe con sandbox) que sirve este módulo. El marco:
 *   1. recibe un ticket firmado por el servidor (blog + hora + IP),
 *   2. comprueba que no haya bloqueador y que el anuncio estuvo a la vista unos segundos,
 *   3. avisa al servidor con una imagen (GET …/_av?t=ticket), que es lo que paga al creador.
 * Un script que llame directo a /_av sin ticket, antes de tiempo o repitiendo ticket no cobra.
 */
'use strict';
const crypto = require('crypto');

const ESPERA_MS = 8e3;           // el anuncio debe estar a la vista 10 s; 2 s de margen por la red
const VIGENCIA_MS = 20 * 60e3;
const CPM = Math.max(0, Math.min(5, parseFloat(process.env.BLOGS_CPM) || 0.30));   // US$ por 1.000 anuncios vistos
const CLAVE_BANNER = /^[a-f0-9]{32}$/.test(process.env.BLOGS_AD_KEY || '') ? process.env.BLOGS_AD_KEY : '0af19e39530f3a17d0722c5f0c91735a';   // 300×250, la misma red que la página puente

const huellaIp = ip => crypto.createHash('sha256').update(String(ip || '')).digest('base64url').slice(0, 10);
const firma = (secreto, id, t, ip) => crypto.createHmac('sha256', secreto).update(`blog-ad|${id}|${t}|${huellaIp(ip)}`).digest('base64url').slice(0, 32);

const emitir = (secreto, blogId, ip, ahora = Date.now()) => `${ahora.toString(36)}.${firma(secreto, String(blogId), ahora, ip)}`;

/** → { ok:true } | { ok:false, motivo:'falta'|'invalido'|'vencido'|'pronto' } */
function verificar(secreto, ticket, blogId, ip, ahora = Date.now()) {
    if (!ticket || typeof ticket !== 'string' || ticket.length > 80) return { ok: false, motivo: 'falta' };
    const [t36, f] = ticket.split('.');
    const t = parseInt(t36, 36);
    if (!Number.isFinite(t) || !f) return { ok: false, motivo: 'invalido' };
    const esperada = firma(secreto, String(blogId), t, ip);
    if (f.length !== esperada.length || !crypto.timingSafeEqual(Buffer.from(f), Buffer.from(esperada))) return { ok: false, motivo: 'invalido' };
    if (t > ahora + 5e3 || ahora - t > VIGENCIA_MS) return { ok: false, motivo: 'vencido' };
    if (ahora - t < ESPERA_MS) return { ok: false, motivo: 'pronto' };
    return { ok: true };
}

/** Firma corta para la vista previa de un borrador (solo quien tiene el enlace lo ve). */
const firmaPrevia = (secreto, entradaId) => crypto.createHmac('sha256', secreto).update(`blog-previa|${entradaId}`).digest('base64url').slice(0, 22);

/** Página del marco del anuncio. `avisar` es la URL absoluta de …/_av (sin el ticket). */
function pagina(ticket, avisar) {
    return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Publicidad</title>
<style>html,body{margin:0;background:transparent;overflow:hidden}body{display:grid;place-items:center;min-height:250px}</style></head><body>
<script>atOptions={'key':'${CLAVE_BANNER}','format':'iframe','height':250,'width':300,'params':{}};</script>
<script data-cfasync="false" src="https://www.highperformanceformat.com/${CLAVE_BANNER}/invoke.js"></script>
<script>
(function(){
  var T=${JSON.stringify(ticket)},U=${JSON.stringify(avisar)},visto=0,hecho=false,bloq=false,ultimo=0,aLaVista=false;
  var cebo=document.createElement('div');cebo.className='ad-banner ad-unit ads adsbox ad-placeholder adsbygoogle pub_300x250';
  cebo.style.cssText='width:1px;height:1px;position:absolute;top:-9999px;left:-9999px';document.body.appendChild(cebo);
  setTimeout(function(){var s=getComputedStyle(cebo);bloq=!cebo.offsetHeight||s.display==='none'||s.visibility==='hidden'||!document.body.contains(cebo);},400);
  try{new IntersectionObserver(function(e){aLaVista=e[0].isIntersecting&&e[0].intersectionRatio>=.5;},{threshold:[0,.5,1]}).observe(document.documentElement);}catch(_){aLaVista=true;}
  setInterval(function(){
    var ahora=Date.now();
    if(aLaVista&&!document.hidden&&ultimo)visto+=ahora-ultimo;
    ultimo=ahora;
    if(!hecho&&visto>=10000){hecho=true;if(!bloq&&document.querySelector('iframe'))(new Image()).src=U+'?t='+encodeURIComponent(T);}
  },500);
})();
</script></body></html>`;
}

module.exports = { emitir, verificar, firmaPrevia, pagina, CPM, ESPERA_MS };
