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

:: Version hint (TensorRT wheel support is cp310-only in this repo)
for /f "tokens=2 delims= " %%a in ('python --version') do set PYVER=%%a
echo 🐍 Detected Python !PYVER!
echo 💡 Recommended: Python 3.10 for TensorRT support (ONNX Runtime paths work on newer Python versions).

:: Install UV package manager
echo 🚀 Installing UV package manager...
python -m pip install --upgrade pip
python -m pip install uv

:: Install core dependencies (required)
echo 📦 Installing core dependencies...
uv pip install -r requirements\requirements-core.txt

:: Install optional Windows feature dependencies
echo ⚡ Installing optional Windows feature dependencies (DirectML/OpenVINO, VMC, Spout2, Web output)...
uv pip install -r requirements\requirements-windows-optional.txt

:: Download placeholder data
echo 📚 Preparing placeholders...
python backend\managers\create_vtuber_placeholders.py

echo.
echo 🌸 Installation Complete! 🌸
echo 💡 To start the launcher: python gui\launcher2.py
echo 💡 To start directly: python main.py --character your_character
echo 💡 Optional TensorRT setup: see desktop\README.md (Windows Quick Start)
pause
