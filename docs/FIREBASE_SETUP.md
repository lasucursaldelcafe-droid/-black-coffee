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
firebase deploy --only firestore:rules
```

## Auth

Debe estar habilitado **Sign-in method → Anonymous**.

## Sincronización

- Los datos se guardan **primero en el navegador**.
- Firebase **respalda** y permite **Forzar sincronización** entre dispositivos.
- Estado en Configuración: `Guardado local · respaldo en la nube`

## Correo

Ver Fase 2 en [PASOS_USUARIO.md](./PASOS_USUARIO.md).
