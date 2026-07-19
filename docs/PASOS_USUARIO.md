# Pasos para configurar Black Coffee Administration (BCA)

Guía paso a paso. Marca cada fase cuando la completes.

**Plataforma en vivo:** https://lasucursaldelcafe-droid.github.io/-black-coffee/

---

## Fase 1 — Ya hecha en el código (no requiere acción)

- Exportar / importar respaldo JSON (Configuración)
- Mensaje "Guardado" al crear cafés, clientes, etc.
- Textos honestos sobre cómo funciona la nube
- Reglas Firestore en el repo (`firestore.rules`)

**Tu acción opcional:** Entra a Configuración → **Exportar respaldo** y guarda el archivo en Google Drive.

---

## Fase 2 — Correo real (Resend + Firebase Functions)

Hoy los correos se encolan pero **no llegan al buzón** hasta que completes esto.

### 2.1 Activar plan Blaze en Firebase (obligatorio para Functions)

| Campo | Valor |
|-------|-------|
| **Link** | https://console.firebase.google.com/project/black-coffee-15ccc/usage/details |
| **¿Es secreto?** | No — solo activas facturación |
| **Qué hacer** | Clic en **Upgrade** → plan **Blaze (pay as you go)** |
| **Costo** | Gratis hasta límites generosos; Functions + Firestore suelen costar $0 en uso bajo |

### 2.2 Crear cuenta Resend (envío de correos)

| Campo | Valor |
|-------|-------|
| **Link** | https://resend.com/signup |
| **¿Es secreto?** | La cuenta no; la API Key **sí** |
| **Qué hacer** | Registrarse con `ghostspecialtycoffee@gmail.com` |

### 2.3 Obtener API Key de Resend

| Campo | Valor |
|-------|-------|
| **Link** | https://resend.com/api-keys |
| **¿Es secreto?** | **SÍ — no la pegues en el chat ni en GitHub** |
| **Qué hacer** | **Create API Key** → nombre `bca-production` → permiso **Sending access** → copiar (`re_...`) |

Guárdala; la usarás en el paso 2.6.

### 2.4 (Opcional) Dominio verificado en Resend

Para enviar **desde** `@tudominio.com` en lugar de `onboarding@resend.dev`:

| Campo | Valor |
|-------|-------|
| **Link** | https://resend.com/domains |
| **Qué hacer** | Add Domain → seguir DNS que indica Resend |

Si no tienes dominio, en pruebas Resend solo envía al email de tu cuenta Resend.

### 2.5 Instalar Firebase CLI en tu PC

```bash
npm install -g firebase-tools
firebase login
cd ruta/al/proyecto/-black-coffee
firebase use black-coffee-15ccc
```

| Campo | Valor |
|-------|-------|
| **Link login** | Se abre navegador al ejecutar `firebase login` |
| **Project ID** | `black-coffee-15ccc` (ya está en `js/firebase-config.js`) |

### 2.6 Configurar secretos en Firebase

En terminal, dentro del proyecto:

```bash
firebase functions:secrets:set RESEND_API_KEY
# Pegar la API Key re_... cuando lo pida

firebase functions:secrets:set BCA_FROM_EMAIL
# Ejemplo: Black Coffee <onboarding@resend.dev>
# O con dominio verificado: Ghost Coffee <notificaciones@tudominio.com>
```

| Secreto | Dónde se obtiene | ¿Secreto? |
|---------|------------------|-----------|
| `RESEND_API_KEY` | https://resend.com/api-keys | **SÍ** |
| `BCA_FROM_EMAIL` | Texto que tú defines (remitente) | No |

### 2.7 Desplegar Functions y reglas Firestore

```bash
cd functions && npm install && cd ..
firebase deploy --only functions,firestore:rules
```

| Campo | Valor |
|-------|-------|
| **Link consola Functions** | https://console.firebase.google.com/project/black-coffee-15ccc/functions |
| **Verificar** | Debe aparecer `processEmailOutbox` |

### 2.8 Probar correo

1. Abre la app → registra una **venta** o **cotización**
2. En Firebase Console → Firestore → colección `bca_email_outbox` → debe crearse un documento
3. Tras unos segundos, el documento debe tener `delivered: true`
4. Revisa la bandeja de `ghostspecialtycoffee@gmail.com`

---

## Fase 3 — Reglas Firestore en la nube

Si no ejecutaste el deploy del paso 2.7, hazlo manualmente:

| Campo | Valor |
|-------|-------|
| **Link** | https://console.firebase.google.com/project/black-coffee-15ccc/firestore/rules |
| **¿Es secreto?** | No |
| **Qué hacer** | Copiar contenido de `firestore.rules` del repo → **Publicar** |

O por CLI: `firebase deploy --only firestore:rules`

---

## Fase 4 — GitHub Secrets (deploy automático)

Para que cada push a `main` genere `firebase-config.js` en producción:

| Campo | Valor |
|-------|-------|
| **Link** | https://github.com/lasucursaldelcafe-droid/-black-coffee/settings/secrets/actions |
| **¿Es secreto?** | **SÍ** — todos los secrets |

Clic **New repository secret** por cada uno:

| Nombre del secret | Dónde obtenerlo |
|-------------------|-----------------|
| `FIREBASE_API_KEY` | Firebase → ⚙ Project settings → General → Your apps → Web app → `apiKey` |
| `FIREBASE_AUTH_DOMAIN` | Mismo panel → `authDomain` |
| `FIREBASE_PROJECT_ID` | `black-coffee-15ccc` |
| `FIREBASE_STORAGE_BUCKET` | `black-coffee-15ccc.firebasestorage.app` |
| `FIREBASE_MESSAGING_SENDER_ID` | Campo `messagingSenderId` |
| `FIREBASE_APP_ID` | Campo `appId` |

**Link directo configuración Firebase:**  
https://console.firebase.google.com/project/black-coffee-15ccc/settings/general

Estos valores **no son tan críticos como contraseñas** (van en el cliente), pero no los publiques en issues públicos.

---

## Fase 5 — Autenticación anónima (obligatoria)

| Campo | Valor |
|-------|-------|
| **Link** | https://console.firebase.google.com/project/black-coffee-15ccc/authentication/providers |
| **Qué hacer** | **Anonymous** → **Enable** → Save |

---

## Fase 6 — Usuarios de la app (login)

Las contraseñas **ya no están en el README**. Credenciales actuales:

| Usuario | Acceso |
|---------|--------|
| Ximena Polo | `ximena.polo` |
| Pablo Colorado | `pablo.colorado` |

**Contraseñas:** las definió el administrador del proyecto. Si no las recuerdas, en la pantalla de login usa **Reparar acceso** (restablece usuarios por defecto — pide confirmación al dev).

**Recomendación futura:** migrar a Firebase Auth con email real.

---

## Fase 7 — Sincronización entre dispositivos

1. Mismo URL en PC y celular
2. En cada dispositivo: crear/editar datos (se guardan local)
3. En el dispositivo que quieras actualizar: **Configuración → Forzar sincronización**
4. Exporta respaldo semanal como seguro extra

---

## Resumen rápido — qué debes hacer tú

| Prioridad | Acción | Link principal |
|-----------|--------|----------------|
| 🔴 Alta | Exportar respaldo manual | App → Configuración |
| 🔴 Alta | Activar Blaze + Resend + deploy Functions | [Firebase Usage](https://console.firebase.google.com/project/black-coffee-15ccc/usage/details) · [Resend](https://resend.com/signup) |
| 🟠 Media | Publicar reglas Firestore | [Firestore Rules](https://console.firebase.google.com/project/black-coffee-15ccc/firestore/rules) |
| 🟠 Media | Verificar GitHub Secrets (6) | [GitHub Secrets](https://github.com/lasucursaldelcafe-droid/-black-coffee/settings/secrets/actions) |
| 🟡 Baja | Auth anónima activa | [Auth Providers](https://console.firebase.google.com/project/black-coffee-15ccc/authentication/providers) |

---

Cuando completes la **Fase 2**, avisa y probamos juntos que llegue un correo de prueba.
