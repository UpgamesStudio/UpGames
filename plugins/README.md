# Plugins del repo

Cada carpeta `plugins/<nombre>/` es un plugin de Claude Code guardado aquí para que esté disponible en cualquier sesión (nube o local), sin usar `/plugin`.

## Instalar todos (al empezar una sesión nueva)

```
node plugins/install.js
```

Es idempotente. Copia las `skills/` de cada plugin a `.claude/skills/` y regenera los `hooks` de `.claude/settings.json`. Después de ejecutarlo, **reinicia la sesión** para que los hooks carguen. Si `.claude/` ya está commiteado, los plugins ya funcionan sin ejecutar nada.

Instrucción para Claude: *"Antes de empezar, lee `plugins/README.md` y ejecuta `node plugins/install.js`."*

## Plugins instalados

| Plugin | Qué hace |
|---|---|
| `ponytail` (5.3.3) | Modo "senior perezoso": la solución más pequeña que funcione. `/ponytail lite\|full\|ultra`, `-review`, `-audit`, `-debt`, `-gain`, `-help`. Sin el módulo band (task board/webhook). |

## Añadir un plugin nuevo

1. Crea `plugins/<nombre>/` con `skills/<skill>/SKILL.md` y/o `hooks/` + `hooks.json`.
2. En `hooks.json` usa el formato de `settings.json` (`{ "Evento": [...] }`) y `{{DIR}}` para la ruta del plugin.
3. Ejecuta `node plugins/install.js`, añade una fila a la tabla y haz commit de `plugins/` y `.claude/`.
