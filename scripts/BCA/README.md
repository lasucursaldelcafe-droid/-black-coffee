# Funciones PowerShell BCA (Black Coffee Administration)

Modulo profesional para Windows PowerShell 5.1+.

## Cargar el modulo

```powershell
cd C:\Users\LENOVO\Documents\BlackCoffeeAdmin
Import-Module .\scripts\BCA\BCA.psm1 -Force
```

## Comandos principales

| Funcion | Descripcion |
|---------|-------------|
| `Open-BCAEnlaces` | Abre app, Firebase, GitHub, Resend en el navegador |
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
.\scripts\bca.ps1 abrir
.\scripts\bca.ps1 instalar
.\scripts\bca.ps1 setup
.\scripts\bca.ps1 config
```

## Accesos de un clic (.bat)

- `ABRIR-ENLACES.bat`
- `INSTALAR-Y-ABRIR.bat`
- `DESCARGAR-PROYECTO.bat`

## Instalacion remota (primera vez)

```powershell
irm https://raw.githubusercontent.com/lasucursaldelcafe-droid/-black-coffee/main/scripts/DESCARGAR-PROYECTO.ps1 | iex
```
