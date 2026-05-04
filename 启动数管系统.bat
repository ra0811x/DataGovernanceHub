@echo off
setlocal
cd /d "%~dp0"

set "APP_HOST=127.0.0.1"
set "APP_PORT=8100"
set "APP_DEBUG=0"
set "TARGET_URL=http://127.0.0.1:%APP_PORT%"
set "PYTHON_EXE="
set "PYTHON_ARGS="

for /f "delims=" %%I in ('where python 2^>nul') do (
    set "PYTHON_EXE=%%I"
    goto start_app
)

for /f "delims=" %%I in ('where py 2^>nul') do (
    set "PYTHON_EXE=%%I"
    set "PYTHON_ARGS=-3"
    goto start_app
)

echo Python 3 was not found in PATH.
pause
exit /b 1

:start_app
echo Starting system...
start "System Service" "%PYTHON_EXE%" %PYTHON_ARGS% core\app.py
timeout /t 5 /nobreak >nul
explorer "%TARGET_URL%"
exit /b 0
