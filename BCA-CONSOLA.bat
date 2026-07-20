@echo off
title Black Coffee - Consola PowerShell BCA
cd /d "%~dp0"
powershell -NoExit -ExecutionPolicy Bypass -Command "Import-Module '%~dp0scripts\BCA\BCA.psm1' -Force; Set-Location '%CD%'; Write-Host ''; Write-Host 'Modulo BCA cargado.' -ForegroundColor Green; Write-Host 'Comandos: Open-BCAEnlaces | Start-BCAFullAutomation | Get-BCAConfig' -ForegroundColor Cyan; Write-Host ''"
