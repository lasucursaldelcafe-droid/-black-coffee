#Requires -Version 5.1
<#
.SYNOPSIS
    Carga el modulo BCA. Usar con -ExecutionPolicy Bypass si la politica esta restringida.
.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\Import-BCA.ps1
.EXAMPLE
    . .\scripts\Import-BCA.ps1
#>

param(
    [switch]$ShowHelp
)

$ModulePath = Join-Path $PSScriptRoot 'BCA\BCA.psm1'
if (-not (Test-Path -LiteralPath $ModulePath)) {
    Write-Error "No se encontro el modulo: $ModulePath"
    exit 1
}

Import-Module $ModulePath -Force -DisableNameChecking

if ($ShowHelp) {
    Write-Host ''
    Write-Host 'Modulo BCA cargado. Comandos principales:' -ForegroundColor Cyan
    Write-Host '  Open-BCAEnlaces'
    Write-Host '  Start-BCAFullAutomation -OpenAppAtEnd'
    Write-Host '  Install-BCAProject'
    Write-Host '  Get-BCAConfig'
    Write-Host ''
}
