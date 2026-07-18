/* Renderizado de vistas */
window.BC = window.BC || {};

BC.Views = {
  titles: {
    dashboard: ["Dashboard", "Resumen operativo y alertas de inventario"],
    cotizaciones: ["Cotizaciones", "Genera PDF con costos de producción"],
    ventas: ["Registro de ventas", "Historial comercial"],
    compras: ["Registro de compras", "Ingresos de café verde / pergamino"],
    inventario: ["Inventario", "Stocks, mermas y lotes"],
    cafes: ["Cafés / Variedades", "Catálogo con zona, proceso y precio"],
    clientes: ["Clientes", "Final, mayorista y distribuidor"],
    proveedores: ["Proveedores", "Caficultores y orígenes"],
    costos: ["Costos de producción", "Tostión, selección, empaque y alza"],
    notificaciones: ["Notificaciones", `Correo: ${BC.NOTIFY_EMAIL}`],
    configuracion: ["Apariencia", "Logo, hero y parámetros visuales"],
  },

  dashboard(state) {
    const alerts = BC.Notify.checkInventoryAlerts(state);
    const salesTotal = state.sales.reduce((s, x) => s + (x.total || 0), 0);
    const purchaseTotal = state.purchases.reduce((s, x) => s + (x.total || 0), 0);
    const stockKg = state.coffees.reduce(
      (s, c) => s + (Number(c.stockVerdeKg) || 0) + (Number(c.stockTostadoKg) || 0),
      0
    );
    const heroStyle = state.appearance.heroDataUrl
      ? `style="--hero-image:url('${state.appearance.heroDataUrl}')"`
      : "";

    return `
      <section class="hero" ${heroStyle}>
        <div class="hero-inner">
          <div class="hero-brand">${escapeHtml(state.appearance.brandName || "Black Coffee")}</div>
          <p class="hero-copy">${escapeHtml(state.appearance.tagline || "Specialty · Distribución · Cotización")}</p>
          <div class="hero-actions">
            <button class="btn btn-primary" data-action="open-quote">Nueva cotización</button>
            <button class="btn btn-secondary" data-nav="inventario">Ver inventario</button>
          </div>
        </div>
      </section>

      <section class="kpi-grid">
        <article class="kpi">
          <div class="kpi-label">Stock total</div>
          <div class="kpi-value">${stockKg.toFixed(1)} kg</div>
          <div class="kpi-meta">${state.coffees.length} cafés activos</div>
        </article>
        <article class="kpi">
          <div class="kpi-label">Cotizaciones</div>
          <div class="kpi-value">${state.quotes.length}</div>
          <div class="kpi-meta">${state.quotes.filter((q) => q.fecha === BC.today()).length} hoy</div>
        </article>
        <article class="kpi">
          <div class="kpi-label">Ventas registradas</div>
          <div class="kpi-value money">${BC.formatCOP(salesTotal)}</div>
          <div class="kpi-meta">${state.sales.length} movimientos</div>
        </article>
        <article class="kpi">
          <div class="kpi-label">Compras</div>
          <div class="kpi-value money">${BC.formatCOP(purchaseTotal)}</div>
          <div class="kpi-meta">${state.purchases.length} ingresos</div>
        </article>
      </section>

      <section class="grid-2">
        <div class="panel">
          <div class="panel-header">
            <div>
              <h3>Alertas de recompra</h3>
              <p>Umbral: ${state.costs.umbralInventarioKg} kg</p>
            </div>
            <button class="btn btn-secondary btn-sm" data-nav="compras">Nueva compra</button>
          </div>
          <div class="alert-stack">
            ${
              alerts.length
                ? alerts
                    .map(
                      (a) => `
              <div class="alert">
                <div>
                  <strong>${escapeHtml(a.coffee.nombre)}</strong>
                  <p>Quedan <b>${a.total.toFixed(1)} kg</b>. Genera compra al caficultor ${escapeHtml(a.coffee.caficultor)} (${escapeHtml(a.coffee.zona)}).</p>
                  <div class="split-actions" style="margin-top:.55rem">
                    <button class="btn btn-primary btn-sm" data-action="quick-purchase" data-id="${a.coffee.id}">Programar compra</button>
                    <button class="btn btn-ghost btn-sm" data-action="mail-restock" data-id="${a.coffee.id}">Avisar por correo</button>
                  </div>
                </div>
              </div>`
                    )
                    .join("")
                : `<div class="empty-state"><h4>Inventario estable</h4><p>Ningún café está bajo el umbral.</p></div>`
            }
          </div>
        </div>
        <div class="panel">
          <div class="panel-header">
            <div>
              <h3>Café piloto</h3>
              <p>Óscar Alejandro · Cauca</p>
            </div>
          </div>
          ${renderCoffeeCard(state.coffees[0], state)}
        </div>
      </section>

      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>Últimas cotizaciones</h3>
            <p>Documentos listos para PDF</p>
          </div>
          <button class="btn btn-secondary btn-sm" data-nav="cotizaciones">Ver todas</button>
        </div>
        ${renderQuotesTable(state.quotes.slice(0, 5), state)}
      </section>
    `;
  },

  cotizaciones(state) {
    return `
      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>Nueva cotización automática</h3>
            <p>Solo defines café, formato, margen y kilos — el costo de producción se calcula solo</p>
          </div>
          <button class="btn btn-primary" data-action="open-quote">Crear cotización</button>
        </div>
        ${renderQuotesTable(state.quotes, state)}
      </section>
    `;
  },

  ventas(state) {
    return `
      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>Ventas</h3>
            <p>Registro comercial vinculado a clientes y cafés</p>
          </div>
          <button class="btn btn-primary" data-action="open-sale">Registrar venta</button>
        </div>
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>Fecha</th><th>Cliente</th><th>Café</th><th>Kg</th><th>Total</th><th></th>
              </tr>
            </thead>
            <tbody>
              ${
                state.sales.length
                  ? state.sales
                      .map((s) => {
                        const cli = state.clients.find((c) => c.id === s.clientId);
                        const cafe = state.coffees.find((c) => c.id === s.coffeeId);
                        return `<tr>
                          <td>${s.fecha}</td>
                          <td>${escapeHtml(cli?.name || "—")}</td>
                          <td>${escapeHtml(cafe?.nombre || "—")}</td>
                          <td>${s.kilos}</td>
                          <td class="money">${BC.formatCOP(s.total)}</td>
                          <td><button class="btn btn-ghost btn-sm" data-action="mail-sale" data-id="${s.id}">Notificar</button></td>
                        </tr>`;
                      })
                      .join("")
                  : `<tr><td colspan="6"><div class="empty-state"><h4>Sin ventas aún</h4><p>Registra la primera venta a La Chocolatada.</p></div></td></tr>`
              }
            </tbody>
          </table>
        </div>
      </section>
    `;
  },

  compras(state) {
    return `
      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>Compras de café</h3>
            <p>Pregunta siempre si el transporte está incluido</p>
          </div>
          <button class="btn btn-primary" data-action="open-purchase">Registrar compra</button>
        </div>
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>Fecha</th><th>Café</th><th>Proveedor</th><th>Kg</th><th>Transporte</th><th>Total</th><th></th>
              </tr>
            </thead>
            <tbody>
              ${state.purchases
                .map((p) => {
                  const cafe = state.coffees.find((c) => c.id === p.coffeeId);
                  const prov = state.providers.find((x) => x.id === p.proveedorId);
                  return `<tr>
                    <td>${p.fecha}</td>
                    <td>${escapeHtml(cafe?.nombre || "—")}</td>
                    <td>${escapeHtml(prov?.name || "—")}</td>
                    <td>${p.kilos}</td>
                    <td><span class="tag ${p.transporteIncluido ? "ok" : "warn"}">${p.transporteIncluido ? "Incluido" : BC.formatCOP(p.transporteTotal)}</span></td>
                    <td class="money">${BC.formatCOP(p.total)}</td>
                    <td><button class="btn btn-ghost btn-sm" data-action="mail-purchase" data-id="${p.id}">Notificar</button></td>
                  </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </section>
    `;
  },

  inventario(state) {
    const m = state.costs.mermas;
    return `
      <section class="grid-3">
        <div class="panel">
          <h3>Merma trilla</h3>
          <p class="help">Pergamino → verde</p>
          <div class="kpi-value" style="margin-top:.6rem">${m.trilla}%</div>
        </div>
        <div class="panel">
          <h3>Merma tostión</h3>
          <p class="help">Verde → tostado</p>
          <div class="kpi-value" style="margin-top:.6rem">${m.tostion}%</div>
        </div>
        <div class="panel">
          <h3>Merma selección</h3>
          <p class="help">Post-tostión</p>
          <div class="kpi-value" style="margin-top:.6rem">${m.seleccion}%</div>
        </div>
      </section>
      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>Stock por café</h3>
            <p>Verde: solo tostión + selección · Pergamino: trilla + tostión + selección</p>
          </div>
          <button class="btn btn-secondary btn-sm" data-action="open-process">Simular proceso / merma</button>
        </div>
        <div class="table-wrap">
          <table class="data">
            <thead>
              <tr>
                <th>Café</th><th>Estado compra</th><th>Verde kg</th><th>Tostado kg</th><th>Rendimiento</th><th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${state.coffees
                .map((c) => {
                  const factor = BC.Calc.yieldFactor(c.estadoCompra, state.costs.mermas);
                  const total = (Number(c.stockVerdeKg) || 0) + (Number(c.stockTostadoKg) || 0);
                  const low = total <= state.costs.umbralInventarioKg;
                  return `<tr>
                    <td>${escapeHtml(c.nombre)}</td>
                    <td>${escapeHtml(BC.CATALOGS.estadosCafe.find((e) => e.id === c.estadoCompra)?.label || c.estadoCompra)}</td>
                    <td>${Number(c.stockVerdeKg || 0).toFixed(2)}</td>
                    <td>${Number(c.stockTostadoKg || 0).toFixed(2)}</td>
                    <td>${(factor * 100).toFixed(1)}% → tostado</td>
                    <td><span class="tag ${low ? "low" : "ok"}">${low ? "Recompra" : "OK"}</span></td>
                  </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </section>
      <section class="panel">
        <div class="panel-header">
          <div><h3>Lotes</h3><p>Trazabilidad de ingresos</p></div>
        </div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Fecha</th><th>Café</th><th>Estado</th><th>Inicial</th><th>Disponible</th><th>Notas</th></tr></thead>
            <tbody>
              ${state.inventoryLots
                .map((l) => {
                  const cafe = state.coffees.find((c) => c.id === l.coffeeId);
                  return `<tr>
                    <td>${l.fecha}</td>
                    <td>${escapeHtml(cafe?.nombre || "—")}</td>
                    <td>${l.estado}</td>
                    <td>${l.kilosIniciales}</td>
                    <td>${l.kilosDisponibles}</td>
                    <td>${escapeHtml(l.notas || "")}</td>
                  </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </section>
    `;
  },

  cafes(state) {
    return `
      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>Catálogo de cafés</h3>
            <p>Variedad, zona, proceso, rango de precio e imagen</p>
          </div>
          <button class="btn btn-primary" data-action="open-coffee">Agregar café</button>
        </div>
        <div class="stack">
          ${state.coffees.map((c) => renderCoffeeCard(c, state, true)).join("")}
        </div>
      </section>
    `;
  },

  clientes(state) {
    return `
      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>Clientes</h3>
            <p>Final · Mayorista · Distribuidor</p>
          </div>
          <button class="btn btn-primary" data-action="open-client">Agregar cliente</button>
        </div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Nombre</th><th>Tipo</th><th>Ciudad</th><th>Contacto</th><th></th></tr></thead>
            <tbody>
              ${state.clients
                .map((c) => {
                  const tipo = BC.CATALOGS.tiposCliente.find((t) => t.id === c.tipo)?.label || c.tipo;
                  return `<tr>
                    <td><strong>${escapeHtml(c.name)}</strong><div class="help">${escapeHtml(c.notas || "")}</div></td>
                    <td><span class="tag">${escapeHtml(tipo)}</span></td>
                    <td>${escapeHtml(c.ciudad)}${c.departamento ? ", " + escapeHtml(c.departamento) : ""}</td>
                    <td>${escapeHtml(c.email || c.telefono || "—")}</td>
                    <td class="split-actions">
                      <button class="btn btn-secondary btn-sm" data-action="quote-for-client" data-id="${c.id}">Cotizar</button>
                    </td>
                  </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </section>
    `;
  },

  proveedores(state) {
    return `
      <section class="panel">
        <div class="panel-header">
          <div><h3>Proveedores / caficultores</h3><p>Origen y zona</p></div>
          <button class="btn btn-primary" data-action="open-provider">Agregar proveedor</button>
        </div>
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Nombre</th><th>Zona</th><th>Contacto</th><th>Notas</th></tr></thead>
            <tbody>
              ${state.providers
                .map(
                  (p) => `<tr>
                  <td>${escapeHtml(p.name)}</td>
                  <td>${escapeHtml(p.zona)}</td>
                  <td>${escapeHtml(p.email || p.telefono || "—")}</td>
                  <td>${escapeHtml(p.notas || "")}</td>
                </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </section>
    `;
  },

  costos(state) {
    const c = state.costs;
    return `
      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>Costos fijos de producción</h3>
            <p>Editables · se preguntan al iniciar sesión</p>
          </div>
          <button class="btn btn-primary" data-action="save-costs">Guardar cambios</button>
        </div>
        <form id="costs-form" class="form-grid">
          <label class="field"><span>Tostión ($ / kg)</span>
            <input type="number" name="tostionPorKg" value="${c.tostionPorKg}" min="0" step="100" /></label>
          <label class="field"><span>Selección post-tostión ($ / kg)</span>
            <input type="number" name="seleccionPorKg" value="${c.seleccionPorKg}" min="0" step="100" /></label>
          <label class="field"><span>Empaque 250 g ($)</span>
            <input type="number" name="empaque250" value="${c.empaque["250g"]}" min="0" step="100" /></label>
          <label class="field"><span>Empaque 500 g ($)</span>
            <input type="number" name="empaque500" value="${c.empaque["500g"]}" min="0" step="100" /></label>
          <label class="field"><span>Empaque 5 lb ($)</span>
            <input type="number" name="empaque5lb" value="${c.empaque["5lb"]}" min="0" step="100" /></label>
          <label class="field"><span>Etiqueta grande ($)</span>
            <input type="number" name="etiquetaGrande" value="${c.etiquetaGrande}" min="0" step="100" /></label>
          <label class="field"><span>Etiqueta pequeña ($)</span>
            <input type="number" name="etiquetaPequena" value="${c.etiquetaPequena}" min="0" step="100" /></label>
          <label class="field"><span>Costo de alza ($)</span>
            <input type="number" name="costoAlza" value="${c.costoAlza}" min="0" step="100" /></label>
          <div class="full switch-row">
            <div>
              <strong>Activar costo de alza</strong>
              <p class="help">Incluye $${c.costoAlza.toLocaleString("es-CO")} en el costo de producción</p>
            </div>
            <label class="switch"><input type="checkbox" name="alzaActiva" ${c.alzaActiva ? "checked" : ""} /><span></span></label>
          </div>
          <label class="field"><span>Merma trilla (%)</span>
            <input type="number" name="mermaTrilla" value="${c.mermas.trilla}" min="0" max="50" step="0.5" /></label>
          <label class="field"><span>Merma tostión (%)</span>
            <input type="number" name="mermaTostion" value="${c.mermas.tostion}" min="0" max="50" step="0.5" /></label>
          <label class="field"><span>Merma selección (%)</span>
            <input type="number" name="mermaSeleccion" value="${c.mermas.seleccion}" min="0" max="50" step="0.5" /></label>
          <label class="field"><span>Umbral alerta inventario (kg)</span>
            <input type="number" name="umbralInventarioKg" value="${c.umbralInventarioKg}" min="1" step="1" /></label>
        </form>
      </section>
    `;
  },

  notificaciones(state) {
    return `
      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>Bandeja</h3>
            <p>Todo aviso operativo también puede enviarse a ${BC.NOTIFY_EMAIL}</p>
          </div>
          <button class="btn btn-secondary btn-sm" data-action="mark-read">Marcar leídas</button>
        </div>
        <div class="alert-stack">
          ${
            state.notifications.length
              ? state.notifications
                  .map(
                    (n) => `<div class="alert">
                <div>
                  <strong>${escapeHtml(n.title)} ${n.read ? "" : "· nuevo"}</strong>
                  <p>${escapeHtml(n.message)}</p>
                  <p class="help">${new Date(n.createdAt).toLocaleString("es-CO")}</p>
                </div>
              </div>`
                  )
                  .join("")
              : `<div class="empty-state"><h4>Sin notificaciones</h4><p>Las cotizaciones, compras y alertas aparecerán aquí.</p></div>`
          }
        </div>
      </section>
    `;
  },

  configuracion(state) {
    const a = state.appearance;
    return `
      <section class="panel">
        <div class="panel-header">
          <div>
            <h3>Identidad visual</h3>
            <p>Sube logo y hero · paleta blanco / negro / gris</p>
          </div>
          <button class="btn btn-primary" data-action="save-appearance">Guardar apariencia</button>
        </div>
        <form id="appearance-form" class="form-grid">
          <div class="full" style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap">
            <div class="logo-preview" id="logo-preview" style="${a.logoDataUrl ? `background-image:url('${a.logoDataUrl}');color:transparent` : ""}">${a.logoDataUrl ? "" : "BC"}</div>
            <div>
              <label class="field"><span>Logo (PNG/JPG/SVG)</span>
                <input type="file" id="logo-file" accept="image/*" /></label>
              <p class="help">Se muestra en login y sidebar</p>
            </div>
          </div>
          <label class="field"><span>Nombre de marca</span>
            <input type="text" name="brandName" value="${escapeAttr(a.brandName)}" /></label>
          <label class="field"><span>Tagline</span>
            <input type="text" name="tagline" value="${escapeAttr(a.tagline)}" /></label>
          <label class="field full"><span>Imagen hero del dashboard</span>
            <input type="file" id="hero-file" accept="image/*" />
            ${a.heroDataUrl ? `<img src="${a.heroDataUrl}" alt="Hero" style="margin-top:.75rem;border-radius:14px;max-height:160px;width:100%;object-fit:cover;border:1px solid #333" />` : ""}
          </label>
          <div class="full form-actions">
            <button type="button" class="btn btn-danger btn-sm" data-action="reset-data">Restablecer datos de ejemplo</button>
          </div>
        </form>
      </section>
    `;
  },
};

function renderCoffeeCard(coffee, state, detailed = false) {
  if (!coffee) return `<div class="empty-state"><p>Sin café cargado</p></div>`;
  const landed = BC.Calc.coffeeLandedCostPerKg(coffee);
  const sample = BC.Calc.productionCostPerKgRoasted({
    coffee,
    costs: state.costs,
    formatoId: "250g",
    etiqueta: "pequena",
  });
  const sale35 = BC.Calc.priceWithMargin(sample.unitCost, 35);
  return `
    <article class="panel" style="margin:0">
      <div style="display:flex;gap:1rem;align-items:flex-start">
        ${
          coffee.imagenDataUrl
            ? `<img class="thumb" src="${coffee.imagenDataUrl}" alt="" />`
            : `<div class="thumb" style="display:grid;place-items:center;color:#888;font-size:.7rem">IMG</div>`
        }
        <div style="flex:1;min-width:0">
          <strong>${escapeHtml(coffee.nombre)}</strong>
          <p class="help">${escapeHtml(coffee.caficultor)} · ${escapeHtml(coffee.zona)} · ${escapeHtml(coffee.variedad)} · ${escapeHtml(coffee.proceso)}</p>
          <div class="split-actions" style="margin-top:.55rem">
            <span class="tag">${BC.formatCOP(coffee.precioKg)}/kg</span>
            <span class="tag ${coffee.transporteIncluido ? "ok" : "warn"}">${coffee.transporteIncluido ? "Transporte incluido" : "Transporte aparte"}</span>
            <span class="tag">${escapeHtml(coffee.estadoCompra)}</span>
          </div>
          ${
            detailed
              ? `<div class="cost-summary" style="margin-top:.9rem">
                  <div class="row"><span>Costo aterrizado café</span><span class="money">${BC.formatCOP(landed)}/kg entrada</span></div>
                  <div class="row"><span>Costo prod. (250g, etiq. peq.)</span><span class="money">${BC.formatCOP(sample.unitCost)}/kg tostado</span></div>
                  <div class="row total"><span>Precio sugerido +35%</span><span class="money">${BC.formatCOP(sale35)}/kg</span></div>
                </div>
                <div class="split-actions" style="margin-top:.75rem">
                  <button class="btn btn-secondary btn-sm" data-action="open-quote" data-coffee="${coffee.id}">Cotizar</button>
                  <button class="btn btn-ghost btn-sm" data-action="edit-coffee" data-id="${coffee.id}">Editar</button>
                </div>`
              : `<p class="help" style="margin-top:.65rem">Stock verde: ${Number(coffee.stockVerdeKg || 0).toFixed(1)} kg · tostado: ${Number(coffee.stockTostadoKg || 0).toFixed(1)} kg</p>`
          }
        </div>
      </div>
    </article>
  `;
}

function renderQuotesTable(quotes, state) {
  if (!quotes.length) {
    return `<div class="empty-state"><h4>Sin cotizaciones</h4><p>Crea la primera para La Chocolatada con el café de Óscar Alejandro.</p></div>`;
  }
  return `
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th>N°</th><th>Fecha</th><th>Cliente</th><th>Total</th><th></th></tr></thead>
        <tbody>
          ${quotes
            .map((q) => {
              const cli = state.clients.find((c) => c.id === q.clientId);
              return `<tr>
                <td>${escapeHtml(q.numero)}</td>
                <td>${q.fecha}</td>
                <td>${escapeHtml(cli?.name || "—")}</td>
                <td class="money">${BC.formatCOP(q.total)}</td>
                <td class="split-actions">
                  <button class="btn btn-secondary btn-sm" data-action="pdf-quote" data-id="${q.id}">PDF</button>
                  <button class="btn btn-ghost btn-sm" data-action="mail-quote" data-id="${q.id}">Correo</button>
                </td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/'/g, "&#39;");
}

BC.escapeHtml = escapeHtml;
