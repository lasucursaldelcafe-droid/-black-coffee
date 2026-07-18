/* Persistencia local */
window.BC = window.BC || {};

BC.STORAGE_KEY = "black-coffee-admin-v1";

BC.Storage = {
  load() {
    try {
      const raw = localStorage.getItem(BC.STORAGE_KEY);
      if (!raw) {
        const fresh = structuredClone(BC.DEFAULT_STATE);
        this.save(fresh);
        return fresh;
      }
      const parsed = JSON.parse(raw);
      return this.mergeDefaults(parsed);
    } catch (err) {
      console.error("Storage load error", err);
      return structuredClone(BC.DEFAULT_STATE);
    }
  },

  save(state) {
    localStorage.setItem(BC.STORAGE_KEY, JSON.stringify(state));
  },

  mergeDefaults(state) {
    const base = structuredClone(BC.DEFAULT_STATE);
    return {
      ...base,
      ...state,
      costs: { ...base.costs, ...(state.costs || {}) },
      appearance: { ...base.appearance, ...(state.appearance || {}) },
      clients: state.clients?.length ? state.clients : base.clients,
      providers: state.providers?.length ? state.providers : base.providers,
      coffees: state.coffees?.length ? state.coffees : base.coffees,
      inventoryLots: state.inventoryLots?.length ? state.inventoryLots : base.inventoryLots,
      purchases: state.purchases?.length ? state.purchases : base.purchases,
      quotes: state.quotes || [],
      sales: state.sales || [],
      notifications: state.notifications || [],
    };
  },

  reset() {
    localStorage.removeItem(BC.STORAGE_KEY);
    return this.load();
  },
};
