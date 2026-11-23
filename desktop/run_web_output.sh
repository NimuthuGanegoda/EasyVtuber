#!/bin/bash
set -e
cd "$(dirname "$0")"
if [ -f ".venv/bin/activate" ]; then
    # shellcheck disable=SC1091
    source ".venv/bin/activate"
fi
echo "🌐 Starting EasyVtuber with Web Output..."
python3 main.py --character Houshou_Marine --output_web "$@"
