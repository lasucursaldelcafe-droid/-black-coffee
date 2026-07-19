#Requires -Version 5.1
# CLI unificada BCA - uso: .\scripts\bca.ps1 abrir|instalar|setup|config

param(
    [Parameter(Position = 0)]
    [ValidateSet('abrir', 'instalar', 'setup', 'config', 'help')]
    [string]$Accion = 'help'
)

$ModulePath = Join-Path $PSScriptRoot 'BCA\BCA.psm1'
Import-Module $ModulePath -Force -DisableNameChecking

switch ($Accion) {
    'abrir' {
        Open-BCAEnlaces
    }
    'instalar' {
        Install-BCAProject
    }
    'setup' {
        Start-BCASetup -OpenLinks
    }
    'config' {
        Get-BCAConfig | Format-List
        Write-Host 'Enlaces:' -ForegroundColor Cyan
        (Get-BCAConfig).Links.GetEnumerator() | ForEach-Object { Write-Host "  $($_.Key): $($_.Value)" }
    }
    default {
        Write-Host ''
        Write-Host 'BCA PowerShell - Comandos disponibles:' -ForegroundColor Cyan
        Write-Host '  .\scripts\bca.ps1 abrir     -> Abre todos los enlaces'
        Write-Host '  .\scripts\bca.ps1 instalar  -> Instala dependencias y despliega'
        Write-Host '  .\scripts\bca.ps1 setup     -> Clona/actualiza + iconos + abrir'
        Write-Host '  .\scripts\bca.ps1 config    -> Muestra rutas y URLs'
        Write-Host ''
        Write-Host 'Funciones del modulo (despues de Import-Module):' -ForegroundColor Yellow
        Write-Host '  Open-BCAEnlaces'
        Write-Host '  Install-BCAProject'
        Write-Host '  Start-BCASetup -OpenLinks'
        Write-Host '  Sync-BCARepository'
        Write-Host '  Get-BCAConfig'
        Write-Host ''
    }
}
