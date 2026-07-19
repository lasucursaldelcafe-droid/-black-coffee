# Configuración automática — 3 pasos (todo en español)

## Lo que ya está automatizado en el código

- Guardado de datos en el navegador
- Respaldo exportar / importar (Configuración)
- Despliegue de la web en cada push a `main`
- Workflows de GitHub para instalar secretos y desplegar correo

---

## PASO 1 — Activar facturación Firebase (una sola vez)

| | |
|--|--|
| **Enlace** | https://console.firebase.google.com/project/black-coffee-15ccc/usage/details |
| **Qué hacer** | Clic en **Actualizar** → plan **Blaze (pago por uso)** |
| **¿Es secreto?** | No |
| **Costo habitual** | $0 con uso bajo |

Sin este paso el correo automático **no funciona**.

---

## PASO 2 — Instalar secretos desde GitHub (sin terminal)

### 2A — Obtener token de Firebase (solo la primera vez)

En tu PC con PowerShell:

```powershell
npm install -g firebase-tools
firebase login:ci
```

Se abre el navegador → inicias sesión con Google → **copias el token** que aparece en la pantalla.

### 2B — Ejecutar workflow en GitHub

| | |
|--|--|
| **Enlace directo** | https://github.com/lasucursaldelcafe-droid/-black-coffee/actions/workflows/instalar-secretos.yml |
| **Qué hacer** | Clic **Run workflow** → **Run workflow** |
| **Campo 1** | `resend_api_key` → tu clave `re_...` de https://resend.com/api-keys |
| **Campo 2** | `firebase_token` → el token del paso 2A |
| **¿Son secretos?** | **SÍ** — no los compartas en chats |

**Alternativa en PC:** doble clic en `scripts/configurar-todo.ps1` (hace lo mismo).

---

## PASO 3 — Desplegar correo automático

| | |
|--|--|
| **Enlace directo** | https://github.com/lasucursaldelcafe-droid/-black-coffee/actions/workflows/desplegar-firebase.yml |
| **Qué hacer** | Clic **Run workflow** → **Run workflow** |
| **Esperar** | 3–5 minutos hasta que diga ✅ verde |

---

## Probar

1. Abre https://lasucursaldelcafe-droid.github.io/-black-coffee/
2. Registra una **venta**
3. Revisa **ghostspecialtycoffee@gmail.com**

---

## Resumen de enlaces

| Qué | Enlace |
|-----|--------|
| Activar Blaze | https://console.firebase.google.com/project/black-coffee-15ccc/usage/details |
| Clave Resend | https://resend.com/api-keys |
| Instalar secretos (GitHub) | https://github.com/lasucursaldelcafe-droid/-black-coffee/actions/workflows/instalar-secretos.yml |
| Desplegar correo (GitHub) | https://github.com/lasucursaldelcafe-droid/-black-coffee/actions/workflows/desplegar-firebase.yml |
| Auth anónima (verificar) | https://console.firebase.google.com/project/black-coffee-15ccc/authentication/providers |
| App en producción | https://lasucursaldelcafe-droid.github.io/-black-coffee/ |

---

## Seguridad

- **Revoca** cualquier clave Resend que hayas pegado en chats y crea una nueva en https://resend.com/api-keys
- Las contraseñas de login **no** están en GitHub
