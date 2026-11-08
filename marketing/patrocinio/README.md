# Anuncios de patrocinio para creadores indie (2 videos)

Dos animaciones publicitarias estilo **SaaS motion graphics** con la identidad cyberpunk de UpGames, verticales **1080×1920 a 60 fps**, con locución, música, efectos de sonido y subtítulos karaoke. Cada una dura unos 44,6 s.

| Archivo | Guion | Música |
|---|---|---|
| `upgames-patrocinio-1.mp4` | «¿Eres un desarrollador indie…?» (voz 0:00–0:43) | *If You Open Up* (Infraction) desde 1:56.25 |
| `upgames-patrocinio-2.mp4` | «Atención, creadores y desarrolladores indie…» (voz 0:43–1:25.7) | *Dead Network* (Infraction) desde 2:32.25 |

Las dos pistas son de `public/audio/` (sin copyright). Elegí el tramo de cada una para que **la caída de la música coincida con la frase que da el giro**: «No te preocupes más → **En UpGames**» (8,0 s) y «Escucha esto → **En UpGames**» (10,2 s). Antes de ese momento la música está casi en silencio y la imagen en grises; después, todo se enciende en verde.

## Cómo volver a grabar

```bash
cd marketing/patrocinio
node render.js 1        # graba el video 1 (≈ 10 min) y mezcla el audio
node render.js 2        # graba el video 2
node audio.js 1         # solo rehace el audio de un video ya grabado
PREVIEW="8.2,12.9" node render.js 1   # PNG de instantes concretos
```

Vista previa en Chrome: `video1.html?play` (tiempo real) o `video1.html?t=12.9` (un instante). Necesita Playwright y ffmpeg.

## Archivos

- `motor.js` — motor común: `render(t)` dibuja cada fotograma de forma exacta (fondo 3D con rejilla de neón y partículas que aceleran, cámara con sacudidas y pulso al ritmo, glitch con separación RGB, destellos, grano de película, subtítulos karaoke, HUD).
- `piezas.js` — piezas reutilizables: iconos, arte del juego ficticio *Neon Runner*, avatares hexagonales, cursor con clic, ondas de choque, chispas, gráfica, red de personas.
- `video1.html`, `video2.html` — las escenas de cada guion, sincronizadas palabra por palabra con la locución (marcas de tiempo sacadas con Whisper).
- `audio.js` — sintetiza los efectos (whoosh, golpes graves, risers, glitch, clics, campanas, contadores…) en el instante en que cada escena los pide con `M.sfx()` y mezcla: voz con compresión y ecualización, música que baja sola cuando habla la voz (sidechain), efectos con un poco de eco; normaliza a −14 LUFS para redes.
- `ritmo1.js`, `ritmo2.js` — golpes de la música (librosa) para el pulso de la cámara.
- `logo.png` — el logotipo real recortado de `public/og-cover.png` con fondo transparente.
- `voz_video.mp3` — la locución con los dos guiones.

## Identidad visual que se aplicó

Sacada de `public/upgames-cyber.css` (tema por defecto) y del logo:

- **Color:** verde neón `#39FF88` como único acento, blanco `#F2F5F7`, grises fríos `#8A94A6`/`#4A5361` y negro azulado `#03060C` con azul marino solo en el fondo. Nada de otros colores: el rojo aparece solo en los problemas (error, tachado) y desaparece en cuanto entra UpGames.
- **Tipografía:** Orbitron 900 en mayúsculas para titulares, Rajdhani para el texto y Share Tech Mono para datos y HUD (etiquetas con `// `).
- **Formas:** esquinas biseladas (`clip-path`), hexágonos para avatares e insignias, líneas de 1–3 px con brillo.
- **Atmósfera:** rejilla en perspectiva que avanza hacia el horizonte, líneas de escaneo, viñeta, glitch en titulares y barridos de luz verde.
- **Logo:** «Up» blanco con la flecha de circuito y «Games» en verde con resplandor; se usa la imagen original, nunca una imitación tipográfica.

## Estructura narrativa (las dos siguen el mismo arco)

1. **Problema** (grises, música baja): no sabes dónde publicar, nadie ve tu trabajo.
2. **Giro** (silencio, todo se apaga en un punto): «No te preocupes más» / «Escucha esto».
3. **Caída** (golpe, logo, rejilla a toda velocidad): UpGames patrocina creadores.
4. **Beneficios** en interfaces tipo SaaS: profesionalismo, visibilidad, comunidad, reconocimiento.
5. **Oferta**: gratis, sin costo, promoción exclusiva/oficial.
6. **Llamada a la acción**: upgames.games y botón final.

### Video 1 — hoja de tiempos

| Tiempo | Frase | Qué se ve |
|---|---|---|
| 0:00 | ¿Eres un desarrollador indie y no sabes dónde publicar…? | Editor de código escribiendo; el .zip busca dónde caer entre zonas vacías con «?» |
| 0:03.8 | …o cómo conseguir más visibilidad en redes? | Publicación con 3 vistas, gráfica plana y avisos de alcance 0,3 % |
| 0:06.6 | No te preocupes más. | El texto cae, se encoge hasta un punto de luz; riser |
| 0:08.0 | En UpGames estamos buscando y patrocinando… | **Caída**: logo con onda de choque; insignia PATROCINADO |
| 0:10.6 | …a creadores independientes exactamente como tú. | Panal de creadores; zoom y mira sobre el hexágono **TÚ** |
| 0:13.7 | Sabemos lo que cuesta crear. | Tarjeta en borrador; 1.840 horas, 312 noches, 97 bugs |
| 0:16.6 | Por eso te damos ese **plus** de profesionalismo… | Un «+» gigante convierte la tarjeta en una ficha premium verificada; barra NIVEL PROFESIONAL al 100 % |
| 0:18.8 | …para presentarte al público. | Foco de escenario sobre la ficha |
| 0:20.2 | Te ofrecemos visibilidad real… | Panel del creador: vistas y jugadas suben, gráfica creciente |
| 0:22.3 | …para que miles de personas descubran tus creaciones… | Red de personas conectándose a tu juego; +12.480 |
| 0:25.0 | …y construyas tu propia comunidad desde cero. | Clic en SEGUIR; seguidores de 0 a 1.280 |
| 0:27.5 | Tu trabajo merece ser **reconocido**. | Medalla hexagonal con rayos y chispas |
| 0:29.4 | ¿Qué esperas…? …totalmente **gratis** | $49.99 tachado → **$0** y sello 100 % GRATIS |
| 0:33.3 | Entra ya a upgames.games… | Se escribe la dirección; clic en ENTRAR |
| 0:35.2 | …o escríbenos por mensaje directo… | Chat en el celular; cupón PROMOCIÓN EXCLUSIVA; sello SIN COSTO |
| 0:41.6 | ¡Únete a UpGames ahora! | Cierre: logo, botón ÚNETE AHORA con clic, upgames.games |

### Video 2 — hoja de tiempos

| Tiempo | Frase | Qué se ve |
|---|---|---|
| 0:00 | Atención, creadores y desarrolladores indie. | Alerta: franjas de peligro, triángulo, ATENCIÓN descifrándose |
| 0:03 | ¿Llevas meses trabajando en tu proyecto…? | Historial de commits llenándose, MES 01 → MES 14 |
| 0:04.9 | …pero no sabes dónde publicarlo… | Subida que se queda en 99 % → ERROR |
| 0:06.7 | …o cómo conseguir visualizaciones reales? | Tráiler cargando con 0 visualizaciones y «vistas falsas» |
| 0:09.2 | Escucha esto. | Negro total, onda de la voz, latido; riser |
| 0:10.2 | En UpGames estamos patrocinando el talento independiente. | **Caída**: logo; tarjeta holográfica SPONSOR OFICIAL |
| 0:13.7 | Queremos elevar tu nivel de profesionalismo. | Medidor de nivel 01 → 99; NIVEL PRO |
| 0:15.8 | Olvídate de los links perdidos. | Enlaces rotos flotando que una onda verde hace pedazos |
| 0:18.0 | Te damos un espacio premium… | Página del proyecto armándose pieza por pieza |
| 0:21.3 | …alcances visibilidad masiva… | Muro de pantallas; contador de impresiones |
| 0:22.6 | …una comunidad de fans que te apoye. | Corazones, comentarios y contador de fans |
| 0:25.5 | Si quieres que el mundo por fin descubra… | Globo de alambre girando con arcos hacia tu juego |
| 0:28.8 | …esta es tu oportunidad. | Golpe y destello |
| 0:30.0 | ¿Qué esperas? Publica tu trabajo totalmente gratis… | Panel PUBLICAR: clic → ¡PUBLICADO! 100 % GRATIS |
| 0:33.1 | …entrando a upgames.games | Se escribe la dirección |
| 0:34.8 | …o comunícate por nuestras redes… promoción oficial sin costo alguno. | Chat, redes en órbita; certificado PROMOCIÓN OFICIAL con sello SIN COSTO |
| 0:40.2 | ¡El ecosistema UpGames te está esperando! | Logo con órbita: Juegos, Apps, Mods, En vivo, Comunidad, Nexus IA; ÚNETE GRATIS |

Los nombres, juegos y cifras que aparecen son ilustrativos.
