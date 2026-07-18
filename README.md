# Black Coffee Administration

Plataforma contable y operativa para **distribución de café specialty**: cotizaciones con costos de producción, compras, ventas, inventario con mermas, clientes y proveedores.

Tema visual: **blanco / negro / gris**. 100% **HTML + CSS + JavaScript** (sin backend). Los datos viven en `localStorage` del navegador; se puede compartir abriendo el `index.html` o publicando en GitHub Pages.

## Acceso

| Usuario | Contraseña |
|---|---|
| Ximena Polo | `BlackCoffee2026!` |
| Pablo Colorado Gómez | `GhostSpecialty26!` |

Notificaciones operativas → **ghostspecialtycoffee@gmail.com** (vía `mailto:` al crear cotizaciones, compras, ventas, producción o alertas de stock).

## Cómo abrir / compartir

```bash
# Opción rápida (servidor local)
npx --yes serve .
# o
python3 -m http.server 8080
```

Luego abre `http://localhost:8080` (o el puerto que indique).

Para compartir el link con el equipo: publica este repo en **GitHub Pages** (Settings → Pages → Deploy from branch `main` / carpeta `/`).

## Datos de ejemplo cargados

- **Café:** Óscar Alejandro · Cauca · Colombia · lavado 24 h fermentación · **$33.000/kg** con transporte incluido · 100 kg verde.
- **Cliente:** La Chocolatada · panadería · Cali (mayorista).

## Costos de producción (editables)

| Concepto | Valor |
|---|---|
| Tostión | $3.700 / kg |
| Selección post-tostión | $1.900 / kg |
| Empaque 250 g | $1.500 |
| Empaque 500 g | $1.900 |
| Empaque 5 lb | $3.000 |
| Etiqueta grande | $1.000 |
| Etiqueta pequeña | $500 |
| Costo de alza | $1.500 (activar / desactivar) |

Al **iniciar sesión**, la plataforma pregunta si hubo cambios en estos costos.

## Mermas (inventario)

- Compra en **verde**: merma de tostión + selección.
- Compra en **pergamino**: merma de trilla + tostión + selección.
- Los % son configurables en **Costos de producción**.

## Módulos

1. Dashboard (hero, KPIs, alertas de recompra)
2. Cotizaciones → PDF (jsPDF) + correo
3. Ventas / Compras (pregunta transporte incluido)
4. Inventario + simulador de proceso
5. Cafés (zona, variedad, proceso, rango de precio, imagen)
6. Clientes (final / mayorista / distribuidor) y márgenes 25 / 35 / 40 / 50 %
7. Proveedores
8. Costos de producción
9. Notificaciones
10. Apariencia (logo + hero)

## Estructura

```
index.html
css/styles.css
js/data.js
js/storage.js
js/calculator.js
js/pdf.js
js/notifications.js
js/views.js
js/app.js
```

## Nota

Es una primera versión funcional para prueba interna. Los documentos PDF se generan en el navegador; el correo se abre con el cliente de email del usuario hacia `ghostspecialtycoffee@gmail.com`.
