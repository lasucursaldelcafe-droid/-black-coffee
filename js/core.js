/**
 * Storage, auth, helpers, notifications
 */
(function () {
  const BCA = window.BCA;

  function uid(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
  }

  function money(n) {
    const v = Number(n) || 0;
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(v);
  }

  function num(n, d = 2) {
    return Number(n || 0).toLocaleString("es-CO", {
      minimumFractionDigits: 0,
      maximumFractionDigits: d,
    });
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(BCA.STORAGE_KEY);
      if (!raw) {
        const seeded = BCA.seedState();
        saveState(seeded);
        return seeded;
      }
      const parsed = JSON.parse(raw);
      return migrate(parsed);
    } catch (e) {
      console.error(e);
      const seeded = BCA.seedState();
      saveState(seeded);
      return seeded;
    }
  }

  function migrate(state) {
    const base = BCA.seedState();
    return {
      ...base,
      ...state,
      costs: { ...base.costs, ...(state.costs || {}), packaging: { ...base.costs.packaging, ...(state.costs?.packaging || {}) }, merma: { ...base.costs.merma, ...(state.costs?.merma || {}) } },
      branding: { ...base.branding, ...(state.branding || {}) },
      suppliers: state.suppliers || base.suppliers,
      coffees: state.coffees || base.coffees,
      clients: state.clients || base.clients,
      inventory: state.inventory || base.inventory,
      purchases: state.purchases || base.purchases,
      sales: state.sales || base.sales,
      quotes: state.quotes || base.quotes,
      notifications: state.notifications || base.notifications,
    };
  }

  function saveState(state) {
    localStorage.setItem(BCA.STORAGE_KEY, JSON.stringify(state));
  }

  function getState() {
    if (!BCA._state) BCA._state = loadState();
    return BCA._state;
  }

  function setState(mutator) {
    const state = getState();
    const next = typeof mutator === "function" ? mutator(state) : mutator;
    BCA._state = next;
    saveState(next);
    return next;
  }

  function login(userId, password) {
    const user = BCA.USERS[userId];
    if (!user || user.password !== password) {
      return { ok: false, error: "Usuario o contraseña incorrectos." };
    }
    setState((s) => ({
      ...s,
      session: { userId: user.id, name: user.name, role: user.role, at: Date.now() },
    }));
    return { ok: true, user };
  }

  function logout() {
    setState((s) => ({ ...s, session: null, costCheckDoneAt: null }));
  }

  function currentUser() {
    return getState().session;
  }

  function toast(message) {
    const stack = document.getElementById("toast-stack");
    if (!stack) return;
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    stack.appendChild(el);
    setTimeout(() => {
      el.style.opacity = "0";
      el.style.transition = "opacity .3s";
      setTimeout(() => el.remove(), 300);
    }, 3200);
  }

  function pushNotification({ type, title, body, openMail = true }) {
    const item = {
      id: uid("n"),
      type: type || "general",
      title,
      body,
      email: BCA.NOTIFY_EMAIL,
      read: false,
      createdAt: Date.now(),
    };
    setState((s) => ({ ...s, notifications: [item, ...s.notifications] }));
    if (openMail) {
      const subject = encodeURIComponent(`[Black Coffee] ${title}`);
      const mailBody = encodeURIComponent(
        `${body}\n\n—\nBlack Coffee Administration\nUsuario: ${currentUser()?.name || "sistema"}`
      );
      // Intento no bloqueante: el usuario puede enviar desde su cliente de correo
      try {
        const a = document.createElement("a");
        a.href = `mailto:${BCA.NOTIFY_EMAIL}?subject=${subject}&body=${mailBody}`;
        a.rel = "noopener";
        // No auto-click agresivo en cada acción; se deja disponible vía UI
        item.mailto = a.href;
      } catch (_) {
        /* ignore */
      }
    }
    document.dispatchEvent(new CustomEvent("bca:notifications"));
    return item;
  }

  function unreadCount() {
    return getState().notifications.filter((n) => !n.read).length;
  }

  function markAllRead() {
    setState((s) => ({
      ...s,
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    }));
    document.dispatchEvent(new CustomEvent("bca:notifications"));
  }

  function applyBranding() {
    const b = getState().branding;
    const root = document.documentElement;
    if (b.accent) root.style.setProperty("--accent", b.accent);
    if (b.background) root.style.setProperty("--bg", b.background);

    const logos = [
      ["login-logo", "login-logo-fallback"],
      ["sidebar-logo", "sidebar-logo-fallback"],
    ];
    logos.forEach(([imgId, fallbackId]) => {
      const img = document.getElementById(imgId);
      const fb = document.getElementById(fallbackId);
      if (!img || !fb) return;
      if (b.logoDataUrl) {
        img.src = b.logoDataUrl;
        img.classList.remove("is-hidden");
        fb.classList.add("is-hidden");
      } else {
        img.classList.add("is-hidden");
        fb.classList.remove("is-hidden");
      }
    });
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function findCoffee(id) {
    return getState().coffees.find((c) => c.id === id);
  }

  function findClient(id) {
    return getState().clients.find((c) => c.id === id);
  }

  function inventoryByCoffee(coffeeId) {
    return getState().inventory.filter((i) => i.coffeeId === coffeeId);
  }

  function stockSummary(coffeeId) {
    const rows = inventoryByCoffee(coffeeId);
    return rows.reduce(
      (acc, r) => {
        acc.green += Number(r.kgAvailableGreen) || 0;
        acc.roasted += Number(r.kgAvailableRoasted) || 0;
        return acc;
      },
      { green: 0, roasted: 0 }
    );
  }

  function checkLowStock() {
    const state = getState();
    const threshold = state.costs.lowStockKg;
    const alerts = [];
    state.coffees.forEach((c) => {
      const s = stockSummary(c.id);
      const total = s.green + s.roasted;
      if (total <= threshold) {
        alerts.push({ coffee: c, stock: s, total });
      }
    });
    return alerts;
  }

  BCA.util = {
    uid,
    money,
    num,
    today,
    loadState,
    saveState,
    getState,
    setState,
    login,
    logout,
    currentUser,
    toast,
    pushNotification,
    unreadCount,
    markAllRead,
    applyBranding,
    readFileAsDataURL,
    findCoffee,
    findClient,
    inventoryByCoffee,
    stockSummary,
    checkLowStock,
  };
})();
