@echo off
title Black Coffee - Instalar y abrir enlaces
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\INSTALAR-Y-ABRIR.ps1"
