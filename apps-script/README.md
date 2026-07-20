# Sync BCA con Google Apps Script

Backend de sincronización **sin Firebase Console**. Los datos se guardan en Google Drive (carpeta `BlackCoffeeAdministration`).

## Despliegue rápido (2 minutos)

1. Abra https://script.google.com → **Nuevo proyecto**
2. Borre el código default y pegue el contenido de `BcaCloudSync.gs`
3. **Implementar** → **Nueva implementación** → tipo **Aplicación web**
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier persona**
4. Copie la URL que termina en `/exec`
5. En GitHub: **Actions** → **Instalar secretos de GitHub** → pegue la URL en **GAS_WEB_APP_URL**
6. Vuelva a ejecutar **Deploy GitHub Pages** (o espere el push a `main`)

La app detectará la URL automáticamente en el próximo build.

## Clave de sync

La clave compartida está en `BcaCloudSync.gs` (`BCA-Ximena-Pablo-2026`) y en `js/gas-config.js` generado en el deploy.

## Probar

Abra en el navegador (sustituya su URL):

```
https://script.google.com/macros/s/SU_ID/exec?action=pull&key=BCA-Ximena-Pablo-2026
```

Debe devolver JSON con `"keys": {}` o datos existentes.
