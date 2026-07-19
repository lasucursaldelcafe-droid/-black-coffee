@echo off
title Black Coffee - Abrir todos los enlaces
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\ABRIR-TODO.ps1"
