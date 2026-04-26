#!/bin/bash
echo "🌸 EasyVtuber: Elite & Lite Installation 🌸"

# Check for Python
if ! command -v python3 &> /dev/null
then
    echo "❌ Error: Python3 is not installed."
    exit 1
fi

# Install UV
pip install uv

# Install dependencies using UV for speed
echo "📦 Installing core dependencies..."
uv pip install -r requirements/requirements.txt

# NPU / Intel Optimization (OpenVINO)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "⚡ Adding OpenVINO support for Intel NPUs (Linux)..."
    uv pip install onnxruntime-openvino
elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🍎 Adding Apple Silicon (Metal) optimization..."
    uv pip install onnxruntime-silicon
fi

echo "📚 Downloading placeholder data..."
python3 backend/managers/create_vtuber_placeholders.py

echo.
echo "🌸 Installation Complete! 🌸"
echo "💡 To start the launcher: python3 gui/launcher2.py"
echo "💡 To start directly: python3 main.py --character your_character"
