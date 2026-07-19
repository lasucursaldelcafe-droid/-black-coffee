#Requires -Version 5.1
# Abre todas las rutas verificadas en el navegador predeterminado.
# Ejecutar: doble clic en ABRIR-ENLACES.bat (raiz del proyecto)

$ErrorActionPreference = 'SilentlyContinue'

$Raiz = Split-Path -Parent $PSScriptRoot

$Enlaces = @(
    @{ Nombre = 'App - Login';              Url = 'https://lasucursaldelcafe-droid.github.io/-black-coffee/' },
    @{ Nombre = 'App - Plataforma';         Url = 'https://lasucursaldelcafe-droid.github.io/-black-coffee/app.html' },
    @{ Nombre = 'GitHub - Repo';            Url = 'https://github.com/lasucursaldelcafe-droid/-black-coffee' },
    @{ Nombre = 'GitHub - Secretos';        Url = 'https://github.com/lasucursaldelcafe-droid/-black-coffee/actions/workflows/instalar-secretos.yml' },
    @{ Nombre = 'GitHub - Deploy Firebase'; Url = 'https://github.com/lasucursaldelcafe-droid/-black-coffee/actions/workflows/desplegar-firebase.yml' },
    @{ Nombre = 'GitHub - Actions';         Url = 'https://github.com/lasucursaldelcafe-droid/-black-coffee/actions' },
    @{ Nombre = 'Firebase - Consola';       Url = 'https://console.firebase.google.com/project/black-coffee-15ccc' },
    @{ Nombre = 'Firebase - Blaze';         Url = 'https://console.firebase.google.com/project/black-coffee-15ccc/usage/details' },
    @{ Nombre = 'Firebase - Firestore';     Url = 'https://console.firebase.google.com/project/black-coffee-15ccc/firestore' },
    @{ Nombre = 'Firebase - Auth';          Url = 'https://console.firebase.google.com/project/black-coffee-15ccc/authentication/providers' },
    @{ Nombre = 'Resend - API keys';        Url = 'https://resend.com/api-keys' }
)

Write-Host ''
Write-Host '==================================================' -ForegroundColor Cyan
Write-Host '  BLACK COFFEE - Abriendo enlaces' -ForegroundColor Cyan
Write-Host '==================================================' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Carpeta del proyecto:' -ForegroundColor Gray
Write-Host "  $Raiz" -ForegroundColor White
Write-Host ''

$i = 0
foreach ($e in $Enlaces) {
    $i++
    Write-Host ("  [{0:D2}] {1}" -f $i, $e.Nombre) -ForegroundColor Green
    Write-Host "       $($e.Url)" -ForegroundColor DarkGray
    Start-Process $e.Url
    Start-Sleep -Milliseconds 800
}

Write-Host ''
Write-Host 'Listo. Revisa las pestanas del navegador.' -ForegroundColor Green
Write-Host 'Correo: ghostspecialtycoffee@gmail.com' -ForegroundColor Yellow
Write-Host ''
Write-Host 'Presiona Enter para cerrar...' -ForegroundColor Gray
Read-Host | Out-Null
