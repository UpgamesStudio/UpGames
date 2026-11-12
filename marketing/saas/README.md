# Video SaaS · UpGames para desarrolladores independientes

Animación publicitaria estilo **SaaS motion graphics** con la identidad NEO de UpGames (verde → cian → violeta, cristal, Orbitron / Space Grotesk / JetBrains Mono). Horizontal **1920×1080 a 60 fps**, 40 s, con música y efectos de sonido. Sin locución: el mensaje va en texto cinético, así sirve con o sin sonido.

## Cómo grabarlo

```bash
cd marketing/saas
node render.js                      # graba upgames-saas.mp4 (≈ 10 min) y mezcla el audio
SOLO_AUDIO=1 CONSERVAR=1 node render.js   # solo rehace el audio (necesita el .sin-audio.mp4)
PREVIEW="6.5,13,21" node render.js  # PNG de instantes concretos
```

Vista previa en Chrome: `video.html?play` (tiempo real) o `video.html?t=20.6` (un instante). Necesita Playwright y ffmpeg. El `.mp4` no se sube al repositorio (está en `.gitignore`).

## Archivos

- `video.html` — motor y escenas. Todo se calcula en `render(t)`: cada fotograma es exacto y reproducible.
- `render.js` — graba cuadro a cuadro con Chromium y codifica con ffmpeg.
- `audio.js` — sintetiza los efectos (whoosh, impacto, riser, contador, campana, clic…) en el instante que cada escena pide con `sfx()` y los mezcla con *If You Open Up* (Infraction, `public/audio/`, sin copyright). La caída de la música coincide con la aparición del logo; todo se normaliza a −14 LUFS.
- `logo.png` — el logotipo real con fondo transparente.

## Hoja de tiempos

| Tiempo | Mensaje | Qué se ve |
|---|---|---|
| 0:00 | Creaste algo increíble. Pero nadie lo ve. | Texto en grises sobre fondo apagado; «0 vistas · 0 seguidores · $0»; todo se encoge a un punto |
| 0:04.7 | **UpGames** — La mejor plataforma del mundo para desarrolladores independientes | Caída de la música: logo con ondas de choque, el fondo se enciende |
| 0:09 | Tu vitrina, lista en minutos. | La web en un navegador 3D; las tarjetas entran; el cursor pulsa PUBLICAR y aparece «Tu juego ya está en línea» |
| 0:15.5 | No pagamos por ~~descargas~~. Pagamos por cada anuncio visto. | Tarjeta «Tu tarifa de creador»: sube hasta **US$1,50 por cada 1.000 visualizaciones de publicidad**, contador de anuncios vistos y +75 UpCoins |
| 0:23.2 | Todo lo que un creador indie necesita. | Seis tarjetas: Nexus IA, lives con regalos (25 %), estadísticas reales, comunidad, UpCoins y Premium, retiros |
| 0:29.9 | Mira crecer tus ingresos, en tiempo real. | Creator Studio: indicadores contando, gráfica dibujándose, meta de retiro al 100 % (desde US$10) |
| 0:34.9 | Publica una vez. Gana siempre. | Logo, se escribe `upgames.games`, clic en EMPIEZA GRATIS |

Los juegos, nombres y cifras del panel son ilustrativos (el video lo indica). La tarifa, el porcentaje de regalos, el mínimo de retiro y los métodos de cobro son los reales de la plataforma.
