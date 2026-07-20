/**
 * Orquestador de sync — elige el mejor backend disponible y fuerza sync al conectar.
 */
const SyncHub = {
  primary: null,
  ready: false,
  lastSyncAt: null,
  lastError: null,
  syncing: false,

  backends() {
    const list = [];
    if (typeof GasSync !== 'undefined' && GasSync.isConfigured()) list.push(GasSync);
    if (typeof FirebaseHttpSync !== 'undefined' && FirebaseHttpSync.isConfigured()) list.push(FirebaseHttpSync);
    if (typeof FirebaseSync !== 'undefined') list.push(FirebaseSync);
    if (typeof CloudSync !== 'undefined') list.push(CloudSync);
    return list;
  },

  getPrimary() {
    if (this.primary) return this.primary;
    if (typeof GasSync !== 'undefined' && GasSync.isConfigured() && GasSync.ready) return GasSync;
    if (typeof FirebaseHttpSync !== 'undefined' && FirebaseHttpSync.isConfigured() && FirebaseHttpSync.ready) {
      return FirebaseHttpSync;
    }
    if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isEnabled() && !FirebaseSync.permissionDenied) {
      return FirebaseSync;
    }
    if (typeof CloudSync !== 'undefined' && CloudSync.ready) return CloudSync;
    return null;
  },

  canWrite() {
    const p = this.getPrimary();
    if (!p) return false;
    if (typeof p.canWrite === 'function') return p.canWrite();
    return Boolean(p.isEnabled && p.isEnabled());
  },

  getLocalDataSummary() {
    const p = this.getPrimary();
    if (p?.getLocalDataSummary) return p.getLocalDataSummary();
    if (typeof SyncShared !== 'undefined') return SyncShared.getLocalDataSummary();
    return {};
  },

  async startInBackground() {
    const starts = [];

    if (typeof GasSync !== 'undefined' && GasSync.isConfigured()) {
      starts.push(GasSync.startInBackground().then((ok) => {
        if (ok) this.primary = GasSync;
        return ok;
      }));
    }

    if (typeof FirebaseHttpSync !== 'undefined' && FirebaseHttpSync.isConfigured()) {
      starts.push(FirebaseHttpSync.startInBackground().then((ok) => {
        if (ok && !this.primary) this.primary = FirebaseHttpSync;
        return ok;
      }));
    }

    if (typeof FirebaseSync !== 'undefined') {
      starts.push(FirebaseSync.startInBackground().then((ok) => {
        if (ok && !this.primary && !FirebaseSync.permissionDenied) this.primary = FirebaseSync;
        return ok;
      }));
    }

    if (typeof CloudSync !== 'undefined') {
      starts.push(CloudSync.startInBackground().then((ok) => {
        if (ok && !this.primary) this.primary = CloudSync;
        return ok;
      }));
    }

    await Promise.allSettled(starts);

    this.ready = Boolean(this.getPrimary());
    await this.forceSync({ silent: true }).catch(() => {});
    this._bindAutoSyncTriggers();
    this.updateStatusElement();
    window.dispatchEvent(new CustomEvent('bca-sync-status', { detail: { hub: true } }));
    return this.ready;
  },

  _bindAutoSyncTriggers() {
    if (this._triggersBound) return;
    this._triggersBound = true;

    const pullNow = () => {
      if (!navigator.onLine || this.syncing) return;
      const flush = typeof OfflineSync !== 'undefined'
        ? OfflineSync.flushPending()
        : Promise.resolve();
      flush.finally(() => {
        this.forceSync({ silent: true }).then((result) => {
          if ((result?.pulled || 0) > 0) {
            window.dispatchEvent(new CustomEvent('bca-data-changed', { detail: { source: 'auto-sync' } }));
          }
        }).catch(() => {});
      });
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') pullNow();
    });

    window.addEventListener('focus', pullNow);
    window.addEventListener('online', pullNow);

    if (this._autoSyncTimer) clearInterval(this._autoSyncTimer);
    this._autoSyncTimer = setInterval(() => {
      if (document.visibilityState === 'visible') pullNow();
    }, 15000);
  },

  async forceSync(options = {}) {
    this.syncing = true;
    const errors = [];
    let best = { pushed: 0, pulled: 0 };

    const tryBackend = async (backend, label) => {
      if (!backend) return null;
      try {
        if (backend === FirebaseSync && FirebaseSync.permissionDenied) return null;
        if (typeof backend.syncAll === 'function') {
          const result = await backend.syncAll({ silent: true });
          if (result.pulled > best.pulled || result.pushed > best.pushed) {
            best = result;
            this.primary = backend;
          }
          return result;
        }
        if (typeof backend.publishAllLocalData === 'function') {
          return await backend.publishAllLocalData({ skipPull: false });
        }
      } catch (error) {
        errors.push(`${label}: ${error.message}`);
      }
      return null;
    };

    if (typeof GasSync !== 'undefined' && GasSync.isConfigured()) {
      await tryBackend(GasSync, 'gas');
    }
    if (typeof FirebaseHttpSync !== 'undefined' && FirebaseHttpSync.isConfigured()) {
      await tryBackend(FirebaseHttpSync, 'firebase-http');
    }
    await tryBackend(FirebaseSync, 'firebase');
    await tryBackend(CloudSync, 'github');

    this.syncing = false;
    this.lastSyncAt = new Date().toISOString();
    this.lastError = errors[0] || null;
    this.ready = Boolean(this.getPrimary());

    if (!options.silent) {
      window.dispatchEvent(new CustomEvent('bca-sync-complete', {
        detail: { ...best, at: this.lastSyncAt, source: 'sync-hub' }
      }));
    }

    this.updateStatusElement();
    if (errors.length && !this.getPrimary()) {
      throw new Error(errors.join(' · '));
    }
    return best;
  },

  async syncAll(options = {}) {
    const p = this.getPrimary();
    if (!p) return this.forceSync(options);
    this.syncing = true;
    try {
      const result = await p.syncAll({ silent: options.silent !== false });
      this.lastSyncAt = new Date().toISOString();
      this.lastError = null;
      if (!options.silent) {
        window.dispatchEvent(new CustomEvent('bca-sync-complete', {
          detail: { ...result, at: this.lastSyncAt }
        }));
      }
      return result;
    } catch (error) {
      this.lastError = error.message;
      return this.forceSync(options);
    } finally {
      this.syncing = false;
      this.updateStatusElement();
    }
  },

  async publishAllLocalData() {
    const p = this.getPrimary();
    if (p?.publishAllLocalData && (typeof p.canWrite !== 'function' || p.canWrite())) {
      return p.publishAllLocalData();
    }
    return this.forceSync({ silent: false });
  },

  queuePush(key) {
    if (typeof GasSync !== 'undefined' && GasSync.isConfigured()) GasSync.queuePush(key);
    if (typeof FirebaseHttpSync !== 'undefined' && FirebaseHttpSync.isConfigured()) FirebaseHttpSync.queuePush(key);
    if (typeof FirebaseSync !== 'undefined') FirebaseSync.queuePush(key);
    if (typeof CloudSync !== 'undefined') CloudSync.queuePush(key);
  },

  getStatusLabel() {
    if (!navigator.onLine) {
      const pending = typeof OfflineSync !== 'undefined' ? OfflineSync.getPendingCount() : 0;
      const device = typeof OfflineSync !== 'undefined' ? OfflineSync.getDeviceShortId() : 'local';
      return pending > 0
        ? `Sin conexión · ${pending} cambio(s) en dispositivo ${device}`
        : `Sin conexión · datos en dispositivo ${device}`;
    }
    const p = this.getPrimary();
    if (p?.getStatusLabel) return p.getStatusLabel();
    if (typeof GasSync !== 'undefined' && GasSync.isConfigured() && GasSync.ready) {
      return GasSync.getStatusLabel();
    }
    if (typeof GasSync !== 'undefined' && GasSync.isConfigured() && !GasSync.ready) {
      return 'Conectando nube Google (Apps Script)...';
    }
    if (this.lastError) return `Sync: ${this.lastError}`;
    return 'Sincronizando...';
  },

  updateStatusElement() {
    if (typeof GasSync !== 'undefined') GasSync.updateStatusElement();
    if (typeof CloudSync !== 'undefined') CloudSync.updateStatusElement();
    if (typeof FirebaseSync !== 'undefined') FirebaseSync.updateStatusElement();

    const label = this.getStatusLabel();
    document.getElementById('firebase-sync-status')?.replaceChildren(document.createTextNode(label));
    document.getElementById('sidebar-sync-status')?.replaceChildren(document.createTextNode(label));
  }
};
