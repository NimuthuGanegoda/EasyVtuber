@echo off
setlocal
cd /d "%~dp0"

set "PY=python"
if exist ".venv\Scripts\python.exe" set "PY=.venv\Scripts\python.exe"

"%PY%" -c "import wx" >nul 2>&1
if errorlevel 1 (
    echo EasyVtuber Desktop dependencies are not installed yet.
    echo Run install_reqs.bat first, then run start_launcher.bat.
    pause
    exit /b 1
)

"%PY%" gui\launcher2.py %*
