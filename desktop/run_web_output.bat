@echo off
cd /D "%~dp0"
set "PY=python"
if exist ".venv\Scripts\python.exe" set "PY=.venv\Scripts\python.exe"
echo 🌐 Starting EasyVtuber with Web Output...
"%PY%" main.py --character Houshou_Marine --output_web %*
pause
