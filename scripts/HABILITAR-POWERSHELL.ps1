#Requires -Version 5.1
<#
.SYNOPSIS
    Habilita la ejecucion de scripts PowerShell para el usuario actual (BCA).
.DESCRIPTION
    Windows bloquea Import-Module y scripts .ps1 con ExecutionPolicy Restricted.
    Este script establece RemoteSigned solo para CurrentUser (no requiere admin).
#>

Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host '  BCA - Habilitar PowerShell' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

$before = Get-ExecutionPolicy -Scope CurrentUser -ErrorAction SilentlyContinue
Write-Host "Politica actual (CurrentUser): $before" -ForegroundColor Gray

try {
    Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
    $after = Get-ExecutionPolicy -Scope CurrentUser
    Write-Host "Politica nueva (CurrentUser):  $after" -ForegroundColor Green
    Write-Host ''
    Write-Host 'Listo. Ya puedes usar:' -ForegroundColor Cyan
    Write-Host '  Import-Module .\scripts\BCA\BCA.psm1 -Force'
    Write-Host '  .\scripts\bca.ps1 auto'
    Write-Host ''
}
catch {
    Write-Host "No se pudo cambiar la politica: $_" -ForegroundColor Red
    Write-Host ''
    Write-Host 'Alternativas sin cambiar la politica:' -ForegroundColor Yellow
    Write-Host '  Doble clic: CONFIGURAR-TODO-AUTO.bat'
    Write-Host '  Doble clic: BCA-CONSOLA.bat'
    Write-Host '  .\BCA.bat auto'
    Write-Host ''
    exit 1
}
