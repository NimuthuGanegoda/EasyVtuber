@echo off
setlocal enabledelayedexpansion

echo 🌸 EasyVtuber: Windows Elite & Lite Installation 🌸

:: Check for Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: Python is not installed or not in your PATH.
    pause
    exit /b
)

:: Install UV
echo 🚀 Installing UV package manager...
pip install uv

:: Install dependencies
echo 📦 Installing core dependencies...
uv pip install -r requirements\requirements.txt

:: NPU / DirectML Optimization
echo ⚡ Adding DirectML/OpenVINO support for Intel/AMD NPUs/GPUs...
uv pip install onnxruntime-directml onnxruntime-openvino

:: Download placeholder data
echo 📚 Preparing placeholders...
python backend\managers\create_vtuber_placeholders.py

echo.
echo 🌸 Installation Complete! 🌸
echo 💡 To start the launcher: python gui\launcher2.py
echo 💡 To start directly: python main.py --character your_character
pause
