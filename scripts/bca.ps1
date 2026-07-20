#Requires -Version 5.1
# CLI unificada BCA - uso: .\scripts\bca.ps1 abrir|instalar|setup|auto|config|plan

param(
    [Parameter(Position = 0)]
    [ValidateSet('abrir', 'instalar', 'setup', 'auto', 'config', 'plan', 'help')]
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
        Start-BCASetup
    }
    'auto' {
        Start-BCAFullAutomation -OpenAppAtEnd
    }
    'plan' {
        Get-BCASetupPlan | Format-Table Orden, Nombre, QueHacer, Auto, Requiere -AutoSize
    }
    'config' {
        Get-BCAConfig | Format-List
        Write-Host 'Enlaces:' -ForegroundColor Cyan
        (Get-BCAConfig).Links.GetEnumerator() | ForEach-Object { Write-Host "  $($_.Key): $($_.Value)" }
    }
    default {
        Write-Host ''
        Write-Host 'BCA PowerShell - Comandos:' -ForegroundColor Cyan
        Write-Host '  .\scripts\bca.ps1 auto      -> TODO automatico sin preguntas (RECOMENDADO)'
        Write-Host '  .\scripts\bca.ps1 abrir     -> Abre enlaces en navegador'
        Write-Host '  .\scripts\bca.ps1 instalar  -> Instala dependencias'
        Write-Host '  .\scripts\bca.ps1 setup     -> Clona + iconos'
        Write-Host '  .\scripts\bca.ps1 plan      -> Que hace cada paso'
        Write-Host '  .\scripts\bca.ps1 config    -> Rutas y URLs'
        Write-Host ''
        Write-Host 'Doble clic: CONFIGURAR-TODO-AUTO.bat' -ForegroundColor Yellow
        Write-Host ''
    }
}
