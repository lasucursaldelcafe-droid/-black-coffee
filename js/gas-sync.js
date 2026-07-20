const GasSync = {
  enabled: false,
  ready: false,
  syncing: false,
  lastSyncAt: null,
  lastError: null,
  _writeTimers: {},
  _pendingPushKeys: new Set(),
  _suppressRemote: false,
  _periodicTimer: null,

  isConfigured() {
    return Boolean(window.GAS_SYNC_CONFIG?.webAppUrl && window.GAS_SYNC_CONFIG?.syncKey);
  },

  isEnabled() {
    return this.enabled && this.ready;
  },

  canWrite() {
    return this.isConfigured();
  },

  getDeviceId() {
    return Storage.getDeviceId();
  },

  getAllSyncKeys() {
    return SyncShared.getAllSyncKeys();
  },

  startInBackground() {
    if (!this.isConfigured()) return Promise.resolve(false);
    if (this._initPromise) return this._initPromise;

    this._initPromise = this._bootstrap().catch((error) => {
      console.warn('GasSync:', error.message);
      this.lastError = error.message;
      return false;
    });
    return this._initPromise;
  },

  async _bootstrap() {
    this.enabled = true;
    this.ready = true;
    this.lastError = null;
    this.updateStatusElement();

    if (typeof Storage !== 'undefined') {
      Storage.purgeDeletedFromStorage();
    }

    await this.syncAll({ silent: true, forcePush: true }).catch((e) => {
      console.warn('GasSync inicial:', e.message);
    });

    this._startPeriodicSync();
    window.dispatchEvent(new CustomEvent('bca-sync-status', { detail: { gas: true } }));
    return true;
  },

  _startPeriodicSync() {
    if (this._periodicTimer) return;
    this._periodicTimer = setInterval(() => {
      if (!navigator.onLine || this.syncing) return;
      this.syncAll({ silent: true }).catch(() => {});
    }, 10000);
  },

  _buildLocalDocument() {
    return SyncShared.buildLocalDocument(
      () => this.getAllSyncKeys(),
      () => this.getDeviceId()
    );
  },

  _localRecordCount() {
    return this.getAllSyncKeys().reduce((sum, key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return sum;
      try {
        const parsed = JSON.parse(raw);
        return sum + (Array.isArray(parsed) ? parsed.length : 1);
      } catch {
        return sum + 1;
      }
    }, 0);
  },

  _remoteRecordCount(doc) {
    if (!doc?.keys) return 0;
    return Object.values(doc.keys).reduce((sum, entry) => {
      const p = entry?.payload ?? entry;
      return sum + (Array.isArray(p) ? p.length : (p ? 1 : 0));
    }, 0);
  },

  async _apiCall(payload, useGet = false) {
    const cfg = window.GAS_SYNC_CONFIG;
    if (!cfg?.webAppUrl) throw new Error('Apps Script no configurado');

    if (useGet && payload.action === 'pull') {
      const url = `${cfg.webAppUrl}?action=pull&key=${encodeURIComponent(cfg.syncKey)}&t=${Date.now()}`;
      const response = await fetch(url, { cache: 'no-store' });
      const text = await response.text();
      return JSON.parse(text);
    }

    const response = await fetch(cfg.webAppUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, key: cfg.syncKey })
    });

    const text = await response.text();
    if (
      text.includes('Access Denied')
      || text.includes('Page Not Found')
      || text.includes('unable to open the file')
      || text.includes('accounts.google.com')
      || text.trimStart().startsWith('<!DOCTYPE')
      || text.trimStart().startsWith('<!doctype')
    ) {
      throw new Error(
        'Apps Script no es público. Implementar → Aplicación web → acceso «Cualquier persona» (no «solo yo» ni «usuarios Google»).'
      );
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Respuesta Apps Script inválida: ${text.slice(0, 200)}`);
    }
  },

  async fetchRemoteDocument() {
    const result = await this._apiCall({ action: 'pull' }, true);
    if (result.error) throw new Error(result.error);
    return result.document || result;
  },

  async syncAll(options = {}) {
    if (!this.isConfigured()) throw new Error('Apps Script no configurado');
    if (this.syncing) return { pushed: 0, pulled: 0 };

    this.syncing = true;
    let pushed = 0;
    let pulled = 0;

    try {
      const localDoc = this._buildLocalDocument();
      const result = await this._apiCall({
        action: 'sync',
        document: localDoc
      });

      if (result.error) throw new Error(result.error);

      const remoteDoc = result.document || { keys: {} };
      const remoteKeys = remoteDoc.keys || {};

      this.getAllSyncKeys().forEach((key) => {
        const localRaw = localStorage.getItem(key);
        const remoteEntry = remoteKeys[key];
        const localPayload = localRaw
          ? SyncShared.sanitizeRemotePayload(key, JSON.parse(localRaw))
          : null;
        const localMeta = typeof Storage !== 'undefined' ? Storage.getLocalSyncMeta() : {};
        const localUpdatedAt = localMeta[key] || SyncShared.getLocalUpdatedAt(key);

        const reconcile = SyncShared.reconcilePayload(
          key,
          localPayload,
          {
            payload: remoteEntry?.payload ?? remoteEntry,
            updatedAt: remoteEntry?.updatedAt
          },
          { localUpdatedAt }
        );

        if (reconcile.changed && reconcile.merged !== null) {
          this._applyMergedLocal(key, reconcile.merged);
          pulled += 1;
        }
      });

      pushed = Object.keys(localDoc.keys).length;

      this.lastSyncAt = new Date().toISOString();
      this.lastError = null;

      if (!options.silent) {
        window.dispatchEvent(new CustomEvent('bca-sync-complete', {
          detail: { pushed, pulled, at: this.lastSyncAt, source: 'gas' }
        }));
      }

      if (pulled > 0) {
        window.dispatchEvent(new CustomEvent('bca-data-changed', { detail: { source: 'gas-sync' } }));
      }

      return { pushed, pulled };
    } catch (error) {
      this.lastError = error.message || 'Error Apps Script';
      throw error;
    } finally {
      this.syncing = false;
      this.updateStatusElement();
    }
  },

  async publishAllLocalData(options = {}) {
    const result = await this.syncAll({ silent: true, forcePush: true });
    this.lastSyncAt = new Date().toISOString();
    window.dispatchEvent(new CustomEvent('bca-sync-complete', {
      detail: { ...result, at: this.lastSyncAt, source: 'gas-publish' }
    }));
    return result;
  },

  queuePush(key, options = {}) {
    if (this._suppressRemote || !this.getAllSyncKeys().includes(key)) return;
    this._pendingPushKeys.add(key);
    if (!navigator.onLine) {
      if (typeof OfflineSync !== 'undefined') OfflineSync.markPending(key);
      return;
    }
    clearTimeout(this._writeTimers.all);
    const delay = options.immediate ? 0 : 800;
    const runSync = () => {
      this.syncAll({ silent: true }).catch((e) => {
        this.lastError = e.message;
      });
    };
    if (options.immediate) {
      runSync();
      return;
    }
    this._writeTimers.all = setTimeout(runSync, delay);
  },

  getLocalDataSummary() {
    return SyncShared.getLocalDataSummary();
  },

  _applyMergedLocal(key, merged) {
    this._suppressRemote = true;
    SyncShared.applyMergedLocal(key, merged);
    this._suppressRemote = false;
  },

  getStatusLabel() {
    if (!this.isConfigured()) return 'Apps Script: pendiente de URL (ver apps-script/README.md)';
    if (this.syncing) return 'Sincronizando vía Google Apps Script...';
    if (this.lastError && !this.lastSyncAt) return `Apps Script: ${this.lastError}`;
    const when = this.lastSyncAt
      ? new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' }).format(new Date(this.lastSyncAt))
      : null;
    return when
      ? `Nube Google activa · ${when}`
      : 'Nube Google (Apps Script) — sync automática';
  },

  updateStatusElement() {
    const el = document.getElementById('gas-sync-status');
    if (el) el.replaceChildren(document.createTextNode(this.getStatusLabel()));
    const combined = document.getElementById('firebase-sync-status');
    if (combined && this.isConfigured() && this.ready) {
      combined.replaceChildren(document.createTextNode(this.getStatusLabel()));
    }
  }
};
