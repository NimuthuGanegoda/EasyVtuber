#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ -f ".venv/bin/activate" ]; then
    # shellcheck disable=SC1091
    source ".venv/bin/activate"
fi

if ! python3 -c "import wx" >/dev/null 2>&1; then
    echo "EasyVtuber Desktop dependencies are not installed yet."
    echo "Run ./install_reqs.sh first, then re-run ./start_launcher.sh"
    exit 1
fi

exec python3 gui/launcher2.py "$@"
