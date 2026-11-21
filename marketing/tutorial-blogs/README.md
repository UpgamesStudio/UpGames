# Lurveta Blogs · Tutorial «Crea tu propia página web con Lurveta»

Tutorial animado del flujo completo de Lurveta Blogs, de crear el blog a compartirlo.
**1920×1080 · 30 fps · H.264 High · AAC 48 kHz · 101 s · −14 LUFS · locución + subtítulos.**

El guion, el storyboard, el inventario de funciones verificadas, la dirección de arte y las limitaciones están
en [`PREPRODUCCION.md`](PREPRODUCCION.md).

## Cómo volver a producirlo

```bash
cd marketing/tutorial-blogs
node servidor.js &                              # 1. entorno local: servidor real + base temporal + Nexus de la demo
node grabar.js                                  # 2. (opcional) vuelve a grabar el flujo real → capturas/ y medidas.json
python3 narracion.py --voces /ruta/a/voces      # 3. (opcional) locución con Piper → narracion.wav y tiempos.json
node render.js                                  # 4. graba 3 042 cuadros (≈ 1 min con 4 núcleos), compone el sonido y mezcla
PREVIEW="14,36,62" node render.js               # solo esos instantes como PNG en previas/
SOLO_AUDIO=1 node render.js                     # rehace solo el sonido
```

- **Requisitos:** Node, Playwright (Chromium), ffmpeg (libx264, libwebp) y, para la voz, `pip install piper-tts` con la voz `es_AR-daniela-high` (huggingface.co/rhasspy/piper-voices). `servidor.js` usa `mongodb-memory-server` de `test/real/node_modules`.
- **Vista previa en el navegador:** `video.html?t=30` o `video.html?play`, servido desde la raíz del repositorio.

## Archivos (versión editable)

| Archivo | Qué es |
|---|---|
| `guion.json` | Texto de la locución por frase. Si lo cambias, vuelve a correr `narracion.py`: la animación se ajusta sola a los nuevos tiempos. |
| `video.html` | El tutorial: `render(t)` dibuja cada fotograma. Cada escena se ancla a las frases de `tiempos.json`. Constantes arriba: `DOMINIO`, `LEMA`. |
| `render.js` | Grabación cuadro a cuadro en paralelo, H.264 y mezcla. |
| `audio.js` | Música original y efectos por síntesis, *sidechain* bajo la voz y normalización a −14 LUFS. |
| `narracion.py` | Locución con Piper, una frase por archivo; escribe `tiempos.json`. |
| `servidor.js` · `nexus-modelo.js` · `nexus/` | Entorno de demostración local. No toca producción. Sobre las respuestas de Nexus, ver `PREPRODUCCION.md` §2. |
| `grabar.js` | Recorre el flujo real con Playwright y guarda capturas a 2× con las cajas de cada botón. |
| `capturas/` | Capturas del flujo real (WebP sin pérdida) y `medidas.json`. |

Las salidas (`*.mp4`, `*.wav`, `sfx.json`, `previas/`, `demo.json`) no se versionan; se rehacen con los comandos de arriba.

## Antes de publicar

- **Configurar el DNS de lurveta.com.** Hoy no resuelve, y el video lo muestra en el cierre y en la barra del navegador.
- Las respuestas de Nexus que se ven las escribió Claude con los prompts reales; en producción serán parecidas, pero no idénticas.
