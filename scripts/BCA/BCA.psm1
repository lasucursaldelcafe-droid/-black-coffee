# Black Coffee Administration - Modulo PowerShell para Windows
# Compatible con Windows PowerShell 5.1+

$script:BCAConfig = @{
    RepoUrl           = 'https://github.com/lasucursaldelcafe-droid/-black-coffee.git'
    RepoName          = 'lasucursaldelcafe-droid/-black-coffee'
    DefaultFolder     = 'BlackCoffeeAdmin'
    FirebaseProject   = 'black-coffee-15ccc'
    NotificationEmail = 'ghostspecialtycoffee@gmail.com'
    AppUrl            = 'https://lasucursaldelcafe-droid.github.io/-black-coffee/'
    AppLoginUrl       = 'https://lasucursaldelcafe-droid.github.io/-black-coffee/'
    AppPlatformUrl    = 'https://lasucursaldelcafe-droid.github.io/-black-coffee/app.html'
}

function Convert-BCAToSinglePath {
    [CmdletBinding()]
    param(
        [AllowNull()]
        $Path
    )

    if ($null -eq $Path) { return $null }
    if ($Path -is [System.Array]) {
        $Path = $Path[-1]
    }
    if ($Path -is [System.IO.FileInfo] -or $Path -is [System.Management.Automation.PathInfo]) {
        return $Path.ProviderPath
    }
    return [string]$Path
}

function Resolve-BCADirectory {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return $Path.TrimEnd('\')
    }

    $resolved = Resolve-Path -LiteralPath $Path -ErrorAction Stop
    return Convert-BCAToSinglePath -Path $resolved
}

function Get-BCAProjectRoot {
    [CmdletBinding()]
    param(
        [string]$StartPath
    )

    if (-not $StartPath) {
        $StartPath = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }
    }

    $current = $StartPath
    for ($i = 0; $i -lt 6; $i++) {
        if (Test-Path (Join-Path $current 'js\firebase-config.js')) {
            return Resolve-BCADirectory -Path $current
        }
        $parent = Split-Path $current -Parent
        if (-not $parent -or $parent -eq $current) { break }
        $current = $parent
    }

    return (Join-Path $env:USERPROFILE "Documents\$($script:BCAConfig.DefaultFolder)")
}

function Get-BCAConfig {
    [CmdletBinding()]
    param(
        [string]$ProjectRoot = (Get-BCAProjectRoot)
    )

    $links = [ordered]@{
        'App - Login'              = $script:BCAConfig.AppLoginUrl
        'App - Plataforma'         = $script:BCAConfig.AppPlatformUrl
        'GitHub - Repo'            = 'https://github.com/lasucursaldelcafe-droid/-black-coffee'
        'GitHub - Secretos'        = 'https://github.com/lasucursaldelcafe-droid/-black-coffee/actions/workflows/instalar-secretos.yml'
        'GitHub - Deploy Firebase' = 'https://github.com/lasucursaldelcafe-droid/-black-coffee/actions/workflows/desplegar-firebase.yml'
        'GitHub - Actions'         = 'https://github.com/lasucursaldelcafe-droid/-black-coffee/actions'
        'Firebase - Consola'       = "https://console.firebase.google.com/project/$($script:BCAConfig.FirebaseProject)"
        'Firebase - Blaze'         = "https://console.firebase.google.com/project/$($script:BCAConfig.FirebaseProject)/usage/details"
        'Firebase - Firestore'     = "https://console.firebase.google.com/project/$($script:BCAConfig.FirebaseProject)/firestore"
        'Firebase - Auth'          = "https://console.firebase.google.com/project/$($script:BCAConfig.FirebaseProject)/authentication/providers"
        'Resend - API keys'        = 'https://resend.com/api-keys'
    }

    [pscustomobject]@{
        ProjectRoot   = $ProjectRoot
        EnvFile       = Join-Path $ProjectRoot '.env.local'
        EnvExample    = Join-Path $ProjectRoot '.env.local.example'
        FunctionsDir  = Join-Path $ProjectRoot 'functions'
        FirebaseConfig = Join-Path $ProjectRoot 'js\firebase-config.js'
        RepoUrl       = $script:BCAConfig.RepoUrl
        RepoName      = $script:BCAConfig.RepoName
        FirebaseProject = $script:BCAConfig.FirebaseProject
        AppUrl        = $script:BCAConfig.AppUrl
        AppLoginUrl   = $script:BCAConfig.AppLoginUrl
        AppPlatformUrl = $script:BCAConfig.AppPlatformUrl
        NotificationEmail = $script:BCAConfig.NotificationEmail
        Links         = $links
    }
}

function Write-BCAStatus {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('Ok', 'Info', 'Warning', 'Error')]
        [string]$Level,

        [Parameter(Mandatory = $true)]
        [string]$Message
    )

    switch ($Level) {
        'Ok'      { Write-Host "[OK] $Message" -ForegroundColor Green }
        'Info'    { Write-Host "[..] $Message" -ForegroundColor Cyan }
        'Warning' { Write-Host "[!] $Message" -ForegroundColor Yellow }
        'Error'   { Write-Host "[X] $Message" -ForegroundColor Red }
    }
}

function Update-BCAPathEnvironment {
    [CmdletBinding()]
    param()

    $machine = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
    $user = [System.Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machine;$user"
}

function Test-BCACommand {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,

        [string]$WinGetId,

        [switch]$InstallIfMissing
    )

    if (Get-Command $Name -ErrorAction SilentlyContinue) {
        return $true
    }

    if (-not $InstallIfMissing -or -not $WinGetId) {
        return $false
    }

    Write-BCAStatus -Level Warning -Message "Instalando $Name con winget..."
    winget install $WinGetId --accept-package-agreements --accept-source-agreements --silent 2>$null | Out-Null
    Update-BCAPathEnvironment
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Sync-BCARepository {
    [CmdletBinding()]
    param(
        [string]$Destination = (Join-Path $env:USERPROFILE "Documents\$($script:BCAConfig.DefaultFolder)")
    )

    if (-not (Test-BCACommand -Name 'git' -WinGetId 'Git.Git' -InstallIfMissing)) {
        throw 'Git no esta instalado y no se pudo instalar automaticamente.'
    }

    if (Test-Path (Join-Path $Destination '.git')) {
        Write-BCAStatus -Level Info -Message "Actualizando repositorio en $Destination"
        Push-Location $Destination
        try {
            $null = git pull origin main 2>&1
            if ($LASTEXITCODE -ne 0) {
                throw "git pull fallo (codigo $LASTEXITCODE)"
            }
        } finally {
            Pop-Location
        }
    } else {
        Write-BCAStatus -Level Info -Message "Clonando repositorio en $Destination"
        $parent = Split-Path $Destination -Parent
        if (-not (Test-Path $parent)) {
            New-Item -ItemType Directory -Force -Path $parent | Out-Null
        }
        $null = git clone $script:BCAConfig.RepoUrl $Destination 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "git clone fallo (codigo $LASTEXITCODE)"
        }
    }

    return Resolve-BCADirectory -Path $Destination
}

function Initialize-BCAEnvFile {
    [CmdletBinding()]
    param(
        [string]$ProjectRoot = (Get-BCAProjectRoot)
    )

    $cfg = Get-BCAConfig -ProjectRoot $ProjectRoot

    if (-not (Test-Path $cfg.EnvFile)) {
        Write-BCAStatus -Level Warning -Message 'Creando .env.local desde plantilla...'
        if (Test-Path $cfg.EnvExample) {
            Copy-Item $cfg.EnvExample $cfg.EnvFile
        } else {
            @(
                '# Credenciales BCA - NO subir a GitHub'
                'RESEND_API_KEY='
                'BCA_FROM_EMAIL=Black Coffee <onboarding@resend.dev>'
                'FIREBASE_TOKEN='
            ) | Set-Content -Path $cfg.EnvFile -Encoding UTF8
        }
        Write-BCAStatus -Level Warning -Message 'Agrega RESEND_API_KEY en .env.local (https://resend.com/api-keys)'
    }

    return $cfg.EnvFile
}

function Import-BCAEnvFile {
    [CmdletBinding()]
    param(
        [string]$ProjectRoot = (Get-BCAProjectRoot)
    )

    $envFile = Initialize-BCAEnvFile -ProjectRoot $ProjectRoot
    $loaded = @{}

    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#=]+)=(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            if ($value) {
                Set-Item -Path "env:$name" -Value $value
                $loaded[$name] = $value
            }
        }
    }

    Write-BCAStatus -Level Ok -Message 'Credenciales cargadas desde .env.local'
    return $loaded
}

function Get-BCAFirebaseField {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$FieldName,

        [string]$ConfigPath = (Get-BCAConfig).FirebaseConfig
    )

    $raw = Get-Content $ConfigPath -Raw -ErrorAction Stop
    if ($raw -match "${FieldName}:\s*'([^']*)'") {
        return $matches[1]
    }
    return ''
}

function Install-BCADependencies {
    [CmdletBinding()]
    param(
        [string]$ProjectRoot = (Get-BCAProjectRoot)
    )

    if (-not (Test-BCACommand -Name 'node' -WinGetId 'OpenJS.NodeJS.LTS' -InstallIfMissing)) {
        throw 'Node.js no esta instalado. Instala desde https://nodejs.org'
    }
    Write-BCAStatus -Level Ok -Message "Node.js: $(node -v)"

    if (Test-BCACommand -Name 'gh' -WinGetId 'GitHub.cli' -InstallIfMissing) {
        Write-BCAStatus -Level Ok -Message 'GitHub CLI instalado'
    } else {
        Write-BCAStatus -Level Warning -Message 'GitHub CLI no disponible (opcional)'
    }

    Push-Location $ProjectRoot
    try {
        Write-BCAStatus -Level Info -Message 'Instalando firebase-tools...'
        npm install firebase-tools --no-save 2>$null | Out-Null

        Write-BCAStatus -Level Info -Message 'Instalando dependencias de functions...'
        Push-Location (Join-Path $ProjectRoot 'functions')
        npm install 2>$null | Out-Null
        Pop-Location

        Write-BCAStatus -Level Ok -Message 'Dependencias npm listas'
    } finally {
        Pop-Location
    }
}

function Set-BCAGitHubSecrets {
    [CmdletBinding()]
    param(
        [string]$ProjectRoot = (Get-BCAProjectRoot),

        [switch]$AllowInteractive
    )

    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
        Write-BCAStatus -Level Warning -Message 'gh no instalado - omitiendo secretos GitHub'
        return
    }

    if ($env:GH_TOKEN) {
        $env:GITHUB_TOKEN = $env:GH_TOKEN
    }

    gh auth status 2>$null
    if ($LASTEXITCODE -ne 0) {
        if ($AllowInteractive) {
            Write-BCAStatus -Level Warning -Message 'Iniciando sesion GitHub (navegador)...'
            gh auth login -w -p https 2>$null
        } else {
            Write-BCAStatus -Level Warning -Message 'GitHub no autenticado - agrega GH_TOKEN en .env.local o ejecuta gh auth login'
            return
        }
    }

    $secrets = @{
        FIREBASE_API_KEY             = (Get-BCAFirebaseField -FieldName 'apiKey' -ConfigPath (Join-Path $ProjectRoot 'js\firebase-config.js'))
        FIREBASE_AUTH_DOMAIN         = (Get-BCAFirebaseField -FieldName 'authDomain' -ConfigPath (Join-Path $ProjectRoot 'js\firebase-config.js'))
        FIREBASE_PROJECT_ID          = (Get-BCAFirebaseField -FieldName 'projectId' -ConfigPath (Join-Path $ProjectRoot 'js\firebase-config.js'))
        FIREBASE_STORAGE_BUCKET      = (Get-BCAFirebaseField -FieldName 'storageBucket' -ConfigPath (Join-Path $ProjectRoot 'js\firebase-config.js'))
        FIREBASE_MESSAGING_SENDER_ID = (Get-BCAFirebaseField -FieldName 'messagingSenderId' -ConfigPath (Join-Path $ProjectRoot 'js\firebase-config.js'))
        FIREBASE_APP_ID              = (Get-BCAFirebaseField -FieldName 'appId' -ConfigPath (Join-Path $ProjectRoot 'js\firebase-config.js'))
        RESEND_API_KEY               = $env:RESEND_API_KEY
        BCA_FROM_EMAIL               = $env:BCA_FROM_EMAIL
    }

    if ($env:FIREBASE_TOKEN) {
        $secrets['FIREBASE_TOKEN'] = $env:FIREBASE_TOKEN
    }

    foreach ($entry in $secrets.GetEnumerator()) {
        if (-not $entry.Value) { continue }
        $entry.Value | gh secret set $entry.Key --repo $script:BCAConfig.RepoName 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-BCAStatus -Level Ok -Message "Secreto GitHub: $($entry.Key)"
        } else {
            Write-BCAStatus -Level Warning -Message "No se pudo guardar $($entry.Key) (requiere admin del repo)"
        }
    }
}

function Get-BCAFirebaseToken {
    [CmdletBinding()]
    param(
        [string]$ProjectRoot = (Get-BCAProjectRoot),

        [switch]$AllowInteractive
    )

    if ($env:FIREBASE_TOKEN) {
        return $env:FIREBASE_TOKEN
    }

    if (-not $AllowInteractive) {
        Write-BCAStatus -Level Warning -Message 'Sin FIREBASE_TOKEN en .env.local - omitiendo login Firebase'
        return $null
    }

    Write-BCAStatus -Level Warning -Message 'Obteniendo token Firebase (se abre el navegador)...'
    Push-Location $ProjectRoot
    try {
        $output = npx firebase login:ci 2>&1 | Out-String
    } finally {
        Pop-Location
    }

    if ($output -match '(1//[A-Za-z0-9_\-]+)') {
        $token = $Matches[1]
        $env:FIREBASE_TOKEN = $token
        $envFile = Join-Path $ProjectRoot '.env.local'
        Add-Content -Path $envFile -Value "FIREBASE_TOKEN=$token"
        Write-BCAStatus -Level Ok -Message 'Token Firebase guardado en .env.local'
        return $token
    }

    Write-BCAStatus -Level Warning -Message 'Token Firebase no obtenido'
    return $null
}

function Deploy-BCAFirebase {
    [CmdletBinding()]
    param(
        [string]$ProjectRoot = (Get-BCAProjectRoot)
    )

    if (-not $env:FIREBASE_TOKEN) {
        Write-BCAStatus -Level Warning -Message 'Sin FIREBASE_TOKEN - omitiendo deploy Firebase'
        return $false
    }
    if (-not $env:RESEND_API_KEY) {
        Write-BCAStatus -Level Warning -Message 'Sin RESEND_API_KEY - omitiendo deploy Firebase'
        return $false
    }

    $project = $script:BCAConfig.FirebaseProject
    Write-BCAStatus -Level Info -Message 'Desplegando Functions y reglas Firestore...'

    Push-Location $ProjectRoot
    try {
        $env:RESEND_API_KEY | npx firebase functions:secrets:set RESEND_API_KEY --project $project --data-file - 2>$null
        'Black Coffee <onboarding@resend.dev>' | npx firebase functions:secrets:set BCA_FROM_EMAIL --project $project --data-file - 2>$null
        $null = npx firebase deploy --only functions,firestore:rules --project $project --token $env:FIREBASE_TOKEN 2>&1
    } finally {
        Pop-Location
    }

    if ($LASTEXITCODE -eq 0) {
        Write-BCAStatus -Level Ok -Message 'Firebase desplegado correctamente'
        return $true
    }

    Write-BCAStatus -Level Warning -Message 'Deploy Firebase fallo. Verifica plan Blaze en Firebase Console.'
    return $false
}

function Start-BCAGitHubWorkflow {
    [CmdletBinding()]
    param(
        [string]$WorkflowName = 'Desplegar Firebase (correo + reglas)'
    )

    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
        return
    }

    gh workflow run $WorkflowName --repo $script:BCAConfig.RepoName 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-BCAStatus -Level Ok -Message "Workflow iniciado: $WorkflowName"
    }
}

function Open-BCAUrl {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url,

        [int]$DelayMs = 0
    )

    Start-Process $Url
    if ($DelayMs -gt 0) {
        Start-Sleep -Milliseconds $DelayMs
    }
}

function Open-BCAEnlaces {
    [CmdletBinding()]
    param(
        [string]$ProjectRoot = (Get-BCAProjectRoot),

        [int]$DelayMs = 800
    )

    $cfg = Get-BCAConfig -ProjectRoot $ProjectRoot

    Write-Host ''
    Write-Host '==================================================' -ForegroundColor Cyan
    Write-Host '  BLACK COFFEE - Abriendo enlaces' -ForegroundColor Cyan
    Write-Host '==================================================' -ForegroundColor Cyan
    Write-Host ''
    Write-Host "Proyecto: $ProjectRoot" -ForegroundColor Gray
    Write-Host ''

    $i = 0
    foreach ($entry in $cfg.Links.GetEnumerator()) {
        $i++
        Write-Host ("  [{0:D2}] {1}" -f $i, $entry.Key) -ForegroundColor Green
        Write-Host "       $($entry.Value)" -ForegroundColor DarkGray
        Open-BCAUrl -Url $entry.Value -DelayMs $DelayMs
    }

    Write-Host ''
    Write-Host 'Listo. Revisa las pestanas del navegador.' -ForegroundColor Green
    Write-Host "Correo: $($cfg.NotificationEmail)" -ForegroundColor Yellow
    Write-Host ''
}

function New-BCADesktopShortcut {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,

        [Parameter(Mandatory = $true)]
        [string]$TargetPath,

        [Parameter(Mandatory = $true)]
        [string]$WorkingDirectory,

        [string]$Description = 'Black Coffee Administration'
    )

    $desktop = [Environment]::GetFolderPath('Desktop')
    $shortcutPath = Join-Path $desktop "$Name.lnk"
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $TargetPath
    $shortcut.WorkingDirectory = $WorkingDirectory
    $shortcut.Description = $Description
    $shortcut.Save()

    Write-BCAStatus -Level Ok -Message "Acceso directo: $shortcutPath"
    return $shortcutPath
}

function Install-BCADesktopShortcuts {
    [CmdletBinding()]
    param(
        [string]$ProjectRoot = (Get-BCAProjectRoot)
    )

    New-BCADesktopShortcut -Name 'BCA - Abrir enlaces' -TargetPath (Join-Path $ProjectRoot 'ABRIR-ENLACES.bat') -WorkingDirectory $ProjectRoot
    New-BCADesktopShortcut -Name 'BCA - Instalar y abrir' -TargetPath (Join-Path $ProjectRoot 'INSTALAR-Y-ABRIR.bat') -WorkingDirectory $ProjectRoot

    New-BCADesktopShortcut -Name 'BCA - Consola PowerShell' -TargetPath (Join-Path $ProjectRoot 'BCA-CONSOLA.bat') -WorkingDirectory $ProjectRoot
    New-BCADesktopShortcut -Name 'BCA - Configurar todo' -TargetPath (Join-Path $ProjectRoot 'CONFIGURAR-TODO-AUTO.bat') -WorkingDirectory $ProjectRoot
}

function Install-BCAProject {
    [CmdletBinding()]
    param(
        [string]$ProjectRoot = (Get-BCAProjectRoot),

        [switch]$SkipFirebaseDeploy,

        [switch]$SkipGitHubSecrets
    )

    Write-Host ''
    Write-Host '========================================' -ForegroundColor Cyan
    Write-Host '  INSTALADOR BCA (modulo PowerShell)' -ForegroundColor Cyan
    Write-Host '========================================' -ForegroundColor Cyan
    Write-Host ''

    Set-Location $ProjectRoot

    Install-BCADependencies -ProjectRoot $ProjectRoot
    Import-BCAEnvFile -ProjectRoot $ProjectRoot

    if (-not $SkipGitHubSecrets) {
        Set-BCAGitHubSecrets -ProjectRoot $ProjectRoot
    }

    if (-not $env:FIREBASE_TOKEN) {
        Get-BCAFirebaseToken -ProjectRoot $ProjectRoot -AllowInteractive | Out-Null
    }

    if (-not $SkipFirebaseDeploy) {
        Deploy-BCAFirebase -ProjectRoot $ProjectRoot | Out-Null
        Start-BCAGitHubWorkflow
    }

    Write-Host ''
    Write-Host '========================================' -ForegroundColor Green
    Write-Host '  INSTALACION COMPLETADA' -ForegroundColor Green
    Write-Host '========================================' -ForegroundColor Green
    Write-Host ''
    Write-Host "App: $($script:BCAConfig.AppUrl)"
    Write-Host "Correo: $($script:BCAConfig.NotificationEmail)"
    Write-Host ''
}

function Start-BCASetup {
    [CmdletBinding()]
    param(
        [string]$Destination = (Join-Path $env:USERPROFILE "Documents\$($script:BCAConfig.DefaultFolder)"),

        [switch]$OpenLinks,

        [switch]$InstallProject
    )

    Write-Host ''
    Write-Host 'Black Coffee Administration - Configuracion inicial' -ForegroundColor Cyan
    Write-Host "Destino: $Destination" -ForegroundColor Gray
    Write-Host ''

    $root = Convert-BCAToSinglePath -Path (Sync-BCARepository -Destination $Destination)
    Install-BCADesktopShortcuts -ProjectRoot $root

    Write-Host ''
    Write-Host 'Iconos creados en el Escritorio:' -ForegroundColor Green
    Write-Host '  - BCA - Abrir enlaces' -ForegroundColor White
    Write-Host '  - BCA - Instalar y abrir' -ForegroundColor White
    Write-Host '  - BCA - Consola PowerShell' -ForegroundColor White
    Write-Host ''
    Write-Host "Carpeta: $root" -ForegroundColor Yellow
    Write-Host ''

    if ($InstallProject) {
        Install-BCAProject -ProjectRoot $root
    }

    if ($OpenLinks) {
        Open-BCAUrl -Url $script:BCAConfig.AppUrl
    }
}

function Get-BCASetupPlan {
    [CmdletBinding()]
    param(
        [string]$ProjectRoot = (Get-BCAProjectRoot)
    )

    $cfg = Get-BCAConfig -ProjectRoot $ProjectRoot
    @(
        [pscustomobject]@{ Orden=1;  Id='sync';       Nombre='Actualizar codigo';           QueHacer='git pull del repositorio';                    Auto=$true;  Requiere='git' }
        [pscustomobject]@{ Orden=2;  Id='deps';       Nombre='Instalar herramientas';       QueHacer='Node.js, GitHub CLI, npm, firebase-tools';    Auto=$true;  Requiere='winget/npm' }
        [pscustomobject]@{ Orden=3;  Id='env';        Nombre='Cargar credenciales';         QueHacer='Leer .env.local (RESEND, FIREBASE, GH_TOKEN)'; Auto=$true; Requiere='.env.local' }
        [pscustomobject]@{ Orden=4;  Id='shortcuts';  Nombre='Iconos Escritorio';           QueHacer='Accesos directos BCA';                        Auto=$true;  Requiere=$null }
        [pscustomobject]@{ Orden=5;  Id='gh-secrets'; Nombre='Secretos GitHub';            QueHacer='gh secret set en el repo';                    Auto=$true;  Requiere='GH_TOKEN o gh auth' }
        [pscustomobject]@{ Orden=6;  Id='fire-rules'; Nombre='Reglas Firestore';           QueHacer='firebase deploy firestore:rules';             Auto=$true;  Requiere='FIREBASE_TOKEN' }
        [pscustomobject]@{ Orden=7;  Id='fire-func';  Nombre='Functions correo Resend';     QueHacer='firebase deploy functions';                   Auto=$true;  Requiere='FIREBASE_TOKEN + RESEND + Blaze' }
        [pscustomobject]@{ Orden=8;  Id='gh-deploy';  Nombre='Workflow GitHub Actions';     QueHacer='Desplegar Firebase en la nube CI';            Auto=$true;  Requiere='gh auth' }
        [pscustomobject]@{ Orden=9;  Id='health';     Nombre='Verificar app en produccion'; QueHacer='HTTP 200 + FormSubmit en email.js';           Auto=$true;  Requiere=$null }
        [pscustomobject]@{ Orden=10; Id='blaze';      Nombre='Plan Blaze Firebase';         QueHacer='Activar facturacion en consola Google';       Auto=$false; Requiere='Cuenta Google (1 vez)' }
        [pscustomobject]@{ Orden=11; Id='resend-key'; Nombre='Clave Resend';                QueHacer='Crear re_... en resend.com/api-keys';         Auto=$false; Requiere='RESEND_API_KEY en .env.local' }
        [pscustomobject]@{ Orden=12; Id='auth-anon';  Nombre='Auth anonima Firebase';     QueHacer='Sign-in method Anonymous ON';                 Auto=$false; Requiere='Consola Firebase' }
    )
}

function Test-BCAUrlReachable {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url,

        [int]$TimeoutSec = 30
    )

    if ([string]::IsNullOrWhiteSpace($Url)) {
        return [pscustomobject]@{
            Url    = $Url
            Ok     = $false
            Status = 0
            Error  = 'URL vacia'
        }
    }

    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec
        return [pscustomobject]@{
            Url    = $Url
            Ok     = ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400)
            Status = $response.StatusCode
            Error  = $null
        }
    } catch {
        return [pscustomobject]@{
            Url    = $Url
            Ok     = $false
            Status = 0
            Error  = $_.Exception.Message
        }
    }
}

function Test-BCAAppHealth {
    [CmdletBinding()]
    param(
        [string]$ProjectRoot = (Get-BCAProjectRoot)
    )

    $cfg = Get-BCAConfig -ProjectRoot $ProjectRoot
    $login = Test-BCAUrlReachable -Url $cfg.AppLoginUrl
    $platform = Test-BCAUrlReachable -Url $cfg.AppPlatformUrl
    $emailJs = Test-BCAUrlReachable -Url ($cfg.AppUrl.TrimEnd('/') + '/js/email.js')

    $formSubmit = $false
    if ($emailJs.Ok) {
        try {
            $body = (Invoke-WebRequest -Uri ($cfg.AppUrl.TrimEnd('/') + '/js/email.js') -UseBasicParsing).Content
            $formSubmit = ($body -match 'sendViaFormSubmit')
        } catch { }
    }

    [pscustomobject]@{
        LoginOk      = $login.Ok
        PlatformOk   = $platform.Ok
        EmailJsOk    = $emailJs.Ok
        FormSubmitOk = $formSubmit
        AllOk        = ($login.Ok -and $emailJs.Ok -and $formSubmit)
    }
}

function Deploy-BCAFirestoreRules {
    [CmdletBinding()]
    param(
        [string]$ProjectRoot = (Get-BCAProjectRoot)
    )

    if (-not $env:FIREBASE_TOKEN) {
        Write-BCAStatus -Level Warning -Message 'Sin FIREBASE_TOKEN - omitiendo reglas Firestore'
        return $false
    }

    $project = $script:BCAConfig.FirebaseProject
    Write-BCAStatus -Level Info -Message 'Desplegando reglas Firestore...'
    Push-Location $ProjectRoot
    try {
        npx firebase deploy --only firestore:rules --project $project --token $env:FIREBASE_TOKEN 2>&1 | Out-Null
    } finally {
        Pop-Location
    }

    if ($LASTEXITCODE -eq 0) {
        Write-BCAStatus -Level Ok -Message 'Reglas Firestore desplegadas'
        return $true
    }
    Write-BCAStatus -Level Warning -Message 'No se pudieron desplegar reglas Firestore'
    return $false
}

function Wait-BCAGitHubWorkflow {
    [CmdletBinding()]
    param(
        [string]$WorkflowName = 'Desplegar Firebase (correo + reglas)',

        [int]$TimeoutMinutes = 8
    )

    if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { return $false }

    gh auth status 2>$null
    if ($LASTEXITCODE -ne 0) { return $false }

    $deadline = (Get-Date).AddMinutes($TimeoutMinutes)
    Start-Sleep -Seconds 5

    while ((Get-Date) -lt $deadline) {
        $runJson = gh run list --repo $script:BCAConfig.RepoName --workflow $WorkflowName --limit 1 --json status,conclusion,url 2>$null
        if ($runJson) {
            $run = ($runJson | ConvertFrom-Json)[0]
            if ($run.status -eq 'completed') {
                if ($run.conclusion -eq 'success') {
                    Write-BCAStatus -Level Ok -Message "Workflow OK: $($run.url)"
                    return $true
                }
                Write-BCAStatus -Level Warning -Message "Workflow termino con: $($run.conclusion)"
                return $false
            }
        }
        Write-BCAStatus -Level Info -Message 'Esperando workflow GitHub...'
        Start-Sleep -Seconds 15
    }

    Write-BCAStatus -Level Warning -Message 'Timeout esperando workflow GitHub'
    return $false
}

function Export-BCASetupReport {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [array]$Results,

        [string]$ProjectRoot = (Get-BCAProjectRoot)
    )

    $reportPath = Join-Path $ProjectRoot 'BCA-informe-setup.txt'
    $lines = @(
        'BLACK COFFEE ADMINISTRATION - INFORME DE CONFIGURACION'
        "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
        "Carpeta: $ProjectRoot"
        ''
        'RESULTADOS POR PASO:'
    )

    foreach ($r in $Results) {
        $lines += ("[{0}] {1} - {2}" -f $r.Estado, $r.Paso, $r.Detalle)
    }

    $lines += ''
    $lines += 'APP: https://lasucursaldelcafe-droid.github.io/-black-coffee/'
    $lines += 'CORREO: ghostspecialtycoffee@gmail.com'
    $lines += ''
    $lines += 'PASOS MANUALES (solo si fallaron arriba):'
    $lines += '  1. Blaze: https://console.firebase.google.com/project/black-coffee-15ccc/usage/details'
    $lines += '  2. Resend: https://resend.com/api-keys -> pegar en .env.local'
    $lines += '  3. Firebase token: npx firebase login:ci -> pegar en .env.local'
    $lines += '  4. Auth anonima: Firebase Console -> Authentication -> Anonymous ON'

    $lines | Set-Content -Path $reportPath -Encoding UTF8
    Write-BCAStatus -Level Ok -Message "Informe guardado: $reportPath"
    return $reportPath
}

function Invoke-BCASetupStep {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Paso,

        [Parameter(Mandatory = $true)]
        [scriptblock]$Accion
    )

    try {
        $null = & $Accion
        return [pscustomobject]@{ Paso = $Paso; Estado = 'OK'; Detalle = 'Completado' }
    } catch {
        return [pscustomobject]@{ Paso = $Paso; Estado = 'SKIP'; Detalle = $_.Exception.Message }
    }
}

function Start-BCAFullAutomation {
    [CmdletBinding()]
    param(
        [string]$Destination = (Join-Path $env:USERPROFILE "Documents\$($script:BCAConfig.DefaultFolder)"),

        [switch]$OpenAppAtEnd
    )

    $results = @()
    $projectRoot = $null

    Write-Host ''
    Write-Host '##########################################################' -ForegroundColor Cyan
    Write-Host '  BCA - CONFIGURACION AUTOMATICA COMPLETA (sin preguntas)' -ForegroundColor Cyan
    Write-Host '##########################################################' -ForegroundColor Cyan
    Write-Host ''

    try {
        $projectRoot = Convert-BCAToSinglePath -Path (Sync-BCARepository -Destination $Destination)
        Set-Location $projectRoot
        $results += [pscustomobject]@{ Paso = '1. Actualizar codigo'; Estado = 'OK'; Detalle = 'Completado' }
    } catch {
        $results += [pscustomobject]@{ Paso = '1. Actualizar codigo'; Estado = 'SKIP'; Detalle = $_.Exception.Message }
    }

    if (-not $projectRoot) {
        $projectRoot = Convert-BCAToSinglePath -Path (Get-BCAProjectRoot -StartPath $Destination)
    }

    $results += Invoke-BCASetupStep -Paso '2. Instalar dependencias' -Accion {
        Install-BCADependencies -ProjectRoot $projectRoot
    }

    $results += Invoke-BCASetupStep -Paso '3. Credenciales .env.local' -Accion {
        Import-BCAEnvFile -ProjectRoot $projectRoot | Out-Null
        if ($env:GH_TOKEN) { $env:GITHUB_TOKEN = $env:GH_TOKEN }
    }

    $results += Invoke-BCASetupStep -Paso '4. Iconos Escritorio' -Accion {
        Install-BCADesktopShortcuts -ProjectRoot $projectRoot
        $autoBat = Join-Path $projectRoot 'CONFIGURAR-TODO-AUTO.bat'
        if (Test-Path $autoBat) {
            New-BCADesktopShortcut -Name 'BCA - Configurar todo AUTO' -TargetPath $autoBat -WorkingDirectory $projectRoot | Out-Null
        }
    }

    $results += Invoke-BCASetupStep -Paso '5. Secretos GitHub' -Accion {
        if ($env:GH_TOKEN) { $env:GITHUB_TOKEN = $env:GH_TOKEN }
        gh auth status 2>$null
        if ($LASTEXITCODE -ne 0 -and -not $env:GH_TOKEN) {
            throw 'Sin GH_TOKEN ni gh auth - omitido'
        }
        Set-BCAGitHubSecrets -ProjectRoot $projectRoot -AllowInteractive:$false
    }

    $results += Invoke-BCASetupStep -Paso '6. Reglas Firestore' -Accion {
        if ($env:FIREBASE_TOKEN) {
            Deploy-BCAFirestoreRules -ProjectRoot $projectRoot | Out-Null
        } else {
            throw 'Sin FIREBASE_TOKEN'
        }
    }

    $results += Invoke-BCASetupStep -Paso '7. Functions + correo' -Accion {
        if ($env:FIREBASE_TOKEN -and $env:RESEND_API_KEY) {
            if (-not (Deploy-BCAFirebase -ProjectRoot $projectRoot)) {
                throw 'Deploy Firebase fallo (verifica plan Blaze)'
            }
        } else {
            throw 'Faltan FIREBASE_TOKEN o RESEND_API_KEY - FormSubmit sigue activo'
        }
    }

    $results += Invoke-BCASetupStep -Paso '8. Workflow GitHub CI' -Accion {
        Start-BCAGitHubWorkflow | Out-Null
        Wait-BCAGitHubWorkflow -TimeoutMinutes 6 | Out-Null
    }

    $results += Invoke-BCASetupStep -Paso '9. Verificar app online' -Accion {
        $health = Test-BCAAppHealth -ProjectRoot $projectRoot
        if (-not $health.AllOk) {
            throw ("Login=$($health.LoginOk) EmailJs=$($health.EmailJsOk) FormSubmit=$($health.FormSubmitOk)")
        }
    }

    $report = Export-BCASetupReport -Results $results -ProjectRoot $projectRoot

    Write-Host ''
    Write-Host '##########################################################' -ForegroundColor Green
    Write-Host '  CONFIGURACION AUTOMATICA TERMINADA' -ForegroundColor Green
    Write-Host '##########################################################' -ForegroundColor Green
    Write-Host ''

    foreach ($r in $results) {
        $color = if ($r.Estado -eq 'OK') { 'Green' } else { 'Yellow' }
        Write-Host ("  [{0}] {1}" -f $r.Estado, $r.Paso) -ForegroundColor $color
        if ($r.Estado -ne 'OK') { Write-Host ("       -> {0}" -f $r.Detalle) -ForegroundColor DarkGray }
    }

    Write-Host ''
    Write-Host "Informe: $report" -ForegroundColor Cyan
    Write-Host "App: $($script:BCAConfig.AppUrl)" -ForegroundColor White
    Write-Host "Correo: $($script:BCAConfig.NotificationEmail)" -ForegroundColor White
    Write-Host ''

    if ($OpenAppAtEnd) {
        Open-BCAUrl -Url $script:BCAConfig.AppUrl
    }

    return $results
}

Export-ModuleMember -Function @(
    'Get-BCAProjectRoot',
    'Get-BCAConfig',
    'Write-BCAStatus',
    'Update-BCAPathEnvironment',
    'Test-BCACommand',
    'Sync-BCARepository',
    'Initialize-BCAEnvFile',
    'Import-BCAEnvFile',
    'Get-BCAFirebaseField',
    'Install-BCADependencies',
    'Set-BCAGitHubSecrets',
    'Get-BCAFirebaseToken',
    'Deploy-BCAFirebase',
    'Start-BCAGitHubWorkflow',
    'Open-BCAUrl',
    'Open-BCAEnlaces',
    'New-BCADesktopShortcut',
    'Install-BCADesktopShortcuts',
    'Install-BCAProject',
    'Start-BCASetup',
    'Get-BCASetupPlan',
    'Test-BCAUrlReachable',
    'Test-BCAAppHealth',
    'Deploy-BCAFirestoreRules',
    'Wait-BCAGitHubWorkflow',
    'Export-BCASetupReport',
    'Invoke-BCASetupStep',
    'Start-BCAFullAutomation'
)
