# Video SaaS · Creator Studio (demo de producto)

Demo de producto de **UpGames Creator Studio**: un cursor real que sube un juego, escribe sus datos, lo publica, mide y cobra. Horizontal **1920×1080 a 60 fps, 50 s**, **sin música**: solo los efectos de sonido de cada acción (clics, arrastre, teclas, interruptores, menús, tics de progreso, avisos, campanas y monedas). Sin locución: el mensaje va en una leyenda por capítulo, así se entiende con o sin sonido.

Es distinto a `marketing/saas` (texto cinético con neón y música) y a las demás animaciones: aquí la **interfaz es la protagonista**, con un estilo sobrio y mate (un solo acento verde), cámara que acompaña la acción como en una grabación de pantalla y el cursor siempre a tamaño real de pantalla.

## Cómo grabarlo

```bash
cd marketing/saas-demo
node render.js                        # graba upgames-saas-demo.mp4 (≈ 3-4 min) y mezcla el audio
SOLO_AUDIO=1 CONSERVAR=1 node render.js   # solo rehace el audio (necesita el .sin-audio.mp4)
PREVIEW="5,16.4,31.5" node render.js  # PNG de instantes concretos
```

Vista previa en Chrome: `video.html?play` (tiempo real) o `video.html?t=21.9` (un instante). Necesita Playwright y ffmpeg. El `.mp4` no se sube al repositorio (`.gitignore`).

## Archivos

- `video.html` — la app y todas las escenas. Todo se calcula en `render(t)`: cada fotograma es exacto y reproducible. La línea de tiempo (cursor, clics, escritura, cámara) está declarada arriba del script con `go()`, `click()`, `typing()` y `sfx()`.
- `render.js` — graba cuadro a cuadro con Chromium y codifica con ffmpeg.
- `audio.js` — sintetiza todos los efectos en el instante que cada acción los pide (`sfx(t, nombre, ganancia, tono)`) y los mezcla con un poco de sala. **No usa ninguna pista de música.**
- El logo se toma de `../saas/logo.png`.

## Hoja de tiempos

| Tiempo | Capítulo | Qué pasa |
|---|---|---|
| 0:00 | Apertura | Logo y «Creator Studio»; la ventana de la app sube |
| 0:03.5 | **01 · Sube tu juego** | Un ZIP se arrastra a la zona de carga; subida con tics; tres verificaciones automáticas |
| 0:10.3 | **02 · Cuéntanos de qué va** | Escribe el título y la descripción (teclas), elige categoría en un menú, activa plataformas e ingresos por anuncios, elige portada; la vista previa se actualiza en vivo |
| 0:19.9 | **03 · Publica con un clic** | Botón con giro, destello, aviso «ya está en línea» |
| 0:26 | **04 · Mide en tiempo real** | Indicadores contando, gráfica que se dibuja, el cursor recorre los días y muestra descargas |
| 0:35 | **05 · Cobra por cada anuncio visto** | Saldo, tarifa, control deslizante de retiro, PayPal, «Retiro solicitado» |
| 0:44 | Cierre | «Tu juego. Tu audiencia. Tus ingresos.», `upgames.games` y clic en «Empieza gratis» |

## Datos

El juego «Neon Rider», sus cifras y el saldo son **ilustrativos** (el video lo indica en pantalla). Son reales: la tarifa de **US$ 1,50 por cada 1.000 visualizaciones de publicidad**, el **retiro mínimo de US$ 10** y el cobro por **PayPal**. Los 41.880 anuncios vistos × US$ 1,50 / 1.000 dan los US$ 62,82 del saldo.
