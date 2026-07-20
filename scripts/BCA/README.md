# Funciones PowerShell BCA (Black Coffee Administration)

Modulo profesional para Windows PowerShell 5.1+.

## Error: "la ejecucion de scripts esta deshabilitada"

Windows bloquea `Import-Module` y scripts `.ps1` por defecto. Tres soluciones:

### Opcion 1 - Un solo doble clic (recomendado)

```
CONFIGURAR-TODO-AUTO.bat
```

Los `.bat` ya usan `-ExecutionPolicy Bypass`. No necesitas `Import-Module` manual.

### Opcion 2 - Habilitar PowerShell una vez

Doble clic en `HABILITAR-POWERSHELL.bat` o en PowerShell:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force
```

Luego ya funciona:

```powershell
Import-Module .\scripts\BCA\BCA.psm1 -Force
```

### Opcion 3 - Consola interactiva sin cambiar la politica

Doble clic en `BCA-CONSOLA.bat` o:

```powershell
.\BCA.bat auto
.\BCA.bat abrir
```

## Cargar el modulo (despues de habilitar)

```powershell
cd C:\Users\LENOVO\Documents\BlackCoffeeAdmin
Import-Module .\scripts\BCA\BCA.psm1 -Force
```

O con bypass sin cambiar politica:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\Import-BCA.ps1
```

## Comandos principales

| Funcion | Descripcion |
|---------|-------------|
| `Open-BCAEnlaces` | Abre app, Firebase, GitHub, Resend en el navegador |
| `Start-BCAFullAutomation` | Configuracion completa sin preguntas |
| `Install-BCAProject` | Instala Node, npm, secretos, Firebase |
| `Start-BCASetup` | Clona/actualiza repo + iconos en Escritorio |
| `Sync-BCARepository` | git clone o git pull |
| `Get-BCAConfig` | Rutas y URLs del proyecto |
| `Get-BCAProjectRoot` | Encuentra la carpeta del proyecto |
| `Import-BCAEnvFile` | Carga .env.local |
| `Deploy-BCAFirebase` | Despliega Functions + reglas |
| `Install-BCADesktopShortcuts` | Crea iconos en el Escritorio |

## CLI rapida

```powershell
.\BCA.bat auto
.\BCA.bat abrir
.\BCA.bat instalar
.\BCA.bat setup
.\BCA.bat plan
.\BCA.bat config
```

## Accesos de un clic (.bat)

| Archivo | Accion |
|---------|--------|
| `CONFIGURAR-TODO-AUTO.bat` | Configuracion completa automatica |
| `HABILITAR-POWERSHELL.bat` | Desbloquea scripts para tu usuario |
| `BCA-CONSOLA.bat` | Abre PowerShell con modulo cargado |
| `BCA.bat auto` | CLI con bypass (desde cmd o PS) |
| `ABRIR-ENLACES.bat` | Abre enlaces en navegador |
| `INSTALAR-Y-ABRIR.bat` | Instala + abre |
| `DESCARGAR-PROYECTO.bat` | Clona/actualiza proyecto |

## Instalacion remota (primera vez)

```powershell
irm https://raw.githubusercontent.com/lasucursaldelcafe-droid/-black-coffee/main/scripts/DESCARGAR-PROYECTO.ps1 | iex
```

El instalador remoto usa `-ExecutionPolicy Bypass` automaticamente.
