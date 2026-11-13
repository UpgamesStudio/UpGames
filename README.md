# UpGames
La primera plataforma de su especie en el mundo 

## En vivo (UpGames Live)

Transmisiones de gameplay con chat en tiempo real, regalos y monedas. Página: `public/live.html`. Backend: `rutas/live.js`. Reglas de la economía: `modulos/live.js`.

**Video:**
- Funciona sin infraestructura extra en modo P2P (WebRTC navegador a navegador).
- Para OBS y público grande, despliega el servidor de medios opcional: ver [`mediamtx/README.md`](mediamtx/README.md).

**Economía:**
- 1 moneda = US$0,01. El espectador compra paquetes con PayPal y los regala.
- El creador recibe `1 − LIVE_COMISION` del valor de cada regalo.
- Lo ganado queda retenido `LIVE_RETENCION_DIAS` días y luego pasa a su saldo retirable. Eso cubre los contracargos.

| Variable | Por defecto | Para qué |
|---|---|---|
| `LIVE_COMISION` | `0.30` | Comisión de la plataforma por regalo |
| `LIVE_RETENCION_DIAS` | `7` | Días de retención antes de que sea retirable |
| `LIVE_P2P_MAX_VIEWERS` | `12` | Espectadores con video en modo P2P |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` / `PAYPAL_MODE` | — | Las mismas de los retiros; activan la compra de monedas |
| `PAYPAL_WEBHOOK_ID` | — | Webhook de PayPal (`/monedas/paypal-webhook`) para revertir reembolsos y contracargos |
| `TURN_URL` / `TURN_USER` / `TURN_PASS` | — | Servidor TURN: mejora la conexión P2P detrás de redes estrictas |

El estado de las salas vive en memoria, así que el backend debe correr con **una réplica**. Para usar varias hace falta el adaptador de Redis de Socket.IO.

## Música de fondo

`public/upgames-musica.js` reproduce de fondo las pistas de `public/audio/` (Infraction, música sin copyright), una distinta en cada sesión, normalizadas a −16 LUFS con ffmpeg (`loudnorm=I=-16:TP=-1.5:LRA=11`). El usuario la silencia o ajusta el volumen desde el botón flotante; se baja sola cuando suena un video. Para añadir una canción: normalízala igual, cópiala a `public/audio/` y agrégala a `PISTAS`.

## UpGames Blogs

Cada creador puede armar su sitio desde `public/blog.html`: elige un tema, escribe entradas y páginas con un editor por bloques y publica. Backend: `rutas/blogs.js`. Lógica: `modulos/blogs/` (`validar.js`, `render.js`, `temas.js`, `modelos.js`).

- **Dirección gratis:** `https://<servidor>/b/<direccion>/`.
- **Dominio propio:** en Ajustes → Dominio propio, el creador crea un `CNAME` hacia UpGames y un `TXT` de verificación (`_upgames.<su dominio>`). Verificado el TXT, el servidor sirve el blog cuando la petición llega con ese `Host`.
- **Monetización opcional:** en Ingresos el creador decide si su blog lleva publicidad. El anuncio va en un marco aislado (`/_anuncio`); se paga cuando estuvo 10 s a la vista, sin bloqueador y con ticket firmado (`modulos/blogs/anuncios.js`), hasta 3 veces al día por visitante y blog.
- **Panel admin → Blogs:** blogs reportados o en revisión; se reactivan o se suspenden (`GET /admin/blogs`, `PUT /admin/blogs/:id/estado`).
- El contenido se guarda como bloques (JSON) y el servidor genera el HTML escapando todo: un blog no puede llevar scripts.

| Variable | Por defecto | Para qué |
|---|---|---|
| `BLOGS_CNAME` | dominio público de Railway | A dónde debe apuntar el `CNAME` de los dominios propios (p. ej. el host de Cloudflare for SaaS) |
| `BLOGS_CPM` | `0.30` | US$ que gana el creador por cada 1.000 anuncios vistos en su blog (solo si activó «Monetizar») |
| `BLOGS_AD_KEY` | la del puente | Clave del banner 300×250 de la red de anuncios que se muestra en los blogs |
| `BLOGS_DOMINIO` | — | Dominio de blogs con comodín (p. ej. `upgames.site`): cada blog queda en `<direccion>.upgames.site` |

Para que un dominio propio abra con HTTPS, además del DNS del creador, el dominio debe estar dado de alta donde termina el TLS: en Railway (Settings → Networking → Custom Domain) o, mejor, en Cloudflare for SaaS delante del servidor.
