@echo off
title Black Coffee - Abrir enlaces
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ABRIR-TODO.ps1"
