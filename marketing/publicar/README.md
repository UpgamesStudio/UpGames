# Video SaaS · Cómo publicar tu proyecto en UpGames

Animación estilo **SaaS motion graphics** que explica, en tres pasos, cómo publicar un juego, mod o app en UpGames. Usa el mismo motor y la misma identidad que `marketing/saas` (verde → cian → violeta, cristal, Orbitron / Space Grotesk / JetBrains Mono). Horizontal **1920×1080 a 60 fps**, 35 s, con música y efectos. Sin locución: el mensaje va en texto cinético, así sirve con o sin sonido.

## Cómo grabarlo

```bash
cd marketing/publicar
node render.js                           # graba upgames-publicar.mp4 y mezcla el audio
PREVIEW="2.6,9.4,15.2" node render.js    # PNG de instantes concretos
```

Vista previa en Chrome: `video.html?play` (tiempo real) o `video.html?t=15` (un instante). Necesita Playwright y ffmpeg. El `.mp4` no se sube al repositorio (está en `.gitignore`).

## Hoja de tiempos

| Tiempo | Mensaje | Qué se ve |
|---|---|---|
| 0:00 | ¿Tienes un juego, un mod o una app? **Publícalo en 3 pasos.** | Logo, texto cinético y tres etiquetas (gratis, desde el celular, en menos de 2 minutos) |
| 0:04 | **Paso 1** · Entra a tu perfil y toca Publicar. | El perfil en un navegador; el cursor pulsa PUBLICAR y elige «Juego» entre los tipos |
| 0:10.5 | **Paso 2** · Cuéntanos de tu proyecto. | El formulario se rellena solo (nombre, descripción, portada, enlace de descarga) y a la derecha la tarjeta «así se verá» se completa a la vez |
| 0:20 | **Paso 3** · Toca Publicar. Listo. | Clic en PUBLICAR AHORA; estados: enviado → en revisión (Nexus IA y el equipo) → aprobada; la tarjeta aparece «en línea» |
| 0:26 | Tu proyecto empieza a ganar. | Tarifa de creador: sube hasta **US$1,50 por cada 1.000 visualizaciones de publicidad** |
| 0:31 | Publica hoy. Es gratis. | Logo, se escribe `upgames.games`, clic en PUBLICAR MI PROYECTO |

Los campos del formulario son los reales de la web (nombre, descripción, imágenes, enlace de descarga). El proyecto de ejemplo («Neon Drift») es inventado y el video lo indica. La tarifa y el mínimo de retiro son los de la plataforma.
