# Intro «Entrar a la red»

> **No está en la web.** Se quitó de upgames.games: la bienvenida del sitio es ahora la animación de `public/js/11-bienvenida.js`. Esta carpeta queda para generar los MP4 (redes, tráilers).

Intro de UpGames: la sensación de **conectarse a la red y entrar a un mundo digital nuevo** (rejilla de luz, muros de luz que corren por el suelo, túnel de datos, ciudad de neón) con la identidad de UpGames: verde neón, blanco y negro, con un acento menta frío.

Dura 71,5 s y tiene botón **SALTAR**. La locución va en 8 frases separadas por tramos largos de animación (un 5 % más pausada que la grabación original).

## Dónde vive

| Archivo | Qué es |
|---|---|
| `web/index.html` + `intro.js` | La animación, en tiempo real (Canvas 2D con proyección 3D propia y resplandor). Sigue al reloj del audio, se adapta a horizontal y vertical y baja la resolución sola si el equipo no da |
| `web/intro-audio.mp3` | Voz + música + efectos ya mezclados (1,7 MB) |
| `marketing/intro/render.js` | Graba la intro a MP4 (16:9 y 9:16, 60 fps) para redes |
| `marketing/intro/mezcla.js` | Genera el audio |

**Cuándo se muestra:** primera visita (se guarda `ug_intro_visto` en el navegador). `?intro` la fuerza, `?nointro` la evita. No sale a buscadores ni a quien tiene activado «reducir movimiento». Los navegadores no dejan sonar audio sin un toque: si se bloquea, la intro empieza con un botón **CONECTAR** a pantalla completa (encaja con la idea de entrar a la red).

## Regenerar

```bash
cd marketing/intro
node mezcla.js          # audio → web/intro-audio.mp3 y intro-mezcla.wav
node render.js h        # upgames-intro-16x9.mp4
node render.js v        # upgames-intro-9x16.mp4
PREVIEW="0.6,30.5" node render.js h   # PNG de instantes
```

Vista previa en el navegador: `web/index.html` (en vivo) o `web/index.html?render&w=1920&h=1080&t=30.5` (un instante).

## Línea de tiempo

La música (*Toxic Love*, libre de derechos, 123 BPM) tiene 30 s de ambiente y su caída en **30,33 s**: ahí salimos del túnel a la ciudad. El logo final cae en el golpe de 65,45 s.

| Tiempo | Voz | Animación |
|---|---|---|
| 0:00.5 | — | **¡Pum!** Logo UpGames con onda de choque y destello |
| 0:03.6 | — | El logo falla como un tubo de neón, parpadea y se apaga |
| 0:06.2 | — | Negro; texto de arranque: INICIANDO ENLACE · ACCESO CONCEDIDO |
| 0:08.0 | «Bienvenido a UpGames» | Una línea de luz parte la pantalla y se abre; aparece el logo |
| 0:10.3 | — | La red se enciende desde el centro; muros de luz cruzan el suelo |
| 0:16.2 | «Estás a punto de entrar a un nuevo mundo digital» | Un portal de anillos aparece en el horizonte |
| 0:19.5 | — | La cámara acelera hacia el portal; CONECTANDO 0 → 100 % |
| 0:24.5 | — | Túnel de datos hexagonal, cada vez más rápido; riser |
| 0:30.3 | — | **Caída**: estallido de luz y vuelo sobre la ciudad de neón, que late con el bombo |
| 0:37.6 | «Explora, crea, publica» | Tres paneles, uno por palabra; un haz de luz sube al cielo en «publica» |
| 0:43.0 | «La decisión es tuya» | Tres caminos de luz (JUGAR, CREAR, GANAR); se elige uno y corremos por él |
| 0:47.8 | «Un mundo lleno de posibilidades» | Carrusel de tarjetas: juegos, apps, mods, en vivo, videos, Nexus IA, UpCoins… |
| 0:52.6 | «Crea tu comunidad» | Constelación de personas conectándose; +1.280 miembros |
| 0:56.3 | «Obtén tu primera monetización y empieza a crear tu comunidad» | Monedas UC cayendo en espiral a una plataforma; la red la rodea |
| 1:00.4 | — | Ascenso vertical sobre la ciudad |
| 1:04.5 | «Esto es UpGames» | Las luces convergen al centro y el logo estalla en el golpe; upgames.games, botón ENTRAR |

Las cifras que aparecen son ilustrativas.
