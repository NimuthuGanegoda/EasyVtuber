#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "🌸 EasyVtuber: Elite & Lite Installation 🌸"

# Check for Python
if ! command -v python3 &> /dev/null
then
    echo "❌ Error: Python3 is not installed."
    exit 1
fi

# Ensure we install inside a virtual environment (avoids PEP 668 system Python errors)
if [ -z "${VIRTUAL_ENV:-}" ]; then
    if [ ! -d ".venv" ]; then
        echo "🐍 Creating virtual environment in .venv..."
        python3 -m venv .venv
    fi
    # shellcheck disable=SC1091
    source .venv/bin/activate
fi

# Install UV
python3 -m pip install --upgrade pip uv

# Install dependencies using UV for speed
echo "📦 Installing core dependencies..."
uv pip install -r requirements/requirements.txt

# NPU / Intel Optimization (OpenVINO)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "⚡ Adding OpenVINO support for Intel NPUs (Linux)..."
    uv pip install "onnxruntime-openvino==1.18.0" || true
elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🍎 Apple Silicon uses built-in CoreML EP from onnxruntime."
fi

# PyTorch is deliberately not installed: the ONNX runtime does not need it.
# Install requirements/requirements-torch.txt only for the legacy PyTorch poser.

echo "📚 Generating placeholder character assets if missing..."
python3 backend/managers/create_vtuber_placeholders.py

echo ""
echo "🌸 Installation Complete! 🌸"
echo "💡 Activate venv first if needed: source .venv/bin/activate"
echo "💡 To start the launcher: python3 gui/launcher2.py"
echo "💡 To start directly: python3 main.py --character Houshou_Marine"
