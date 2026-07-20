@echo off
title Black Coffee - Descargar para Windows
cd /d "%~dp0"

echo.
echo  ========================================
echo   Black Coffee Administration - Windows
echo  ========================================
echo.
echo  Abriendo BCA en el navegador...
echo  Para instalar como app de Windows:
echo    1. Use Microsoft Edge o Google Chrome
echo    2. Menu (tres puntos) - Instalar Black Coffee Administration
echo    3. O haga clic en el icono Instalar en la barra de direcciones
echo.
echo  Modo offline: los datos se guardan en ESTE PC.
echo  Al reconectar internet, se sincronizan con la nube.
echo.

set "APP_URL=https://lasucursaldelcafe-droid.github.io/-black-coffee/"

if exist "%~dp0index.html" (
  start "" "%~dp0index.html"
) else (
  start "" "%APP_URL%"
)

timeout /t 3 >nul
