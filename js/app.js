/* Black Coffee Administration — app controller */
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  let state = BC.Storage.load();
  let currentView = "dashboard";
  let pendingQuoteClientId = null;
  let pendingQuoteCoffeeId = null;

  const loginScreen = $("#login-screen");
  const appEl = $("#app");
  const content = $("#content");
  const modalRoot = $("#modal-root");
  const modalTitle = $("#modal-title");
  const modalBody = $("#modal-body");
  const modalFooter = $("#modal-footer");

  function toast(title, message) {
    const root = $("#toast-root");
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = `<strong>${BC.escapeHtml(title)}</strong><p>${BC.escapeHtml(message)}</p>`;
    root.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  function persist() {
    BC.Storage.save(state);
  }

  function applyAppearance() {
    const a = state.appearance;
    document.documentElement.style.setProperty("--bg", a.primaryBg || "#0a0a0a");
    const logos = [document.getElementById("login-logo"), document.getElementById("app-logo")];
    logos.forEach((el) => {
      if (!el) return;
      if (a.logoDataUrl) {
        el.style.backgroundImage = `url('${a.logoDataUrl}')`;
        el.style.color = "transparent";
        el.textContent = "";
      } else {
        el.style.backgroundImage = "";
        el.style.color = "";
        el.textContent = "BC";
      }
    });
  }

  function updateNotifBadge() {
    const n = BC.Notify.unreadCount(state);
    const badge = $("#notif-badge");
    if (n > 0) {
      badge.hidden = false;
      badge.textContent = String(n);
    } else {
      badge.hidden = true;
    }
  }

  function setUserChrome(user) {
    $("#user-name").textContent = user.name;
    $("#user-role").textContent = user.role;
    $("#user-avatar").textContent = user.initials;
  }

  function navigate(view) {
    currentView = view;
    $$(".nav-item").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === view);
    });
    const [title, subtitle] = BC.Views.titles[view] || ["Black Coffee", ""];
    $("#view-title").textContent = title;
    $("#view-subtitle").textContent = subtitle;
    const renderer = BC.Views[view];
    content.innerHTML = renderer ? renderer(state) : "<p>Vista no encontrada</p>";
    updateNotifBadge();
    $("#sidebar").classList.remove("open");
  }

  function openModal({ title, body, footer }) {
    modalTitle.textContent = title;
    modalBody.innerHTML = body;
    modalFooter.innerHTML = footer || "";
    modalRoot.hidden = false;
  }

  function closeModal() {
    modalRoot.hidden = true;
    modalBody.innerHTML = "";
    modalFooter.innerHTML = "";
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /* ---------- Auth ---------- */
  $("#login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const userId = $("#login-user").value;
    const pass = $("#login-pass").value;
    const err = $("#login-error");
    const user = BC.USERS[userId];
    if (!user || user.password !== pass) {
      err.hidden = false;
      err.textContent = "Usuario o contraseña incorrectos.";
      return;
    }
    err.hidden = true;
    state.session = { userId: user.id, name: user.name, at: new Date().toISOString() };
    persist();
    enterApp(user);
  });

  function enterApp(user) {
    loginScreen.hidden = true;
    appEl.hidden = false;
    setUserChrome(user);
    applyAppearance();
    navigate("dashboard");
    // Pregunta de costos al entrar
    setTimeout(() => promptCostChanges(), 350);
  }

  $("#logout-btn").addEventListener("click", () => {
    state.session = null;
    persist();
    appEl.hidden = true;
    loginScreen.hidden = false;
    $("#login-pass").value = "";
  });

  /* ---------- Cost change prompt ---------- */
  function promptCostChanges() {
    openModal({
      title: "¿Hay algún cambio en los costos de producción?",
      body: `
        <p style="margin-bottom:1rem;color:var(--text-muted)">
          Cada vez que ingresas, confirmamos si tostión, selección, empaque, etiquetas o el costo de alza cambiaron.
        </p>
        <div class="cost-summary">
          <div class="row"><span>Tostión</span><span>${BC.formatCOP(state.costs.tostionPorKg)}/kg</span></div>
          <div class="row"><span>Selección</span><span>${BC.formatCOP(state.costs.seleccionPorKg)}/kg</span></div>
          <div class="row"><span>Empaque 250 / 500 / 5lb</span><span>${BC.formatCOP(state.costs.empaque["250g"])} · ${BC.formatCOP(state.costs.empaque["500g"])} · ${BC.formatCOP(state.costs.empaque["5lb"])}</span></div>
          <div class="row"><span>Etiquetas G / P</span><span>${BC.formatCOP(state.costs.etiquetaGrande)} · ${BC.formatCOP(state.costs.etiquetaPequena)}</span></div>
          <div class="row"><span>Costo de alza</span><span>${state.costs.alzaActiva ? BC.formatCOP(state.costs.costoAlza) + " (activo)" : "Desactivado"}</span></div>
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" data-close-modal>No, todo igual</button>
        <button class="btn btn-primary" id="yes-cost-change">Sí, modificar costos</button>
      `,
    });
    $("#yes-cost-change")?.addEventListener("click", () => {
      closeModal();
      navigate("costos");
      toast("Costos", "Puedes editar y guardar los valores de producción.");
    });
    state.costsPromptSeenAt = new Date().toISOString();
    persist();
  }

  /* ---------- Navigation ---------- */
  $("#main-nav").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-view]");
    if (!btn) return;
    navigate(btn.dataset.view);
  });

  $("#menu-toggle").addEventListener("click", () => {
    $("#sidebar").classList.toggle("open");
  });

  $("#notif-bell").addEventListener("click", () => navigate("notificaciones"));

  $$("[data-quick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.quick === "nueva-cotizacion") openQuoteModal();
    });
  });

  /* ---------- Content actions ---------- */
  content.addEventListener("click", async (e) => {
    const nav = e.target.closest("[data-nav]");
    if (nav) {
      navigate(nav.dataset.nav);
      return;
    }

    const actionBtn = e.target.closest("[data-action]");
    if (!actionBtn) return;
    const action = actionBtn.dataset.action;
    const id = actionBtn.dataset.id;

    switch (action) {
      case "open-quote":
        pendingQuoteCoffeeId = actionBtn.dataset.coffee || null;
        openQuoteModal();
        break;
      case "quote-for-client":
        pendingQuoteClientId = id;
        openQuoteModal();
        break;
      case "open-sale":
        openSaleModal();
        break;
      case "open-purchase":
      case "quick-purchase":
        openPurchaseModal(id || null);
        break;
      case "open-coffee":
        openCoffeeModal();
        break;
      case "edit-coffee":
        openCoffeeModal(id);
        break;
      case "open-client":
        openClientModal();
        break;
      case "open-provider":
        openProviderModal();
        break;
      case "open-process":
        openProcessModal();
        break;
      case "save-costs":
        saveCostsForm();
        break;
      case "save-appearance":
        await saveAppearanceForm();
        break;
      case "reset-data":
        if (confirm("¿Restablecer datos de ejemplo? Se perderán cambios locales.")) {
          state = BC.Storage.reset();
          if (state.session) {
            /* keep session */
          }
          applyAppearance();
          navigate(currentView);
          toast("Datos", "Se restableció el ejemplo Óscar Alejandro + La Chocolatada.");
        }
        break;
      case "mark-read":
        BC.Notify.markAllRead(state);
        navigate("notificaciones");
        break;
      case "pdf-quote":
        await exportQuotePdf(id);
        break;
      case "mail-quote":
        mailQuote(id);
        break;
      case "mail-sale":
        mailSale(id);
        break;
      case "mail-purchase":
        mailPurchase(id);
        break;
      case "mail-restock":
        mailRestock(id);
        break;
      default: {
        const _exhaustive = action;
        console.warn("Acción no manejada", _exhaustive);
      }
    }
  });

  modalRoot.addEventListener("click", (e) => {
    if (e.target.closest("[data-close-modal]")) closeModal();
  });

  /* ---------- Forms: Quote ---------- */
  function openQuoteModal() {
    const clients = state.clients;
    const coffees = state.coffees;
    openModal({
      title: "Nueva cotización",
      body: `
        <form id="quote-form" class="form-grid">
          <label class="field"><span>Cliente</span>
            <select name="clientId" required>
              ${clients.map((c) => `<option value="${c.id}" ${pendingQuoteClientId === c.id ? "selected" : ""}>${BC.escapeHtml(c.name)} (${c.ciudad})</option>`).join("")}
            </select>
          </label>
          <label class="field"><span>Tipo de cliente</span>
            <div class="chip-group" id="tipo-chips">
              ${BC.CATALOGS.tiposCliente.map((t, i) => `<button type="button" class="btn btn-chip ${i === 1 ? "selected" : ""}" data-chip="tipo" data-value="${t.id}">${t.label}</button>`).join("")}
            </div>
            <input type="hidden" name="tipoCliente" value="mayorista" />
          </label>
          <label class="field full"><span>Café</span>
            <select name="coffeeId" required>
              ${coffees.map((c) => `<option value="${c.id}" ${pendingQuoteCoffeeId === c.id ? "selected" : ""}>${BC.escapeHtml(c.nombre)} — ${BC.formatCOP(c.precioKg)}/kg</option>`).join("")}
            </select>
          </label>
          <label class="field"><span>¿Transporte incluido en el precio del café?</span>
            <select name="transporteIncluidoOverride">
              <option value="keep">Usar valor del café</option>
              <option value="yes">Sí, incluido</option>
              <option value="no">No, sumar transporte</option>
            </select>
          </label>
          <label class="field"><span>Transporte $ / kg (si no incluido)</span>
            <input type="number" name="transportePorKg" min="0" step="100" value="0" />
          </label>
          <label class="field full"><span>Formato de empaque</span>
            <div class="chip-group" id="formato-chips">
              ${BC.CATALOGS.formatosEmpaque.map((f, i) => `<button type="button" class="btn btn-chip ${i === 0 ? "selected" : ""}" data-chip="formato" data-value="${f.id}">${f.label}</button>`).join("")}
            </div>
            <input type="hidden" name="formatoId" value="250g" />
          </label>
          <label class="field"><span>Etiqueta</span>
            <div class="chip-group" id="etiq-chips">
              <button type="button" class="btn btn-chip selected" data-chip="etiqueta" data-value="pequena">Pequeña ($500)</button>
              <button type="button" class="btn btn-chip" data-chip="etiqueta" data-value="grande">Grande ($1000)</button>
            </div>
            <input type="hidden" name="etiqueta" value="pequena" />
          </label>
          <label class="field"><span>Margen de ganancia</span>
            <div class="chip-group" id="margen-chips">
              ${BC.CATALOGS.margenes.map((m) => `<button type="button" class="btn btn-chip ${m === 35 ? "selected" : ""}" data-chip="margen" data-value="${m}">${m}%</button>`).join("")}
            </div>
            <input type="hidden" name="margen" value="35" />
          </label>
          <label class="field"><span>Kilos tostados a cotizar</span>
            <input type="number" name="kilos" min="0.25" step="0.25" value="5" required />
          </label>
          <label class="field full"><span>Notas</span>
            <textarea name="notas" rows="2" placeholder="Validez, condiciones de entrega…"></textarea>
          </label>
          <div class="full cost-summary" id="quote-preview">
            <div class="help">Selecciona opciones para ver el desglose…</div>
          </div>
        </form>
      `,
      footer: `
        <button class="btn btn-ghost" data-close-modal>Cancelar</button>
        <button class="btn btn-primary" id="save-quote">Guardar y PDF</button>
      `,
    });

    pendingQuoteClientId = null;
    pendingQuoteCoffeeId = null;

    wireChipGroups();
    const form = $("#quote-form");
    const refresh = () => updateQuotePreview(form);
    form.addEventListener("input", refresh);
    form.addEventListener("change", refresh);
    refresh();

    $("#save-quote").addEventListener("click", async () => {
      const data = new FormData(form);
      const coffee = structuredClone(state.coffees.find((c) => c.id === data.get("coffeeId")));
      if (!coffee) return;

      const override = data.get("transporteIncluidoOverride");
      if (override === "yes") {
        coffee.transporteIncluido = true;
        coffee.transportePorKg = 0;
      } else if (override === "no") {
        coffee.transporteIncluido = false;
        coffee.transportePorKg = Number(data.get("transportePorKg")) || 0;
      }

      const line = BC.Calc.buildQuoteLine({
        coffee,
        costs: state.costs,
        formatoId: data.get("formatoId"),
        etiqueta: data.get("etiqueta"),
        margen: Number(data.get("margen")),
        kilosTostados: Number(data.get("kilos")),
        tipoCliente: data.get("tipoCliente"),
      });

      const quote = {
        id: BC.uid("qt"),
        numero: `COT-${String(state.quotes.length + 1).padStart(4, "0")}`,
        fecha: BC.today(),
        clientId: data.get("clientId"),
        tipoCliente: data.get("tipoCliente"),
        lines: [line],
        total: line.subtotal,
        notas: data.get("notas") || "",
        createdBy: state.session?.name || "Black Coffee",
      };
      state.quotes.unshift(quote);
      persist();

      BC.Notify.push(state, {
        type: "cotizacion",
        title: `Cotización ${quote.numero}`,
        message: `${quote.createdBy} cotizó ${BC.formatCOP(quote.total)} para ${state.clients.find((c) => c.id === quote.clientId)?.name}.`,
        openMail: true,
      });

      closeModal();
      navigate("cotizaciones");
      toast("Cotización creada", `${quote.numero} · ${BC.formatCOP(quote.total)}`);
      try {
        await BC.PDF.quote(quote, state);
      } catch (err) {
        toast("PDF", "No se pudo generar el PDF automáticamente. Usa el botón PDF.");
      }
    });
  }

  function wireChipGroups() {
    $$("[data-chip]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const group = btn.dataset.chip;
        $$(`[data-chip="${group}"]`).forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        const map = {
          tipo: "tipoCliente",
          formato: "formatoId",
          etiqueta: "etiqueta",
          margen: "margen",
          zona: "zona",
          variedad: "variedad",
          proceso: "proceso",
          estado: "estadoCompra",
          rango: "rangoPrecioId",
          tipocli: "tipo",
        };
        const inputName = map[group];
        if (inputName) {
          const input = modalBody.querySelector(`[name="${inputName}"]`);
          if (input) {
            input.value = btn.dataset.value;
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
      });
    });
  }

  function updateQuotePreview(form) {
    const data = new FormData(form);
    const coffee = structuredClone(state.coffees.find((c) => c.id === data.get("coffeeId")));
    if (!coffee) return;
    const override = data.get("transporteIncluidoOverride");
    if (override === "yes") {
      coffee.transporteIncluido = true;
      coffee.transportePorKg = 0;
    } else if (override === "no") {
      coffee.transporteIncluido = false;
      coffee.transportePorKg = Number(data.get("transportePorKg")) || 0;
    }
    const line = BC.Calc.buildQuoteLine({
      coffee,
      costs: state.costs,
      formatoId: data.get("formatoId"),
      etiqueta: data.get("etiqueta"),
      margen: Number(data.get("margen")),
      kilosTostados: Number(data.get("kilos")) || 0,
      tipoCliente: data.get("tipoCliente"),
    });
    const b = line.breakdown;
    $("#quote-preview").innerHTML = `
      <div class="row"><span>Café (ajustado por merma)</span><span class="money">${BC.formatCOP(b.coffeePerRoastedKg)}/kg</span></div>
      <div class="row"><span>Tostión</span><span class="money">${BC.formatCOP(b.tostion)}/kg</span></div>
      <div class="row"><span>Selección</span><span class="money">${BC.formatCOP(b.seleccion)}/kg</span></div>
      <div class="row"><span>Empaque prorrateado</span><span class="money">${BC.formatCOP(b.empaquePorKg)}/kg</span></div>
      <div class="row"><span>Etiqueta prorrateada</span><span class="money">${BC.formatCOP(b.etiquetaPorKg)}/kg</span></div>
      <div class="row"><span>Costo de alza</span><span class="money">${BC.formatCOP(b.alza)}/kg</span></div>
      <div class="row"><span>Costo producción</span><span class="money">${BC.formatCOP(b.unitCost)}/kg</span></div>
      <div class="row"><span>Precio venta (+${line.margen}%)</span><span class="money">${BC.formatCOP(line.precioVentaKg)}/kg</span></div>
      <div class="row"><span>~${line.unidades} unidades</span><span class="money">${BC.formatCOP(line.precioUnidad)}/u</span></div>
      <div class="row total"><span>Total cotización</span><span class="money">${BC.formatCOP(line.subtotal)}</span></div>
    `;
  }

  /* ---------- Sale ---------- */
  function openSaleModal() {
    openModal({
      title: "Registrar venta",
      body: `
        <form id="sale-form" class="form-grid">
          <label class="field"><span>Cliente</span>
            <select name="clientId">${state.clients.map((c) => `<option value="${c.id}">${BC.escapeHtml(c.name)}</option>`).join("")}</select>
          </label>
          <label class="field"><span>Café</span>
            <select name="coffeeId">${state.coffees.map((c) => `<option value="${c.id}">${BC.escapeHtml(c.nombre)}</option>`).join("")}</select>
          </label>
          <label class="field"><span>Kilos tostados vendidos</span>
            <input type="number" name="kilos" min="0.1" step="0.1" value="1" required /></label>
          <label class="field"><span>Precio total ($)</span>
            <input type="number" name="total" min="0" step="100" required /></label>
          <label class="field"><span>Fecha</span>
            <input type="date" name="fecha" value="${BC.today()}" /></label>
          <label class="field full"><span>Notas</span>
            <textarea name="notas" rows="2"></textarea></label>
        </form>
      `,
      footer: `<button class="btn btn-ghost" data-close-modal>Cancelar</button>
               <button class="btn btn-primary" id="save-sale">Guardar venta</button>`,
    });
    $("#save-sale").addEventListener("click", () => {
      const f = new FormData($("#sale-form"));
      const coffeeId = f.get("coffeeId");
      const kilos = Number(f.get("kilos"));
      const coffee = state.coffees.find((c) => c.id === coffeeId);
      if (!coffee) return;
      if ((coffee.stockTostadoKg || 0) < kilos) {
        if (!confirm("No hay suficiente stock tostado. ¿Registrar igual y descontar lo disponible?")) return;
      }
      coffee.stockTostadoKg = Math.max(0, (coffee.stockTostadoKg || 0) - kilos);
      const sale = {
        id: BC.uid("sale"),
        clientId: f.get("clientId"),
        coffeeId,
        kilos,
        total: Number(f.get("total")),
        fecha: f.get("fecha"),
        notas: f.get("notas") || "",
      };
      state.sales.unshift(sale);
      persist();
      BC.Notify.push(state, {
        type: "venta",
        title: "Venta registrada",
        message: `Se vendieron ${kilos} kg de ${coffee.nombre} por ${BC.formatCOP(sale.total)}.`,
        openMail: true,
      });
      // alerta inventario
      const alerts = BC.Notify.checkInventoryAlerts(state);
      if (alerts.some((a) => a.coffee.id === coffeeId)) {
        BC.Notify.push(state, {
          type: "inventario",
          title: "Stock bajo — recompra",
          message: `${coffee.nombre} está bajo el umbral. Genera una nueva compra.`,
          openMail: true,
        });
      }
      closeModal();
      navigate("ventas");
      toast("Venta", "Registro guardado");
    });
  }

  /* ---------- Purchase ---------- */
  function openPurchaseModal(coffeeId) {
    openModal({
      title: "Registrar compra de café",
      body: `
        <form id="purchase-form" class="form-grid">
          <label class="field"><span>Café</span>
            <select name="coffeeId">${state.coffees.map((c) => `<option value="${c.id}" ${c.id === coffeeId ? "selected" : ""}>${BC.escapeHtml(c.nombre)}</option>`).join("")}</select>
          </label>
          <label class="field"><span>Proveedor</span>
            <select name="proveedorId">${state.providers.map((p) => `<option value="${p.id}">${BC.escapeHtml(p.name)}</option>`).join("")}</select>
          </label>
          <label class="field"><span>Kilos comprados</span>
            <input type="number" name="kilos" min="1" step="1" value="50" required /></label>
          <label class="field"><span>Precio $ / kg</span>
            <input type="number" name="precioKg" min="0" step="100" value="33000" required /></label>
          <label class="field full"><span>¿El transporte viene incluido en el precio?</span>
            <div class="chip-group">
              <button type="button" class="btn btn-chip selected" data-chip="trans" data-value="yes">Sí, incluido</button>
              <button type="button" class="btn btn-chip" data-chip="trans" data-value="no">No, tiene costo aparte</button>
            </div>
            <input type="hidden" name="transporteIncluido" value="yes" />
          </label>
          <label class="field"><span>Transporte total ($)</span>
            <input type="number" name="transporteTotal" min="0" step="100" value="0" /></label>
          <label class="field"><span>Fecha</span>
            <input type="date" name="fecha" value="${BC.today()}" /></label>
          <label class="field full"><span>Notas</span>
            <textarea name="notas" rows="2"></textarea></label>
        </form>
      `,
      footer: `<button class="btn btn-ghost" data-close-modal>Cancelar</button>
               <button class="btn btn-primary" id="save-purchase">Guardar compra</button>`,
    });

    $$('[data-chip="trans"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        $$('[data-chip="trans"]').forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        $('[name="transporteIncluido"]').value = btn.dataset.value;
      });
    });

    $("#save-purchase").addEventListener("click", () => {
      const f = new FormData($("#purchase-form"));
      const kilos = Number(f.get("kilos"));
      const precioKg = Number(f.get("precioKg"));
      const incluido = f.get("transporteIncluido") === "yes";
      const transporteTotal = incluido ? 0 : Number(f.get("transporteTotal")) || 0;
      const total = kilos * precioKg + transporteTotal;
      const coffee = state.coffees.find((c) => c.id === f.get("coffeeId"));
      if (!coffee) return;

      coffee.precioKg = precioKg;
      coffee.transporteIncluido = incluido;
      coffee.transportePorKg = incluido || kilos === 0 ? 0 : transporteTotal / kilos;
      coffee.stockVerdeKg = (Number(coffee.stockVerdeKg) || 0) + kilos;

      const purchase = {
        id: BC.uid("pur"),
        coffeeId: coffee.id,
        proveedorId: f.get("proveedorId"),
        kilos,
        precioKg,
        transporteIncluido: incluido,
        transporteTotal,
        total,
        fecha: f.get("fecha"),
        notas: f.get("notas") || "",
      };
      state.purchases.unshift(purchase);
      state.inventoryLots.unshift({
        id: BC.uid("lot"),
        coffeeId: coffee.id,
        estado: coffee.estadoCompra,
        kilosIniciales: kilos,
        kilosDisponibles: kilos,
        fecha: f.get("fecha"),
        notas: f.get("notas") || "Compra",
      });
      persist();
      BC.Notify.push(state, {
        type: "compra",
        title: "Compra de café",
        message: `Ingreso de ${kilos} kg · ${coffee.nombre} · ${BC.formatCOP(total)}. Transporte ${incluido ? "incluido" : "aparte"}.`,
        openMail: true,
      });
      closeModal();
      navigate("compras");
      toast("Compra", "Inventario actualizado");
    });
  }

  /* ---------- Coffee ---------- */
  function openCoffeeModal(editId) {
    const coffee = editId ? state.coffees.find((c) => c.id === editId) : null;
    openModal({
      title: coffee ? "Editar café" : "Agregar variedad de café",
      body: `
        <form id="coffee-form" class="form-grid">
          <label class="field full"><span>Nombre comercial</span>
            <input name="nombre" required value="${BC.escapeHtml(coffee?.nombre || "")}" placeholder="Ej. Óscar Alejandro — Colombia lavado 24h" /></label>
          <label class="field"><span>Caficultor</span>
            <input name="caficultor" required value="${BC.escapeHtml(coffee?.caficultor || "")}" /></label>
          <label class="field"><span>Proveedor</span>
            <select name="proveedorId">${state.providers.map((p) => `<option value="${p.id}" ${coffee?.proveedorId === p.id ? "selected" : ""}>${BC.escapeHtml(p.name)}</option>`).join("")}</select>
          </label>
          <label class="field full"><span>Zona del país</span>
            <div class="chip-group">
              ${BC.CATALOGS.zonas.map((z) => `<button type="button" class="btn btn-chip ${(coffee?.zona || "Cauca") === z ? "selected" : ""}" data-chip="zona" data-value="${z}">${z}</button>`).join("")}
            </div>
            <input type="hidden" name="zona" value="${coffee?.zona || "Cauca"}" />
          </label>
          <label class="field full"><span>Variedad</span>
            <div class="chip-group">
              ${BC.CATALOGS.variedades.map((v) => `<button type="button" class="btn btn-chip ${(coffee?.variedad || "Colombia") === v ? "selected" : ""}" data-chip="variedad" data-value="${v}">${v}</button>`).join("")}
            </div>
            <input type="hidden" name="variedad" value="${coffee?.variedad || "Colombia"}" />
          </label>
          <label class="field full"><span>Proceso</span>
            <div class="chip-group">
              ${BC.CATALOGS.procesos.map((p) => `<button type="button" class="btn btn-chip ${(coffee?.proceso || "Lavado + fermentación 24h") === p ? "selected" : ""}" data-chip="proceso" data-value="${p}">${p}</button>`).join("")}
            </div>
            <input type="hidden" name="proceso" value="${coffee?.proceso || "Lavado + fermentación 24h"}" />
          </label>
          <label class="field full"><span>Estado de compra (define mermas)</span>
            <div class="chip-group">
              ${BC.CATALOGS.estadosCafe.map((e) => `<button type="button" class="btn btn-chip ${(coffee?.estadoCompra || "verde") === e.id ? "selected" : ""}" data-chip="estado" data-value="${e.id}">${e.label}</button>`).join("")}
            </div>
            <input type="hidden" name="estadoCompra" value="${coffee?.estadoCompra || "verde"}" />
          </label>
          <label class="field full"><span>Rango de precio</span>
            <div class="chip-group">
              ${BC.CATALOGS.rangosPrecio.map((r) => `<button type="button" class="btn btn-chip ${(coffee?.rangoPrecioId || "r2") === r.id ? "selected" : ""}" data-chip="rango" data-value="${r.id}">${r.label}</button>`).join("")}
            </div>
            <input type="hidden" name="rangoPrecioId" value="${coffee?.rangoPrecioId || "r2"}" />
          </label>
          <label class="field"><span>Precio $ / kg</span>
            <input type="number" name="precioKg" min="0" step="100" value="${coffee?.precioKg ?? 33000}" required /></label>
          <label class="field"><span>Stock verde inicial (kg)</span>
            <input type="number" name="stockVerdeKg" min="0" step="0.1" value="${coffee?.stockVerdeKg ?? 0}" /></label>
          <label class="field full"><span>¿Transporte incluido?</span>
            <div class="chip-group">
              <button type="button" class="btn btn-chip ${coffee?.transporteIncluido !== false ? "selected" : ""}" data-chip="transc" data-value="yes">Sí</button>
              <button type="button" class="btn btn-chip ${coffee?.transporteIncluido === false ? "selected" : ""}" data-chip="transc" data-value="no">No</button>
            </div>
            <input type="hidden" name="transporteIncluido" value="${coffee?.transporteIncluido !== false ? "yes" : "no"}" />
          </label>
          <label class="field"><span>Transporte $ / kg</span>
            <input type="number" name="transportePorKg" min="0" step="100" value="${coffee?.transportePorKg || 0}" /></label>
          <label class="field full"><span>Imagen del producto</span>
            <input type="file" id="coffee-image" accept="image/*" /></label>
          <label class="field full"><span>Notas</span>
            <textarea name="notas" rows="2">${BC.escapeHtml(coffee?.notas || "")}</textarea></label>
        </form>
      `,
      footer: `<button class="btn btn-ghost" data-close-modal>Cancelar</button>
               <button class="btn btn-primary" id="save-coffee">Guardar café</button>`,
    });
    wireChipGroups();
    $$('[data-chip="transc"]').forEach((btn) => {
      btn.addEventListener("click", () => {
        $$('[data-chip="transc"]').forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        $('[name="transporteIncluido"]').value = btn.dataset.value;
      });
    });

    $("#save-coffee").addEventListener("click", async () => {
      const f = new FormData($("#coffee-form"));
      let imagenDataUrl = coffee?.imagenDataUrl || "";
      const file = $("#coffee-image").files?.[0];
      if (file) imagenDataUrl = await readFileAsDataURL(file);

      const payload = {
        nombre: f.get("nombre"),
        caficultor: f.get("caficultor"),
        proveedorId: f.get("proveedorId"),
        zona: f.get("zona"),
        variedad: f.get("variedad"),
        proceso: f.get("proceso"),
        estadoCompra: f.get("estadoCompra"),
        precioKg: Number(f.get("precioKg")),
        transporteIncluido: f.get("transporteIncluido") === "yes",
        transportePorKg: Number(f.get("transportePorKg")) || 0,
        rangoPrecioId: f.get("rangoPrecioId"),
        imagenDataUrl,
        notas: f.get("notas") || "",
        stockVerdeKg: Number(f.get("stockVerdeKg")) || 0,
        stockTostadoKg: coffee?.stockTostadoKg || 0,
      };

      if (coffee) {
        Object.assign(coffee, payload);
      } else {
        state.coffees.unshift({
          id: BC.uid("cafe"),
          ...payload,
          createdAt: new Date().toISOString(),
        });
      }
      persist();
      closeModal();
      navigate("cafes");
      toast("Café", "Variedad guardada");
    });
  }

  /* ---------- Client / Provider ---------- */
  function openClientModal() {
    openModal({
      title: "Agregar cliente",
      body: `
        <form id="client-form" class="form-grid">
          <label class="field"><span>Nombre</span><input name="name" required placeholder="La Chocolatada" /></label>
          <label class="field"><span>Ciudad</span><input name="ciudad" required placeholder="Cali" /></label>
          <label class="field"><span>Departamento</span><input name="departamento" value="Valle del Cauca" /></label>
          <label class="field full"><span>Tipo</span>
            <div class="chip-group">
              ${BC.CATALOGS.tiposCliente.map((t, i) => `<button type="button" class="btn btn-chip ${i === 1 ? "selected" : ""}" data-chip="tipocli" data-value="${t.id}">${t.label}</button>`).join("")}
            </div>
            <input type="hidden" name="tipo" value="mayorista" />
          </label>
          <label class="field"><span>Email</span><input name="email" type="email" /></label>
          <label class="field"><span>Teléfono</span><input name="telefono" /></label>
          <label class="field full"><span>Notas</span><textarea name="notas" rows="2"></textarea></label>
        </form>
      `,
      footer: `<button class="btn btn-ghost" data-close-modal>Cancelar</button>
               <button class="btn btn-primary" id="save-client">Guardar</button>`,
    });
    wireChipGroups();
    $("#save-client").addEventListener("click", () => {
      const f = new FormData($("#client-form"));
      state.clients.unshift({
        id: BC.uid("cli"),
        name: f.get("name"),
        tipo: f.get("tipo"),
        ciudad: f.get("ciudad"),
        departamento: f.get("departamento"),
        email: f.get("email"),
        telefono: f.get("telefono"),
        notas: f.get("notas") || "",
        createdAt: new Date().toISOString(),
      });
      persist();
      closeModal();
      navigate("clientes");
      toast("Cliente", "Agregado al directorio");
    });
  }

  function openProviderModal() {
    openModal({
      title: "Agregar proveedor",
      body: `
        <form id="provider-form" class="form-grid">
          <label class="field"><span>Nombre</span><input name="name" required /></label>
          <label class="field full"><span>Zona</span>
            <div class="chip-group">
              ${BC.CATALOGS.zonas.map((z, i) => `<button type="button" class="btn btn-chip ${i === 0 ? "selected" : ""}" data-chip="zona" data-value="${z}">${z}</button>`).join("")}
            </div>
            <input type="hidden" name="zona" value="Cauca" />
          </label>
          <label class="field"><span>Email</span><input name="email" type="email" /></label>
          <label class="field"><span>Teléfono</span><input name="telefono" /></label>
          <label class="field full"><span>Notas</span><textarea name="notas" rows="2"></textarea></label>
        </form>
      `,
      footer: `<button class="btn btn-ghost" data-close-modal>Cancelar</button>
               <button class="btn btn-primary" id="save-provider">Guardar</button>`,
    });
    wireChipGroups();
    $("#save-provider").addEventListener("click", () => {
      const f = new FormData($("#provider-form"));
      state.providers.unshift({
        id: BC.uid("prov"),
        name: f.get("name"),
        zona: f.get("zona"),
        email: f.get("email"),
        telefono: f.get("telefono"),
        notas: f.get("notas") || "",
        createdAt: new Date().toISOString(),
      });
      persist();
      closeModal();
      navigate("proveedores");
      toast("Proveedor", "Registrado");
    });
  }

  /* ---------- Process / merma simulator ---------- */
  function openProcessModal() {
    openModal({
      title: "Simular mermas de proceso",
      body: `
        <form id="process-form" class="form-grid">
          <label class="field"><span>Café</span>
            <select name="coffeeId">${state.coffees.map((c) => `<option value="${c.id}">${BC.escapeHtml(c.nombre)}</option>`).join("")}</select>
          </label>
          <label class="field"><span>Kilos a procesar (desde stock verde/pergamino)</span>
            <input type="number" name="kilos" min="0.1" step="0.1" value="10" /></label>
          <div class="full cost-summary" id="process-preview"></div>
        </form>
      `,
      footer: `<button class="btn btn-ghost" data-close-modal>Cerrar</button>
               <button class="btn btn-primary" id="run-process">Aplicar al inventario</button>`,
    });
    const form = $("#process-form");
    const refresh = () => {
      const f = new FormData(form);
      const coffee = state.coffees.find((c) => c.id === f.get("coffeeId"));
      const kg = Number(f.get("kilos")) || 0;
      const out = BC.Calc.yieldRoastedKg(kg, coffee.estadoCompra, state.costs.mermas);
      const m = state.costs.mermas;
      let steps = "";
      if (coffee.estadoCompra === "pergamino") {
        const afterTrilla = kg * (1 - m.trilla / 100);
        const afterRoast = afterTrilla * (1 - m.tostion / 100);
        steps = `
          <div class="row"><span>Entrada pergamino</span><span>${kg.toFixed(2)} kg</span></div>
          <div class="row"><span>Tras trilla (−${m.trilla}%)</span><span>${afterTrilla.toFixed(2)} kg verde</span></div>
          <div class="row"><span>Tras tostión (−${m.tostion}%)</span><span>${afterRoast.toFixed(2)} kg</span></div>
          <div class="row"><span>Tras selección (−${m.seleccion}%)</span><span>${out.toFixed(2)} kg tostado</span></div>`;
      } else if (coffee.estadoCompra === "verde") {
        const afterRoast = kg * (1 - m.tostion / 100);
        steps = `
          <div class="row"><span>Entrada verde</span><span>${kg.toFixed(2)} kg</span></div>
          <div class="row"><span>Tras tostión (−${m.tostion}%)</span><span>${afterRoast.toFixed(2)} kg</span></div>
          <div class="row"><span>Tras selección (−${m.seleccion}%)</span><span>${out.toFixed(2)} kg tostado</span></div>`;
      } else {
        steps = `<div class="row"><span>Ya tostado</span><span>${kg.toFixed(2)} kg</span></div>`;
      }
      $("#process-preview").innerHTML = steps + `<div class="row total"><span>Listo para empaque</span><span>${out.toFixed(2)} kg</span></div>`;
    };
    form.addEventListener("input", refresh);
    form.addEventListener("change", refresh);
    refresh();

    $("#run-process").addEventListener("click", () => {
      const f = new FormData(form);
      const coffee = state.coffees.find((c) => c.id === f.get("coffeeId"));
      const kg = Number(f.get("kilos")) || 0;
      if ((coffee.stockVerdeKg || 0) < kg) {
        toast("Inventario", "No hay suficientes kilos verdes/pergamino.");
        return;
      }
      const out = BC.Calc.yieldRoastedKg(kg, coffee.estadoCompra, state.costs.mermas);
      coffee.stockVerdeKg -= kg;
      coffee.stockTostadoKg = (coffee.stockTostadoKg || 0) + out;
      persist();
      BC.Notify.push(state, {
        type: "produccion",
        title: "Producción / tostión",
        message: `Procesados ${kg} kg de ${coffee.nombre} → ${out.toFixed(2)} kg tostados listos.`,
        openMail: true,
      });
      closeModal();
      navigate("inventario");
      toast("Producción", `${out.toFixed(2)} kg tostados añadidos`);
    });
  }

  /* ---------- Costs / appearance ---------- */
  function saveCostsForm() {
    const form = $("#costs-form");
    if (!form) return;
    const f = new FormData(form);
    state.costs.tostionPorKg = Number(f.get("tostionPorKg"));
    state.costs.seleccionPorKg = Number(f.get("seleccionPorKg"));
    state.costs.empaque["250g"] = Number(f.get("empaque250"));
    state.costs.empaque["500g"] = Number(f.get("empaque500"));
    state.costs.empaque["5lb"] = Number(f.get("empaque5lb"));
    state.costs.etiquetaGrande = Number(f.get("etiquetaGrande"));
    state.costs.etiquetaPequena = Number(f.get("etiquetaPequena"));
    state.costs.costoAlza = Number(f.get("costoAlza"));
    state.costs.alzaActiva = !!form.querySelector('[name="alzaActiva"]')?.checked;
    state.costs.mermas.trilla = Number(f.get("mermaTrilla"));
    state.costs.mermas.tostion = Number(f.get("mermaTostion"));
    state.costs.mermas.seleccion = Number(f.get("mermaSeleccion"));
    state.costs.umbralInventarioKg = Number(f.get("umbralInventarioKg"));
    state.costs.updatedAt = new Date().toISOString();
    persist();
    BC.Notify.push(state, {
      type: "costos",
      title: "Costos de producción actualizados",
      message: `Tostión ${BC.formatCOP(state.costs.tostionPorKg)} · Selección ${BC.formatCOP(state.costs.seleccionPorKg)} · Alza ${state.costs.alzaActiva ? "activa" : "off"}.`,
      openMail: true,
    });
    toast("Costos", "Guardados correctamente");
    navigate("costos");
  }

  async function saveAppearanceForm() {
    const form = $("#appearance-form");
    if (!form) return;
    const f = new FormData(form);
    state.appearance.brandName = f.get("brandName") || "Black Coffee";
    state.appearance.tagline = f.get("tagline") || "";
    const logoFile = $("#logo-file")?.files?.[0];
    const heroFile = $("#hero-file")?.files?.[0];
    if (logoFile) state.appearance.logoDataUrl = await readFileAsDataURL(logoFile);
    if (heroFile) state.appearance.heroDataUrl = await readFileAsDataURL(heroFile);
    persist();
    applyAppearance();
    toast("Apariencia", "Identidad visual actualizada");
    navigate("configuracion");
  }

  /* ---------- Mail helpers ---------- */
  async function exportQuotePdf(id) {
    const quote = state.quotes.find((q) => q.id === id);
    if (!quote) return;
    try {
      await BC.PDF.quote(quote, state);
      toast("PDF", `${quote.numero} descargado`);
    } catch (err) {
      toast("PDF", err.message);
    }
  }

  function mailQuote(id) {
    const quote = state.quotes.find((q) => q.id === id);
    if (!quote) return;
    BC.Notify.push(state, {
      type: "cotizacion",
      title: `Reenvío ${quote.numero}`,
      message: `Cotización por ${BC.formatCOP(quote.total)} — cliente ${state.clients.find((c) => c.id === quote.clientId)?.name}.`,
      openMail: true,
    });
    updateNotifBadge();
  }

  function mailSale(id) {
    const sale = state.sales.find((s) => s.id === id);
    if (!sale) return;
    BC.Notify.push(state, {
      type: "venta",
      title: "Notificación de venta",
      message: `Venta ${BC.formatCOP(sale.total)} · ${sale.kilos} kg · ${sale.fecha}`,
      openMail: true,
    });
  }

  function mailPurchase(id) {
    const p = state.purchases.find((x) => x.id === id);
    if (!p) return;
    BC.Notify.push(state, {
      type: "compra",
      title: "Notificación de compra",
      message: `Compra ${BC.formatCOP(p.total)} · ${p.kilos} kg · transporte ${p.transporteIncluido ? "incluido" : "aparte"}`,
      openMail: true,
    });
  }

  function mailRestock(coffeeId) {
    const coffee = state.coffees.find((c) => c.id === coffeeId);
    if (!coffee) return;
    BC.Notify.push(state, {
      type: "inventario",
      title: "Alerta de recompra",
      message: `${coffee.nombre} bajo umbral. Contactar a ${coffee.caficultor} (${coffee.zona}).`,
      openMail: true,
    });
    toast("Correo", "Se abrió el aviso de recompra");
  }

  /* ---------- Boot ---------- */
  applyAppearance();
  if (state.session && BC.USERS[state.session.userId]) {
    enterApp(BC.USERS[state.session.userId]);
  }

  // Live logo preview on config
  document.addEventListener("change", async (e) => {
    if (e.target?.id === "logo-file" && e.target.files?.[0]) {
      const url = await readFileAsDataURL(e.target.files[0]);
      const preview = $("#logo-preview");
      if (preview) {
        preview.style.backgroundImage = `url('${url}')`;
        preview.style.color = "transparent";
        preview.textContent = "";
      }
    }
  });
})();
