# UpGames

## Grafo de conocimiento (ahorra tokens)
Antes de buscar en el código o leer muchos archivos, consulta el grafo de `graphify-out/`:
- Lee `graphify-out/GRAPH_REPORT.md` (nodos clave, comunidades, preguntas sugeridas).
- Consulta: `export PATH=$HOME/.local/bin:$PATH; graphify query "<pregunta>"`, `graphify explain "<Símbolo>"`, `graphify path "A" "B"`.
- Si no existe el comando `graphify`: `node plugins/install.js`. Tras cambiar código: `graphify update .` (sin coste de API).
- El grafo excluye `plugins/`, `.claude/` y las librerías `games/*/lib/` (ver `.graphifyignore`). No incluye imágenes ni audio.

## Plugins
Antes de empezar: `node plugins/install.js` (ver `plugins/README.md`).
