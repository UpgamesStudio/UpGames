# Lurveta · Film de lanzamiento

Anuncio del paso de **UpGames a Lurveta** y del ecosistema que hay hoy en la plataforma.
**1920×1080 · 30 fps · H.264 High · AAC 48 kHz · 80 s · −14 LUFS.** Sin locución; música original.

La investigación, el concepto («Convergencia»), el guion, el storyboard, la dirección de arte y el plan
técnico están en [`PREPRODUCCION.md`](PREPRODUCCION.md).

## Cómo volver a producirlo

```bash
cd marketing/lanzamiento
node capturar.js                 # (opcional) vuelve a capturar la plataforma real en producción → capturas/
node render.js                   # graba los 2 400 cuadros en paralelo (≈ 5 min con 4 núcleos), compone el sonido y mezcla
PREVIEW="8.1,24,64.5" node render.js   # solo esos instantes como PNG en previas/
SOLO_AUDIO=1 node render.js      # rehace solo el sonido sobre el video ya grabado
```

Necesita Node, Playwright (Chromium) y ffmpeg con libx264 y libwebp. El render sirve el repositorio por HTTP
(el film carga Three.js desde `games/studio/lib`, el logotipo desde `public/icons/logo-lurveta.svg` y las capturas).
Vista previa en el navegador: `video.html?t=12.5` o `video.html?play`, servido desde la raíz del repo.

## Archivos

| Archivo | Qué es |
|---|---|
| `video.html` | El film: `render(t)` dibuja cada fotograma de forma exacta. DOM + CSS 3D para la tipografía y las interfaces reales; Three.js para la V y el logotipo extruidos. Constantes de marca arriba (`MARCA`, `TAGLINE`, `DOMINIO`, `CTA`). |
| `render.js` | Grabación cuadro a cuadro en paralelo, codificación H.264 y mezcla del sonido. |
| `audio.js` | Música original y efectos por síntesis (tabla de ondas, FM, batería sintetizada, reverb, eco, sidechain). Lee los cortes de `sfx.json` que escribe `render.js` a partir de las escenas. |
| `capturar.js` | Capturas reales de https://upgames.games con Playwright (teléfono a 3×, escritorio a 1920×1080) y posiciones de los elementos (`capturas/medidas.json`). Solo lee; no toca el servidor. |
| `capturas/` | Las capturas que usa el film (WebP sin pérdida). |
| `recursos/` | El logotipo anterior de UpGames, sacado del historial del repositorio. |
| `fuentes/` | Inter / Inter Display (OFL), para que el render no dependa del sistema. |

## Decisiones que conviene saber

- **Nombre:** Lurveta (el brief decía «LUVERta»; la marca oficial en producción es Lurveta).
- **Dominio del cierre:** `upgames.games`, que es el oficial hoy. Si se registra un dominio Lurveta, se cambia `DOMINIO` y se vuelve a renderizar.
- **Eslogan:** «Donde todo converge.» es una **propuesta** (justificación y alternativas en `PREPRODUCCION.md`); cambiarla es editar `TAGLINE`.
- **Datos reales, sin inventar:** no se muestran cifras, saldos ni respuestas de Nexus. Las publicaciones que aún se titulan «UPGAMES…» se quitan de las capturas, y la portada de LURVETA RACING usa el arte oficial actual del juego.
- **Funciones fuera del film:** la IA 3D a partir de fotos de Studio (desactivada en producción) y los feeds vacíos (artículos de Novedades, lives en curso).
