#!/usr/bin/env bash
# Instala la CLI `graphify` (paquete en ./pkg) en un venv propio y la deja en el PATH. Idempotente.
set -e
V="$HOME/.venvs/graphify"; WANT=$(sed -n 's/^version = "\(.*\)"/\1/p' "$(dirname "$0")/pkg/pyproject.toml" | head -1)
if command -v graphify >/dev/null && [ "$(graphify --version 2>/dev/null)" = "graphify $WANT" ]; then echo "graphify $WANT ya instalado"; exit 0; fi
T=$(mktemp -d); cp -r "$(dirname "$0")/pkg/." "$T"   # pip deja build/ y egg-info: se instala desde una copia
python3 -m venv "$V" && "$V/bin/pip" install -q "$T"; rm -rf "$T"
mkdir -p "$HOME/.local/bin" && ln -sf "$V/bin/graphify" "$HOME/.local/bin/graphify"
echo "graphify $WANT instalado en $HOME/.local/bin (añádelo al PATH si hace falta)"
