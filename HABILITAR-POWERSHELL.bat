@echo off
title Black Coffee - Habilitar PowerShell
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\HABILITAR-POWERSHELL.ps1"
echo.
pause
