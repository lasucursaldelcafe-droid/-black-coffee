# ☕ Black Coffee Administration

Plataforma integral de gestión contable y logística para café de especialidad. Desarrollada en HTML, CSS y JavaScript puro — lista para compartir por enlace.

## 🚀 Plataforma en vivo

**URL oficial (GitHub Pages):** https://lasucursaldelcafe-droid.github.io/-black-coffee/

Cada push a `main` actualiza automáticamente la rama `gh-pages` vía GitHub Actions y publica en GitHub Pages.

## 👤 Usuarios del Sistema

| Usuario | Usuario de acceso | Contraseña |
|---------|-------------------|------------|
| Ximena Polo | `ximena.polo` | `XimenaBCA2026!` |
| Pablo Colorado Gómez | `pablo.colorado` | `PabloBCA2026!` |

## 📧 Notificaciones

Todas las notificaciones (cotizaciones, compras, alertas de stock) se envían a:
**ghostspecialtycoffee@gmail.com**

## ✨ Funcionalidades

### Dashboard
- Vista general con estadísticas de cafés, clientes, inventario y cotizaciones
- Hero personalizable con logo y mensaje de bienvenida
- Alertas de stock bajo
- Acciones rápidas

### Costos de Producción
- **Tostión:** $3,700/kg
- **Selección post-tostión:** $1,900/kg
- **Empaque:** 250g ($1,500) · 500g ($1,900) · 5 lb ($3,000)
- **Etiquetas:** Grande ($1,000) · Pequeña ($500)
- **Costo de alza:** $1,500 (activar/desactivar)
- **Mermas configurables:** Trilla, Tostión, Selección
- Modal de verificación al iniciar sesión

### Gestión de Cafés
- Variedades, regiones, procesos con botones de selección
- Estado del café (verde o pergamino)
- Precio por kg con transporte incluido o separado
- Imágenes de producto
- Ejemplo precargado: **Óscar Alejandro** — Cauca, Lavado, 24h fermentación, $33,000/kg

### Clientes y Proveedores
- Tipos de cliente: Final, Mayorista, Distribuidor
- Margen de ganancia: 25%, 35%, 40%, 50%
- Ejemplo precargado: **La Chocolatada** — Panadería en Cali

### Inventario y Mermas
- Café verde: merma de tostión + selección
- Café pergamino: merma de trilla + tostión + selección
- Registro de compras y tostiones
- Alertas automáticas de stock bajo

### Cotizaciones
- Cálculo automático de costos con mermas
- Desglose detallado por unidad
- Generación de PDF
- Envío de notificación por email

### Configuración Visual
- Subida de logo
- Personalización de hero, colores y textos
- Umbral de alerta de inventario

## 🎨 Diseño

Tema profesional en **blanco, negro y gris** inspirado en dashboards de café de especialidad. Botones con sombra 3D, animaciones suaves y diseño responsive.

## 📁 Estructura

```
├── index.html          # Página de login
├── app.html            # Aplicación principal
├── css/
│   ├── variables.css   # Variables de tema
│   ├── base.css        # Estilos base
│   ├── components.css  # Componentes UI
│   └── layout.css      # Layout y páginas
└── js/
    ├── storage.js      # Persistencia localStorage
    ├── auth.js         # Autenticación
    ├── data.js         # Datos iniciales
    ├── costs.js        # Costos de producción
    ├── coffees.js      # Gestión de cafés
    ├── clients.js      # Gestión de clientes
    ├── suppliers.js    # Gestión de proveedores
    ├── inventory.js    # Inventario y mermas
    ├── quotations.js   # Cotizaciones
    ├── pdf.js          # Generación PDF
    ├── notifications.js # Notificaciones
    ├── email.js        # Servicio de email
    └── app.js          # Aplicación principal
```

## 🔧 Despliegue

### GitHub Pages
1. Sube el repositorio a GitHub
2. Ve a Settings → Pages → Source: main branch
3. Comparte el enlace generado

### Netlify / Vercel
Arrastra la carpeta del proyecto o conecta el repositorio.

## 💾 Almacenamiento

Los datos se guardan en `localStorage` del navegador. Para respaldar, exporta desde las herramientas de desarrollo del navegador.

---

**Black Coffee Administration** — Gestión integral de café de especialidad
