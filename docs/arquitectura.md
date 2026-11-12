# Arquitectura de UpGames

Mapa rápido de dónde está cada cosa.

## Servidor (Railway): `index.js` + `rutas/` + `modulos/`

`index.js` (≈1.400 líneas) configura y conecta todo: seguridad, conexión a MongoDB, modelos (esquemas), middleware de sesión, correo, y **registra los módulos de rutas en orden**. El orden importa: Express prueba las rutas de arriba hacia abajo.

Cada archivo de `rutas/` recibe sus dependencias explícitas desde `index.js`:

```js
require('./rutas/comentarios')({ app, Comentario, Juego, verificarToken, logger, ... });
```

Si un módulo necesita algo que se crea más abajo en `index.js` (por ejemplo `live` o `cobros`), lo recibe después con `vincularTarde()`, antes de que llegue cualquier petición.

| Módulo | Qué hace |
|---|---|
| `rutas/economia.js` | Página puente: ticket y visualizaciones de publicidad (lo único que se paga, US$1,50 por 1.000), vistas, referidos, saldo y retiros |
| `rutas/tarjetas.js` | Tarjetas de pago y cola de retiros (procesar/rechazar) |
| `rutas/auth.js` | Registro, login, identidad única (usuario/email) |
| `rutas/admin.js` | Panel admin: estadísticas, saldos, acciones masivas, publicaciones |
| `rutas/items.js` | Catálogo (`GET /items`, orden de Nexus), publicar, editar, reportes, series, plantillas |
| `rutas/usuarios.js` | Usuarios públicos y gestión en el panel |
| `rutas/perfil.js` | Perfil, seguir, ajustes de cuenta, firma de subida a Cloudinary |
| `rutas/comentarios.js` | Comentarios |
| `rutas/interacciones.js` | Favoritos, me gusta, aviso de títulos comerciales y panel de verificación |
| `rutas/fraude.js` | Anti-fraude (admin) |
| `rutas/notificaciones.js` | Campana y push |
| `rutas/chat.js` | Chat privado |
| `rutas/stories.js` | Stories |
| `rutas/deteccionJuegos.js` | Detección de juego y botón Comprar |
| `rutas/busqueda.js` | Búsqueda tolerante a errores y autocompletado |
| `rutas/seo.js` | Sitemap y datos de las páginas estáticas `/p/`, `/u/`, `/j/` |
| `rutas/metricas.js` | Métricas anónimas de producto y panel Métricas |
| `rutas/compat.js` | Compatibilidad real por dispositivo |
| `rutas/tienda.js`, `extrasUC.js`, `accesoDirecto.js`, `cobros.js` | Pagos, UpCoins, Premium y métodos de cobro |
| `rutas/live.js`, `grupos.js`, `social.js`, `nexus.js`, `apexgp.js`, `studio.js`, `upstar.js` | Lives, grupos, reseñas, Nexus IA y juegos propios |
| `rutas/adminPanel.js`, `adminEconomia.js`, `adminNexus.js` | Sesión y vistas del panel admin |
| `modulos/tareas.js` | Tareas automáticas (limpiezas, enlaces caídos, revisión diaria de enlaces, verificación de títulos comerciales, scores) |

Lógica reutilizable en `modulos/`: `sospecha.js` (juegos comerciales), `search.js`, `gameDetector.js`, `seo.js`, `statsItems.js`, `revisionIA.js`, `series.js`, etc. La fórmula del feed vive en `public/upgames-ranking.js` y la usan el servidor y la web.

### Al mover o agregar rutas

1. Registra el módulo en `index.js` **en la posición correcta** (antes del manejador 404 y respetando rutas que se pisan, p. ej. `/items/:id` captura `/items/loquesea`).
2. Pasa todas las dependencias que usa el módulo.
3. Corre `npm test`.

## Web (GitHub Pages): `public/`

`public/biblioteca.html` carga dos paquetes que **se generan** (no se editan a mano):

| Paquete | Se arma desde | Script |
|---|---|---|
| `public/script.js` | `public/js/00-base.js` … `15-extras.js` (en orden) | `node scripts/unir-js.js` |
| `public/upgames-app.css` | `biblioteca.css`, `upgames-glass.css`, `upgames-estilo.css`, `upgames-cyber.css`, `upgames-videos.css`, `upgames-ux.css` | `node scripts/unir-css.js` |

Las partes de `public/js/` comparten variables globales igual que antes (se concatenan en el mismo orden), así que el comportamiento es idéntico. La acción `.github/workflows/css.yml` (“Paquetes”) los regenera sola al subir cambios a `main`, y `npm test` falla si no están al día.

| Parte | Contenido |
|---|---|
| `00-base.js` | Sesión, almacenamiento seguro, invitados, UpCoins, menú radial, caché, toast, confirmaciones, formatos |
| `01-tarjetas.js` | Tarjetas del catálogo, series por partes, imágenes |
| `02-portada-render.js` | Carrusel, videos diferidos, `render()` |
| `03-catalogo-busqueda.js` | Carga del catálogo, búsqueda (local + servidor), categorías, vistas de videos |
| `04-ficha.js` | Ficha de la publicación, SEO dinámico, comentarios |
| `05-favoritos-navegacion.js` | Favoritos (con y sin cuenta), compartir, reportar, pestañas |
| `06-perfil.js` | Perfil y formulario de publicación (vista previa) |
| `07-publicar.js` | Categorías, subidas a Cloudinary, videos, revisión con Nexus, publicar |
| `08-mis-publicaciones.js` | Mis publicaciones, promoción con UpCoins, editar |
| `09-economia.js` | Economía, gráficas, métodos de cobro, tarjetas |
| `10-ajustes-sesion.js` | Ajustes, edición de medios, cerrar sesión |
| `11-bienvenida.js` | Bienvenida y términos |
| `12-nexus.js` | Nexus IA y cuota |
| `13-tutorial-inicio.js` | Tutorial e inicio |
| `14-notificaciones.js` | Notificaciones, isla flotante y push |
| `15-extras.js` | Live, tienda, verificación de email, Premium, `?q=`, referidos |

Módulos sueltos de la web: `upgames-ux.js` (filas, historial, guía, me gusta), `upgames-ranking.js` (fórmula del feed), `upgames-publicar.js` (asistente por pasos), `upgames-compat.js` (compatibilidad), `upgames-metricas.js` (métricas anónimas), `upgames-videos.js` (feed de videos).
