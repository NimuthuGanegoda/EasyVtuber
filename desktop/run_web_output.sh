#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "🌐 Starting EasyVtuber with Web Output..."
python3 main.py --character Houshou_Marine --output_web
