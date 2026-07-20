# Firebase — Black Coffee Administration

> **Guía principal para el administrador:** [PASOS_USUARIO.md](./PASOS_USUARIO.md)

## Proyecto actual

- **Project ID:** `black-coffee-15ccc`
- **Consola:** https://console.firebase.google.com/project/black-coffee-15ccc

## Colección Firestore

| Ruta | Contenido |
|------|-----------|
| `bca_data/{clave}` | `{ key, deviceId, payload, updatedAt }` — datos compartidos del negocio |
| `bca_email_outbox/{id}` | Cola de correos; Cloud Function `processEmailOutbox` los envía |

Claves típicas: `bca_coffees`, `bca_clients`, `bca_suppliers`, `bca_inventory`, etc.

## Reglas

Archivo en repo: `firestore.rules`. Publicar con:

```bash
# Opción A — GitHub Actions (recomendado)
# Actions → Desbloquear Firebase → Run workflow → pegar token de npx firebase login:ci

# Opción B — Local
export FIREBASE_TOKEN="$(npx firebase login:ci)"
./scripts/deploy-firestore-rules.sh
```

Enlace directo: https://github.com/lasucursaldelcafe-droid/-black-coffee/actions/workflows/desbloquear-firebase.yml

## Auth

Debe estar habilitado **Sign-in method → Anonymous**.

## Sincronización

- Los datos se guardan **primero en el navegador**.
- Firebase **respalda** y permite **Forzar sincronización** entre dispositivos.
- Estado en Configuración: `Guardado local · respaldo en la nube`

## Correo

Ver Fase 2 en [PASOS_USUARIO.md](./PASOS_USUARIO.md).
