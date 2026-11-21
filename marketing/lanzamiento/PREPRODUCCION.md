# Lurveta · Film de lanzamiento — Preproducción

> **Nombre verificado:** el brief dice «LUVERta», pero la marca oficial en producción, en el logo y en la
> plataforma es **Lurveta** (logotipo: LURVETA). El film usa Lurveta. Si el nombre cambió otra vez, se
> cambia en un solo sitio (`video.html`, constante `MARCA`) y se vuelve a renderizar.

---

## 1. Diagnóstico de la identidad actual

**Logotipo.** Wordmark LURVETA en palo seco negro (recreado con Inter Display Black). «LUR» en verde
`#32D583`; la **V** partida: trazo izquierdo verde y trazo derecho blanco, que sube por encima de la línea
de mayúsculas; «ETA» en blanco `#F4F6F8`. La V es la pieza con más carácter: **dos trazos que llegan
desde lados distintos y se encuentran en un punto**, y uno de ellos sigue subiendo.

**Herencia.** El logo anterior, *UpGames*, tenía una flecha de circuito hacia arriba en la «p». La nueva V
conserva ese gesto ascendente en su trazo blanco: la evolución ya está dibujada en la marca.

**Color.** Casi negro con matiz verde (`#080C0B`), verde Lurveta como único acento, blanco roto y grises
fríos. Dorado (`#F4C451`) reservado a UpCoins y Premium. Nada de morados ni azules decorativos.

**Tipografía.** Inter en toda la interfaz (rediseño de noviembre de 2026); Inter Display Black para el logo.

**Interfaz.** Oscura, sobria, con tarjetas de borde fino, píldoras, la pestaña activa en verde y Nexus AI
con un orbe de cristal verde. Es una interfaz de producto real con identidad propia, apta para protagonizar.

**Tono.** Directo, cercano, en español latinoamericano («Descargar gratis», «Tu inteligencia dentro de
Lurveta», «Tu visita apoya al creador»).

**Inconsistencias que el film evita y que conviene corregir en la plataforma:**

| Hallazgo | Efecto en el film | Recomendación |
|---|---|---|
| El dominio oficial sigue siendo **upgames.games** | El cierre muestra `upgames.games` (es la dirección real) | Registrar un dominio Lurveta y redirigir con 301 |
| La portada guardada de LURVETA RACING aún dice «UPGAMES RACING» | Se usa el arte oficial actual del juego (`games/monoplaza/logo.webp`) | Cambiar la portada en el panel |
| Tres publicaciones de @lurveta se titulan «UPGAMES…» (videos) | No aparecen en las tomas | Renombrarlas o retirarlas |
| El menú del juego de carreras dice **APEX GP** | Se muestra la pista (vallas LURVETA, cartel NEXUS IA), no el menú | Unificar el nombre del juego |

---

## 2. Inventario de funcionalidades (verificado en código y en producción, 20/11/2026)

**Activas y mostrables**

| Función | Evidencia | Toma real |
|---|---|---|
| Catálogo de juegos, mods, apps, herramientas, optimización y software | `/items` (24 publicaciones), categorías en la portada | Portada, categorías |
| Descargas libres y sin registro | Texto de la plataforma; la ficha dice «Gratis · sin tarjeta» | Ficha |
| Fichas con capturas, video, reseñas y compatibilidad real por dispositivo | `rutas/compat.js`, ficha de LURVETA RACING | Ficha |
| Búsqueda en lenguaje natural con Nexus | `/nexus/buscar` responde sin cuenta: «juegos de carreras para android» → *Juegos · Android* → LURVETA RACING | Búsqueda real |
| Nexus AI (chat) | Panel real; el chat pide cuenta gratuita | Pantalla de Nexus |
| Publicar: Juego, Mod, Optimización, App, Herramienta, Software, Video | Selector «¿Qué deseas publicar hoy?» | Publicar |
| Revisión del equipo antes de publicar | Texto de la plataforma | (texto) |
| Perfil público con seguidores, mensajes, colecciones e insignias | `perfil-publico.html` (@keroxenee) | Perfil |
| Transmisiones en vivo con chat y regalos | `live.html`, `rutas/live.js` (hoy no hay ninguna en curso) | Cabecera de En vivo |
| Blogs con dirección propia (`/b/<dirección>`) | `blog.html`, `rutas/blogs.js` | Editor de blogs |
| Monetización por publicidad en la página de descarga | Página puente: «Tu visita apoya al creador» | Página puente |
| UpCoins (regalos, apoyos, extras) y retiro como dinero | `modulos/upcoins.js`, `modulos/retiros.js` | Página puente / texto |
| Premium: sin anuncios ni esperas, NEXUS ilimitado, desde US$4.99 | Página puente | Página puente |
| Lurveta Studio: modelado 3D en el navegador y el celular | `/studio/`, APK | Studio |
| Juego de carreras (Lurveta RACING) | `/games/monoplaza/` | Pista |
| Comunidad: grupos, comunidades y mensajes | `rutas/grupos.js`, `chats.html` | (texto) |

**Limitadas o sin contenido hoy (no se exageran)**
- **Novedades/blogs de la comunidad:** la sección existe, pero aún no hay artículos publicados → se muestra la herramienta para crear el blog, no un feed.
- **Lives:** la función existe, pero en este momento no hay transmisiones → se muestra la sección, sin simular un directo.
- **Videos:** los videos publicados son de la marca anterior → no se muestran; se menciona la categoría desde el selector de publicar.
- **Cifras:** las descargas y los seguidores son reales pero pequeños; el film **no muestra estadísticas** ni promete resultados.

**No disponible (fuera del film)**
- **IA 3D a partir de fotos en Studio:** `/studio/ia3d/estado` → `disponible: false`.
- **Conversaciones de Nexus:** no se escribe ninguna respuesta de Nexus; solo su interfaz y su búsqueda real.

---

## 3. Concepto creativo central — «Convergencia»

La V de Lurveta son **dos caminos que vienen de lugares distintos y se encuentran en un punto**. El film
entero se construye con esa geometría:

- **Acto I:** la flecha de UpGames no desaparece: se convierte en el trazo blanco de la V. Un trazo verde
  llega desde el otro lado, se encuentran y nace Lurveta. *El cambio de nombre es una evolución, no un borrado.*
- **Acto II:** cada perfil (quien juega, quien desarrolla, quien crea contenido, quien quiere construir algo
  más grande) es un camino. Las transiciones cortan la pantalla siguiendo los ángulos de la V; las
  interfaces reales viajan por esas diagonales.
- **Acto III:** todos los caminos (todas las tomas del producto) convergen en el vértice y forman la V.

**Lenguaje de movimiento derivado de la marca:** las diagonales y la pendiente de la V gobiernan las
máscaras, los barridos y la dirección de cámara. Ninguna transición es de plantilla: todas son la V.

### Eslogan — propuesta justificada (no definitivo)

| Opción | Por qué | Riesgo |
|---|---|---|
| **«Donde todo converge.»** *(recomendada)* | Nace del logotipo (la V), resume el ecosistema y es breve; funciona en cualquier pieza | Es abstracta sin la imagen de la V (el film la enseña) |
| «Juega. Crea. Publica. Gana.» | Muy clara y accionable | Suena a lista y a cualquier plataforma |
| «La nueva dimensión de UpGames.» | Ancla el cambio de nombre | Mantiene vivo el nombre anterior |

El film usa la recomendada; cambiarla es editar una línea (`TAGLINE`).

---

## 4. Guion (80 s · 120 BPM · sin locución)

Sin voz en off: el ritmo lo llevan la música y la tipografía (lenguaje de lanzamiento internacional;
menos texto, más imagen). Todo el texto en pantalla es breve y está verificado.

| Tiempo | Acto | Texto en pantalla | Imagen |
|---|---|---|---|
| 0:00–0:03.5 | I | — | Negro. El logo de UpGames aparece como un recuerdo. |
| 0:03.5–0:07.5 | I | «Crecimos.» «Cambiamos.» «Evolucionamos.» | «Games» se deshace en franjas; queda la flecha de «Up», que sube. |
| 0:08 | I | — | **Golpe.** Un trazo verde corta la diagonal y se encuentra con la flecha: la V. |
| 0:08–0:12 | I | — | La V en 3D gira; LUR y ETA salen desde detrás de ella. |
| 0:12–0:16 | I | «UpGames ahora es» → **LURVETA** | Tipografía a pantalla completa; la cámara entra por el vértice. |
| 0:16–0:28 | II · Descubre | «Para quienes juegan» · JUEGOS · MODS · APPS · HERRAMIENTAS · «Gratis. Sin registro para descargar.» | Portada real; categorías al ritmo; búsqueda real con Nexus; ficha de LURVETA RACING. |
| 0:28–0:38 | II · Publica | «Para quienes desarrollan» · «Publica tu proyecto.» · «Modela en 3D desde el celular.» · «Tu página. Tu comunidad.» | Selector de publicar real; Studio y la pista de carreras; perfil de un creador. |
| 0:38–0:48 | II · Comparte | «Para quienes crean contenido» · «En vivo.» · «Tu sitio web, hecho en Lurveta.» · «Videos, guías y reseñas.» | Sección En vivo; editor de blogs; categoría Video. |
| 0:48–1:00 | II · Construye | «Para quienes van por más» · «Gana UpCoins con cada visita.» · «Premium. Sin anuncios ni esperas.» · «Nexus AI. Tu inteligencia dentro de Lurveta.» | Página puente; Premium; pantalla de Nexus AI. |
| 1:00–1:03.5 | III | — | Todas las tomas se ordenan en la forma de la V y convergen al vértice. |
| 1:03.5–1:04 | III | — | Silencio. |
| 1:04 | III | — | **Golpe final:** la V se cierra; aparece el logotipo. |
| 1:04–1:11 | III | **«Donde todo converge.»** | Logotipo con barrido de luz. |
| 1:11–1:17 | III | «Explora gratis» · **upgames.games** · «UpGames ahora es Lurveta» | Dominio y llamada a la acción. |
| 1:17–1:20 | III | — | Fundido a negro con la cola del sonido. |

---

## 5. Storyboard escena por escena

1. **Memoria (0–3.5 s).** Negro absoluto; grano fino. El logo de UpGames (archivo real del historial) se
   enciende con un parpadeo eléctrico, desaturado, como una foto vieja. Cámara casi quieta.
2. **Ascenso (3.5–7.5 s).** «Games» se corta en franjas horizontales que se desplazan y se apagan. Queda «Up»;
   la flecha de circuito se aísla y sube; la cámara la sigue. Tres palabras golpean en la diagonal, una
   por compás: *Crecimos. Cambiamos. Evolucionamos.* La flecha gira 25° y se vuelve el trazo blanco.
3. **Encuentro (8 s).** Silencio de un cuarto de segundo. Un trazo verde entra desde abajo a la izquierda y
   se encuentra con el blanco en el vértice. Destello contenido, onda de presión, golpe grave.
4. **Revelación (8–12 s).** La V extruida en 3D (material de vidrio y metal, luz rasante) gira medio cuarto de
   vuelta. LUR y ETA salen por máscara desde detrás de los trazos. Barrido de luz por el logotipo.
5. **Nombre (12–16 s).** «UpGames ahora es» en gris; la palabra **LURVETA** ocupa toda la pantalla; la
   cámara entra por el vértice de la V, que se abre como un portal hacia el Acto II.
6. **Descubre (16–28 s).** Pantalla partida por la diagonal de la V: a la izquierda la palabra gigante del
   capítulo, a la derecha la portada real flotando en 3D (sin marco de teléfono, solo la pantalla con
   borde de cristal). Las categorías cambian al ritmo y la pantalla real cambia con ellas. Plano macro de
   la barra de búsqueda: se escribe «juegos de carreras para android»; Nexus responde (toma real); la
   tarjeta de LURVETA RACING se agranda hasta su ficha; detalle de «Gratis».
7. **Publica (28–38 s).** El selector real «¿Qué deseas publicar hoy?» se ilumina opción por opción, a
   tempo. Las tomas de Lurveta Studio y de la pista de carreras atraviesan la pantalla por las diagonales.
   Perfil real de un creador con «Seguir» y «Mensaje».
8. **Comparte (38–48 s).** La pastilla roja LIVE late con la música; «En vivo» en gran formato. El editor
   de blogs y la dirección `/b/tu-blog` se escriben. La opción Video del selector se acerca en macro.
9. **Construye (48–60 s).** Plano macro de la página puente: «Tu visita apoya al creador». Una moneda
   dorada (la de la interfaz) gira. La tarjeta Premium con «desde US$4.99». Corte a Nexus AI a pantalla
   completa: el orbe respira con la música; se ilumina «¿Cuánto llevo ganado y qué me falta para retirar?».
10. **Convergencia (60–64 s).** Travelling hacia atrás: todas las tomas usadas están dispuestas en dos
    filas diagonales que dibujan una V gigante. Se comprimen hacia el vértice. Silencio.
11. **Lurveta (64–80 s).** La V se cierra con el golpe final; logotipo con luz rasante; eslogan; dominio y
    llamada a la acción. Fundido a negro.

---

## 6. Dirección de arte

- **Fondo:** `#080C0B` con niebla verde muy tenue en las zonas de luz; grano de película fino constante.
- **Acento:** verde Lurveta `#32D583`/`#2FD37F`. Dorado `#F4C451` solo en el capítulo de monetización.
  Rojo solo en la pastilla LIVE (es de la interfaz real).
- **Tipografía:** Inter Display Black para titulares (tracking −0,04 em, tamaños de 120 a 420 px), Inter
  Medium para subtítulos, mayúsculas solo en las palabras de capítulo.
- **Interfaces:** capturas reales a 3× (1170×2532), sin carcasa de teléfono: pantallas flotantes con
  radio de 48 px, borde de 1 px blanco al 14 % y sombra larga. Perspectiva real (CSS 3D) con parallax.
- **Composición:** diagonales de la V (≈ ±24°) como ejes; mucho negativo; un solo foco por plano.
- **Movimiento:** curvas *expo* y *quint* (entradas rápidas, llegadas suaves); desenfoque de movimiento
  simulado con *motion blur* por submuestreo en los golpes; nada de rebotes ni elásticos.

---

## 7. Plan técnico de producción

| Pieza | Herramienta | Por qué |
|---|---|---|
| Capturas reales | `capturar.js` (Playwright sobre producción) | Interfaces auténticas, reproducibles, a 3× |
| Escenas | `video.html`: DOM + CSS 3D para tipografía e interfaces; Three.js (el del repo) para la V y el logotipo en 3D | Precisión tipográfica y 3D en un mismo fotograma, sin software de pago |
| Render | `render.js`: cada fotograma se dibuja con `render(t)` (determinista) y se graba en paralelo | Mismo resultado siempre; 30 fps exactos |
| Música y sonido | `audio.js`: síntesis original (bajo, batería, pads, arpegio, motivo sonoro, golpes, risers) en el mismo tiempo que la imagen | Música original sin licencias, sincronizada al fotograma |
| Codificación | ffmpeg: H.264 High, yuv420p, CRF 16, AAC 256 kb/s, `+faststart` | Compatible con todas las redes y reproductores |

Entrega: `lurveta-lanzamiento.mp4`, 1920×1080, 30 fps, 80 s, más todas las fuentes en esta carpeta.

## 8. Herramientas y limitaciones

- **Sin After Effects, Cinema 4D ni librerías de sonido comerciales:** todo es código abierto y reproducible.
  El 3D es en tiempo real (Three.js) y no un render con trazado de rayos; se compensa con iluminación
  cuidada, desenfoque de profundidad simulado y composición.
- **Sin locución:** no hay voz disponible y la pieza no la necesita.
- **Datos de cuenta:** el saldo de UpCoins y las conversaciones de Nexus dependen de cada usuario; no se
  inventan. Se muestran las interfaces y los textos reales de la plataforma.
- **Contenido de la comunidad:** algunas portadas del catálogo son arte de juegos comerciales que suben
  los usuarios; aparecen pequeñas y dentro de la interfaz, nunca como protagonistas del anuncio.
