# Sincronización Ximena ↔ Pablo (Build 32+)

## Opción A — Google Apps Script (recomendada, sin Firebase Console)

1. Abra https://script.google.com → **Nuevo proyecto**
2. Pegue el código de `apps-script/BcaCloudSync.gs`
3. **Implementar** → **Nueva implementación** → **Aplicación web**
   - Ejecutar como: **Yo**
   - Acceso: **Cualquier persona**
4. Copie la URL `/exec`
5. GitHub → **Actions** → **Instalar secretos de GitHub** → campo **GAS_WEB_APP_URL**
6. Espere el deploy de GitHub Pages (automático al push a `main`)

**Ximena:** Configuración → **Publicar mis datos a la nube**  
**Pablo:** Configuración → **Forzar sincronización completa**  
(La app también sincroniza sola cada 30 segundos.)

## Opción B — Firebase (cuando tenga FIREBASE_TOKEN)

1. Actions → **Instalar secretos** → pegue `FIREBASE_TOKEN` (`npx firebase login:ci`)
2. Actions → **Desplegar Firebase** — publica reglas + función `bcaSync` (Admin SDK, sin depender de reglas del cliente)

## Opción C — GitHub (respaldo)

En **Instalar secretos**, pegue un **PAT** con permiso `contents:write` en **GITHUB_SYNC_TOKEN**.

---

Producción: https://lasucursaldelcafe-droid.github.io/-black-coffee/
