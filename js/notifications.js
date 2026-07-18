/* Sistema de notificaciones + mailto al correo operativo */
window.BC = window.BC || {};

BC.Notify = {
  push(state, { type, title, message, openMail = true }) {
    const item = {
      id: BC.uid("ntf"),
      type,
      title,
      message,
      read: false,
      createdAt: new Date().toISOString(),
    };
    state.notifications.unshift(item);
    if (state.notifications.length > 100) {
      state.notifications.length = 100;
    }
    BC.Storage.save(state);

    if (openMail) {
      this.openMail(title, message);
    }
    return item;
  },

  openMail(subject, body) {
    const mailto = `mailto:${encodeURIComponent(BC.NOTIFY_EMAIL)}?subject=${encodeURIComponent(
      `[Black Coffee] ${subject}`
    )}&body=${encodeURIComponent(body + "\n\n— Black Coffee Administration")}`;
    // Evita bloquear UX: solo abre si el usuario confirma en contexto de acción
    try {
      window.open(mailto, "_blank");
    } catch (_) {
      /* ignore */
    }
  },

  unreadCount(state) {
    return state.notifications.filter((n) => !n.read).length;
  },

  markAllRead(state) {
    state.notifications.forEach((n) => {
      n.read = true;
    });
    BC.Storage.save(state);
  },

  checkInventoryAlerts(state) {
    const umbral = state.costs.umbralInventarioKg || 15;
    const alerts = [];
    for (const coffee of state.coffees) {
      const verde = Number(coffee.stockVerdeKg) || 0;
      const tostado = Number(coffee.stockTostadoKg) || 0;
      const total = verde + tostado;
      if (total <= umbral) {
        alerts.push({
          coffee,
          total,
          umbral,
        });
      }
    }
    return alerts;
  },
};
