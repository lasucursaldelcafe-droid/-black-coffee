@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo ========================================
echo   BLACK COFFEE - Aplicar stack completo
echo   HTML ^| CSS ^| JavaScript ^| Python
echo ========================================
echo.

where python >nul 2>&1
if %errorlevel%==0 (
  python scripts\validar_plataforma.py
  if errorlevel 1 goto :error
) else (
  where python3 >nul 2>&1
  if %errorlevel%==0 (
    python3 scripts\validar_plataforma.py
    if errorlevel 1 goto :error
  ) else (
    echo [!] Python no encontrado - se continua solo con Node
  )
)

where node >nul 2>&1
if errorlevel 1 (
  echo [X] Instale Node.js: https://nodejs.org
  goto :error
)

node scripts\aplicar-todo.mjs
if errorlevel 1 goto :error

echo.
echo Listo. Abra: https://lasucursaldelcafe-droid.github.io/-black-coffee/
echo.
pause
exit /b 0

:error
echo.
echo Hubo errores. Revise los mensajes arriba.
pause
exit /b 1
