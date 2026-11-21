# Tutorial «Crea tu propia página web con Lurveta» · Preproducción

**1920×1080 · 30 fps · H.264 · 101 s · locución en español latino neutro · subtítulos integrados · −14 LUFS.**

## 1. Objetivo

Enseñar a alguien que no programa a tener su sitio en Lurveta Blogs en pocos minutos: crear el blog, armar la
página de inicio con Nexus, completarla, publicarla, darle su marca, escribir una entrada y compartirla.
Cierra con la llamada a **lurveta.com**.

## 2. Regla absoluta: nada inventado

Cada función que aparece se verificó en el código **y** se ejecutó de verdad. `grabar.js` recorre el flujo con
el servidor real (`index.js`) y la interfaz real (`public/`), en un entorno local con base de datos temporal
(`servidor.js`). No toca producción. Todas las imágenes del video son capturas de ese recorrido.

| Lo que muestra el tutorial | Dónde está en el código | Cómo se verificó |
|---|---|---|
| Menú rápido → «Mi blog» | `public/js` (menú radial de la portada) | Captura de la portada real (`00-menu`) |
| Asistente: nombre, dirección automática, «✓ Disponible», descripción, tema, aceptación de responsabilidad | `public/upgames-blog.js` + `rutas/blogs.js` | Recorrido real (`01`–`06`) |
| Temas listos (Neón, Vidrio, Claro, Revista, Gamer; Cristal y Lienzo Premium) | `rutas/blogs.js` | Asistente real (`04`) |
| «Páginas» → **+** → «✦ Que Nexus la cree» | `public/upgames-blog.js` | `07`–`08` |
| Nexus arma la landing por secciones (portada, columnas, opiniones, preguntas, llamada a la acción) | `/blogs/nexus/ayuda` (`accion: landing`) | `09`–`13`, la página la construye el código real a partir de la respuesta del modelo |
| Los textos entre [corchetes] los completa el usuario; Nexus no inventa opiniones ni datos | Prompt real de Nexus (`modulos/blogs/escritor.js`) | Bloque de testimonios con corchetes (`17`) |
| Vista previa Celular / Computador | Editor de páginas | `14`–`15` |
| Edición por bloques, borrar bloque, enlace del botón | Editor de bloques | `17`–`20` |
| «Revisar mi página» (lista que se calcula en el navegador) | Editor | `21`–`22` |
| «Título, resumen y etiquetas» (SEO) | `/blogs/nexus/ayuda` (`accion: seo`) | `24` |
| Publicar → «¡Publicada! 🎉 Tu página ya está en internet» → «Usar esta landing como inicio de mi sitio» | Editor + `rutas/blogs.js` | `25`–`26` |
| Kit de marca: Nexus propone paletas de colores y letras | `/blogs/nexus/ayuda` (`accion: colores`) | `29`–`32` |
| Entrada nueva, destello de Nexus → «Mejorar redacción» | `/blogs/nexus/ayuda` (`accion: texto`) | `34`–`37` |
| Sitio público, versión móvil, botones para compartir (WhatsApp, Telegram, X, Facebook) | `rutas/blogs.js` (página `/b/...`) | `90`–`94` |
| Dominio propio en «Ajustes» (con verificación DNS) | Panel del blog | `27` |
| «Estadísticas» | `public/upgames-blog.js` | `40` |

**Lo que no aparece porque no se pudo verificar o no existe:** cifras de visitas reales, plantillas de
terceros, integraciones de pago y promesas de posicionamiento en buscadores. La ficha de buscador del paso 4
está marcada como «Así te verán en buscadores»: es una ilustración que usa el título y el resumen reales que
propuso Nexus, no una captura de Google.

### Respuestas de Nexus (aviso)

Nexus funciona en producción con un modelo de lenguaje vía API (Groq). Para grabar sin credenciales de
producción, el dueño de la plataforma decidió que **Claude escribiera las respuestas del modelo siguiendo los
prompts reales de Nexus** con la entrada que teclea el usuario del tutorial. `nexus-modelo.js` las sirve con la
misma API que usa el servidor y todo lo demás es el código real: validación, armado de la landing, editor y
página pública. Las respuestas están en `nexus/*.json`. En producción el texto de Nexus será parecido, pero no
idéntico.

## 3. Guion de narración

Voz: Piper `es_AR-daniela-high` (neural, local). Texto fuente: `guion.json`. Tiempos reales: `tiempos.json`.

| # | Tiempo | Escena | Locución |
|---|---|---|---|
| 1 | 0:01 | El problema | ¿Quieres tu propio espacio en internet, pero no sabes programar? Con Lurveta Blogs creas tu sitio, escribes y publicas, sin tocar una línea de código. |
| 2 | 0:09 | Entrar | Entra a Lurveta, abre el menú rápido y toca «Mi blog». |
| 3 | 0:13 | Paso 1 · Crea tu blog | Ponle nombre a tu blog. La dirección se completa sola, y Lurveta te confirma si está disponible. |
| 4 | 0:18 | | Agrega una frase que lo describa y elige uno de los temas listos. |
| 5 | 0:22 | | Acepta que eres responsable de lo que publicas, y toca «Crear mi blog». |
| 6 | 0:26 | Paso 2 · Tu página con Nexus | Ahora, tu página de inicio. En «Páginas», toca el botón más y elige «Que Nexus la cree». |
| 7 | 0:30 | | Cuéntale qué haces, para quién, y qué quieres que haga quien te visita. |
| 8 | 0:34 | | En unos segundos, Nexus arma la página por secciones: portada, beneficios, opiniones, preguntas frecuentes y una llamada a la acción. |
| 9 | 0:41 | | En la vista previa ves cómo quedará, en el celular o en la computadora. |
| 10 | 0:45 | Paso 3 · Edita y completa | Todo se edita por bloques. Nexus no inventa opiniones ni datos: lo que va entre corchetes lo completas tú, y si una sección no te sirve, la quitas. |
| 11 | 0:54 | Paso 4 · Revisa y publica | Antes de publicar, «Revisar mi página» te dice qué falta, y Nexus te propone el título, el resumen y las etiquetas para Google y las redes. |
| 12 | 1:01 | | Toca «Publicar». Tu página ya está en internet, y puedes usarla como inicio de tu sitio. |
| 13 | 1:06 | Paso 5 · Tu marca | En «Tema», describe tu marca y Nexus te propone paletas de colores y letras. Eliges una, y la guardas. |
| 14 | 1:12 | Paso 6 · Escribe con ayuda | Para tus artículos, escribe el borrador como te salga, toca el destello de Nexus y elige «Mejorar redacción»: corrige y ordena tu texto, sin cambiar lo que quieres decir. |
| 15 | 1:21 | Paso 7 · Comparte tu sitio | Y este es el resultado: tu sitio, con tu página de inicio, tu blog y botones para compartir en WhatsApp, Telegram, X o Facebook. |
| 16 | 1:28 | | Cuando tengas tu dominio, lo conectas desde «Ajustes», y en «Estadísticas» ves cuántas personas te visitan. |
| 17 | 1:33 | Cierre | Tu espacio. Tus ideas. Tu contenido. Empieza a construirlo en lurveta punto com. |

## 4. Storyboard (lo que se ve mientras suena cada frase)

1. **El problema.** Fragmentos de código (`<!DOCTYPE html>`, `npm install`, `DNS · registro A`…) flotan alrededor de «¿Tu propio espacio en internet?», se dispersan con «Sin programar.» y sube la página real de Lurveta Blogs.
2. **Entrar.** Portada real; la cámara se acerca a la esquina, el cursor toca el orbe, se abre el menú radial y se resalta «Mi blog».
3. **Crea tu blog.** El nombre se escribe en el campo y la dirección aparece sola, con el aro sobre «✓ Disponible». Luego la descripción, los temas (clic en Gamer), la casilla de responsabilidad, «Crear mi blog» y el panel.
4. **Nexus.** «+» en Páginas, aro violeta en «✦ Que Nexus la cree», la idea se escribe, Nexus piensa, y la cámara baja por la landing con etiquetas en cada sección. Termina con la vista previa de computador y celular lado a lado.
5. **Edita.** Aro sobre los testimonios entre corchetes con «Esto lo completas tú», clic en borrar bloque, preguntas completadas y enlace del botón.
6. **Revisa y publica.** Menú de Nexus, «Revisar mi página» con su lista y propuesta SEO junto a la ficha «Así te verán en buscadores». Después el diálogo «¡Publicada! 🎉» con aro sobre el enlace y «Usar esta landing como inicio de mi sitio».
7. **Tu marca.** Kit de marca, «Sugerir con Nexus», idea de marca y tres paletas (clic en Arcade nocturno). Cierra con el antes (tema Gamer) y el después (paleta de Nexus) lado a lado.
8. **Escribe con ayuda.** Borrador sin tildes, destello de Nexus, «Mejorar redacción», Nexus escribiendo, y tarjetas «Tu borrador» y «✦ Con Nexus» con los textos reales.
9. **Resultado.** Navegador con `lurveta.com/b/diario-de-un-dev-indie` recorriendo el sitio, versión móvil al lado, entrada publicada con aro en los botones para compartir, y después Dominio propio y Estadísticas.
10. **Cierre.** Fondo oscuro, logotipo, «Tu espacio. Tus ideas. Tu contenido.» palabra por palabra, **lurveta.com** en verde y fundido a negro.

Siempre visibles: indicador «Paso N de 7» con barra de progreso arriba a la izquierda y subtítulos sincronizados abajo.

## 5. Dirección de arte (distinta del film de lanzamiento)

El film de lanzamiento es oscuro, en 3D y cinematográfico. El tutorial es **claro y didáctico**:

- **Lienzo:** papel `#F2F0EB` con retícula de puntos.
- **Interfaz:** la interfaz real va en paneles oscuros con sombras amplias, así resalta sobre el lienzo.
- **Color:** tinta `#121715`; verde Lurveta `#17A866` / `#32D583` para acciones y confirmaciones; violeta Nexus `#7C5CFF` para todo lo que hace la IA.
- **Tipografía:** Inter Display y Inter (OFL), las mismas fuentes del film.
- **Recursos visuales:** cursor animado sobre las coordenadas reales de cada botón (`capturas/medidas.json`), ondas al hacer clic, aros de resaltado, globos de texto y zooms de cámara a la región exacta de la captura.

## 6. Sonido

- **Locución:** Piper, una frase por archivo. La imagen se sincroniza con el inicio real de cada frase.
- **Música:** original y sintetizada (`audio.js`), en Do mayor a 96 BPM con pad, marimba suave y un pulso muy ligero. Un *sidechain* la baja unos 20 dB cada vez que habla la voz, y resuelve con el lema.
- **Efectos:** clics, teclas, confirmaciones y destellos de Nexus, en los mismos instantes que la animación (`sfx.json`).
- **Mezcla:** −14 LUFS integrados, pico real ≤ −1,5 dBTP.

## 7. Limitaciones conocidas

- **lurveta.com todavía no resuelve (NXDOMAIN).** El cierre y la barra del navegador muestran lurveta.com por decisión del dueño: hay que configurar el DNS antes de publicar el video. En producción, las direcciones públicas de los blogs dependen de `RAILWAY_PUBLIC_DOMAIN` / `BLOGS_DOMINIO`.
- **Estadísticas:** muestra un blog recién creado, sin visitas. La fuente Orbitron del panel dibuja el cero con una barra dentro de un recuadro; así se ve también en producción.
- Las respuestas de Nexus son las de la sección 2.
