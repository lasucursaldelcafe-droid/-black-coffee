#Requires -Version 5.1
Import-Module (Join-Path $PSScriptRoot 'BCA\BCA.psm1') -Force -DisableNameChecking
Open-BCAEnlaces
Write-Host 'Presiona Enter para cerrar...' -ForegroundColor Gray
Read-Host | Out-Null
