/**
 * Black Coffee Administration — bootstrap & navigation
 */
(function () {
  const BCA = window.BCA;
  const U = () => BCA.util;

  const TITLES = {
    dashboard: ["Dashboard", "Resumen operativo"],
    costos: ["Costos de producción", "Parámetros base modificables"],
    cafes: ["Variedades de café", "Zona, proceso, precio y transporte"],
    inventario: ["Inventario", "Mermas y conversión a tostado"],
    cotizaciones: ["Cotizaciones", "Costeo + PDF profesional"],
    compras: ["Compras", "Registro de entradas"],
    ventas: ["Ventas", "Salidas y alertas de stock"],
    clientes: ["Clientes", "Final y mayorista"],
    proveedores: ["Proveedores", "Caficultores y zonas"],
    notificaciones: ["Notificaciones", BCA.NOTIFY_EMAIL],
    branding: ["Branding / Visual", "Logo y parámetros visuales"],
  };

  function showView(id) {
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("is-active"));
    document.getElementById(id)?.classList.add("is-active");
  }

  function refreshBadges() {
    const n = U().unreadCount();
    const bell = document.getElementById("bell-count");
    const nav = document.getElementById("nav-notif-count");
    if (bell) bell.textContent = String(n);
    if (nav) nav.textContent = String(n);
  }

  function navigate(route) {
    const session = U().currentUser();
    if (!session) {
      showView("view-login");
      return;
    }
    showView("view-app");
    const content = document.getElementById("content");
    const [title, sub] = TITLES[route] || ["Black Coffee", ""];
    document.getElementById("page-title").textContent = title;
    document.getElementById("page-sub").textContent = sub;
    document.querySelectorAll(".nav-item").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.route === route);
    });
    document.getElementById("sidebar")?.classList.remove("is-open");
    const renderer = BCA.views[route];
    if (renderer) renderer(content);
    else content.innerHTML = `<div class="panel">Vista no encontrada</div>`;
    BCA.app.currentRoute = route;
    refreshBadges();
  }

  function openCostCheckModal() {
    const modal = document.getElementById("modal-cost-check");
    const editor = document.getElementById("cost-check-editor");
    const costs = U().getState().costs;
    let choice = "no";

    editor.innerHTML = BCA.views.costsFormHtml(costs, { idPrefix: "check" });
    editor.classList.add("is-collapsed");

    document.querySelectorAll("[data-cost-choice]").forEach((btn) => {
      btn.classList.toggle("chip--active", btn.dataset.costChoice === "no");
      btn.classList.toggle("is-active", btn.dataset.costChoice === "no");
      btn.onclick = () => {
        choice = btn.dataset.costChoice;
        document.querySelectorAll("[data-cost-choice]").forEach((b) => {
          b.classList.toggle("chip--active", b === btn);
          b.classList.toggle("is-active", b === btn);
        });
        editor.classList.toggle("is-collapsed", choice !== "yes");
      };
    });

    const toggle = document.getElementById("check-alza-on");
    toggle?.addEventListener("change", () => {
      const label = toggle.closest(".toggle")?.querySelector("span:last-child");
      if (label) label.textContent = `Costo de alza ${toggle.checked ? "activo" : "inactivo"}`;
    });

    document.getElementById("btn-confirm-costs").onclick = () => {
      if (choice === "yes") {
        const next = BCA.views.readCostsForm("check");
        U().setState((s) => ({
          ...s,
          costs: next,
          costCheckDoneAt: Date.now(),
        }));
        U().pushNotification({
          type: "produccion",
          title: "Costos actualizados al ingreso",
          body: "Se confirmaron cambios en costos de producción al iniciar sesión.",
        });
        U().toast("Costos actualizados");
      } else {
        U().setState((s) => ({ ...s, costCheckDoneAt: Date.now() }));
      }
      modal.hidden = true;
      navigate("dashboard");
      refreshBadges();
    };

    modal.hidden = false;
  }

  function enterApp() {
    const session = U().currentUser();
    if (!session) return;
    document.getElementById("session-name").textContent = session.name;
    document.getElementById("session-role").textContent = session.role;
    U().applyBranding();
    showView("view-app");
    openCostCheckModal();
  }

  function bindShell() {
    document.getElementById("login-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const userId = document.getElementById("login-user").value;
      const pass = document.getElementById("login-pass").value;
      const err = document.getElementById("login-error");
      const res = U().login(userId, pass);
      if (!res.ok) {
        err.hidden = false;
        err.textContent = res.error;
        return;
      }
      err.hidden = true;
      U().toast(`Bienvenida/o, ${res.user.name}`);
      enterApp();
    });

    document.getElementById("btn-logout")?.addEventListener("click", () => {
      U().logout();
      showView("view-login");
      document.getElementById("login-pass").value = "";
    });

    document.getElementById("main-nav")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-route]");
      if (!btn) return;
      navigate(btn.dataset.route);
    });

    document.getElementById("btn-menu")?.addEventListener("click", () => {
      document.getElementById("sidebar")?.classList.toggle("is-open");
    });

    document.getElementById("btn-quick-quote")?.addEventListener("click", () => navigate("cotizaciones"));
    document.getElementById("btn-bell")?.addEventListener("click", () => navigate("notificaciones"));

    document.querySelectorAll("[data-close-modal]").forEach((el) => {
      el.addEventListener("click", () => {
        document.getElementById("modal-generic").hidden = true;
      });
    });

    document.addEventListener("bca:notifications", refreshBadges);
  }

  function boot() {
    U().getState();
    U().applyBranding();
    bindShell();
    const session = U().currentUser();
    if (session) {
      // Si hay sesión persistida, pedir de nuevo el chequeo de costos al cargar
      document.getElementById("session-name").textContent = session.name;
      document.getElementById("session-role").textContent = session.role;
      showView("view-app");
      openCostCheckModal();
    } else {
      showView("view-login");
    }
    refreshBadges();
  }

  BCA.app = { navigate, refreshBadges, enterApp, currentRoute: "dashboard" };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
