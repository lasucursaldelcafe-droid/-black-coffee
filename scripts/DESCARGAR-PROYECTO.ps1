#Requires -Version 5.1
# Clona el repo (si no existe) y deja accesos de un clic en el Escritorio.

$ErrorActionPreference = 'Stop'

$RepoUrl = 'https://github.com/lasucursaldelcafe-droid/-black-coffee.git'
$CarpetaDestino = Join-Path $env:USERPROFILE 'Documents\BlackCoffeeAdmin'

Write-Host ''
Write-Host 'Black Coffee Administration - Descarga automatica' -ForegroundColor Cyan
Write-Host "Destino: $CarpetaDestino" -ForegroundColor Gray
Write-Host ''

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host 'Instalando Git...' -ForegroundColor Yellow
    winget install Git.Git --accept-package-agreements --accept-source-agreements --silent
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')
}

if (Test-Path (Join-Path $CarpetaDestino '.git')) {
    Write-Host 'Actualizando proyecto existente...' -ForegroundColor Yellow
    Set-Location $CarpetaDestino
    git pull origin main
} else {
    New-Item -ItemType Directory -Force -Path (Split-Path $CarpetaDestino) | Out-Null
    git clone $RepoUrl $CarpetaDestino
    Set-Location $CarpetaDestino
}

$Escritorio = [Environment]::GetFolderPath('Desktop')

function Crear-AccesoDirecto($Nombre, $BatRelativo) {
    $Origen = Join-Path $CarpetaDestino $BatRelativo
    $Destino = Join-Path $Escritorio "$Nombre.lnk"
    $Wsh = New-Object -ComObject WScript.Shell
    $Acceso = $Wsh.CreateShortcut($Destino)
    $Acceso.TargetPath = $Origen
    $Acceso.WorkingDirectory = $CarpetaDestino
    $Acceso.Description = 'Black Coffee Administration'
    $Acceso.Save()
    Write-Host "  Acceso directo: $Destino" -ForegroundColor Green
}

Crear-AccesoDirecto 'BCA - Abrir enlaces' 'ABRIR-ENLACES.bat'
Crear-AccesoDirecto 'BCA - Instalar y abrir' 'INSTALAR-Y-ABRIR.bat'

Write-Host ''
Write-Host 'Listo. En tu Escritorio tienes:' -ForegroundColor Green
Write-Host '  - BCA - Abrir enlaces.lnk' -ForegroundColor White
Write-Host '  - BCA - Instalar y abrir.lnk' -ForegroundColor White
Write-Host ''
Write-Host 'Carpeta del proyecto:' -ForegroundColor Yellow
Write-Host "  $CarpetaDestino" -ForegroundColor White
Write-Host ''

$Abrir = Read-Host 'Abrir enlaces ahora? (S/n)'
if ($Abrir -ne 'n' -and $Abrir -ne 'N') {
    & (Join-Path $CarpetaDestino 'scripts\ABRIR-TODO.ps1')
}
