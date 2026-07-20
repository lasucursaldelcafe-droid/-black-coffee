const FirebaseHttpSync = {
  enabled: false,
  ready: false,
  syncing: false,
  lastSyncAt: null,
  lastError: null,
  _periodicTimer: null,
  _pendingPushKeys: new Set(),
  _writeTimers: {},
  _suppressRemote: false,

  isConfigured() {
    return Boolean(window.FIREBASE_HTTP_SYNC_CONFIG?.syncUrl && window.FIREBASE_HTTP_SYNC_CONFIG?.syncKey);
  },

  isEnabled() {
    return this.enabled && this.ready;
  },

  canWrite() {
    return this.isConfigured();
  },

  getAllSyncKeys() {
    return SyncShared.getAllSyncKeys();
  },

  startInBackground() {
    if (!this.isConfigured()) return Promise.resolve(false);
    if (this._initPromise) return this._initPromise;

    this._initPromise = this._bootstrap().catch((error) => {
      console.warn('FirebaseHttpSync:', error.message);
      this.lastError = error.message;
      return false;
    });
    return this._initPromise;
  },

  async _bootstrap() {
    const ok = await this._probe();
    if (!ok) return false;

    this.enabled = true;
    this.ready = true;
    await this.syncAll({ silent: true }).catch(() => {});
    this._startPeriodicSync();
    return true;
  },

  async _probe() {
    try {
      const cfg = window.FIREBASE_HTTP_SYNC_CONFIG;
      const response = await fetch(`${cfg.syncUrl}?action=pull&key=${encodeURIComponent(cfg.syncKey)}`, {
        cache: 'no-store'
      });
      if (response.status === 404) return false;
      const data = await response.json();
      return !data.error || data.keys !== undefined;
    } catch {
      return false;
    }
  },

  _startPeriodicSync() {
    if (this._periodicTimer) return;
    this._periodicTimer = setInterval(() => {
      if (!navigator.onLine || this.syncing) return;
      this.syncAll({ silent: true }).catch(() => {});
    }, 45000);
  },

  _buildLocalDocument() {
    const keys = {};
    const now = Date.now();
    const deviceId = Storage.getDeviceId();
    this.getAllSyncKeys().forEach((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      keys[key] = {
        payload: SyncShared.sanitizeRemotePayload(key, JSON.parse(raw)),
        updatedAt: now,
        deviceId
      };
    });
    return { version: 1, updatedAt: now, deviceId, keys };
  },

  async _apiCall(body) {
    const cfg = window.FIREBASE_HTTP_SYNC_CONFIG;
    const response = await fetch(cfg.syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-bca-sync-key': cfg.syncKey
      },
      body: JSON.stringify({ ...body, key: cfg.syncKey })
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Firebase HTTP ${response.status}: ${text.slice(0, 200)}`);
    }
    return response.json();
  },

  async syncAll(options = {}) {
    if (this.syncing) return { pushed: 0, pulled: 0 };
    this.syncing = true;
    let pulled = 0;

    try {
      const localDoc = this._buildLocalDocument();
      const result = await this._apiCall({ action: 'sync', document: localDoc });
      const remoteDoc = result.document || { keys: {} };

      this.getAllSyncKeys().forEach((key) => {
        const localRaw = localStorage.getItem(key);
        const remoteEntry = remoteDoc.keys?.[key];
        const localPayload = localRaw
          ? SyncShared.sanitizeRemotePayload(key, JSON.parse(localRaw))
          : null;
        const reconcile = SyncShared.reconcilePayload(key, localPayload, {
          payload: remoteEntry?.payload ?? remoteEntry
        });
        if (reconcile.changed && reconcile.merged !== null) {
          this._suppressRemote = true;
          SyncShared.applyMergedLocal(key, reconcile.merged);
          this._suppressRemote = false;
          pulled += 1;
        }
      });

      this.lastSyncAt = new Date().toISOString();
      this.lastError = null;

      if (pulled > 0) {
        window.dispatchEvent(new CustomEvent('bca-data-changed', { detail: { source: 'firebase-http' } }));
      }

      if (!options.silent) {
        window.dispatchEvent(new CustomEvent('bca-sync-complete', {
          detail: { pushed: result.pushed || 0, pulled, at: this.lastSyncAt, source: 'firebase-http' }
        }));
      }

      return { pushed: result.pushed || 0, pulled };
    } catch (error) {
      this.lastError = error.message;
      throw error;
    } finally {
      this.syncing = false;
    }
  },

  async publishAllLocalData() {
    return this.syncAll({ silent: false });
  },

  queuePush(key) {
    if (this._suppressRemote || !this.getAllSyncKeys().includes(key)) return;
    clearTimeout(this._writeTimers.all);
    this._writeTimers.all = setTimeout(() => {
      this.syncAll({ silent: true }).catch(() => {});
    }, 800);
  },

  getLocalDataSummary() {
    return SyncShared.getLocalDataSummary();
  },

  getStatusLabel() {
    if (!this.ready) return 'Firebase HTTP sync no disponible';
    const when = this.lastSyncAt
      ? new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' }).format(new Date(this.lastSyncAt))
      : null;
    return when ? `Firebase nube activa · ${when}` : 'Firebase nube activa';
  },

  updateStatusElement() {}
};
