# ☕ Black Coffee Administration

Plataforma integral de gestión contable y logística para café de especialidad.

## 🚀 Plataforma en vivo

**URL:** https://lasucursaldelcafe-droid.github.io/-black-coffee/

## 👤 Acceso

Usuarios: `ximena.polo` y `pablo.colorado`. Las contraseñas las administra el equipo — **no están en este repositorio**. Si hay problemas de acceso, use **Reparar acceso** en la pantalla de login.

## 📧 Notificaciones

Destino: **ghostspecialtycoffee@gmail.com**

- **Inmediato:** FormSubmit (sin configuración extra)
- **Profesional:** Resend + Firebase Functions — instalar con un comando:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\INSTALAR-AUTOMATICO.ps1
```

Guía completa: **[docs/PASOS_USUARIO.md](docs/PASOS_USUARIO.md)**

## 💾 Datos y respaldo

1. **Local primero:** cada guardado va a `localStorage` del navegador.
2. **Nube:** Firebase respalda en Firestore (misma URL en varios dispositivos).
3. **Respaldo manual:** Configuración → Exportar respaldo JSON (recomendado semanalmente).

Guía completa de configuración: **[docs/PASOS_USUARIO.md](docs/PASOS_USUARIO.md)**

## ✨ Módulos

- Dashboard, costos de producción, cafés, clientes, proveedores
- Inventario, cotizaciones, ventas, importación Excel/PDF
- Notificaciones, auditoría, PDF de cotizaciones

## 📁 Estructura principal

```
├── index.html / app.html
├── css/
├── js/
│   ├── storage.js, backup.js, firebase-sync.js
│   ├── auth.js, data.js, app.js
│   └── coffees.js, clients.js, suppliers.js, inventory.js, ...
├── functions/          # Cloud Functions (correo)
├── firestore.rules
├── firebase.json
└── docs/PASOS_USUARIO.md
```

## 🔧 Despliegue

Push a `main` → GitHub Actions despliega a `gh-pages`.

Secrets requeridos en GitHub Actions: ver [docs/PASOS_USUARIO.md](docs/PASOS_USUARIO.md) Fase 4.

---

**Black Coffee Administration** — Gestión integral de café de especialidad
