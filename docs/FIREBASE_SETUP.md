# Firebase + GitHub Actions — Black Coffee Administration

La plataforma guarda datos en el navegador (`localStorage`) y, cuando Firebase está configurado, los sincroniza en **Cloud Firestore** para que los cambios persistan entre dispositivos y sesiones.

## 1. Crear proyecto en Firebase

1. Entra a [Firebase Console](https://console.firebase.google.com/)
2. **Crear proyecto** (ej: `black-coffee-admin`)
3. Activa **Authentication** → método **Anónimo** (Sign-in method → Anonymous → Enable)
4. Activa **Firestore Database** → modo **producción** (región cercana, ej. `southamerica-east1` si está disponible)
5. En **Project settings** → **Your apps** → agrega una app **Web** (`</>`)
6. Copia los valores de configuración que muestra Firebase

## 2. Reglas de Firestore (seguridad básica)

En Firestore → Rules, usa algo como:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /bca_data/{document} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Publica las reglas. Sin autenticación anónima habilitada, la app no podrá escribir.

## 3. Secrets en GitHub

Ve a tu repositorio → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret | Descripción | Dónde encontrarlo en Firebase |
|--------|-------------|-------------------------------|
| `FIREBASE_API_KEY` | API Key de la app web | Project settings → General → Your apps → SDK setup |
| `FIREBASE_AUTH_DOMAIN` | Dominio de auth | Mismo panel, campo `authDomain` (ej. `tu-proyecto.firebaseapp.com`) |
| `FIREBASE_PROJECT_ID` | ID del proyecto | Campo `projectId` |
| `FIREBASE_STORAGE_BUCKET` | Bucket de storage | Campo `storageBucket` (ej. `tu-proyecto.appspot.com`) |
| `FIREBASE_MESSAGING_SENDER_ID` | Sender ID | Campo `messagingSenderId` |
| `FIREBASE_APP_ID` | App ID | Campo `appId` |

**Importante:** Si falta alguno de los 6 secrets, el deploy funciona pero la app queda solo con `localStorage` (sin nube).

## 4. Qué hace el workflow de GitHub

En cada push a `main`, el workflow:

1. Genera `js/firebase-config.js` con los secrets
2. Despliega a GitHub Pages (`gh-pages`)

Archivo: `.github/workflows/deploy-pages.yml`

## 5. Probar en local (opcional)

Crea `js/firebase-config.local.js` (no subir a git) o exporta variables y ejecuta:

```bash
FIREBASE_API_KEY=... \
FIREBASE_AUTH_DOMAIN=... \
FIREBASE_PROJECT_ID=... \
FIREBASE_STORAGE_BUCKET=... \
FIREBASE_MESSAGING_SENDER_ID=... \
FIREBASE_APP_ID=... \
node scripts/generate-firebase-config.js > js/firebase-config.js
```

Luego sirve la carpeta con cualquier servidor estático y abre la app.

## 6. Verificar que sincroniza

1. Abre la app en producción
2. Ve a **Configuración**
3. En **Base de datos** debe decir: `Sincronizado · tu-proyecto`
4. Crea un café o cotización en un dispositivo
5. Abre la app en otro navegador/dispositivo con la misma URL — los datos deben aparecer

## 7. Por qué “no se guardaban” los cambios antes

- **Sin Firebase:** cada navegador tiene su propio `localStorage`. Si cambias de celular, borras datos del navegador o usas modo incógnito, pierdes información.
- **Migración de versión:** versiones antiguas podían resetear datos; desde la v2 las migraciones ya no borran cotizaciones ni ventas.

## Colección Firestore

| Ruta | Contenido |
|------|-----------|
| `bca_data/{storageKey}` | Documento con `{ payload, updatedAt }` por cada clave (`bca_coffees`, `bca_quotations`, etc.) |
