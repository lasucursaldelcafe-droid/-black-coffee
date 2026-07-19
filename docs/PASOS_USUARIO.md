# Configuración automática — Black Coffee Administration

## Opción A — Un solo comando (Windows, recomendado)

Abre **PowerShell** en la carpeta del proyecto y ejecuta:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\INSTALAR-AUTOMATICO.ps1
```

El script hace **todo solo**, sin preguntarte nada:

1. Instala Node.js y GitHub CLI (winget) si faltan
2. Crea `.env.local` desde la plantilla (si no existe)
3. Instala dependencias npm
4. Guarda secretos en GitHub (si tienes permisos de admin)
5. Obtiene token Firebase (`firebase login:ci`) si falta
6. Despliega Functions + reglas Firestore
7. Dispara el workflow de despliegue en GitHub

**Antes de ejecutar:** copia tu clave Resend en `.env.local`:

```
RESEND_API_KEY=re_tu_clave_aqui
```

Obtén la clave en https://resend.com/api-keys

---

## Opción B — Manual (3 pasos en GitHub)

### PASO 1 — Activar facturación Firebase (una sola vez)

| | |
|--|--|
| **Enlace** | https://console.firebase.google.com/project/black-coffee-15ccc/usage/details |
| **Qué hacer** | Clic en **Actualizar** → plan **Blaze (pago por uso)** |
| **Costo habitual** | $0 con uso bajo |

Sin Blaze el correo vía Cloud Functions **no funciona** (FormSubmit sigue funcionando como respaldo).

---

### PASO 2 — Instalar secretos en GitHub

**Enlace:** https://github.com/lasucursaldelcafe-droid/-black-coffee/actions/workflows/instalar-secretos.yml

Clic **Run workflow** y completa `resend_api_key` y `firebase_token`.

Token Firebase: `npx firebase login:ci` en PowerShell.

---

### PASO 3 — Desplegar correo automático

**Enlace:** https://github.com/lasucursaldelcafe-droid/-black-coffee/actions/workflows/desplegar-firebase.yml

Clic **Run workflow** → esperar ✅ verde (3–5 min).

---

## Probar

1. Abre https://lasucursaldelcafe-droid.github.io/-black-coffee/
2. Registra una **venta**
3. Revisa **ghostspecialtycoffee@gmail.com**

Los correos se envían por **FormSubmit** de inmediato y, cuando Firebase esté desplegado, también por **Resend** (Cloud Function).

---

## Enlaces útiles

| Qué | Enlace |
|-----|--------|
| Activar Blaze | https://console.firebase.google.com/project/black-coffee-15ccc/usage/details |
| Clave Resend | https://resend.com/api-keys |
| Instalar secretos | https://github.com/lasucursaldelcafe-droid/-black-coffee/actions/workflows/instalar-secretos.yml |
| Desplegar correo | https://github.com/lasucursaldelcafe-droid/-black-coffee/actions/workflows/desplegar-firebase.yml |
| App en producción | https://lasucursaldelcafe-droid.github.io/-black-coffee/ |

---

## Seguridad

- **Revoca** cualquier clave Resend pegada en chats y crea una nueva
- `.env.local` **nunca** se sube a GitHub (está en `.gitignore`)
- Las contraseñas de login no están en el repositorio
