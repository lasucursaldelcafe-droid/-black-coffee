# Black Coffee Administration

Plataforma contable y operativa (HTML / CSS / JavaScript) para distribución de café especial: costos de producción, mermas, cotizaciones PDF, clientes, proveedores, compras, ventas e inventario.

## Cómo abrir / compartir

1. Abre `index.html` en el navegador, **o**
2. Publica el repo en **GitHub Pages** (Settings → Pages → Deploy from branch `main` / carpeta root) y comparte el link.

No requiere backend: los datos viven en `localStorage` del navegador.

## Usuarios

| Nombre | Usuario | Clave |
|--------|---------|-------|
| Ximena Polo | `ximena.polo` | `Ximena#BCA26` |
| Pablo Colorado Gómez | `pablo.colorado` | `Pablo#BCA26` |

## Correo de notificaciones

Todas las alertas de cotización, compra, venta, producción e inventario apuntan a:

**ghostspecialtycoffee@gmail.com**

(Desde la UI se abre un `mailto:` listo para enviar.)

## Datos demo incluidos

- **Café:** Óscar Alejandro — Cauca, lavado 24 h fermentación, variedad Colombia, **$33.000/kg** con transporte incluido, stock inicial 100 kg verde.
- **Cliente:** Panadería **La Chocolatada**, Cali (cliente final).
- **Proveedor:** Óscar Alejandro (caficultor, Cauca).

## Costos de producción (editables)

Al iniciar sesión aparece el modal: *“¿Hay algún cambio en los costos de producción?”*

| Concepto | Valor demo |
|----------|------------|
| Tostión | $3.700 / kg |
| Selección post-tostión | $1.900 / kg |
| Empaque 250 g | $1.500 |
| Empaque 500 g | $1.900 |
| Empaque 5 lb | $3.000 |
| Etiqueta grande | $1.000 |
| Etiqueta pequeña | $500 |
| Costo de alza | $1.500 (activable / desactivable) |

## Mermas (editables)

| Etapa | % demo | Aplica cuando |
|-------|--------|----------------|
| Trilla | 18% | Café pergamino |
| Tostión | 16% | Verde o pergamino |
| Selección | 3% | Todas las formas |

## Módulos

- Dashboard con alertas de stock
- Costos de producción + mermas
- Variedades de café (zona, variedad, proceso, forma, precio, transporte)
- Clientes (final / por mayor) y proveedores
- Cotizaciones con margen 25 / 35 / 40 / 50 % y PDF
- Compras, ventas e inventario con simulador de mermas
- Marca: logo, nombre, tagline y acento visual (blanco / negro / gris)

## Estructura

```
index.html
css/styles.css
js/data.js
js/calculations.js
js/pdf.js
js/app.js
```

## Primera prueba sugerida

1. Ingresa con `ximena.polo` / `Ximena#BCA26`
2. Confirma costos en el modal de ingreso
3. Dashboard → **Cotizar ahora** (La Chocolatada + Óscar Alejandro)
4. Elige formato 250 g, margen 35 %, cantidad en kg → **Guardar + PDF**
