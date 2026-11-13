# Video · UpGames Blogs («Tu sitio web en minutos»)

Animación SaaS en **claro**: papel cálido, bloques pastel (lila, lima, rosa, aqua), un solo índigo y cristal esmerilado, con letra ligera a gran escala. Es la contraparte del video de `marketing/saas` (oscuro, neón verde): otro diseño, otras animaciones (texto que sube con rebote, bloques que caen al editor, mini-blogs que cambian de tema) y **otro sonido** (marimba, almohadillas y campanitas sintetizadas, sin archivos de música). Horizontal **1920×1080 a 60 fps**, 36 s.

## Cómo grabarlo

```bash
cd marketing/blogs
node render.js                       # graba upgames-blogs.mp4 (≈ 9 min) y mezcla el audio
SOLO_AUDIO=1 CONSERVAR=1 node render.js   # solo rehace el audio (necesita el .sin-audio.mp4)
PREVIEW="2.9,8.9,18.8" node render.js     # PNG de instantes concretos
```

Vista previa en Chrome: `video.html?play` (tiempo real) o `video.html?t=18.8` (un instante). Necesita Playwright y ffmpeg. El `.mp4` no se sube al repositorio.

## Hoja de tiempos

| Tiempo | Mensaje | Qué se ve |
|---|---|---|
| 0:00 | Escribe. Publica. Crece. | Palabras gigantes que suben con rebote y etiquetas (reseña, guía, noticia, top 5) |
| 0:03,7 | Arma tu entrada con bloques | Editor: el cursor toma bloques (texto, imagen, ficha, **descarga**) y caen a la entrada; se teclea el título |
| 0:10,3 | Nexus escribe el borrador | Se elige una publicación, «✦ Escribir borrador» y aparece una reseña con un hueco para tu experiencia |
| 0:15,7 | Elige cómo se ve | Tres mini-blogs (Neón, Cristal, Lienzo); los dos últimos son Premium (sin «Hecho con UpGames», hasta 10 blogs) |
| 0:21,3 | Tus lectores responden | Comentarios y notificación «@kale publicó en su blog» con el contador de seguidores avisados |
| 0:26,5 | Cada descarga suma | Entrada → página puente (30 s) → descarga; el contador de anuncios vistos suma al CPM |
| 0:31,3 | UpGames Blogs | Logo, `upgames.games/blog` y clic en «Crear mi blog» |

Los nombres, cifras y comentarios son ilustrativos (el video lo indica). Lo que se muestra existe en la plataforma.
