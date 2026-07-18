/**
 * Render de pantallas
 */
(function () {
  const BCA = window.BCA;
  const U = () => BCA.util;
  const C = () => BCA.calc;

  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function chipGroup(name, options, selected, { multi = false } = {}) {
    return `
      <div class="chip-row" data-chip-group="${name}" data-multi="${multi ? "1" : "0"}">
        ${options
          .map((opt) => {
            const id = typeof opt === "object" ? opt.id : opt;
            const label = typeof opt === "object" ? opt.label : opt;
            const active = multi
              ? (selected || []).includes(id)
              : String(selected) === String(id);
            return `<button type="button" class="chip ${active ? "is-active" : ""}" data-value="${id}">${label}</button>`;
          })
          .join("")}
      </div>`;
  }

  function bindChips(root, onChange) {
    root.querySelectorAll("[data-chip-group]").forEach((group) => {
      group.addEventListener("click", (e) => {
        const btn = e.target.closest(".chip");
        if (!btn) return;
        const multi = group.dataset.multi === "1";
        if (!multi) {
          group.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-active"));
          btn.classList.add("is-active");
        } else {
          btn.classList.toggle("is-active");
        }
        onChange?.(group.dataset.chipGroup, getChipValue(group));
      });
    });
  }

  function getChipValue(group) {
    const multi = group.dataset.multi === "1";
    const active = [...group.querySelectorAll(".chip.is-active")].map((c) => c.dataset.value);
    return multi ? active : active[0] ?? null;
  }

  function getChipValueByName(root, name) {
    const group = root.querySelector(`[data-chip-group="${name}"]`);
    return group ? getChipValue(group) : null;
  }

  /* ---------- DASHBOARD ---------- */
  function renderDashboard(root) {
    const state = U().getState();
    const alerts = U().checkLowStock();
    const quotes = state.quotes.length;
    const sales = state.sales.reduce((a, s) => a + (s.total || 0), 0);
    const purchases = state.purchases.reduce((a, p) => a + (p.total || 0), 0);
    const stockKg = state.inventory.reduce(
      (a, i) => a + (i.kgAvailableGreen || 0) + (i.kgAvailableRoasted || 0),
      0
    );

    root.innerHTML = `
      <div class="hero-dash">
        <img src="${state.branding.heroUrl || BCA.DEFAULT_BRANDING.heroUrl}" alt="" />
        <div class="hero-dash__copy">
          <h3>${state.branding.companyName || "Black Coffee"}</h3>
          <p>${state.branding.tagline || ""} · Operación specialty lista para cotizar y producir.</p>
        </div>
      </div>
      <div class="kpi-strip">
        <div class="stat"><label>Stock disponible</label><strong class="mono">${U().num(stockKg, 1)} kg</strong><small>Verde + tostado</small></div>
        <div class="stat"><label>Cotizaciones</label><strong class="mono">${quotes}</strong><small>Documentos generados</small></div>
        <div class="stat"><label>Compras</label><strong class="mono">${U().money(purchases)}</strong><small>Entradas registradas</small></div>
        <div class="stat"><label>Ventas</label><strong class="mono">${U().money(sales)}</strong><small>Salidas registradas</small></div>
      </div>
      <div class="grid grid-2">
        <div class="panel">
          <div class="panel-head">
            <h3>Alertas de reposición</h3>
            <span class="tag">${alerts.length}</span>
          </div>
          ${
            alerts.length
              ? alerts
                  .map(
                    (a) => `
              <div class="alert alert--warn" style="margin-bottom:.6rem">
                <strong>${a.coffee.name}</strong>
                <p class="muted" style="margin:.35rem 0 0">Quedan ${U().num(a.total, 1)} kg (umbral ${state.costs.lowStockKg} kg). Genera una nueva compra.</p>
                <div class="row" style="margin-top:.65rem">
                  <button class="btn btn-secondary btn-sm" data-goto="compras">Registrar compra</button>
                  <button class="btn btn-ghost btn-sm" data-notify-restock="${a.coffee.id}">Notificar correo</button>
                </div>
              </div>`
                  )
                  .join("")
              : `<div class="alert alert--ok">Inventario por encima del umbral. Sin alertas críticas.</div>`
          }
        </div>
        <div class="panel">
          <div class="panel-head"><h3>Café piloto</h3><span class="tag tag--dark">Óscar Alejandro</span></div>
          <p style="margin:0 0 .75rem">Cauca · Lavado 24h · ${U().money(33000)}/kg · transporte incluido.</p>
          <p class="muted" style="margin:0 0 1rem">Cliente ejemplo: <strong>La Chocolatada</strong> (Cali).</p>
          <div class="row">
            <button class="btn btn-primary btn-sm" data-goto="cotizaciones">Cotizar ahora</button>
            <button class="btn btn-secondary btn-sm" data-goto="cafes">Ver variedad</button>
          </div>
        </div>
      </div>
      <div class="panel" style="margin-top:1rem">
        <div class="panel-head"><h3>Flujo de mermas</h3></div>
        <p class="muted" style="margin-top:0">Si compras <strong>verde</strong>: merma de tostión + selección. Si compras <strong>pergamino</strong>: trilla + tostión + selección.</p>
        <div class="chip-row">
          <span class="chip is-active">Trilla ${state.costs.merma.trilla}%</span>
          <span class="chip is-active">Tostión ${state.costs.merma.tostion}%</span>
          <span class="chip is-active">Selección ${state.costs.merma.seleccion}%</span>
        </div>
      </div>
    `;

    root.querySelectorAll("[data-goto]").forEach((b) =>
      b.addEventListener("click", () => BCA.app.navigate(b.dataset.goto))
    );
    root.querySelectorAll("[data-notify-restock]").forEach((b) =>
      b.addEventListener("click", () => {
        const coffee = U().findCoffee(b.dataset.notifyRestock);
        const n = U().pushNotification({
          type: "produccion",
          title: `Reposición de café — ${coffee.name}`,
          body: `El stock de ${coffee.name} está bajo el umbral (${state.costs.lowStockKg} kg). Se recomienda generar una nueva compra.`,
          openMail: true,
        });
        if (n.mailto) window.location.href = n.mailto;
        U().toast("Notificación de reposición preparada");
        BCA.app.refreshBadges();
      })
    );
  }

  /* ---------- COSTOS ---------- */
  function costsFormHtml(costs, { idPrefix = "cost" } = {}) {
    return `
      <div class="grid grid-2">
        <label class="field"><span>Tostión (COP/kg)</span><input class="input" type="number" id="${idPrefix}-roast" value="${costs.roastingPerKg}" /></label>
        <label class="field"><span>Selección post-tostión (COP/kg)</span><input class="input" type="number" id="${idPrefix}-sel" value="${costs.selectionPerKg}" /></label>
        <label class="field"><span>Empaque 250 g</span><input class="input" type="number" id="${idPrefix}-p250" value="${costs.packaging["250g"]}" /></label>
        <label class="field"><span>Empaque 500 g</span><input class="input" type="number" id="${idPrefix}-p500" value="${costs.packaging["500g"]}" /></label>
        <label class="field"><span>Empaque 5 lb</span><input class="input" type="number" id="${idPrefix}-p5lb" value="${costs.packaging["5lb"]}" /></label>
        <label class="field"><span>Etiqueta grande</span><input class="input" type="number" id="${idPrefix}-ll" value="${costs.labelLarge}" /></label>
        <label class="field"><span>Etiqueta pequeña</span><input class="input" type="number" id="${idPrefix}-ls" value="${costs.labelSmall}" /></label>
        <label class="field"><span>Costo de alza (COP/kg)</span><input class="input" type="number" id="${idPrefix}-alza" value="${costs.alza}" /></label>
        <label class="field"><span>Merma trilla %</span><input class="input" type="number" id="${idPrefix}-mt" value="${costs.merma.trilla}" step="0.1" /></label>
        <label class="field"><span>Merma tostión %</span><input class="input" type="number" id="${idPrefix}-mr" value="${costs.merma.tostion}" step="0.1" /></label>
        <label class="field"><span>Merma selección %</span><input class="input" type="number" id="${idPrefix}-ms" value="${costs.merma.seleccion}" step="0.1" /></label>
        <label class="field"><span>Umbral stock bajo (kg)</span><input class="input" type="number" id="${idPrefix}-low" value="${costs.lowStockKg}" step="0.1" /></label>
      </div>
      <div class="row" style="margin-top:1rem">
        <label class="toggle">
          <input type="checkbox" id="${idPrefix}-alza-on" ${costs.alzaActive ? "checked" : ""} />
          <span class="toggle__track"></span>
          <span>Costo de alza ${costs.alzaActive ? "activo" : "inactivo"}</span>
        </label>
      </div>
    `;
  }

  function readCostsForm(idPrefix = "cost") {
    const g = (id) => Number(document.getElementById(`${idPrefix}-${id}`).value);
    const alzaOn = document.getElementById(`${idPrefix}-alza-on`);
    return {
      roastingPerKg: g("roast"),
      selectionPerKg: g("sel"),
      packaging: { "250g": g("p250"), "500g": g("p500"), "5lb": g("p5lb") },
      labelLarge: g("ll"),
      labelSmall: g("ls"),
      alza: g("alza"),
      alzaActive: !!alzaOn?.checked,
      merma: { trilla: g("mt"), tostion: g("mr"), seleccion: g("ms") },
      lowStockKg: g("low"),
    };
  }

  function renderCostos(root) {
    const costs = U().getState().costs;
    root.innerHTML = `
      <div class="panel">
        <div class="panel-head">
          <h3>Costos de producción</h3>
          <button class="btn btn-primary btn-sm" id="btn-save-costs">Guardar cambios</button>
        </div>
        <p class="muted" style="margin-top:0">Estos valores son la base de toda cotización. El precio del café por variedad es la variable principal; el transporte se pregunta por café.</p>
        ${costsFormHtml(costs)}
      </div>
    `;
    const toggle = root.querySelector("#cost-alza-on");
    toggle?.addEventListener("change", () => {
      const label = toggle.closest(".toggle").querySelector("span:last-child");
      label.textContent = `Costo de alza ${toggle.checked ? "activo" : "inactivo"}`;
    });
    root.querySelector("#btn-save-costs").addEventListener("click", () => {
      const next = readCostsForm("cost");
      U().setState((s) => ({ ...s, costs: next }));
      U().pushNotification({
        type: "produccion",
        title: "Costos de producción actualizados",
        body: `Nuevos costos: tostión ${next.roastingPerKg}, selección ${next.selectionPerKg}, alza ${next.alzaActive ? "ON" : "OFF"}.`,
      });
      U().toast("Costos guardados");
      BCA.app.refreshBadges();
      renderCostos(root);
    });
  }

  /* ---------- CAFÉS ---------- */
  function renderCafes(root) {
    const state = U().getState();
    root.innerHTML = `
      <div class="grid grid-2">
        <div class="panel">
          <h3>Agregar / editar variedad</h3>
          <form id="form-coffee" class="stack">
            <label class="field"><span>Nombre comercial</span><input class="input" name="name" required placeholder="Ej. Óscar Alejandro — Lavado 24h" /></label>
            <label class="field"><span>Caficultor</span><input class="input" name="farmer" required /></label>
            <div>
              <div class="muted" style="margin-bottom:.4rem;font-size:.82rem">Zona del país</div>
              ${chipGroup("zone", BCA.ZONES, "Cauca")}
            </div>
            <div>
              <div class="muted" style="margin-bottom:.4rem;font-size:.82rem">Proceso</div>
              ${chipGroup("process", BCA.PROCESSES, "Lavado")}
            </div>
            <label class="field"><span>Fermentación / detalle</span><input class="input" name="fermentation" placeholder="24 horas" /></label>
            <div>
              <div class="muted" style="margin-bottom:.4rem;font-size:.82rem">Forma de compra</div>
              ${chipGroup("form", BCA.FORMS, "verde")}
            </div>
            <label class="field"><span>Precio por kilogramo (COP)</span><input class="input" type="number" name="pricePerKg" required value="33000" /></label>
            <div>
              <div class="muted" style="margin-bottom:.4rem;font-size:.82rem">¿Transporte incluido en el precio?</div>
              ${chipGroup(
                "transportIncluded",
                [
                  { id: "yes", label: "Sí, incluido" },
                  { id: "no", label: "No, va aparte" },
                ],
                "yes"
              )}
            </div>
            <label class="field" id="transport-field"><span>Transporte COP/kg (si no incluido)</span><input class="input" type="number" name="transportPerKg" value="0" /></label>
            <label class="field"><span>Notas</span><textarea class="textarea" name="notes" rows="2"></textarea></label>
            <label class="field"><span>Imagen del producto</span><input type="file" name="image" accept="image/*" /></label>
            <input type="hidden" name="editId" value="" />
            <button class="btn btn-primary" type="submit">Guardar variedad</button>
          </form>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>Variedades</h3><span class="tag">${state.coffees.length}</span></div>
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th></th><th>Café</th><th>Zona</th><th>Precio</th><th>Forma</th><th></th></tr></thead>
              <tbody>
                ${state.coffees
                  .map((c) => {
                    const stock = U().stockSummary(c.id);
                    return `<tr>
                      <td>${c.imageDataUrl ? `<img class="thumb" src="${c.imageDataUrl}" alt="" />` : `<div class="thumb"></div>`}</td>
                      <td><strong>${c.name}</strong><br /><span class="muted">${c.farmer} · ${c.process}</span><br /><span class="tag">${U().num(stock.green + stock.roasted, 1)} kg</span></td>
                      <td>${c.zone}</td>
                      <td class="mono">${U().money(c.pricePerKg)}</td>
                      <td>${c.form}${c.transportIncluded ? '<br><span class="tag">Flete incl.</span>' : ""}</td>
                      <td><button class="btn btn-ghost btn-sm" data-edit-coffee="${c.id}">Editar</button></td>
                    </tr>`;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    const form = root.querySelector("#form-coffee");
    bindChips(form, (name, val) => {
      if (name === "transportIncluded") {
        const field = form.querySelector("#transport-field");
        field.style.opacity = val === "no" ? "1" : "0.45";
      }
    });
    form.querySelector("#transport-field").style.opacity = "0.45";

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const editId = fd.get("editId");
      let imageDataUrl = "";
      const file = fd.get("image");
      if (file && file.size) imageDataUrl = await U().readFileAsDataURL(file);

      const coffee = {
        id: editId || U().uid("cafe"),
        name: String(fd.get("name")),
        farmer: String(fd.get("farmer")),
        zone: getChipValueByName(form, "zone"),
        process: getChipValueByName(form, "process"),
        fermentation: String(fd.get("fermentation") || ""),
        form: getChipValueByName(form, "form"),
        pricePerKg: Number(fd.get("pricePerKg")),
        transportIncluded: getChipValueByName(form, "transportIncluded") === "yes",
        transportPerKg: Number(fd.get("transportPerKg") || 0),
        notes: String(fd.get("notes") || ""),
        imageDataUrl,
        active: true,
        createdAt: Date.now(),
        supplierId: U().getState().suppliers[0]?.id || null,
      };

      U().setState((s) => {
        const exists = s.coffees.some((c) => c.id === coffee.id);
        let coffees;
        if (exists) {
          coffees = s.coffees.map((c) =>
            c.id === coffee.id
              ? { ...c, ...coffee, imageDataUrl: imageDataUrl || c.imageDataUrl, createdAt: c.createdAt }
              : c
          );
        } else {
          coffees = [coffee, ...s.coffees];
        }
        return { ...s, coffees };
      });

      U().pushNotification({
        type: "produccion",
        title: existsTitle(editId) + coffee.name,
        body: `Variedad ${coffee.name} · ${coffee.zone} · ${U().money(coffee.pricePerKg)}/kg · transporte ${coffee.transportIncluded ? "incluido" : "aparte"}.`,
      });
      U().toast("Variedad guardada");
      BCA.app.refreshBadges();
      renderCafes(root);
    });

    function existsTitle(editId) {
      return editId ? "Café actualizado — " : "Nueva variedad — ";
    }

    root.querySelectorAll("[data-edit-coffee]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const c = U().findCoffee(btn.dataset.editCoffee);
        if (!c) return;
        form.name.value = c.name;
        form.farmer.value = c.farmer;
        form.fermentation.value = c.fermentation || "";
        form.pricePerKg.value = c.pricePerKg;
        form.transportPerKg.value = c.transportPerKg || 0;
        form.notes.value = c.notes || "";
        form.editId.value = c.id;
        setChip(form, "zone", c.zone);
        setChip(form, "process", c.process);
        setChip(form, "form", c.form);
        setChip(form, "transportIncluded", c.transportIncluded ? "yes" : "no");
        form.querySelector("#transport-field").style.opacity = c.transportIncluded ? "0.45" : "1";
        form.scrollIntoView({ behavior: "smooth" });
      });
    });
  }

  function setChip(root, name, value) {
    const group = root.querySelector(`[data-chip-group="${name}"]`);
    if (!group) return;
    group.querySelectorAll(".chip").forEach((c) => {
      c.classList.toggle("is-active", c.dataset.value === String(value));
    });
  }

  /* ---------- INVENTARIO ---------- */
  function renderInventario(root) {
    const state = U().getState();
    root.innerHTML = `
      <div class="panel" style="margin-bottom:1rem">
        <div class="panel-head">
          <h3>Inventario & conversión</h3>
          <button class="btn btn-secondary btn-sm" id="btn-roast-convert">Simular tostión de lote</button>
        </div>
        <p class="muted" style="margin:0">Compra en verde → merma tostión + selección. Compra en pergamino → trilla + tostión + selección.</p>
      </div>
      <div class="table-wrap panel" style="padding:0;overflow:hidden">
        <table class="data">
          <thead>
            <tr><th>Café</th><th>Forma lote</th><th>Comprado</th><th>Verde disp.</th><th>Tostado disp.</th><th>Costo u.</th><th>Notas</th></tr>
          </thead>
          <tbody>
            ${state.inventory
              .map((i) => {
                const c = U().findCoffee(i.coffeeId);
                return `<tr>
                  <td><strong>${c?.name || "—"}</strong></td>
                  <td>${i.form}</td>
                  <td class="mono">${U().num(i.kgPurchased, 1)} kg</td>
                  <td class="mono">${U().num(i.kgAvailableGreen, 1)} kg</td>
                  <td class="mono">${U().num(i.kgAvailableRoasted, 1)} kg</td>
                  <td class="mono">${U().money(i.unitCost)}</td>
                  <td class="muted">${i.notes || ""}</td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    root.querySelector("#btn-roast-convert").addEventListener("click", () => {
      openRoastModal();
    });
  }

  function openRoastModal() {
    const state = U().getState();
    const body = document.getElementById("modal-generic-body");
    const modal = document.getElementById("modal-generic");
    body.innerHTML = `
      <h3>Convertir a tostado</h3>
      <p class="modal__lead">Selecciona un lote con stock verde/pergamino y la cantidad a procesar.</p>
      <label class="field"><span>Lote</span>
        <select class="select" id="roast-lot">
          ${state.inventory
            .filter((i) => i.kgAvailableGreen > 0)
            .map((i) => {
              const c = U().findCoffee(i.coffeeId);
              return `<option value="${i.id}">${c?.name || i.id} — ${U().num(i.kgAvailableGreen, 1)} kg (${i.form})</option>`;
            })
            .join("")}
        </select>
      </label>
      <label class="field" style="margin-top:.75rem"><span>Kilogramos a procesar</span><input class="input" type="number" id="roast-kg" step="0.1" /></label>
      <div class="modal__actions">
        <button class="btn btn-ghost" data-close-modal>Cancelar</button>
        <button class="btn btn-primary" id="btn-do-roast">Procesar</button>
      </div>
    `;
    modal.hidden = false;
    body.querySelector("#btn-do-roast").addEventListener("click", () => {
      const lotId = body.querySelector("#roast-lot").value;
      const kg = Number(body.querySelector("#roast-kg").value);
      if (!lotId || !kg) return U().toast("Completa lote y kilos");
      const costs = U().getState().costs;
      U().setState((s) => {
        const inv = s.inventory.map((i) => {
          if (i.id !== lotId) return i;
          if (kg > i.kgAvailableGreen) {
            U().toast("No hay suficiente stock");
            return i;
          }
          const out = C().roastFromGreen(kg, i.form, costs);
          return {
            ...i,
            kgAvailableGreen: i.kgAvailableGreen - kg,
            kgAvailableRoasted: (i.kgAvailableRoasted || 0) + out,
          };
        });
        return { ...s, inventory: inv };
      });
      U().pushNotification({
        type: "produccion",
        title: "Lote tostado",
        body: `Se procesaron ${kg} kg. Mermas aplicadas según forma del lote.`,
      });
      modal.hidden = true;
      U().toast("Conversión registrada");
      BCA.app.navigate("inventario");
    });
  }

  /* ---------- COTIZACIONES ---------- */
  function renderCotizaciones(root) {
    const state = U().getState();
    const defaultCoffee = state.coffees[0]?.id || "";
    const defaultClient = state.clients[0]?.id || "";

    root.innerHTML = `
      <div class="grid grid-2">
        <div class="panel">
          <h3>Nueva cotización</h3>
          <form id="form-quote" class="stack">
            <label class="field"><span>Cliente</span>
              <select class="select" name="clientId" required>
                ${state.clients.map((c) => `<option value="${c.id}" ${c.id === defaultClient ? "selected" : ""}>${c.name} — ${c.city}</option>`).join("")}
              </select>
            </label>
            <label class="field"><span>Café</span>
              <select class="select" name="coffeeId" required>
                ${state.coffees.map((c) => `<option value="${c.id}" ${c.id === defaultCoffee ? "selected" : ""}>${c.name} (${U().money(c.pricePerKg)}/kg)</option>`).join("")}
              </select>
            </label>
            <div>
              <div class="muted" style="margin-bottom:.4rem;font-size:.82rem">Tipo de cliente</div>
              ${chipGroup("clientType", BCA.CLIENT_TYPES, "final")}
            </div>
            <div>
              <div class="muted" style="margin-bottom:.4rem;font-size:.82rem">Empaque</div>
              ${chipGroup(
                "packageId",
                BCA.PACKAGES.map((p) => ({ id: p.id, label: p.label })),
                "250g"
              )}
            </div>
            <div>
              <div class="muted" style="margin-bottom:.4rem;font-size:.82rem">Margen de ganancia</div>
              ${chipGroup(
                "margin",
                BCA.MARGINS.map((m) => ({ id: String(m), label: `${m}%` })),
                "35"
              )}
            </div>
            <label class="field"><span>Cantidad a entregar (kg tostado/seleccionado)</span><input class="input" type="number" name="qty" value="5" min="0.1" step="0.1" required /></label>
            <div>
              <div class="muted" style="margin-bottom:.4rem;font-size:.82rem">¿Este café tiene transporte aparte?</div>
              ${chipGroup(
                "askTransport",
                [
                  { id: "included", label: "Incluido en precio" },
                  { id: "extra", label: "Cobrar transporte" },
                ],
                "included"
              )}
            </div>
            <label class="field" id="q-transport-field"><span>Transporte COP/kg</span><input class="input" type="number" name="transportPerKg" value="0" /></label>
            <div class="quote-summary" id="quote-live"></div>
            <div class="row">
              <button type="button" class="btn btn-secondary" id="btn-preview-quote">Recalcular</button>
              <button type="submit" class="btn btn-primary">Guardar + PDF</button>
            </div>
          </form>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>Historial</h3></div>
          ${
            state.quotes.length
              ? `<div class="table-wrap"><table class="data">
                <thead><tr><th>Fecha</th><th>Cliente</th><th>Café</th><th>Total</th><th></th></tr></thead>
                <tbody>
                  ${state.quotes
                    .map((q) => {
                      const cl = U().findClient(q.clientId);
                      const cf = U().findCoffee(q.coffeeId);
                      return `<tr>
                        <td>${q.date}</td>
                        <td>${cl?.name || "—"}</td>
                        <td>${cf?.name || "—"}</td>
                        <td class="mono">${U().money(q.sellingTotal)}</td>
                        <td><button class="btn btn-ghost btn-sm" data-pdf="${q.id}">PDF</button></td>
                      </tr>`;
                    })
                    .join("")}
                </tbody></table></div>`
              : `<div class="empty">Aún no hay cotizaciones. Genera la primera para La Chocolatada.</div>`
          }
        </div>
      </div>
    `;

    const form = root.querySelector("#form-quote");
    bindChips(form, () => updateLive());
    form.addEventListener("input", updateLive);
    form.addEventListener("change", updateLive);
    form.querySelector("#btn-preview-quote").addEventListener("click", updateLive);
    updateLive();

    function buildCalc() {
      const fd = new FormData(form);
      const coffee = U().findCoffee(String(fd.get("coffeeId")));
      const client = U().findClient(String(fd.get("clientId")));
      const ask = getChipValueByName(form, "askTransport");
      const calc = C().calculateQuote({
        coffee,
        costs: U().getState().costs,
        packageId: getChipValueByName(form, "packageId"),
        marginPercent: Number(getChipValueByName(form, "margin")),
        quantityKg: Number(fd.get("qty")),
        clientType: getChipValueByName(form, "clientType") || client?.type || "final",
        overrideTransportIncluded: ask === "included",
        overrideTransportPerKg: Number(fd.get("transportPerKg") || 0),
      });
      return { calc, coffee, client, fd };
    }

    function updateLive() {
      const ask = getChipValueByName(form, "askTransport");
      form.querySelector("#q-transport-field").style.opacity = ask === "extra" ? "1" : "0.45";
      const { calc } = buildCalc();
      const box = form.querySelector("#quote-live");
      box.innerHTML = `
        <div class="line"><span>Café (con merma)</span><span>${U().money(calc.lines.cafe)}</span></div>
        <div class="line"><span>Transporte</span><span>${U().money(calc.lines.transporte)}</span></div>
        <div class="line"><span>Tostión</span><span>${U().money(calc.lines.tostion)}</span></div>
        <div class="line"><span>Selección</span><span>${U().money(calc.lines.seleccion)}</span></div>
        <div class="line"><span>Empaque</span><span>${U().money(calc.lines.empaque)}</span></div>
        <div class="line"><span>Etiquetas</span><span>${U().money(calc.lines.etiquetas)}</span></div>
        <div class="line"><span>Alza</span><span>${U().money(calc.lines.alza)}</span></div>
        <div class="line"><span>Costo producción</span><span>${U().money(calc.productionTotal)}</span></div>
        <div class="line"><span>Rendimiento</span><span>${U().num(calc.yieldPercent, 1)}% · input ${U().num(calc.inputKg, 2)} kg</span></div>
        <div class="line total"><span>Precio venta (${calc.marginPercent}%)</span><span>${U().money(calc.sellingTotal)}</span></div>
        <div class="line"><span>Por kg / por unidad</span><span>${U().money(calc.pricePerKg)} · ${U().money(calc.pricePerUnit)}</span></div>
      `;
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const { calc, coffee, client } = buildCalc();
      const quote = {
        id: U().uid("q"),
        date: U().today(),
        clientId: client.id,
        coffeeId: coffee.id,
        ...calc,
        createdBy: U().currentUser()?.name,
        createdAt: Date.now(),
      };
      U().setState((s) => ({ ...s, quotes: [quote, ...s.quotes] }));
      const n = U().pushNotification({
        type: "cotizacion",
        title: `Cotización ${quote.id} — ${client.name}`,
        body: `${coffee.name} · ${calc.quantityKg} kg · ${calc.packageLabel} · Total ${U().money(calc.sellingTotal)} (margen ${calc.marginPercent}%).`,
      });
      await generateQuotePdf(quote);
      if (n.mailto) {
        /* mailto disponible en notificaciones */
      }
      U().toast("Cotización guardada y PDF generado");
      BCA.app.refreshBadges();
      renderCotizaciones(root);
    });

    root.querySelectorAll("[data-pdf]").forEach((b) =>
      b.addEventListener("click", () => {
        const q = U().getState().quotes.find((x) => x.id === b.dataset.pdf);
        if (q) generateQuotePdf(q);
      })
    );
  }

  async function generateQuotePdf(quote) {
    const coffee = U().findCoffee(quote.coffeeId);
    const client = U().findClient(quote.clientId);
    const brand = U().getState().branding;
    const root = document.getElementById("pdf-root");
    root.innerHTML = `
      <div class="pdf-doc">
        <h1>${brand.companyName || "Black Coffee"}</h1>
        <h2>Cotización ${quote.id} · ${quote.date}</h2>
        <div class="pdf-meta">
          <div>
            <strong>Cliente</strong><br/>
            ${client?.name || "—"}<br/>
            ${client?.city || ""} · ${client?.type === "mayorista" ? "Mayorista" : "Cliente final"}
          </div>
          <div>
            <strong>Producto</strong><br/>
            ${coffee?.name || "—"}<br/>
            ${coffee?.zone || ""} · ${coffee?.process || ""} · ${coffee?.fermentation || ""}
          </div>
        </div>
        <table class="pdf-table">
          <thead><tr><th>Concepto</th><th>Detalle</th><th>Valor</th></tr></thead>
          <tbody>
            <tr><td>Café (input con merma)</td><td>${U().num(quote.inputKg, 2)} kg @ ${U().money(coffee.pricePerKg)}</td><td>${U().money(quote.lines.cafe)}</td></tr>
            <tr><td>Transporte</td><td>${quote.transportIncluded ? "Incluido" : U().money(quote.transportPerKg) + "/kg"}</td><td>${U().money(quote.lines.transporte)}</td></tr>
            <tr><td>Tostión</td><td>${quote.quantityKg} kg</td><td>${U().money(quote.lines.tostion)}</td></tr>
            <tr><td>Selección</td><td>${quote.quantityKg} kg</td><td>${U().money(quote.lines.seleccion)}</td></tr>
            <tr><td>Empaque</td><td>${quote.packageLabel} · ${U().num(quote.units, 1)} und</td><td>${U().money(quote.lines.empaque)}</td></tr>
            <tr><td>Etiquetas</td><td>${U().num(quote.units, 1)} und</td><td>${U().money(quote.lines.etiquetas)}</td></tr>
            <tr><td>Alza</td><td>${quote.lines.alza ? "Activa" : "Inactiva"}</td><td>${U().money(quote.lines.alza)}</td></tr>
            <tr><td colspan="2"><strong>Costo de producción</strong></td><td><strong>${U().money(quote.productionTotal)}</strong></td></tr>
            <tr><td colspan="2"><strong>Margen ${quote.marginPercent}%</strong></td><td><strong>${U().money(quote.profit)}</strong></td></tr>
          </tbody>
        </table>
        <div class="pdf-total">
          <strong>Total cotizado: ${U().money(quote.sellingTotal)}</strong><br/>
          Precio/kg: ${U().money(quote.pricePerKg)} · Precio/unidad: ${U().money(quote.pricePerUnit)}
        </div>
        <div class="pdf-foot">
          Documento generado por Black Coffee Administration · ${quote.createdBy || ""} · Notificaciones: ${BCA.NOTIFY_EMAIL}<br/>
          Rendimiento estimado ${U().num(quote.yieldPercent, 1)}% sobre forma ${quote.form}.
        </div>
      </div>
    `;

    if (typeof html2pdf === "undefined") {
      U().toast("PDF no disponible (cdn). Usa imprimir del navegador.");
      window.print();
      return;
    }
    await html2pdf()
      .set({
        margin: 10,
        filename: `cotizacion-${quote.id}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(root.querySelector(".pdf-doc"))
      .save();
  }

  /* ---------- COMPRAS ---------- */
  function renderCompras(root) {
    const state = U().getState();
    root.innerHTML = `
      <div class="grid grid-2">
        <div class="panel">
          <h3>Registro de compra</h3>
          <form id="form-purchase" class="stack">
            <label class="field"><span>Café</span>
              <select class="select" name="coffeeId">${state.coffees.map((c) => `<option value="${c.id}">${c.name}</option>`).join("")}</select>
            </label>
            <label class="field"><span>Proveedor</span>
              <select class="select" name="supplierId">${state.suppliers.map((s) => `<option value="${s.id}">${s.name} · ${s.zone}</option>`).join("")}</select>
            </label>
            <label class="field"><span>Kilogramos</span><input class="input" type="number" name="kg" value="50" step="0.1" required /></label>
            <label class="field"><span>Precio / kg</span><input class="input" type="number" name="unitPrice" value="33000" required /></label>
            <div>
              <div class="muted" style="margin-bottom:.4rem;font-size:.82rem">Transporte</div>
              ${chipGroup(
                "transportIncluded",
                [
                  { id: "yes", label: "Incluido" },
                  { id: "no", label: "Aparte" },
                ],
                "yes"
              )}
            </div>
            <label class="field"><span>Transporte total (si aparte)</span><input class="input" type="number" name="transportTotal" value="0" /></label>
            <label class="field"><span>Fecha</span><input class="input" type="date" name="date" value="${U().today()}" /></label>
            <label class="field"><span>Notas</span><textarea class="textarea" name="notes" rows="2"></textarea></label>
            <button class="btn btn-primary" type="submit">Registrar compra</button>
          </form>
        </div>
        <div class="panel">
          <h3>Historial de compras</h3>
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>Fecha</th><th>Café</th><th>Kg</th><th>Total</th></tr></thead>
              <tbody>
                ${state.purchases
                  .map((p) => {
                    const c = U().findCoffee(p.coffeeId);
                    return `<tr><td>${p.date}</td><td>${c?.name || "—"}</td><td class="mono">${U().num(p.kg, 1)}</td><td class="mono">${U().money(p.total)}</td></tr>`;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    const form = root.querySelector("#form-purchase");
    bindChips(form);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const coffee = U().findCoffee(String(fd.get("coffeeId")));
      const kg = Number(fd.get("kg"));
      const unitPrice = Number(fd.get("unitPrice"));
      const transportIncluded = getChipValueByName(form, "transportIncluded") === "yes";
      const transportTotal = transportIncluded ? 0 : Number(fd.get("transportTotal") || 0);
      const total = kg * unitPrice + transportTotal;
      const purchase = {
        id: U().uid("pur"),
        coffeeId: coffee.id,
        supplierId: String(fd.get("supplierId")),
        kg,
        form: coffee.form,
        unitPrice,
        transportIncluded,
        transportTotal,
        total,
        date: String(fd.get("date")),
        notes: String(fd.get("notes") || ""),
      };
      const inv = {
        id: U().uid("inv"),
        coffeeId: coffee.id,
        form: coffee.form,
        kgPurchased: kg,
        ...C().processPurchaseToInventory(purchase, coffee, U().getState().costs),
        purchasedAt: Date.now(),
        unitCost: unitPrice,
        notes: purchase.notes,
      };
      U().setState((s) => ({
        ...s,
        purchases: [purchase, ...s.purchases],
        inventory: [inv, ...s.inventory],
      }));
      const n = U().pushNotification({
        type: "compra",
        title: `Compra registrada — ${coffee.name}`,
        body: `${kg} kg a ${U().money(unitPrice)} · Total ${U().money(total)}. Transporte ${transportIncluded ? "incluido" : "aparte"}.`,
      });
      if (n.mailto) window.open(n.mailto, "_blank");
      U().toast("Compra e inventario actualizados");
      BCA.app.refreshBadges();
      // low stock clear naturally
      renderCompras(root);
    });
  }

  /* ---------- VENTAS ---------- */
  function renderVentas(root) {
    const state = U().getState();
    root.innerHTML = `
      <div class="grid grid-2">
        <div class="panel">
          <h3>Registro de venta</h3>
          <form id="form-sale" class="stack">
            <label class="field"><span>Cliente</span>
              <select class="select" name="clientId">${state.clients.map((c) => `<option value="${c.id}">${c.name}</option>`).join("")}</select>
            </label>
            <label class="field"><span>Café</span>
              <select class="select" name="coffeeId">${state.coffees.map((c) => `<option value="${c.id}">${c.name}</option>`).join("")}</select>
            </label>
            <label class="field"><span>Kg vendidos (tostado)</span><input class="input" type="number" name="kg" value="1" step="0.1" required /></label>
            <label class="field"><span>Precio total</span><input class="input" type="number" name="total" required placeholder="COP" /></label>
            <label class="field"><span>Fecha</span><input class="input" type="date" name="date" value="${U().today()}" /></label>
            <label class="field"><span>Notas</span><textarea class="textarea" name="notes" rows="2"></textarea></label>
            <button class="btn btn-primary" type="submit">Registrar venta</button>
          </form>
        </div>
        <div class="panel">
          <h3>Ventas</h3>
          ${
            state.sales.length
              ? `<div class="table-wrap"><table class="data">
                <thead><tr><th>Fecha</th><th>Cliente</th><th>Kg</th><th>Total</th></tr></thead>
                <tbody>${state.sales
                  .map((s) => {
                    const cl = U().findClient(s.clientId);
                    return `<tr><td>${s.date}</td><td>${cl?.name || "—"}</td><td class="mono">${U().num(s.kg, 1)}</td><td class="mono">${U().money(s.total)}</td></tr>`;
                  })
                  .join("")}</tbody></table></div>`
              : `<div class="empty">Sin ventas aún.</div>`
          }
        </div>
      </div>
    `;
    root.querySelector("#form-sale").addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const coffeeId = String(fd.get("coffeeId"));
      const kg = Number(fd.get("kg"));
      const sale = {
        id: U().uid("sale"),
        clientId: String(fd.get("clientId")),
        coffeeId,
        kg,
        total: Number(fd.get("total")),
        date: String(fd.get("date")),
        notes: String(fd.get("notes") || ""),
      };

      let ok = true;
      U().setState((s) => {
        let remaining = kg;
        const inventory = s.inventory.map((i) => {
          if (i.coffeeId !== coffeeId || remaining <= 0) return i;
          const take = Math.min(i.kgAvailableRoasted || 0, remaining);
          remaining -= take;
          return { ...i, kgAvailableRoasted: (i.kgAvailableRoasted || 0) - take };
        });
        if (remaining > 0) {
          ok = false;
          return s;
        }
        return { ...s, sales: [sale, ...s.sales], inventory };
      });

      if (!ok) {
        U().toast("Stock tostado insuficiente. Procesa tostión primero.");
        return;
      }

      U().pushNotification({
        type: "venta",
        title: `Venta — ${U().findClient(sale.clientId)?.name}`,
        body: `${kg} kg de ${U().findCoffee(coffeeId)?.name} · ${U().money(sale.total)}`,
      });

      const alerts = U().checkLowStock();
      alerts.forEach((a) => {
        if (a.coffee.id === coffeeId) {
          U().pushNotification({
            type: "produccion",
            title: `Stock bajo tras venta — ${a.coffee.name}`,
            body: `Quedan ${U().num(a.total, 1)} kg. Generar nueva compra de café.`,
          });
        }
      });

      U().toast("Venta registrada");
      BCA.app.refreshBadges();
      renderVentas(root);
    });
  }

  /* ---------- CLIENTES ---------- */
  function renderClientes(root) {
    const state = U().getState();
    root.innerHTML = `
      <div class="grid grid-2">
        <div class="panel">
          <h3>Agregar cliente</h3>
          <form id="form-client" class="stack">
            <label class="field"><span>Nombre</span><input class="input" name="name" required placeholder="La Chocolatada" /></label>
            <label class="field"><span>Ciudad</span><input class="input" name="city" required placeholder="Cali" /></label>
            <div>
              <div class="muted" style="margin-bottom:.4rem;font-size:.82rem">Tipo</div>
              ${chipGroup("type", BCA.CLIENT_TYPES, "final")}
            </div>
            <label class="field"><span>Email</span><input class="input" name="email" type="email" /></label>
            <label class="field"><span>Teléfono</span><input class="input" name="phone" /></label>
            <label class="field"><span>Notas</span><textarea class="textarea" name="notes" rows="2"></textarea></label>
            <button class="btn btn-primary" type="submit">Guardar cliente</button>
          </form>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>Clientes</h3><span class="tag">${state.clients.length}</span></div>
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>Nombre</th><th>Ciudad</th><th>Tipo</th><th></th></tr></thead>
              <tbody>
                ${state.clients
                  .map(
                    (c) => `<tr>
                      <td><strong>${c.name}</strong><br/><span class="muted">${c.notes || ""}</span></td>
                      <td>${c.city}</td>
                      <td><span class="tag">${c.type === "mayorista" ? "Mayorista" : "Final"}</span></td>
                      <td><button class="btn btn-ghost btn-sm" data-quote-client="${c.id}">Cotizar</button></td>
                    </tr>`
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    const form = root.querySelector("#form-client");
    bindChips(form);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const client = {
        id: U().uid("cli"),
        name: String(fd.get("name")),
        city: String(fd.get("city")),
        type: getChipValueByName(form, "type") || "final",
        email: String(fd.get("email") || ""),
        phone: String(fd.get("phone") || ""),
        notes: String(fd.get("notes") || ""),
        contact: "",
        createdAt: Date.now(),
      };
      U().setState((s) => ({ ...s, clients: [client, ...s.clients] }));
      U().toast("Cliente agregado");
      renderClientes(root);
    });
    root.querySelectorAll("[data-quote-client]").forEach((b) =>
      b.addEventListener("click", () => {
        sessionStorage.setItem("bca_pref_client", b.dataset.quoteClient);
        BCA.app.navigate("cotizaciones");
      })
    );
  }

  /* ---------- PROVEEDORES ---------- */
  function renderProveedores(root) {
    const state = U().getState();
    root.innerHTML = `
      <div class="grid grid-2">
        <div class="panel">
          <h3>Agregar proveedor / caficultor</h3>
          <form id="form-supplier" class="stack">
            <label class="field"><span>Nombre</span><input class="input" name="name" required /></label>
            <div>
              <div class="muted" style="margin-bottom:.4rem;font-size:.82rem">Zona</div>
              ${chipGroup("zone", BCA.ZONES, "Cauca")}
            </div>
            <label class="field"><span>Contacto</span><input class="input" name="contact" /></label>
            <label class="field"><span>Notas</span><textarea class="textarea" name="notes" rows="2"></textarea></label>
            <button class="btn btn-primary" type="submit">Guardar</button>
          </form>
        </div>
        <div class="panel">
          <h3>Proveedores</h3>
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>Nombre</th><th>Zona</th><th>Notas</th></tr></thead>
              <tbody>
                ${state.suppliers
                  .map(
                    (s) => `<tr><td><strong>${s.name}</strong><br/><span class="muted">${s.contact || ""}</span></td><td>${s.zone}</td><td>${s.notes || ""}</td></tr>`
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    const form = root.querySelector("#form-supplier");
    bindChips(form);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const supplier = {
        id: U().uid("prov"),
        name: String(fd.get("name")),
        zone: getChipValueByName(form, "zone"),
        contact: String(fd.get("contact") || ""),
        notes: String(fd.get("notes") || ""),
        createdAt: Date.now(),
      };
      U().setState((s) => ({ ...s, suppliers: [supplier, ...s.suppliers] }));
      U().toast("Proveedor guardado");
      renderProveedores(root);
    });
  }

  /* ---------- NOTIFICACIONES ---------- */
  function renderNotificaciones(root) {
    const state = U().getState();
    root.innerHTML = `
      <div class="panel">
        <div class="panel-head">
          <h3>Centro de notificaciones</h3>
          <div class="row">
            <span class="muted">Destino: ${BCA.NOTIFY_EMAIL}</span>
            <button class="btn btn-secondary btn-sm" id="btn-mark-read">Marcar leídas</button>
          </div>
        </div>
        <div class="stack">
          ${
            state.notifications.length
              ? state.notifications
                  .map(
                    (n) => `
              <div class="alert ${n.read ? "" : "alert--warn"}">
                <div class="row">
                  <span class="tag tag--dark">${n.type}</span>
                  <strong>${n.title}</strong>
                  <span class="spacer"></span>
                  <span class="muted">${new Date(n.createdAt).toLocaleString("es-CO")}</span>
                </div>
                <p style="margin:.55rem 0">${n.body}</p>
                ${n.mailto ? `<a class="btn btn-ghost btn-sm" href="${n.mailto}">Abrir correo</a>` : `<a class="btn btn-ghost btn-sm" href="mailto:${BCA.NOTIFY_EMAIL}?subject=${encodeURIComponent(n.title)}&body=${encodeURIComponent(n.body)}">Abrir correo</a>`}
              </div>`
                  )
                  .join("")
              : `<div class="empty">Sin notificaciones</div>`
          }
        </div>
      </div>
    `;
    root.querySelector("#btn-mark-read")?.addEventListener("click", () => {
      U().markAllRead();
      BCA.app.refreshBadges();
      renderNotificaciones(root);
    });
  }

  /* ---------- BRANDING ---------- */
  function renderBranding(root) {
    const b = U().getState().branding;
    root.innerHTML = `
      <div class="panel">
        <h3>Branding y parámetros visuales</h3>
        <p class="muted">Sube el logo cuando esté listo. Paleta base: blanco, negro y gris.</p>
        <form id="form-brand" class="stack">
          <div class="dropzone">
            <strong>Logo de la plataforma</strong>
            <p class="muted">PNG o JPG recomendado. Se guarda en este navegador.</p>
            <input type="file" name="logo" accept="image/*" />
            ${b.logoDataUrl ? `<img src="${b.logoDataUrl}" alt="Logo" style="max-height:80px;margin:1rem auto 0;filter:none" />` : ""}
          </div>
          <label class="field"><span>Nombre comercial</span><input class="input" name="companyName" value="${b.companyName || ""}" /></label>
          <label class="field"><span>Tagline</span><input class="input" name="tagline" value="${b.tagline || ""}" /></label>
          <label class="field"><span>URL imagen hero dashboard</span><input class="input" name="heroUrl" value="${b.heroUrl || ""}" /></label>
          <div class="grid grid-2">
            <label class="field"><span>Color acento</span><input class="input" type="color" name="accent" value="${b.accent || "#111111"}" /></label>
            <label class="field"><span>Fondo</span><input class="input" type="color" name="background" value="${b.background || "#f3f3f1"}" /></label>
          </div>
          <div class="row">
            <button class="btn btn-primary" type="submit">Guardar branding</button>
            <button class="btn btn-ghost" type="button" id="btn-reset-data">Restablecer datos demo</button>
          </div>
        </form>
      </div>
    `;
    root.querySelector("#form-brand").addEventListener("submit", async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      let logoDataUrl = b.logoDataUrl;
      const file = fd.get("logo");
      if (file && file.size) logoDataUrl = await U().readFileAsDataURL(file);
      U().setState((s) => ({
        ...s,
        branding: {
          ...s.branding,
          logoDataUrl,
          companyName: String(fd.get("companyName")),
          tagline: String(fd.get("tagline")),
          heroUrl: String(fd.get("heroUrl")),
          accent: String(fd.get("accent")),
          background: String(fd.get("background")),
        },
      }));
      U().applyBranding();
      U().toast("Branding actualizado");
      renderBranding(root);
    });
    root.querySelector("#btn-reset-data").addEventListener("click", () => {
      if (!confirm("¿Restablecer todos los datos de demostración?")) return;
      const seeded = BCA.seedState();
      U().setState(seeded);
      U().applyBranding();
      U().toast("Datos demo restablecidos");
      BCA.app.navigate("dashboard");
    });
  }

  BCA.views = {
    dashboard: renderDashboard,
    costos: renderCostos,
    cafes: renderCafes,
    inventario: renderInventario,
    cotizaciones: renderCotizaciones,
    compras: renderCompras,
    ventas: renderVentas,
    clientes: renderClientes,
    proveedores: renderProveedores,
    notificaciones: renderNotificaciones,
    branding: renderBranding,
    costsFormHtml,
    readCostsForm,
    generateQuotePdf,
  };
})();
