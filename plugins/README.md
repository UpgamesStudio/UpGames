# Plugins del repo

Cada carpeta `plugins/<nombre>/` es un plugin de Claude Code guardado aquí para que esté disponible en cualquier sesión (nube o local), sin usar `/plugin`.

## Instalar todos (al empezar una sesión nueva)

```
node plugins/install.js
```

Es idempotente. Copia las `skills/` de cada plugin a `.claude/skills/`, regenera los `hooks` de `.claude/settings.json` y ejecuta el `install.sh` del plugin si lo tiene (instala CLIs; necesita red para `pip`). Después de ejecutarlo, **reinicia la sesión** para que los hooks carguen. Si `.claude/` ya está commiteado, los plugins ya funcionan sin ejecutar nada.

Instrucción para Claude: *"Antes de empezar, lee `plugins/README.md` y ejecuta `node plugins/install.js`."*

Solo las 25 skills de agent-skills (más sus 4 agentes y 9 comandos `/spec`, `/plan`, `/build`, `/test`, `/review`, `/ship`...):

```
node plugins/install.js agent-skills
```

(`node plugins/install.js <plugin> [<plugin> ...]` instala solo los plugins que nombres.)

## Plugins instalados

| Plugin | Qué hace |
|---|---|
| `ponytail` (5.3.3) | Modo "senior perezoso": la solución más pequeña que funcione. `/ponytail lite\|full\|ultra`, `-review`, `-audit`, `-debt`, `-gain`, `-help`. Sin el módulo band (task board/webhook). |
| `graphify` (0.9.108) | Convierte código, docs e imágenes en un grafo de conocimiento consultable. Skill `/graphify` + CLI `graphify` (se instala en `~/.local/bin`; usa `export PATH=$HOME/.local/bin:$PATH`). `plugins/graphify/self-graph/` es el grafo de graphify sobre sí mismo (`graphify explain "X" --graph plugins/graphify/self-graph/graph.json`). No se instalan los hooks PreToolUse de graphify. |
| `agent-skills` (0.6.16) | 25 skills de ingeniería (spec, plan, TDD, revisión, seguridad, rendimiento, CI/CD, lanzamiento...), 4 agentes (code-reviewer, security-auditor, test-engineer, web-performance-auditor) y 9 comandos `/spec /plan /build /test /review /code-simplify /constraints /webperf /ship`. Sin sus hooks (Claude Code ya enruta skills por descripción). |
| `emil-skills` (main) | 19 skills de diseño e ingeniería de interfaces (de Emil Kowalski): animar (`animate`, `choreograph`, `gestures`, `animation-performance`, `animation-vocabulary`), revisar y limpiar movimiento (`review-animations`, `improve-animations`, `remove-animations`, `find-animation-opportunities`), pulido y gusto (`emil-design-eng`, `apple-design`, `learn-taste`, `break-ui`, `prototype`), móvil (`mobile-native`, `animate-expo`, `write-swift`) y librerías (`pick-ui-library`, `ask-sonner`). Incluye `ui-cheatsheet.md` y `performance-cheatsheet.md` en su carpeta. |

## Añadir un plugin nuevo

1. Crea `plugins/<nombre>/` con `skills/<skill>/SKILL.md` (y opcional `references/`, `agents/`, `commands/`) y/o `hooks/` + `hooks.json`.
2. Si trae una CLI, añade un `install.sh` idempotente.
3. En `hooks.json` usa el formato de `settings.json` (`{ "Evento": [...] }`) y `{{DIR}}` para la ruta del plugin.
4. Ejecuta `node plugins/install.js`, añade una fila a la tabla y haz commit de `plugins/` y `.claude/`.
