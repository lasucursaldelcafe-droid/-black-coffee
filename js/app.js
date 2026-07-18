/**
 * Black Coffee Administration — aplicación principal
 */
(function () {
  let state = BCA.loadState();

  const NAV = [
    { id: "dashboard", label: "Dashboard" },
    { id: "costs", label: "Costos de producción" },
    { id: "coffees", label: "Variedades de café" },
    { id: "clients", label: "Clientes" },
    { id: "suppliers", label: "Proveedores" },
    { id: "quotes", label: "Cotizaciones" },
    { id: "purchases", label: "Compras" },
    { id: "sales", label: "Ventas" },
    { id: "inventory", label: "Inventario & mermas" },
    { id: "branding", label: "Marca & apariencia" },
    { id: "notifications", label: "Notificaciones" },
  ];

  const els = {
    authView: document.getElementById("auth-view"),
    appView: document.getElementById("app-view"),
    loginForm: document.getElementById("login-form"),
    loginError: document.getElementById("login-error"),
    pageRoot: document.getElementById("page-root"),
    pageTitle: document.getElementById("page-title"),
    mainNav: document.getElementById("main-nav"),
    modalRoot: document.getElementById("modal-root"),
    toastStack: document.getElementById("toast-stack"),
    currentUser: document.getElementById("current-user-label"),
    sidebar: document.getElementById("sidebar"),
    sidebarLogo: document.getElementById("sidebar-logo"),
    sidebarBrand: document.getElementById("sidebar-brand-name"),
    notifDot: document.getElementById("notif-dot"),
    heroTagline: document.getElementById("hero-tagline"),
  };

  let currentPage = "dashboard";

  function persist() {
    BCA.saveState(state);
  }

  function toast(title, message) {
    const node = document.createElement("div");
    node.className = "toast";
    node.innerHTML = `<strong>${escapeHtml(title)}</strong><div class="soft">${escapeHtml(message || "")}</div>`;
    els.toastStack.appendChild(node);
    setTimeout(() => node.remove(), 4200);
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function money(n) {
    return BCACalc.formatCOP(n);
  }

  function pushNotification({ type, title, message, openMail = true }) {
    const item = {
      id: BCA.createId("ntf"),
      type,
      title,
      message,
      emailTarget: BCA.NOTIFY_EMAIL,
      read: false,
      createdAt: new Date().toISOString(),
    };
    state.notifications.unshift(item);
    persist();
    updateNotifDot();

    if (openMail) {
      const subject = encodeURIComponent(`[BCA] ${title}`);
      const body = encodeURIComponent(
        `${message}\n\n— Black Coffee Administration\n${new Date().toLocaleString("es-CO")}`
      );
      // No forzar popup en cada acción; se ofrece desde UI. Guardamos mailto listo.
      item.mailto = `mailto:${BCA.NOTIFY_EMAIL}?subject=${subject}&body=${body}`;
    }
    return item;
  }

  function updateNotifDot() {
    const unread = state.notifications.filter((n) => !n.read).length;
    els.notifDot.classList.toggle("hidden", unread === 0);
  }

  function applyBranding() {
    const b = state.branding;
    document.body.style.setProperty("--brand-accent", b.accent || "#d0d0d0");
    els.sidebarBrand.textContent = b.brandName || "Black Coffee";
    els.heroTagline.textContent =
      b.heroTagline ||
      "Distribución, producción y cotización de café especial.";

    if (b.logoDataUrl) {
      els.sidebarLogo.outerHTML = `<img id="sidebar-logo" class="sidebar-logo" alt="Logo" src="${b.logoDataUrl}" />`;
      els.sidebarLogo = document.getElementById("sidebar-logo");
    } else {
      els.sidebarLogo.className = "sidebar-logo placeholder";
      els.sidebarLogo.textContent = "BC";
      if (els.sidebarLogo.tagName === "IMG") {
        const div = document.createElement("div");
        div.id = "sidebar-logo";
        div.className = "sidebar-logo placeholder";
        div.textContent = "BC";
        els.sidebarLogo.replaceWith(div);
        els.sidebarLogo = div;
      }
    }
  }

  function closeModal() {
    els.modalRoot.innerHTML = "";
  }

  function openModal({ title, bodyHtml, footerHtml }) {
    els.modalRoot.innerHTML = `
      <div class="modal-backdrop" data-close-modal>
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal-head">
            <h3>${escapeHtml(title)}</h3>
            <button class="btn btn-ghost btn-sm" type="button" data-close-modal>Cerrar</button>
          </div>
          <div class="modal-body">${bodyHtml}</div>
          ${footerHtml ? `<div class="modal-foot">${footerHtml}</div>` : ""}
        </div>
      </div>
    `;
    els.modalRoot.querySelectorAll("[data-close-modal]").forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.hasAttribute("data-close-modal")) closeModal();
      });
    });
    const modal = els.modalRoot.querySelector(".modal");
    modal?.addEventListener("click", (e) => e.stopPropagation());
  }

  function choiceGroup(name, options, selected, mapLabel = (o) => o) {
    return `
      <div class="choice-grid" data-choice-group="${escapeHtml(name)}">
        ${options
          .map((opt) => {
            const value = typeof opt === "object" ? opt.id ?? opt : opt;
            const label = typeof opt === "object" ? mapLabel(opt) : opt;
            const active = String(selected) === String(value) ? "active" : "";
            return `<button type="button" class="choice ${active}" data-choice-value="${escapeHtml(value)}">${escapeHtml(label)}</button>`;
          })
          .join("")}
      </div>
    `;
  }

  function bindChoiceGroups(root, onChange) {
    root.querySelectorAll("[data-choice-group]").forEach((group) => {
      group.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-choice-value]");
        if (!btn) return;
        group.querySelectorAll(".choice").forEach((c) => c.classList.remove("active"));
        btn.classList.add("active");
        onChange?.(group.dataset.choiceGroup, btn.dataset.choiceValue);
      });
    });
  }

  function getSelectedChoice(root, name) {
    return root.querySelector(`[data-choice-group="${name}"] .choice.active`)?.dataset
      .choiceValue;
  }

  function coffeeById(id) {
    return state.coffees.find((c) => c.id === id);
  }

  function clientById(id) {
    return state.clients.find((c) => c.id === id);
  }

  function stockForCoffee(coffeeId) {
    return state.inventoryLots
      .filter((l) => l.coffeeId === coffeeId)
      .reduce((sum, l) => sum + (Number(l.kgAvailable) || 0), 0);
  }

  function checkLowStock() {
    state.coffees.forEach((c) => {
      const stock = stockForCoffee(c.id);
      c.stockKg = stock;
      if (stock <= (c.stockAlertKg ?? 20)) {
        const exists = state.notifications.some(
          (n) =>
            n.type === "inventory" &&
            n.message.includes(c.name) &&
            Date.now() - new Date(n.createdAt).getTime() < 1000 * 60 * 60 * 12
        );
        if (!exists && stock >= 0) {
          pushNotification({
            type: "inventory",
            title: "Inventario bajo — generar compra",
            message: `${c.name} tiene ${stock.toFixed(2)} kg. Umbral: ${c.stockAlertKg ?? 20} kg. Considera una nueva compra.`,
            openMail: true,
          });
        }
      }
    });
    persist();
  }

  /* ——— Auth ——— */
  function showApp() {
    els.authView.classList.add("hidden");
    els.appView.classList.remove("hidden");
    applyBranding();
    renderNav();
    updateNotifDot();
    els.currentUser.textContent = state.session?.name || "Usuario";
    navigate(currentPage || "dashboard");
    maybeShowCostPrompt();
    checkLowStock();
  }

  function showAuth() {
    els.appView.classList.add("hidden");
    els.authView.classList.remove("hidden");
  }

  function maybeShowCostPrompt() {
    const today = new Date().toISOString().slice(0, 10);
    if (state.costPromptDismissedAt === today) return;

    const c = state.productionCosts;
    openModal({
      title: "¿Hay algún cambio en los costos de producción?",
      bodyHtml: `
        <p class="soft">Al ingresar confirmamos si los parámetros productivos siguen vigentes. Si hubo un cambio, ajústalos aquí.</p>
        <form id="cost-prompt-form" class="form-grid" style="margin-top:1rem">
          <div class="field"><label>Tostión ($/kg)</label><input name="tostionPerKg" type="number" min="0" value="${c.tostionPerKg}" required /></div>
          <div class="field"><label>Selección ($/kg)</label><input name="seleccionPerKg" type="number" min="0" value="${c.seleccionPerKg}" required /></div>
          <div class="field"><label>Empaque 250 g</label><input name="bag250" type="number" min="0" value="${c.empaque.bag250}" required /></div>
          <div class="field"><label>Empaque 500 g</label><input name="bag500" type="number" min="0" value="${c.empaque.bag500}" required /></div>
          <div class="field"><label>Empaque 5 lb</label><input name="bag5lb" type="number" min="0" value="${c.empaque.bag5lb}" required /></div>
          <div class="field"><label>Etiqueta grande</label><input name="etiquetaGrande" type="number" min="0" value="${c.etiquetas.grande}" required /></div>
          <div class="field"><label>Etiqueta pequeña</label><input name="etiquetaPequena" type="number" min="0" value="${c.etiquetas.pequena}" required /></div>
          <div class="field"><label>Costo de alza</label><input name="alzaValue" type="number" min="0" value="${c.alza.value}" required /></div>
          <div class="field full">
            <label class="toggle">
              <input type="checkbox" name="alzaEnabled" ${c.alza.enabled ? "checked" : ""} />
              <span>Activar / desactivar costo de alza (${money(c.alza.value)})</span>
            </label>
          </div>
        </form>
      `,
      footerHtml: `
        <button class="btn btn-ghost" type="button" id="cost-no-change">No hay cambios</button>
        <button class="btn btn-primary" type="button" id="cost-save-change" style="width:auto">Guardar cambios</button>
      `,
    });

    document.getElementById("cost-no-change")?.addEventListener("click", () => {
      state.costPromptDismissedAt = today;
      persist();
      closeModal();
      toast("Costos", "Sin cambios. Se mantienen los valores actuales.");
    });

    document.getElementById("cost-save-change")?.addEventListener("click", () => {
      const form = document.getElementById("cost-prompt-form");
      const fd = new FormData(form);
      state.productionCosts = {
        tostionPerKg: Number(fd.get("tostionPerKg")),
        seleccionPerKg: Number(fd.get("seleccionPerKg")),
        empaque: {
          bag250: Number(fd.get("bag250")),
          bag500: Number(fd.get("bag500")),
          bag5lb: Number(fd.get("bag5lb")),
        },
        etiquetas: {
          grande: Number(fd.get("etiquetaGrande")),
          pequena: Number(fd.get("etiquetaPequena")),
        },
        alza: {
          enabled: form.alzaEnabled.checked,
          value: Number(fd.get("alzaValue")),
        },
        updatedAt: new Date().toISOString(),
      };
      state.costPromptDismissedAt = today;
      persist();
      closeModal();
      const n = pushNotification({
        type: "production",
        title: "Costos de producción actualizados",
        message: `Tostión ${money(state.productionCosts.tostionPerKg)}/kg · Selección ${money(state.productionCosts.seleccionPerKg)}/kg · Alza ${state.productionCosts.alza.enabled ? "activa" : "inactiva"}.`,
      });
      toast("Costos actualizados", "Los nuevos valores ya aplican a cotizaciones.");
      maybeMail(n);
      if (currentPage === "costs") renderPage();
    });
  }

  function maybeMail(notification) {
    if (!notification?.mailto) return;
    // Enlace disponible en notificaciones; no abrimos automáticamente para no saturar.
  }

  function renderNav() {
    els.mainNav.innerHTML = NAV.map(
      (item) =>
        `<button type="button" class="nav-btn ${item.id === currentPage ? "active" : ""}" data-nav="${item.id}">${item.label}</button>`
    ).join("");
    els.mainNav.querySelectorAll("[data-nav]").forEach((btn) => {
      btn.addEventListener("click", () => {
        navigate(btn.dataset.nav);
        els.sidebar.classList.remove("open");
      });
    });
  }

  function navigate(page) {
    currentPage = page;
    const meta = NAV.find((n) => n.id === page);
    els.pageTitle.textContent = meta?.label || "Dashboard";
    renderNav();
    renderPage();
  }

  function renderPage() {
    const map = {
      dashboard: renderDashboard,
      costs: renderCosts,
      coffees: renderCoffees,
      clients: renderClients,
      suppliers: renderSuppliers,
      quotes: renderQuotes,
      purchases: renderPurchases,
      sales: renderSales,
      inventory: renderInventory,
      branding: renderBranding,
      notifications: renderNotifications,
    };
    (map[currentPage] || renderDashboard)();
  }

  /* ——— Pages ——— */
  function renderDashboard() {
    const quotes = state.quotes.length;
    const clients = state.clients.length;
    const coffees = state.coffees.filter((c) => c.active).length;
    const low = state.coffees.filter((c) => stockForCoffee(c.id) <= (c.stockAlertKg ?? 20));
    const salesTotal = state.sales.reduce((s, x) => s + (x.total || 0), 0);

    els.pageRoot.innerHTML = `
      <section class="page-hero">
        <div>
          <h3>${escapeHtml(state.branding.brandName)}</h3>
          <p>${escapeHtml(state.branding.heroTagline)}</p>
        </div>
        <div class="actions">
          <button class="btn btn-primary" style="width:auto" type="button" id="dash-quote">Cotizar café</button>
          <button class="btn btn-ghost" type="button" id="dash-coffee">Agregar variedad</button>
        </div>
      </section>
      <section class="grid-stats">
        <article class="stat"><div class="label">Cotizaciones</div><div class="value">${quotes}</div></article>
        <article class="stat"><div class="label">Clientes</div><div class="value">${clients}</div></article>
        <article class="stat"><div class="label">Cafés activos</div><div class="value">${coffees}</div></article>
        <article class="stat"><div class="label">Ventas registradas</div><div class="value">${money(salesTotal)}</div></article>
      </section>
      <section class="two-col">
        <div class="panel">
          <div class="panel-head"><h4>Inventario en alerta</h4></div>
          <div class="panel-body alert-list">
            ${
              low.length
                ? low
                    .map((c) => {
                      const kg = stockForCoffee(c.id);
                      return `<div class="alert-item"><strong>${escapeHtml(c.name)}</strong><span class="soft">${kg.toFixed(2)} kg disponibles · umbral ${c.stockAlertKg ?? 20} kg</span></div>`;
                    })
                    .join("")
                : `<div class="empty">Sin alertas de inventario por ahora.</div>`
            }
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><h4>Café piloto</h4></div>
          <div class="panel-body">
            ${renderCoffeeCard(coffeeById("caf_oscar_alejandro") || state.coffees[0])}
          </div>
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><h4>Cliente piloto · La Chocolatada</h4><button class="btn btn-soft btn-sm" type="button" id="dash-quote-chocolatada">Cotizar ahora</button></div>
        <div class="panel-body soft">Panadería en Cali. Usa este flujo para generar la primera cotización con margen y formato de empaque.</div>
      </section>
    `;

    document.getElementById("dash-quote")?.addEventListener("click", () => openQuoteBuilder());
    document.getElementById("dash-coffee")?.addEventListener("click", () => navigate("coffees"));
    document
      .getElementById("dash-quote-chocolatada")
      ?.addEventListener("click", () =>
        openQuoteBuilder({ clientId: "cli_chocolatada", coffeeId: "caf_oscar_alejandro" })
      );
  }

  function renderCoffeeCard(coffee) {
    if (!coffee) return `<div class="empty">Sin café cargado.</div>`;
    const unit = BCACalc.computeUnitCost({
      coffee,
      costs: state.productionCosts,
      mermas: state.mermas,
      packFormatId: "250g",
    });
    const priced = BCACalc.applyMargin(unit.totalCostPerKg, 35);
    return `
      <div class="stack">
        <div style="display:flex;gap:0.8rem;align-items:center">
          ${coffee.imageDataUrl ? `<img class="thumb" src="${coffee.imageDataUrl}" alt="" />` : `<div class="thumb"></div>`}
          <div>
            <strong>${escapeHtml(coffee.name)}</strong>
            <div class="muted">${escapeHtml(coffee.zone)} · ${escapeHtml(coffee.process)}</div>
          </div>
        </div>
        <div class="kpi-line"><span>Compra</span><strong>${money(coffee.pricePerKg)}/kg</strong></div>
        <div class="kpi-line"><span>Transporte</span><strong>${coffee.transportIncluded ? "Incluido" : money(coffee.transportCostPerKg) + "/kg"}</strong></div>
        <div class="kpi-line"><span>Costo prod. (250g)</span><strong>${money(unit.totalCostPerKg)}/kg</strong></div>
        <div class="kpi-line"><span>P. sugerido 35%</span><strong>${money(priced.salePricePerKg)}/kg</strong></div>
        <div class="kpi-line"><span>Stock</span><strong>${stockForCoffee(coffee.id).toFixed(2)} kg</strong></div>
      </div>
    `;
  }

  function renderCosts() {
    const c = state.productionCosts;
    const m = state.mermas;
    els.pageRoot.innerHTML = `
      <section class="page-hero">
        <div>
          <h3>Costos de producción</h3>
          <p>Base fija del ecosistema. La variable principal es el precio del café (variedad, caficultor y zona). El transporte se pregunta por cada lote.</p>
        </div>
      </section>
      <section class="two-col">
        <div class="panel">
          <div class="panel-head"><h4>Parámetros productivos</h4></div>
          <div class="panel-body">
            <form id="costs-form" class="form-grid">
              <div class="field"><label>Tostión ($/kg)</label><input name="tostionPerKg" type="number" value="${c.tostionPerKg}" /></div>
              <div class="field"><label>Selección post-tostión ($/kg)</label><input name="seleccionPerKg" type="number" value="${c.seleccionPerKg}" /></div>
              <div class="field"><label>Empaque bolsa 250 g</label><input name="bag250" type="number" value="${c.empaque.bag250}" /></div>
              <div class="field"><label>Empaque bolsa 500 g</label><input name="bag500" type="number" value="${c.empaque.bag500}" /></div>
              <div class="field"><label>Empaque bolsa 5 lb</label><input name="bag5lb" type="number" value="${c.empaque.bag5lb}" /></div>
              <div class="field"><label>Etiqueta grande</label><input name="etiquetaGrande" type="number" value="${c.etiquetas.grande}" /></div>
              <div class="field"><label>Etiqueta pequeña</label><input name="etiquetaPequena" type="number" value="${c.etiquetas.pequena}" /></div>
              <div class="field"><label>Costo de alza</label><input name="alzaValue" type="number" value="${c.alza.value}" /></div>
              <div class="field full">
                <label class="toggle">
                  <input type="checkbox" name="alzaEnabled" ${c.alza.enabled ? "checked" : ""} />
                  <span>Alza activa (se suma al costo cuando está encendida)</span>
                </label>
              </div>
              <div class="field full actions">
                <button class="btn btn-primary" style="width:auto" type="submit">Guardar costos</button>
              </div>
            </form>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><h4>Mermas del proceso</h4></div>
          <div class="panel-body">
            <form id="mermas-form" class="form-grid">
              <div class="field"><label>Merma trilla % (pergamino→verde)</label><input name="trilla" type="number" step="0.1" value="${m.trilla}" /></div>
              <div class="field"><label>Merma tostión % (verde→tostado)</label><input name="tostion" type="number" step="0.1" value="${m.tostion}" /></div>
              <div class="field"><label>Merma selección %</label><input name="seleccion" type="number" step="0.1" value="${m.seleccion}" /></div>
              <div class="field full muted">Café verde: tostión + selección. Pergamino: trilla + tostión + selección. Tostado: solo selección residual.</div>
              <div class="field full"><button class="btn btn-primary" style="width:auto" type="submit">Guardar mermas</button></div>
            </form>
            <div style="margin-top:1rem" class="panel" >
              <div class="panel-body">
                <strong>Ejemplo 100 kg</strong>
                <div class="kpi-line"><span>Verde → final</span><span>${BCACalc.projectAfterMermas("verde", state.mermas, 100).finalKg.toFixed(2)} kg</span></div>
                <div class="kpi-line"><span>Pergamino → final</span><span>${BCACalc.projectAfterMermas("pergamino", state.mermas, 100).finalKg.toFixed(2)} kg</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>
    `;

    document.getElementById("costs-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      state.productionCosts = {
        ...state.productionCosts,
        tostionPerKg: Number(fd.get("tostionPerKg")),
        seleccionPerKg: Number(fd.get("seleccionPerKg")),
        empaque: {
          bag250: Number(fd.get("bag250")),
          bag500: Number(fd.get("bag500")),
          bag5lb: Number(fd.get("bag5lb")),
        },
        etiquetas: {
          grande: Number(fd.get("etiquetaGrande")),
          pequena: Number(fd.get("etiquetaPequena")),
        },
        alza: {
          enabled: e.target.alzaEnabled.checked,
          value: Number(fd.get("alzaValue")),
        },
        updatedAt: new Date().toISOString(),
      };
      persist();
      const n = pushNotification({
        type: "production",
        title: "Costos de producción modificados",
        message: "Se actualizaron parámetros de tostión, selección, empaque, etiquetas o alza.",
      });
      toast("Guardado", "Costos de producción actualizados.");
      maybeMail(n);
      renderCosts();
    });

    document.getElementById("mermas-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      state.mermas = {
        trilla: Number(fd.get("trilla")),
        tostion: Number(fd.get("tostion")),
        seleccion: Number(fd.get("seleccion")),
      };
      persist();
      pushNotification({
        type: "production",
        title: "Mermas actualizadas",
        message: `Trilla ${state.mermas.trilla}% · Tostión ${state.mermas.tostion}% · Selección ${state.mermas.seleccion}%`,
      });
      toast("Guardado", "Porcentajes de merma actualizados.");
      renderCosts();
    });
  }

  function renderCoffees() {
    els.pageRoot.innerHTML = `
      <section class="page-hero">
        <div>
          <h3>Variedades de café</h3>
          <p>Precio por kg, zona, proceso, forma (verde/pergamino/tostado) y si el transporte va incluido.</p>
        </div>
        <button class="btn btn-primary" style="width:auto" type="button" id="btn-add-coffee">Agregar café</button>
      </section>
      <section class="panel">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Café</th><th>Zona</th><th>Forma</th><th>Precio</th><th>Transporte</th><th>Stock</th><th></th>
              </tr>
            </thead>
            <tbody>
              ${state.coffees
                .map((c) => {
                  const stock = stockForCoffee(c.id);
                  const low = stock <= (c.stockAlertKg ?? 20);
                  return `<tr>
                    <td>
                      <div style="display:flex;gap:.6rem;align-items:center">
                        ${c.imageDataUrl ? `<img class="thumb" src="${c.imageDataUrl}" alt="" />` : `<div class="thumb"></div>`}
                        <div>
                          <strong>${escapeHtml(c.name)}</strong>
                          <div class="muted">${escapeHtml(c.producer)} · ${escapeHtml(c.variety)}</div>
                        </div>
                      </div>
                    </td>
                    <td>${escapeHtml(c.zone)}</td>
                    <td><span class="badge">${escapeHtml(c.form)}</span></td>
                    <td>${money(c.pricePerKg)}/kg</td>
                    <td>${c.transportIncluded ? '<span class="badge ok">Incluido</span>' : money(c.transportCostPerKg) + "/kg"}</td>
                    <td>${stock.toFixed(2)} kg ${low ? '<span class="badge warn">Bajo</span>' : ""}</td>
                    <td class="actions">
                      <button class="btn btn-soft btn-sm" data-edit-coffee="${c.id}">Editar</button>
                      <button class="btn btn-ghost btn-sm" data-quote-coffee="${c.id}">Cotizar</button>
                    </td>
                  </tr>`;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </section>
    `;

    document.getElementById("btn-add-coffee")?.addEventListener("click", () => openCoffeeForm());
    els.pageRoot.querySelectorAll("[data-edit-coffee]").forEach((btn) => {
      btn.addEventListener("click", () => openCoffeeForm(coffeeById(btn.dataset.editCoffee)));
    });
    els.pageRoot.querySelectorAll("[data-quote-coffee]").forEach((btn) => {
      btn.addEventListener("click", () => openQuoteBuilder({ coffeeId: btn.dataset.quoteCoffee }));
    });
  }

  function openCoffeeForm(coffee = null) {
    const isEdit = Boolean(coffee);
    const c = coffee || {
      name: "",
      producer: "",
      zone: "Cauca",
      variety: "Colombia",
      process: "Lavado fermentación extendida",
      processDetail: "",
      form: "verde",
      pricePerKg: 0,
      transportIncluded: true,
      transportCostPerKg: 0,
      stockAlertKg: 20,
      notes: "",
      imageDataUrl: null,
      active: true,
    };

    openModal({
      title: isEdit ? "Editar café" : "Agregar variedad de café",
      bodyHtml: `
        <form id="coffee-form" class="stack">
          <div class="form-grid">
            <div class="field full"><label>Nombre comercial</label><input name="name" required value="${escapeHtml(c.name)}" /></div>
            <div class="field"><label>Caficultor / productor</label><input name="producer" required value="${escapeHtml(c.producer)}" /></div>
            <div class="field"><label>Detalle de proceso</label><input name="processDetail" value="${escapeHtml(c.processDetail || "")}" placeholder="ej. 24 horas de fermentación" /></div>
            <div class="field full"><label>Zona del país</label>${choiceGroup("zone", state.catalogs.zones, c.zone)}</div>
            <div class="field full"><label>Variedad</label>${choiceGroup("variety", state.catalogs.varieties, c.variety)}</div>
            <div class="field full"><label>Proceso</label>${choiceGroup("process", state.catalogs.processes, c.process)}</div>
            <div class="field full"><label>Forma de compra</label>${choiceGroup(
              "form",
              state.catalogs.forms,
              c.form,
              (o) => o.label
            )}</div>
            <div class="field"><label>Precio compra ($/kg)</label><input name="pricePerKg" type="number" min="0" required value="${c.pricePerKg}" /></div>
            <div class="field"><label>Alerta stock (kg)</label><input name="stockAlertKg" type="number" min="0" value="${c.stockAlertKg ?? 20}" /></div>
            <div class="field full">
              <label class="toggle">
                <input type="checkbox" name="transportIncluded" ${c.transportIncluded ? "checked" : ""} />
                <span>¿El transporte está incluido en el precio de compra?</span>
              </label>
            </div>
            <div class="field full" id="transport-cost-field" style="${c.transportIncluded ? "display:none" : ""}">
              <label>Costo transporte ($/kg)</label>
              <input name="transportCostPerKg" type="number" min="0" value="${c.transportCostPerKg || 0}" />
            </div>
            <div class="field full"><label>Notas</label><textarea name="notes">${escapeHtml(c.notes || "")}</textarea></div>
            <div class="field full"><label>Imagen del producto</label><input name="image" type="file" accept="image/*" /></div>
          </div>
        </form>
      `,
      footerHtml: `
        <button class="btn btn-ghost" type="button" data-close-modal>Cancelar</button>
        <button class="btn btn-primary" style="width:auto" type="button" id="save-coffee">Guardar</button>
      `,
    });

    const modal = els.modalRoot;
    const form = modal.querySelector("#coffee-form");
    bindChoiceGroups(form);

    form.transportIncluded.addEventListener("change", () => {
      modal.querySelector("#transport-cost-field").style.display = form.transportIncluded.checked
        ? "none"
        : "grid";
    });

    let imageDataUrl = c.imageDataUrl || null;
    form.image.addEventListener("change", async () => {
      const file = form.image.files?.[0];
      if (!file) return;
      imageDataUrl = await readFileAsDataURL(file);
    });

    modal.querySelector("#save-coffee").addEventListener("click", () => {
      const fd = new FormData(form);
      const payload = {
        name: String(fd.get("name")).trim(),
        producer: String(fd.get("producer")).trim(),
        processDetail: String(fd.get("processDetail") || "").trim(),
        zone: getSelectedChoice(form, "zone"),
        variety: getSelectedChoice(form, "variety"),
        process: getSelectedChoice(form, "process"),
        form: getSelectedChoice(form, "form"),
        pricePerKg: Number(fd.get("pricePerKg")),
        stockAlertKg: Number(fd.get("stockAlertKg")),
        transportIncluded: form.transportIncluded.checked,
        transportCostPerKg: form.transportIncluded.checked
          ? 0
          : Number(fd.get("transportCostPerKg") || 0),
        notes: String(fd.get("notes") || ""),
        imageDataUrl,
        active: true,
      };

      if (!payload.name || !payload.producer) {
        toast("Faltan datos", "Nombre y productor son obligatorios.");
        return;
      }

      if (isEdit) {
        Object.assign(coffee, payload);
      } else {
        state.coffees.unshift({
          id: BCA.createId("caf"),
          supplierId: null,
          score: null,
          harvest: "",
          stockKg: 0,
          createdAt: new Date().toISOString(),
          ...payload,
        });
      }
      persist();
      pushNotification({
        type: "production",
        title: isEdit ? "Café actualizado" : "Nueva variedad de café",
        message: `${payload.name} · ${payload.zone} · ${money(payload.pricePerKg)}/kg · transporte ${payload.transportIncluded ? "incluido" : "aparte"}`,
      });
      closeModal();
      toast("Café guardado", payload.name);
      renderCoffees();
    });
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function renderClients() {
    els.pageRoot.innerHTML = `
      <section class="page-hero">
        <div>
          <h3>Clientes</h3>
          <p>Cliente final o al por mayor. Desde aquí se generan cotizaciones por café.</p>
        </div>
        <button class="btn btn-primary" style="width:auto" type="button" id="btn-add-client">Agregar cliente</button>
      </section>
      <section class="panel table-wrap">
        <table>
          <thead><tr><th>Cliente</th><th>Tipo</th><th>Ciudad</th><th>Contacto</th><th></th></tr></thead>
          <tbody>
            ${state.clients
              .map((c) => {
                const typeLabel =
                  BCA.CLIENT_TYPES.find((t) => t.id === c.type)?.label || c.type;
                return `<tr>
                  <td><strong>${escapeHtml(c.name)}</strong><div class="muted">${escapeHtml(c.notes || "")}</div></td>
                  <td><span class="badge">${escapeHtml(typeLabel)}</span></td>
                  <td>${escapeHtml(c.city)}${c.department ? ", " + escapeHtml(c.department) : ""}</td>
                  <td>${escapeHtml(c.email || c.phone || "—")}</td>
                  <td class="actions">
                    <button class="btn btn-soft btn-sm" data-edit-client="${c.id}">Editar</button>
                    <button class="btn btn-ghost btn-sm" data-quote-client="${c.id}">Cotizar</button>
                  </td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </section>
    `;
    document.getElementById("btn-add-client")?.addEventListener("click", () => openClientForm());
    els.pageRoot.querySelectorAll("[data-edit-client]").forEach((b) =>
      b.addEventListener("click", () => openClientForm(clientById(b.dataset.editClient)))
    );
    els.pageRoot.querySelectorAll("[data-quote-client]").forEach((b) =>
      b.addEventListener("click", () => openQuoteBuilder({ clientId: b.dataset.quoteClient }))
    );
  }

  function openClientForm(client = null) {
    const isEdit = Boolean(client);
    const c = client || {
      name: "",
      type: "final",
      city: "",
      department: "",
      contact: "",
      phone: "",
      email: "",
      notes: "",
    };
    openModal({
      title: isEdit ? "Editar cliente" : "Agregar cliente",
      bodyHtml: `
        <form id="client-form" class="form-grid">
          <div class="field full"><label>Nombre</label><input name="name" required value="${escapeHtml(c.name)}" /></div>
          <div class="field full"><label>Tipo de cliente</label>${choiceGroup(
            "type",
            BCA.CLIENT_TYPES,
            c.type,
            (o) => o.label
          )}</div>
          <div class="field"><label>Ciudad</label><input name="city" value="${escapeHtml(c.city)}" /></div>
          <div class="field"><label>Departamento</label><input name="department" value="${escapeHtml(c.department || "")}" /></div>
          <div class="field"><label>Contacto</label><input name="contact" value="${escapeHtml(c.contact || "")}" /></div>
          <div class="field"><label>Teléfono</label><input name="phone" value="${escapeHtml(c.phone || "")}" /></div>
          <div class="field full"><label>Email</label><input name="email" type="email" value="${escapeHtml(c.email || "")}" /></div>
          <div class="field full"><label>Notas</label><textarea name="notes">${escapeHtml(c.notes || "")}</textarea></div>
        </form>
      `,
      footerHtml: `
        <button class="btn btn-ghost" type="button" data-close-modal>Cancelar</button>
        <button class="btn btn-primary" style="width:auto" type="button" id="save-client">Guardar</button>
      `,
    });
    const form = els.modalRoot.querySelector("#client-form");
    bindChoiceGroups(form);
    els.modalRoot.querySelector("#save-client").addEventListener("click", () => {
      const fd = new FormData(form);
      const payload = {
        name: String(fd.get("name")).trim(),
        type: getSelectedChoice(form, "type"),
        city: String(fd.get("city") || "").trim(),
        department: String(fd.get("department") || "").trim(),
        contact: String(fd.get("contact") || "").trim(),
        phone: String(fd.get("phone") || "").trim(),
        email: String(fd.get("email") || "").trim(),
        notes: String(fd.get("notes") || "").trim(),
      };
      if (!payload.name) return toast("Falta nombre", "El cliente necesita un nombre.");
      if (isEdit) Object.assign(client, payload);
      else
        state.clients.unshift({
          id: BCA.createId("cli"),
          createdAt: new Date().toISOString(),
          ...payload,
        });
      persist();
      pushNotification({
        type: "client",
        title: isEdit ? "Cliente actualizado" : "Nuevo cliente",
        message: `${payload.name} · ${payload.city || "sin ciudad"} · ${payload.type}`,
      });
      closeModal();
      toast("Cliente guardado", payload.name);
      renderClients();
    });
  }

  function renderSuppliers() {
    els.pageRoot.innerHTML = `
      <section class="page-hero">
        <div>
          <h3>Proveedores</h3>
          <p>Caficultores y proveedores logísticos asociados a las compras.</p>
        </div>
        <button class="btn btn-primary" style="width:auto" type="button" id="btn-add-supplier">Agregar proveedor</button>
      </section>
      <section class="panel table-wrap">
        <table>
          <thead><tr><th>Nombre</th><th>Tipo</th><th>Zona</th><th>Contacto</th><th></th></tr></thead>
          <tbody>
            ${state.suppliers
              .map(
                (s) => `<tr>
                <td><strong>${escapeHtml(s.name)}</strong><div class="muted">${escapeHtml(s.notes || "")}</div></td>
                <td>${escapeHtml(s.type)}</td>
                <td>${escapeHtml(s.zone || "—")}</td>
                <td>${escapeHtml(s.email || s.phone || "—")}</td>
                <td><button class="btn btn-soft btn-sm" data-edit-supplier="${s.id}">Editar</button></td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </section>
    `;
    document
      .getElementById("btn-add-supplier")
      ?.addEventListener("click", () => openSupplierForm());
    els.pageRoot.querySelectorAll("[data-edit-supplier]").forEach((b) =>
      b.addEventListener("click", () =>
        openSupplierForm(state.suppliers.find((s) => s.id === b.dataset.editSupplier))
      )
    );
  }

  function openSupplierForm(supplier = null) {
    const isEdit = Boolean(supplier);
    const s = supplier || {
      name: "",
      type: "caficultor",
      zone: "Cauca",
      phone: "",
      email: "",
      notes: "",
    };
    openModal({
      title: isEdit ? "Editar proveedor" : "Agregar proveedor",
      bodyHtml: `
        <form id="supplier-form" class="form-grid">
          <div class="field"><label>Nombre</label><input name="name" required value="${escapeHtml(s.name)}" /></div>
          <div class="field"><label>Tipo</label>
            <select name="type">
              <option value="caficultor" ${s.type === "caficultor" ? "selected" : ""}>Caficultor</option>
              <option value="cooperativa" ${s.type === "cooperativa" ? "selected" : ""}>Cooperativa</option>
              <option value="logistica" ${s.type === "logistica" ? "selected" : ""}>Logística</option>
              <option value="otro" ${s.type === "otro" ? "selected" : ""}>Otro</option>
            </select>
          </div>
          <div class="field full"><label>Zona</label>${choiceGroup("zone", state.catalogs.zones, s.zone || "Cauca")}</div>
          <div class="field"><label>Teléfono</label><input name="phone" value="${escapeHtml(s.phone || "")}" /></div>
          <div class="field"><label>Email</label><input name="email" value="${escapeHtml(s.email || "")}" /></div>
          <div class="field full"><label>Notas</label><textarea name="notes">${escapeHtml(s.notes || "")}</textarea></div>
        </form>
      `,
      footerHtml: `
        <button class="btn btn-ghost" type="button" data-close-modal>Cancelar</button>
        <button class="btn btn-primary" style="width:auto" type="button" id="save-supplier">Guardar</button>
      `,
    });
    const form = els.modalRoot.querySelector("#supplier-form");
    bindChoiceGroups(form);
    els.modalRoot.querySelector("#save-supplier").addEventListener("click", () => {
      const fd = new FormData(form);
      const payload = {
        name: String(fd.get("name")).trim(),
        type: String(fd.get("type")),
        zone: getSelectedChoice(form, "zone"),
        phone: String(fd.get("phone") || ""),
        email: String(fd.get("email") || ""),
        notes: String(fd.get("notes") || ""),
      };
      if (!payload.name) return;
      if (isEdit) Object.assign(supplier, payload);
      else
        state.suppliers.unshift({
          id: BCA.createId("prv"),
          createdAt: new Date().toISOString(),
          ...payload,
        });
      persist();
      closeModal();
      toast("Proveedor guardado", payload.name);
      renderSuppliers();
    });
  }

  function openQuoteBuilder(defaults = {}) {
    const coffeeId = defaults.coffeeId || state.coffees[0]?.id;
    const clientId = defaults.clientId || state.clients[0]?.id;
    openModal({
      title: "Nueva cotización",
      bodyHtml: `
        <form id="quote-form" class="stack">
          <div class="form-grid">
            <div class="field"><label>Cliente</label>
              <select name="clientId">${state.clients
                .map(
                  (c) =>
                    `<option value="${c.id}" ${c.id === clientId ? "selected" : ""}>${escapeHtml(c.name)} (${c.type})</option>`
                )
                .join("")}</select>
            </div>
            <div class="field"><label>Café</label>
              <select name="coffeeId">${state.coffees
                .map(
                  (c) =>
                    `<option value="${c.id}" ${c.id === coffeeId ? "selected" : ""}>${escapeHtml(c.name)}</option>`
                )
                .join("")}</select>
            </div>
            <div class="field full"><label>Formato de empaque</label>${choiceGroup(
              "pack",
              BCA.PACK_FORMATS,
              "250g",
              (o) => o.label
            )}</div>
            <div class="field full"><label>Margen de ganancia</label>${choiceGroup(
              "margin",
              BCA.MARGIN_OPTIONS.map((m) => ({ id: String(m), label: `${m}%` })),
              "35",
              (o) => o.label
            )}</div>
            <div class="field"><label>Cantidad (kg producto final)</label><input name="kg" type="number" min="0.1" step="0.1" value="5" required /></div>
            <div class="field">
              <label class="toggle" style="margin-top:1.6rem">
                <input type="checkbox" name="includeAlza" ${state.productionCosts.alza.enabled ? "checked" : ""} />
                <span>Incluir costo de alza</span>
              </label>
            </div>
            <div class="field full"><label>Notas</label><textarea name="notes" placeholder="Condiciones, vigencia, entrega..."></textarea></div>
          </div>
          <div class="panel"><div class="panel-body" id="quote-preview">Calculando…</div></div>
        </form>
      `,
      footerHtml: `
        <button class="btn btn-ghost" type="button" data-close-modal>Cancelar</button>
        <button class="btn btn-soft" style="width:auto" type="button" id="quote-pdf-only">Solo PDF</button>
        <button class="btn btn-primary" style="width:auto" type="button" id="quote-save">Guardar + PDF</button>
      `,
    });

    const form = els.modalRoot.querySelector("#quote-form");
    bindChoiceGroups(form, () => refreshQuotePreview());
    form.addEventListener("input", refreshQuotePreview);
    form.addEventListener("change", refreshQuotePreview);

    function buildQuoteFromForm() {
      const coffee = coffeeById(form.coffeeId.value);
      const client = clientById(form.clientId.value);
      if (!coffee || !client) return null;
      const pack = getSelectedChoice(form, "pack");
      const margin = Number(getSelectedChoice(form, "margin"));
      const kg = Number(form.kg.value);
      const line = BCACalc.quoteLine({
        coffee,
        costs: state.productionCosts,
        mermas: state.mermas,
        packFormatId: pack,
        marginPct: margin,
        kg,
        includeAlza: form.includeAlza.checked,
      });
      return {
        ...line,
        clientId: client.id,
        clientName: client.name,
        clientCity: client.city,
        clientType: client.type,
        clientTypeLabel: BCA.CLIENT_TYPES.find((t) => t.id === client.type)?.label,
        producer: coffee.producer,
        zone: coffee.zone,
        process: `${coffee.process}${coffee.processDetail ? " · " + coffee.processDetail : ""}`,
        formatLabel: line.format.label,
        notes: form.notes.value,
        date: new Date().toISOString().slice(0, 10),
      };
    }

    function refreshQuotePreview() {
      const q = buildQuoteFromForm();
      const box = els.modalRoot.querySelector("#quote-preview");
      if (!q) {
        box.textContent = "Selecciona cliente y café.";
        return;
      }
      box.innerHTML = `
        <strong>Desglose de costo</strong>
        <div class="kpi-line"><span>Rendimiento tras mermas</span><span>${q.yieldPercent}%</span></div>
        <div class="kpi-line"><span>Café + transporte / kg final</span><span>${money(q.inputCostPerFinalKg)}</span></div>
        <div class="kpi-line"><span>Tostión</span><span>${money(q.tostion)}</span></div>
        <div class="kpi-line"><span>Selección</span><span>${money(q.seleccion)}</span></div>
        <div class="kpi-line"><span>Empaque + etiqueta / kg</span><span>${money(q.packagingPerKg)}</span></div>
        <div class="kpi-line"><span>Alza</span><span>${q.alzaActive ? money(q.alza) : "Desactivada"}</span></div>
        <div class="kpi-line"><span>Costo total / kg</span><strong>${money(q.totalCostPerKg)}</strong></div>
        <div class="kpi-line"><span>Precio venta (${q.marginPct}%)</span><strong>${money(q.salePricePerKg)}</strong></div>
        <div class="kpi-line"><span>Bolsas aprox.</span><span>${q.bags}</span></div>
        <div class="kpi-line"><span>Total cotización</span><strong>${money(q.subtotal)}</strong></div>
      `;
    }

    refreshQuotePreview();

    async function finalize(save) {
      const q = buildQuoteFromForm();
      if (!q) return;
      q.id = BCA.createId("cot");
      q.number = `BCA-${String(state.quotes.length + 1).padStart(4, "0")}`;
      q.createdAt = new Date().toISOString();
      q.createdBy = state.session?.name || "";

      if (save) {
        state.quotes.unshift(q);
        persist();
        const n = pushNotification({
          type: "quote",
          title: `Cotización ${q.number}`,
          message: `${q.clientName} · ${q.coffeeName} · ${q.quantityKg} kg · Total ${money(q.subtotal)}`,
        });
        if (n.mailto) window.open(n.mailto, "_blank");
      }

      try {
        await BCAPdf.downloadQuotePdf(q, state.branding);
        toast("PDF listo", save ? `Cotización ${q.number} guardada` : "PDF descargado");
      } catch (err) {
        toast("PDF", "No se pudo generar el PDF. Revisa la conexión al CDN.");
        console.error(err);
      }
      if (save) {
        closeModal();
        if (currentPage === "quotes") renderQuotes();
      }
    }

    els.modalRoot.querySelector("#quote-save").addEventListener("click", () => finalize(true));
    els.modalRoot.querySelector("#quote-pdf-only").addEventListener("click", () => finalize(false));
  }

  function renderQuotes() {
    els.pageRoot.innerHTML = `
      <section class="page-hero">
        <div>
          <h3>Cotizaciones</h3>
          <p>Genera PDF con costos de producción, mermas y margen. Notifica a ${BCA.NOTIFY_EMAIL}.</p>
        </div>
        <button class="btn btn-primary" style="width:auto" type="button" id="btn-new-quote">Nueva cotización</button>
      </section>
      <section class="panel table-wrap">
        ${
          state.quotes.length
            ? `<table>
              <thead><tr><th>#</th><th>Cliente</th><th>Café</th><th>Cantidad</th><th>Total</th><th></th></tr></thead>
              <tbody>
                ${state.quotes
                  .map(
                    (q) => `<tr>
                    <td>${escapeHtml(q.number)}</td>
                    <td>${escapeHtml(q.clientName)}<div class="muted">${escapeHtml(q.date)}</div></td>
                    <td>${escapeHtml(q.coffeeName)}<div class="muted">${escapeHtml(q.formatLabel)} · ${q.marginPct}%</div></td>
                    <td>${q.quantityKg} kg</td>
                    <td>${money(q.subtotal)}</td>
                    <td class="actions">
                      <button class="btn btn-soft btn-sm" data-pdf-quote="${q.id}">PDF</button>
                      <button class="btn btn-ghost btn-sm" data-mail-quote="${q.id}">Email</button>
                    </td>
                  </tr>`
                  )
                  .join("")}
              </tbody>
            </table>`
            : `<div class="empty">Aún no hay cotizaciones. Crea la de La Chocolatada con el café de Óscar Alejandro.</div>`
        }
      </section>
    `;
    document.getElementById("btn-new-quote")?.addEventListener("click", () => openQuoteBuilder());
    els.pageRoot.querySelectorAll("[data-pdf-quote]").forEach((b) =>
      b.addEventListener("click", async () => {
        const q = state.quotes.find((x) => x.id === b.dataset.pdfQuote);
        if (q) await BCAPdf.downloadQuotePdf(q, state.branding);
      })
    );
    els.pageRoot.querySelectorAll("[data-mail-quote]").forEach((b) => {
      b.addEventListener("click", () => {
        const q = state.quotes.find((x) => x.id === b.dataset.mailQuote);
        if (!q) return;
        const subject = encodeURIComponent(`[BCA] Cotización ${q.number}`);
        const body = encodeURIComponent(
          `Cliente: ${q.clientName}\nCafé: ${q.coffeeName}\nCantidad: ${q.quantityKg} kg\nTotal: ${money(q.subtotal)}\n`
        );
        window.location.href = `mailto:${BCA.NOTIFY_EMAIL}?subject=${subject}&body=${body}`;
      });
    });
  }

  function renderPurchases() {
    els.pageRoot.innerHTML = `
      <section class="page-hero">
        <div>
          <h3>Registro de compras</h3>
          <p>Cada compra crea o alimenta un lote de inventario. Pregunta siempre si el transporte va incluido.</p>
        </div>
        <button class="btn btn-primary" style="width:auto" type="button" id="btn-add-purchase">Registrar compra</button>
      </section>
      <section class="panel table-wrap">
        <table>
          <thead><tr><th>Fecha</th><th>Café</th><th>Kg</th><th>Forma</th><th>Total</th><th>Transporte</th></tr></thead>
          <tbody>
            ${state.purchases
              .map((p) => {
                const coffee = coffeeById(p.coffeeId);
                return `<tr>
                  <td>${escapeHtml(p.date)}</td>
                  <td>${escapeHtml(coffee?.name || "—")}</td>
                  <td>${p.kg}</td>
                  <td>${escapeHtml(p.form)}</td>
                  <td>${money(p.total)}</td>
                  <td>${p.transportIncluded ? "Incluido" : money(p.transportCostPerKg) + "/kg"}</td>
                </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </section>
    `;
    document.getElementById("btn-add-purchase")?.addEventListener("click", openPurchaseForm);
  }

  function openPurchaseForm() {
    openModal({
      title: "Registrar compra",
      bodyHtml: `
        <form id="purchase-form" class="form-grid">
          <div class="field"><label>Café</label>
            <select name="coffeeId">${state.coffees.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")}</select>
          </div>
          <div class="field"><label>Proveedor</label>
            <select name="supplierId">${state.suppliers.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("")}</select>
          </div>
          <div class="field"><label>Fecha</label><input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}" /></div>
          <div class="field"><label>Kg comprados</label><input name="kg" type="number" min="0.1" step="0.1" value="50" required /></div>
          <div class="field full"><label>Forma</label>${choiceGroup(
            "form",
            state.catalogs.forms,
            "verde",
            (o) => o.label
          )}</div>
          <div class="field"><label>Precio $/kg</label><input name="pricePerKg" type="number" min="0" value="33000" required /></div>
          <div class="field full">
            <label class="toggle"><input type="checkbox" name="transportIncluded" checked /><span>¿Transporte incluido en el precio?</span></label>
          </div>
          <div class="field full" id="p-transport" style="display:none">
            <label>Transporte $/kg</label><input name="transportCostPerKg" type="number" min="0" value="0" />
          </div>
          <div class="field full"><label>Notas</label><textarea name="notes"></textarea></div>
        </form>
      `,
      footerHtml: `
        <button class="btn btn-ghost" type="button" data-close-modal>Cancelar</button>
        <button class="btn btn-primary" style="width:auto" type="button" id="save-purchase">Guardar compra</button>
      `,
    });
    const form = els.modalRoot.querySelector("#purchase-form");
    bindChoiceGroups(form);
    form.transportIncluded.addEventListener("change", () => {
      els.modalRoot.querySelector("#p-transport").style.display = form.transportIncluded.checked
        ? "none"
        : "grid";
    });
    els.modalRoot.querySelector("#save-purchase").addEventListener("click", () => {
      const fd = new FormData(form);
      const kg = Number(fd.get("kg"));
      const pricePerKg = Number(fd.get("pricePerKg"));
      const transportIncluded = form.transportIncluded.checked;
      const transportCostPerKg = transportIncluded
        ? 0
        : Number(fd.get("transportCostPerKg") || 0);
      const formType = getSelectedChoice(form, "form");
      const coffeeId = String(fd.get("coffeeId"));
      const purchase = {
        id: BCA.createId("com"),
        coffeeId,
        supplierId: String(fd.get("supplierId")),
        date: String(fd.get("date")),
        form: formType,
        kg,
        pricePerKg,
        transportIncluded,
        transportCostPerKg,
        total: kg * (pricePerKg + transportCostPerKg),
        notes: String(fd.get("notes") || ""),
        createdAt: new Date().toISOString(),
      };
      state.purchases.unshift(purchase);
      state.inventoryLots.unshift({
        id: BCA.createId("lot"),
        coffeeId,
        form: formType,
        kgAvailable: kg,
        kgOriginal: kg,
        purchaseId: purchase.id,
        createdAt: new Date().toISOString(),
      });
      const coffee = coffeeById(coffeeId);
      if (coffee) {
        coffee.pricePerKg = pricePerKg;
        coffee.form = formType;
        coffee.transportIncluded = transportIncluded;
        coffee.transportCostPerKg = transportCostPerKg;
      }
      persist();
      const n = pushNotification({
        type: "purchase",
        title: "Compra registrada",
        message: `${coffee?.name || "Café"} · ${kg} kg · Total ${money(purchase.total)}`,
      });
      if (n.mailto) window.open(n.mailto, "_blank");
      closeModal();
      toast("Compra guardada", "Inventario actualizado.");
      checkLowStock();
      renderPurchases();
    });
  }

  function renderSales() {
    els.pageRoot.innerHTML = `
      <section class="page-hero">
        <div>
          <h3>Registro de ventas</h3>
          <p>Descuenta inventario y dispara alertas cuando el café se acaba.</p>
        </div>
        <button class="btn btn-primary" style="width:auto" type="button" id="btn-add-sale">Registrar venta</button>
      </section>
      <section class="panel table-wrap">
        ${
          state.sales.length
            ? `<table>
              <thead><tr><th>Fecha</th><th>Cliente</th><th>Café</th><th>Kg</th><th>Total</th></tr></thead>
              <tbody>
                ${state.sales
                  .map((s) => {
                    const coffee = coffeeById(s.coffeeId);
                    const client = clientById(s.clientId);
                    return `<tr>
                      <td>${escapeHtml(s.date)}</td>
                      <td>${escapeHtml(client?.name || "—")}</td>
                      <td>${escapeHtml(coffee?.name || "—")}</td>
                      <td>${s.kg}</td>
                      <td>${money(s.total)}</td>
                    </tr>`;
                  })
                  .join("")}
              </tbody>
            </table>`
            : `<div class="empty">Sin ventas registradas todavía.</div>`
        }
      </section>
    `;
    document.getElementById("btn-add-sale")?.addEventListener("click", openSaleForm);
  }

  function openSaleForm() {
    openModal({
      title: "Registrar venta",
      bodyHtml: `
        <form id="sale-form" class="form-grid">
          <div class="field"><label>Cliente</label>
            <select name="clientId">${state.clients.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")}</select>
          </div>
          <div class="field"><label>Café</label>
            <select name="coffeeId">${state.coffees.map((c) => `<option value="${c.id}">${escapeHtml(c.name)} (${stockForCoffee(c.id).toFixed(1)} kg)</option>`).join("")}</select>
          </div>
          <div class="field"><label>Fecha</label><input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}" /></div>
          <div class="field"><label>Kg vendidos (inventario origen)</label><input name="kg" type="number" min="0.1" step="0.1" value="5" required /></div>
          <div class="field"><label>Precio venta $/kg</label><input name="pricePerKg" type="number" min="0" value="0" required /></div>
          <div class="field full"><label>Notas</label><textarea name="notes"></textarea></div>
        </form>
      `,
      footerHtml: `
        <button class="btn btn-ghost" type="button" data-close-modal>Cancelar</button>
        <button class="btn btn-primary" style="width:auto" type="button" id="save-sale">Guardar venta</button>
      `,
    });

    const form = els.modalRoot.querySelector("#sale-form");
    const syncPrice = () => {
      const coffee = coffeeById(form.coffeeId.value);
      if (!coffee) return;
      const unit = BCACalc.computeUnitCost({
        coffee,
        costs: state.productionCosts,
        mermas: state.mermas,
        packFormatId: "250g",
      });
      const priced = BCACalc.applyMargin(unit.totalCostPerKg, 35);
      form.pricePerKg.value = Math.round(priced.salePricePerKg);
    };
    form.coffeeId.addEventListener("change", syncPrice);
    syncPrice();

    els.modalRoot.querySelector("#save-sale").addEventListener("click", () => {
      const fd = new FormData(form);
      const coffeeId = String(fd.get("coffeeId"));
      const kg = Number(fd.get("kg"));
      const available = stockForCoffee(coffeeId);
      if (kg > available) {
        toast("Stock insuficiente", `Solo hay ${available.toFixed(2)} kg disponibles.`);
        return;
      }
      deductInventory(coffeeId, kg);
      const sale = {
        id: BCA.createId("vta"),
        clientId: String(fd.get("clientId")),
        coffeeId,
        date: String(fd.get("date")),
        kg,
        pricePerKg: Number(fd.get("pricePerKg")),
        total: kg * Number(fd.get("pricePerKg")),
        notes: String(fd.get("notes") || ""),
        createdAt: new Date().toISOString(),
      };
      state.sales.unshift(sale);
      persist();
      const coffee = coffeeById(coffeeId);
      const client = clientById(sale.clientId);
      const n = pushNotification({
        type: "sale",
        title: "Venta registrada",
        message: `${client?.name || "Cliente"} compró ${kg} kg de ${coffee?.name || "café"} · ${money(sale.total)}`,
      });
      if (n.mailto) window.open(n.mailto, "_blank");
      closeModal();
      toast("Venta guardada", "Inventario descontado.");
      checkLowStock();
      renderSales();
    });
  }

  function deductInventory(coffeeId, kg) {
    let remaining = kg;
    const lots = state.inventoryLots.filter(
      (l) => l.coffeeId === coffeeId && l.kgAvailable > 0
    );
    for (const lot of lots) {
      if (remaining <= 0) break;
      const take = Math.min(lot.kgAvailable, remaining);
      lot.kgAvailable -= take;
      remaining -= take;
    }
  }

  function renderInventory() {
    els.pageRoot.innerHTML = `
      <section class="page-hero">
        <div>
          <h3>Inventario & mermas</h3>
          <p>Simula el rendimiento según la forma del café y proyecta cuánto producto final obtienes.</p>
        </div>
      </section>
      <section class="two-col">
        <div class="panel">
          <div class="panel-head"><h4>Lotes</h4></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Café</th><th>Forma</th><th>Disponible</th><th>Original</th></tr></thead>
              <tbody>
                ${state.inventoryLots
                  .map((l) => {
                    const coffee = coffeeById(l.coffeeId);
                    return `<tr>
                      <td>${escapeHtml(coffee?.name || "—")}</td>
                      <td>${escapeHtml(l.form)}</td>
                      <td>${Number(l.kgAvailable).toFixed(2)} kg</td>
                      <td>${Number(l.kgOriginal).toFixed(2)} kg</td>
                    </tr>`;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><h4>Simulador de mermas</h4></div>
          <div class="panel-body">
            <form id="merma-sim" class="stack">
              <div class="field"><label>Forma de entrada</label>${choiceGroup(
                "form",
                state.catalogs.forms,
                "verde",
                (o) => o.label
              )}</div>
              <div class="field"><label>Kg de entrada</label><input name="kg" type="number" value="100" min="0.1" step="0.1" /></div>
              <button class="btn btn-soft" type="submit">Calcular</button>
            </form>
            <div id="merma-result" style="margin-top:1rem"></div>
          </div>
        </div>
      </section>
    `;
    const form = els.pageRoot.querySelector("#merma-sim");
    bindChoiceGroups(form);
    const run = () => {
      const formType = getSelectedChoice(form, "form");
      const kg = Number(form.kg.value);
      const result = BCACalc.projectAfterMermas(formType, state.mermas, kg);
      els.pageRoot.querySelector("#merma-result").innerHTML = `
        ${result.steps
          .map(
            (s) =>
              `<div class="kpi-line"><span>Merma ${s.stage}</span><span>-${s.lossKg.toFixed(2)} kg → ${s.remainingKg.toFixed(2)} kg</span></div>`
          )
          .join("")}
        <div class="kpi-line"><span>Producto final estimado</span><strong>${result.finalKg.toFixed(2)} kg</strong></div>
      `;
    };
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      run();
    });
    run();
  }

  function renderBranding() {
    const b = state.branding;
    els.pageRoot.innerHTML = `
      <section class="page-hero">
        <div>
          <h3>Marca & apariencia</h3>
          <p>Sube el logo y ajusta el nombre, tagline y acento visual (escala de grises).</p>
        </div>
      </section>
      <section class="panel">
        <div class="panel-body">
          <form id="brand-form" class="form-grid">
            <div class="field full"><label>Nombre de marca</label><input name="brandName" value="${escapeHtml(b.brandName)}" /></div>
            <div class="field full"><label>Tagline del hero</label><input name="heroTagline" value="${escapeHtml(b.heroTagline)}" /></div>
            <div class="field"><label>Acento (hex gris/claro)</label><input name="accent" type="color" value="${b.accent || '#c8c8c8'}" /></div>
            <div class="field"><label>Logo</label><input name="logo" type="file" accept="image/*" /></div>
            <div class="field full">
              ${b.logoDataUrl ? `<img src="${b.logoDataUrl}" alt="Logo" style="max-height:80px;border-radius:12px;border:1px solid var(--line)" />` : `<div class="muted">Sin logo todavía — se muestra el monograma BC.</div>`}
            </div>
            <div class="field full actions">
              <button class="btn btn-primary" style="width:auto" type="submit">Guardar apariencia</button>
              <button class="btn btn-danger btn-sm" type="button" id="btn-reset-data">Reiniciar datos demo</button>
            </div>
          </form>
        </div>
      </section>
    `;
    const form = els.pageRoot.querySelector("#brand-form");
    let logoDataUrl = b.logoDataUrl;
    form.logo.addEventListener("change", async () => {
      const file = form.logo.files?.[0];
      if (file) logoDataUrl = await readFileAsDataURL(file);
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      state.branding = {
        ...state.branding,
        brandName: String(fd.get("brandName")),
        heroTagline: String(fd.get("heroTagline")),
        accent: String(fd.get("accent")),
        logoDataUrl,
      };
      persist();
      applyBranding();
      toast("Apariencia", "Marca actualizada.");
      renderBranding();
    });
    document.getElementById("btn-reset-data")?.addEventListener("click", () => {
      if (!confirm("Esto reinicia toda la plataforma a los datos demo. ¿Continuar?")) return;
      const session = state.session;
      state = BCA.resetPlatform();
      state.session = session;
      persist();
      applyBranding();
      toast("Reinicio", "Datos demo restaurados.");
      navigate("dashboard");
    });
  }

  function renderNotifications() {
    els.pageRoot.innerHTML = `
      <section class="page-hero">
        <div>
          <h3>Notificaciones</h3>
          <p>Cotizaciones, compras, ventas y alertas de inventario. Destino: ${BCA.NOTIFY_EMAIL}</p>
        </div>
        <button class="btn btn-ghost" type="button" id="mark-all-read">Marcar todo leído</button>
      </section>
      <section class="alert-list">
        ${
          state.notifications.length
            ? state.notifications
                .map(
                  (n) => `<article class="alert-item">
                  <div class="actions" style="justify-content:space-between">
                    <strong>${escapeHtml(n.title)}</strong>
                    <span class="badge">${escapeHtml(n.type)}</span>
                  </div>
                  <div class="soft">${escapeHtml(n.message)}</div>
                  <div class="muted" style="margin-top:.4rem">${new Date(n.createdAt).toLocaleString("es-CO")}</div>
                  <div class="actions" style="margin-top:.6rem">
                    ${n.mailto ? `<a class="btn btn-soft btn-sm" href="${n.mailto}">Enviar correo</a>` : ""}
                  </div>
                </article>`
                )
                .join("")
            : `<div class="empty">Sin notificaciones.</div>`
        }
      </section>
    `;
    document.getElementById("mark-all-read")?.addEventListener("click", () => {
      state.notifications.forEach((n) => {
        n.read = true;
      });
      persist();
      updateNotifDot();
      renderNotifications();
    });
    state.notifications.forEach((n) => {
      n.read = true;
    });
    persist();
    updateNotifDot();
  }

  /* ——— Boot ——— */
  function init() {
    applyBranding();

    els.loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const username = document.getElementById("login-user").value.trim().toLowerCase();
      const password = document.getElementById("login-pass").value;
      const user = BCA.USERS.find(
        (u) => u.username === username && u.password === password
      );
      if (!user) {
        els.loginError.textContent = "Usuario o clave incorrectos.";
        els.loginError.classList.remove("hidden");
        return;
      }
      els.loginError.classList.add("hidden");
      state.session = {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
      };
      state.meta.lastLoginAt = new Date().toISOString();
      // Forzar prompt de costos en cada ingreso
      state.costPromptDismissedAt = null;
      persist();
      showApp();
      toast("Bienvenido", user.name);
    });

    document.getElementById("btn-logout")?.addEventListener("click", () => {
      state.session = null;
      persist();
      showAuth();
    });

    document.getElementById("btn-menu")?.addEventListener("click", () => {
      els.sidebar.classList.toggle("open");
    });

    document.getElementById("btn-quick-quote")?.addEventListener("click", () => openQuoteBuilder());
    document.getElementById("btn-notifications")?.addEventListener("click", () =>
      navigate("notifications")
    );

    if (state.session) showApp();
    else showAuth();
  }

  init();
})();
