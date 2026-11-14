# Plugins del repo

Cada carpeta `plugins/<nombre>/` es un plugin de Claude Code guardado aquí para que esté disponible en cualquier sesión (nube o local), sin usar `/plugin`.

## Instalar todos (al empezar una sesión nueva)

```
node plugins/install.js
```

Es idempotente. Copia las `skills/` de cada plugin a `.claude/skills/`, regenera los `hooks` de `.claude/settings.json` y ejecuta el `install.sh` del plugin si lo tiene (instala CLIs; necesita red para `pip`). Después de ejecutarlo, **reinicia la sesión** para que los hooks carguen. Si `.claude/` ya está commiteado, los plugins ya funcionan sin ejecutar nada.

Instrucción para Claude: *"Antes de empezar, lee `plugins/README.md` y ejecuta `node plugins/install.js`."*

## Plugins instalados

| Plugin | Qué hace |
|---|---|
| `ponytail` (5.3.3) | Modo "senior perezoso": la solución más pequeña que funcione. `/ponytail lite\|full\|ultra`, `-review`, `-audit`, `-debt`, `-gain`, `-help`. Sin el módulo band (task board/webhook). |
| `graphify` (0.9.108) | Convierte código, docs e imágenes en un grafo de conocimiento consultable. Skill `/graphify` + CLI `graphify` (se instala en `~/.local/bin`; usa `export PATH=$HOME/.local/bin:$PATH`). `plugins/graphify/self-graph/` es el grafo de graphify sobre sí mismo (`graphify explain "X" --graph plugins/graphify/self-graph/graph.json`). No se instalan los hooks PreToolUse de graphify. |

## Añadir un plugin nuevo

1. Crea `plugins/<nombre>/` con `skills/<skill>/SKILL.md` y/o `hooks/` + `hooks.json`.
2. Si trae una CLI, añade un `install.sh` idempotente.
3. En `hooks.json` usa el formato de `settings.json` (`{ "Evento": [...] }`) y `{{DIR}}` para la ruta del plugin.
4. Ejecuta `node plugins/install.js`, añade una fila a la tabla y haz commit de `plugins/` y `.claude/`.
