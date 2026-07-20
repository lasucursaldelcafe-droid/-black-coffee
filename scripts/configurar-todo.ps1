# Configuración automática — Black Coffee Administration
# Clic derecho → "Ejecutar con PowerShell"  O en terminal:
#   cd C:\Users\LENOVO\Projects\...\ -black-coffee
#   .\scripts\configurar-todo.ps1

$ErrorActionPreference = "Stop"
Write-Host ""
Write-Host "=== INSTALADOR AUTOMÁTICO BCA ===" -ForegroundColor Cyan
Write-Host ""

# --- Clave Resend (cámbiala si rotaste la key) ---
if (-not $env:RESEND_API_KEY) {
    Write-Host "Pega tu clave de Resend (empieza con re_):" -ForegroundColor Yellow
    $env:RESEND_API_KEY = Read-Host "RESEND_API_KEY"
}

if (-not $env:RESEND_API_KEY) {
    Write-Host "ERROR: Necesitas una clave de Resend." -ForegroundColor Red
    Write-Host "Créala en: https://resend.com/api-keys" -ForegroundColor Yellow
    exit 1
}

# --- Token Firebase (solo la primera vez) ---
if (-not $env:FIREBASE_TOKEN) {
    Write-Host ""
    Write-Host "¿Ya tienes FIREBASE_TOKEN? (s/n)" -ForegroundColor Yellow
    $tiene = Read-Host
    if ($tiene -ne "s" -and $tiene -ne "S") {
        Write-Host "Ejecutando firebase login:ci (se abre el navegador)..." -ForegroundColor Cyan
        firebase login:ci
        Write-Host ""
        Write-Host "Pega el token que apareció arriba:" -ForegroundColor Yellow
        $env:FIREBASE_TOKEN = Read-Host "FIREBASE_TOKEN"
    } else {
        $env:FIREBASE_TOKEN = Read-Host "Pega tu FIREBASE_TOKEN"
    }
}

Set-Location $PSScriptRoot\..

Write-Host ""
Write-Host "Ejecutando instalador..." -ForegroundColor Cyan
node scripts/instalar-todo.mjs

Write-Host ""
Write-Host "=== FIN ===" -ForegroundColor Green
Read-Host "Presiona Enter para cerrar"
