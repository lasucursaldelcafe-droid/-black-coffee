#Requires -Version 5.1
# Instala dependencias + abre todos los enlaces. Sin preguntas.
# Ejecutar: doble clic en INSTALAR-Y-ABRIR.bat (raíz del proyecto)

$Raiz = Split-Path -Parent $PSScriptRoot
Set-Location $Raiz

Write-Host ""
Write-Host "PASO 1/2 — Instalacion automatica..." -ForegroundColor Cyan
& (Join-Path $PSScriptRoot 'INSTALAR-AUTOMATICO.ps1')

Write-Host ""
Write-Host "PASO 2/2 — Abriendo enlaces..." -ForegroundColor Cyan
& (Join-Path $PSScriptRoot 'ABRIR-TODO.ps1')
