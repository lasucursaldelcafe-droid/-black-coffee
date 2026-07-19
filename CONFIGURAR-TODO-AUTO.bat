@echo off
title Black Coffee - Configuracion automatica completa
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\CONFIGURAR-TODO-AUTO.ps1"
