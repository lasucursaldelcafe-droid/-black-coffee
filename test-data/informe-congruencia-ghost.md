# Informe de Congruencia — Catálogo Ghost Specialty Coffee

**Fecha:** 18 de julio de 2026  
**Fuente:** 15 PDFs de fichas y cotizaciones Ghost Specialty Coffee  
**Plataforma:** Black Coffee Administration (BCA)

---

## Resumen ejecutivo

| Métrica | Valor |
|---------|-------|
| PDFs analizados | 15 |
| Cafés únicos extraídos | 15 |
| Coincidentes con seed BCA | 1 (Óscar Alejandro — $33,000/kg) |
| Alertas de congruencia | 22 |
| Alertas alta severidad | 8 |
| Códigos duplicados en PDFs | C02, CLV01 |

---

## Cafés importados

| Código | Nombre | Precio/kg efectivo | Proceso | Archivo fuente |
|--------|--------|-------------------|---------|----------------|
| C01 | Blend Regional Valle | $29,000 | Lavado | C01_Blend_Regiona_7f37.pdf |
| C02 | Blend Regional Bruselas | $32,500 | Lavado | C02_Blend_Regional_Bruselas_f600.pdf |
| C02-GE | Geisha Evocare | $68,500 | Lavado | C02_GESHA_-_Evocare_83e1.pdf |
| C02-GD | Geisha Juan Daniel | $67,000 | Lavado | C02_GESHA_-_JUAN_DANIEL_2571.pdf |
| C03 | Caturra Thermal Shock | $56,500 | Thermal shock | C03_BOURBON_ROSADO_Thermal_Shock_1341.pdf |
| C04 | Papayo | $47,500 | Lavado | C04_Papayo_06a9.pdf |
| C05 | Natural Regional | $56,500 | Natural | C05_Natural_Regional_150d.pdf |
| C06 | Bourbon Rosado | $58,500 | Honey | C06_Bourbon_Rosado_f807.pdf |
| C07 | Java | $71,500 | Lavado | C07_Java_5725.pdf |
| C12 | Cofertado Frutos Tropicales | $56,500 | Anaeróbico | C12_Cofertado_Frutos_Tropicales_3816.pdf |
| C13 | Cofertado Uva | $56,500 | Anaeróbico | C13_Cofertado_Uva_17a3.pdf |
| COT-1 | Óscar Alejandro | $33,000 | Lavado | COTIZACIONES_v2_dfe0.pdf |
| CLV01-L | Castillo Lavado Fresco | $35,000 | Lavado (maquila) | Caf__Fresco_Castillo_lavado_656d.pdf |
| CLV01-RH | Castillo Red Honey Fresco | $38,000 | Honey (maquila) | Caf__Fresco_Castillo_red_honey_bdec.pdf |
| CBRV01 | Hawaii Maquila Blend | $31,500 | Lavado (maquila) | Caf__Hawaii_Maquila_c566.pdf |

---

## Incongruencias detectadas

### 1. PDF interno — resumen vs supuestos (alta)

| Café | Resumen | Supuestos | Diferencia |
|------|---------|-----------|------------|
| Geisha Evocare | $80,000/kg | $68,500/kg | 14.4% |
| Caturra Thermal Shock | $36,500/kg | $56,500/kg | 35.4% |
| Hawaii Maquila Blend | $30,000/kg | $31,500/kg | 4.5% |

**Recomendación:** Usar siempre la hoja de **Supuestos** como fuente de verdad; el resumen de portada en varios PDFs está desactualizado o usa plantilla incorrecta.

### 2. Códigos duplicados en catálogo Ghost (alta)

| Código | Cafés que lo comparten |
|--------|------------------------|
| C02 | Blend Regional Bruselas, Geisha Evocare, Geisha Juan Daniel |
| CLV01 | Castillo Lavado Fresco, Castillo Red Honey Fresco |

**Recomendación:** BCA asigna códigos únicos (`C02-GE`, `C02-GD`, `CLV01-L`, `CLV01-RH`) al importar.

### 3. Logística no sumada al precio efectivo (media)

| Café | Precio verde | Logística | Precio efectivo resumen |
|------|-------------|-----------|------------------------|
| Blend Regional Valle (C01) | $29,000 | $1,500 | $29,000 (debería ser $30,500) |
| Hawaii Maquila (CBRV01) | $30,000 | $1,500 | $30,000 (supuestos: $31,500) |

### 4. Merma tostión — PDF vs plataforma BCA (media)

| Fuente | Merma tostión | Merma selección |
|--------|--------------|-----------------|
| PDFs Ghost (mayoría) | **15%** | 2% |
| Plataforma BCA default | **16%** | 3% |
| Fresco Coffee (CLV01) | **18%** | 2% |

**Impacto:** BCA calcula ~1.2% menos rendimiento que Ghost → costo unitario ligeramente mayor en BCA.

### 5. Costos de empaque — PDF vs BCA (media)

| Presentación | PDF Ghost | BCA default |
|-------------|-----------|-------------|
| 250g | $1,766 | $1,500 + $800 labor = $2,300 |
| 500g | $2,000 | $1,900 + $1,000 labor = $2,900 |
| 5 lb | $2,500 | $3,000 + $1,500 labor = $4,500 |

Los PDFs Ghost separan empaque material de mano de obra; BCA los suma en categorías distintas pero el total es mayor en BCA.

### 6. Presentación 340g no soportada (baja)

Fresco Coffee usa bolsa de **340g** con precio $40,000–$45,000. BCA solo tiene 250g, 500g y 5lb.

**Recomendación:** Agregar `340g` a `PACKAGING_SIZES` si se trabaja con Fresco Coffee.

### 7. Plantillas PDF incorrectas (alta)

- `C02_GESHA_-_Evocare_83e1.pdf` — título dice "Blend Regional Valle", código C02, variedad incorrecta en portada
- `C03_BOURBON_ROSADO_Thermal_Shock_1341.pdf` — título "Bourbon Rosado" pero variedad Caturra Thermal Shock
- `Caf__Hawaii_Maquila_c566.pdf` — portada dice "Blend Regional Valle", supuestos dicen "Natural Regional"

---

## Congruencia con catálogo BCA existente

| Café | BCA (seed) | PDF Ghost | Estado |
|------|-----------|-----------|--------|
| Óscar Alejandro | $33,000/kg, Caturra, Cauca | $33,000/kg, Castillo/Caturra | ✅ Congruente |
| Resto (14 cafés) | No existían | Nuevos | ➕ Se agregan al importar |

---

## Costo BCA estimado vs precio Ghost (500g)

Cálculo con defaults BCA (merma 16%, empaque+labor+etiqueta estándar):

| Café | Costo BCA ~500g | Precio Ghost 500g | Margen estimado |
|------|----------------|-------------------|-----------------|
| Blend Regional Valle | ~$30,500 | $33,000 | ~8% ⚠️ |
| Blend Regional Bruselas | ~$32,800 | $33,000 | ~1% ⚠️ |
| Geisha Evocare | ~$58,000 | $90,000 | ~55% ✅ |
| Geisha Juan Daniel | ~$57,000 | $70,000 | ~23% ✅ |
| Caturra Thermal Shock | ~$48,500 | $60,000 | ~24% ✅ |
| Papayo | ~$41,000 | $45,000 | ~10% ⚠️ |
| Natural Regional | ~$48,500 | $45,000 | **-7%** 🔴 |
| Bourbon Rosado | ~$50,000 | $60,000 | ~20% ✅ |
| Java | ~$61,000 | $80,000 | ~31% ✅ |
| Óscar Alejandro | ~$30,500 | $28,081 | **-8%** 🔴 |

**Alertas críticas:** Natural Regional y Óscar Alejandro tienen precio Ghost por debajo del costo BCA con defaults actuales.

---

## Cómo importar en BCA

1. Ir a **Catálogo de Cafés** → **Importar Excel / PDF**
2. Pestaña **Catálogo Ghost (15 cafés)** → revisar análisis de congruencia
3. Clic en **Importar Cafés**
4. Alternativa: pestaña **PDF Ghost** para subir PDFs individuales

---

## Mejoras recomendadas al sistema

1. **Alinear mermas** — Permitir merma por café (15% Ghost, 18% Fresco) en lugar de solo global
2. **Presentación 340g** — Para clientes maquila Fresco Coffee
3. **Validación resumen vs supuestos** — Al generar PDF desde BCA, verificar coherencia
4. **Cotización → Venta en un clic** — Flujo comercial más rápido
5. **Modo maquila en ventas** — Registrar ventas de transformación sin compra de café
6. **Precio efectivo automático** — `pricePerKg + transportCost` cuando logística no está incluida
