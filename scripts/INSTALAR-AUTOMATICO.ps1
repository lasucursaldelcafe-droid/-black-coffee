#Requires -Version 5.1
# Instalación 100% automática — Black Coffee Administration
# Ejecutar: powershell -ExecutionPolicy Bypass -File scripts\INSTALAR-AUTOMATICO.ps1

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

function Escribir-Ok($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Escribir-Aviso($msg) { Write-Host "[!] $msg" -ForegroundColor Yellow }
function Escribir-Error($msg) { Write-Host "[X] $msg" -ForegroundColor Red }

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  INSTALADOR AUTOMATICO BCA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$Raiz = Split-Path -Parent $PSScriptRoot
Set-Location $Raiz

# --- 1. Node.js (winget silencioso si falta) ---
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Escribir-Aviso "Instalando Node.js..."
    winget install OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements --silent 2>$null
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')
}
if (Get-Command node -ErrorAction SilentlyContinue) { Escribir-Ok "Node.js: $(node -v)" }
else { Escribir-Error "No se pudo instalar Node.js. Instala manualmente desde https://nodejs.org"; exit 1 }

# --- 2. GitHub CLI (winget silencioso si falta) ---
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Escribir-Aviso "Instalando GitHub CLI..."
    winget install GitHub.cli --accept-package-agreements --accept-source-agreements --silent 2>$null
    $env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')
}
if (Get-Command gh -ErrorAction SilentlyContinue) { Escribir-Ok "GitHub CLI instalado" }

# --- 3. Archivo .env.local (credenciales) ---
$EnvFile = Join-Path $Raiz ".env.local"
$EnvExample = Join-Path $Raiz ".env.local.example"
if (-not (Test-Path $EnvFile)) {
    Escribir-Aviso "Creando .env.local desde plantilla..."
    if (Test-Path $EnvExample) {
        Copy-Item $EnvExample $EnvFile
    } else {
        @"
# Credenciales BCA — NO subir a GitHub
RESEND_API_KEY=
BCA_FROM_EMAIL=Black Coffee <onboarding@resend.dev>
FIREBASE_TOKEN=
"@ | Set-Content -Path $EnvFile -Encoding UTF8
    }
    Escribir-Aviso "Edita .env.local y agrega RESEND_API_KEY (https://resend.com/api-keys) si aun no la tienes"
}
Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
        $nombre = $matches[1].Trim()
        $valor = $matches[2].Trim()
        if ($valor) { Set-Item -Path "env:$nombre" -Value $valor }
    }
}
Escribir-Ok "Credenciales cargadas desde .env.local"

# --- 4. Dependencias npm locales ---
Escribir-Aviso "Instalando dependencias..."
npm install firebase-tools --no-save 2>$null
Push-Location (Join-Path $Raiz "functions")
npm install 2>$null
Pop-Location
Escribir-Ok "Dependencias npm listas"

# --- 5. Secretos en GitHub (si gh tiene permisos) ---
$Repo = "lasucursaldelcafe-droid/-black-coffee"
if (Get-Command gh -ErrorAction SilentlyContinue) {
    gh auth status 2>$null
    if ($LASTEXITCODE -ne 0) {
        Escribir-Aviso "Iniciando sesion GitHub (se abre el navegador)..."
        gh auth login -w -p https 2>$null
    }

    $fbConfig = Get-Content (Join-Path $Raiz "js\firebase-config.js") -Raw
    function Extraer($campo) {
        if ($fbConfig -match "${campo}:\s*'([^']*)'") { return $matches[1] }
        return ""
    }

    $secretos = @{
        FIREBASE_API_KEY            = (Extraer "apiKey")
        FIREBASE_AUTH_DOMAIN        = (Extraer "authDomain")
        FIREBASE_PROJECT_ID         = (Extraer "projectId")
        FIREBASE_STORAGE_BUCKET     = (Extraer "storageBucket")
        FIREBASE_MESSAGING_SENDER_ID = (Extraer "messagingSenderId")
        FIREBASE_APP_ID             = (Extraer "appId")
        RESEND_API_KEY              = $env:RESEND_API_KEY
        BCA_FROM_EMAIL              = $env:BCA_FROM_EMAIL
    }
    if ($env:FIREBASE_TOKEN) { $secretos["FIREBASE_TOKEN"] = $env:FIREBASE_TOKEN }

    foreach ($par in $secretos.GetEnumerator()) {
        if ($par.Value) {
            echo $par.Value | gh secret set $par.Key --repo $Repo 2>$null
            if ($LASTEXITCODE -eq 0) { Escribir-Ok "Secreto GitHub: $($par.Key)" }
            else { Escribir-Aviso "No se pudo guardar $($par.Key) (necesitas ser admin del repo)" }
        }
    }
}

# --- 6. Token Firebase (login CI automatico si falta) ---
if (-not $env:FIREBASE_TOKEN) {
    Escribir-Aviso "Obteniendo token Firebase (se abre el navegador una vez)..."
    $loginOutput = npx firebase login:ci 2>&1 | Out-String
    if ($loginOutput -match '1//[A-Za-z0-9_\-]+') {
        $env:FIREBASE_TOKEN = $Matches[0]
        Add-Content -Path $EnvFile -Value "FIREBASE_TOKEN=$($env:FIREBASE_TOKEN)"
        Escribir-Ok "Token Firebase guardado en .env.local"
        if (Get-Command gh -ErrorAction SilentlyContinue) {
            echo $env:FIREBASE_TOKEN | gh secret set FIREBASE_TOKEN --repo $Repo 2>$null
        }
    } else {
        Escribir-Aviso "Token Firebase no obtenido. Ejecuta: npx firebase login:ci"
    }
}

# --- 7. Desplegar Firebase Functions + reglas ---
if ($env:FIREBASE_TOKEN -and $env:RESEND_API_KEY) {
    Escribir-Aviso "Desplegando correo y reglas Firestore..."
    $proj = "black-coffee-15ccc"
    $env:FIREBASE_TOKEN = $env:FIREBASE_TOKEN
    echo -n $env:RESEND_API_KEY | npx firebase functions:secrets:set RESEND_API_KEY --project $proj --data-file - 2>$null
    echo -n $env:BCA_FROM_EMAIL | npx firebase functions:secrets:set BCA_FROM_EMAIL --project $proj --data-file - 2>$null
    npx firebase deploy --only functions,firestore:rules --project $proj --token $env:FIREBASE_TOKEN
    if ($LASTEXITCODE -eq 0) { Escribir-Ok "Firebase desplegado correctamente" }
    else { Escribir-Aviso "Deploy Firebase fallo. Verifica plan Blaze en Firebase Console." }
} else {
    Escribir-Aviso "Omitiendo deploy Firebase (falta FIREBASE_TOKEN o RESEND_API_KEY)"
}

# --- 8. Disparar workflow GitHub ---
if (Get-Command gh -ErrorAction SilentlyContinue) {
    gh workflow run "Desplegar Firebase (correo + reglas)" --repo $Repo 2>$null
    Escribir-Ok "Workflow de despliegue iniciado en GitHub"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  INSTALACION COMPLETADA" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "App: https://lasucursaldelcafe-droid.github.io/-black-coffee/"
Write-Host "Prueba: registra una venta y revisa ghostspecialtycoffee@gmail.com"
Write-Host ""
