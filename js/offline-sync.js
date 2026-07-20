/**
 * Modo offline local-first: este dispositivo es la memoria principal
 * mientras no hay conexión; al reconectar se sincroniza con la nube.
 */
const OFFLINE_PENDING_KEY = 'bca_offline_pending_keys';

const OfflineSync = {
  getPendingKeys() {
    try {
      const raw = localStorage.getItem(OFFLINE_PENDING_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  savePendingKeys(keys) {
    localStorage.setItem(OFFLINE_PENDING_KEY, JSON.stringify([...new Set(keys)]));
    this.updateBanner();
  },

  markPending(key) {
    if (!key || navigator.onLine) return;
    const next = [...this.getPendingKeys(), key];
    this.savePendingKeys(next);
    window.dispatchEvent(new CustomEvent('bca-offline-pending', { detail: { key, count: next.length } }));
  },

  clearPending(key) {
    const next = this.getPendingKeys().filter((k) => k !== key);
    this.savePendingKeys(next);
  },

  clearAllPending() {
    this.savePendingKeys([]);
  },

  getPendingCount() {
    return this.getPendingKeys().length;
  },

  isOnline() {
    return navigator.onLine;
  },

  getDeviceShortId() {
    if (typeof Storage === 'undefined') return 'local';
    return Storage.getDeviceId().replace(/^dev_/, '').slice(-8);
  },

  getLocalMemorySummary() {
    if (typeof SyncHub === 'undefined' || typeof SyncHub.getLocalDataSummary !== 'function') {
      return {};
    }
    return SyncHub.getLocalDataSummary();
  },

  renderLocalMemoryLine() {
    const summary = this.getLocalMemorySummary();
    const total = Object.values(summary).reduce((sum, n) => sum + (Number(n) || 0), 0);
    const pending = this.getPendingCount();
    const device = this.getDeviceShortId();
    if (!this.isOnline()) {
      return `📱 Dispositivo ${device} · memoria local (${total} registros)${pending ? ` · ${pending} pendiente(s) de sync` : ''}`;
    }
    if (pending > 0) {
      return `📤 Sincronizando ${pending} cambio(s) desde dispositivo ${device}…`;
    }
    return `📱 Dispositivo ${device} · datos en este equipo sincronizados con la nube`;
  },

  async flushPending() {
    if (!this.isOnline()) return { flushed: false, reason: 'offline' };

    const pending = this.getPendingKeys();
    if (typeof SyncHub !== 'undefined') {
      pending.forEach((key) => SyncHub.queuePush(key));
      try {
        await SyncHub.forceSync({ silent: pending.length === 0 });
        this.clearAllPending();
        this.updateBanner();
        if (typeof SyncHub.updateStatusElement === 'function') {
          SyncHub.updateStatusElement();
        }
        window.dispatchEvent(new CustomEvent('bca-data-changed', { detail: { source: 'offline-flush' } }));
        return { flushed: true, count: pending.length };
      } catch (error) {
        console.warn('OfflineSync flush:', error.message);
        return { flushed: false, error: error.message };
      }
    }
    return { flushed: false, reason: 'no-sync-hub' };
  },

  updateBanner() {
    const banner = document.getElementById('offline-banner');
    if (!banner) return;

    const offline = !this.isOnline();
    const pending = this.getPendingCount();
    const device = this.getDeviceShortId();

    if (!offline && pending === 0) {
      banner.hidden = true;
      banner.innerHTML = '';
      document.documentElement.classList.remove('bca-offline-mode');
      return;
    }

    banner.hidden = false;
    document.documentElement.classList.toggle('bca-offline-mode', offline);

    if (offline) {
      banner.innerHTML = `
        <div class="offline-banner-inner">
          <span class="offline-banner-icon">📴</span>
          <div class="offline-banner-text">
            <strong>Sin conexión — modo local activo</strong>
            <span>Este dispositivo (${device}) guarda todos los cambios. Al reconectar se sincronizarán con la nube automáticamente.</span>
          </div>
          ${pending > 0 ? `<span class="badge badge-warning">${pending} pendiente(s)</span>` : ''}
        </div>`;
      return;
    }

    banner.innerHTML = `
      <div class="offline-banner-inner offline-banner-inner--syncing">
        <span class="offline-banner-icon">🔄</span>
        <div class="offline-banner-text">
          <strong>Conexión restaurada — sincronizando…</strong>
          <span>Enviando ${pending} cambio(s) desde este dispositivo a la nube.</span>
        </div>
        <button type="button" class="btn btn-sm btn-primary" id="offline-sync-now-btn">Sync ahora</button>
      </div>`;

    document.getElementById('offline-sync-now-btn')?.addEventListener('click', () => {
      this.flushPending().then((result) => {
        if (result.flushed) {
          Toast?.show('Datos sincronizados con la nube', 'success');
        } else if (result.error) {
          Toast?.show(`Sync: ${result.error}`, 'warning');
        }
      });
    });
  },

  bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    window.addEventListener('online', () => {
      this.updateBanner();
      Toast?.show('Conexión restaurada — sincronizando datos de este dispositivo…', 'info');
      this.flushPending();
    });

    window.addEventListener('offline', () => {
      this.updateBanner();
      Toast?.show('Sin conexión — los datos se guardan en este dispositivo', 'warning');
      if (typeof SyncHub !== 'undefined' && SyncHub.updateStatusElement) {
        SyncHub.updateStatusElement();
      }
    });

    window.addEventListener('bca-offline-pending', () => this.updateBanner());
    window.addEventListener('bca-sync-complete', () => {
      if (this.isOnline() && this.getPendingCount() === 0) {
        this.updateBanner();
      }
    });
  },

  init() {
    this.bindEvents();
    this.updateBanner();
  }
};
