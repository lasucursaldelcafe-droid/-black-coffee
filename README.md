# Black Coffee Administration

Plataforma contable y logística para distribución de café specialty (HTML · CSS · JavaScript).  
Cotizaciones con costos de producción, mermas, inventario, compras, ventas, clientes y proveedores.

## Cómo abrir / compartir

1. Publica el repositorio en **GitHub Pages** (Settings → Pages → Deploy from branch `main` / carpeta `/root`), **o**
2. Abre `index.html` en el navegador, **o**
3. Sirve localmente: `npx serve .` y comparte el enlace de la red.

Los datos se guardan en `localStorage` del navegador de cada usuario.

## Usuarios

| Usuario | Contraseña |
|---|---|
| **Ximena Polo** | `XimenaBCA2026!` |
| **Pablo Colorado Gómez** | `PabloBCA2026!` |

Notificaciones (cotización, compra, venta, producción) → **ghostspecialtycoffee@gmail.com**

## Datos demo incluidos

- Café: **Óscar Alejandro** · Cauca · Lavado 24h · **$33.000/kg** con transporte incluido  
- Cliente: **La Chocolatada** · Cali (panadería)  
- Compra inicial: 100 kg en verde  

## Costos de producción (base)

| Concepto | Valor |
|---|---|
| Tostión | $3.700 / kg |
| Selección post-tostión | $1.900 / kg |
| Empaque 250 g | $1.500 |
| Empaque 500 g | $1.900 |
| Empaque 5 lb | $3.000 |
| Etiqueta grande | $1.000 |
| Etiqueta pequeña | $500 |
| Costo de alza (activable) | $1.500 / kg |

Al ingresar, la plataforma pregunta si hubo cambios en estos costos.

## Mermas

- **Café verde** → merma de tostión + selección  
- **Pergamino** → merma de trilla + tostión + selección  

Porcentajes editables en Costos de producción.

## Módulos

Dashboard · Costos · Variedades · Inventario · Cotizaciones (PDF) · Compras · Ventas · Clientes · Proveedores · Notificaciones · Branding (logo y visual)

## Stack

HTML + CSS + JavaScript (vanilla). PDF con `html2pdf.js` (CDN). Sin backend: persistencia local + `mailto:` para correo.
