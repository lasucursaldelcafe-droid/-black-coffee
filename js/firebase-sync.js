const FIREBASE_COLLECTION = 'bca_data';
const FIREBASE_SYNC_EXCLUDED = new Set([STORAGE_KEYS.SESSION, STORAGE_KEYS.USERS, DEVICE_ID_KEY, LOCAL_SYNC_META_KEY]);
const FIREBASE_SYNC_KEYS = Object.values(STORAGE_KEYS).filter((key) => !FIREBASE_SYNC_EXCLUDED.has(key));
const FIREBASE_META_KEYS = [
  'bca_data_version',
  'bca_email_queue',
  'bca_deleted_records',
  'bca_dismissed_supplier_services',
  'bca_supplier_templates_initialized'
];

const FirebaseSync = {
  enabled: false,
  ready: false,
  syncing: false,
  db: null,
  auth: null,
  lastSyncAt: null,
  lastError: null,
  _writeTimers: {},
  _pulling: false,
  _suppressRemote: false,
  _lastPushedAt: {},
  _pendingPushKeys: new Set(),
  _offlinePushKeys: new Set(),
  _unsubscribe: null,
  _listenerReady: false,
  _localBootstrapped: false,

  isEnabled() {
    return this.enabled && this.ready;
  },

  getDeviceId() {
    return Storage.getDeviceId();
  },

  getDocId(key) {
    return key;
  },

  _withTimeout(promise, ms, label = 'operación') {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Tiempo de espera agotado (${label})`)), ms);
      })
    ]);
  },

  startInBackground() {
    const config = window.FIREBASE_CONFIG;
    if (!config?.projectId) {
      return Promise.resolve(false);
    }
    if (this._initPromise) {
      return this._initPromise;
    }

    this._bindFlushHandlers();

    this._initPromise = this._connect()
      .then((connected) => {
        if (!connected) return false;
        this._runBackgroundSync();
        return true;
      })
      .catch((error) => {
        console.error('Firebase sync no disponible:', error);
        this.lastError = error.message || 'Error de conexión';
        this.enabled = false;
        this.ready = false;
        this.updateStatusElement();
        return false;
      });

    return this._initPromise;
  },

  async init() {
    return this.startInBackground();
  },

  _bindFlushHandlers() {
    if (this._flushBound) return;
    this._flushBound = true;

    window.addEventListener('beforeunload', () => {
      this.flushPendingWrites({ sync: true });
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flushPendingWrites({ sync: true });
      }
    });
  },

  async _connect() {
    const config = window.FIREBASE_CONFIG;
    if (!config?.projectId) {
      return false;
    }

    await this._withTimeout(this.loadSdk(), 15000, 'carga de Firebase SDK');
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
    this.auth = firebase.auth();
    this.db = firebase.firestore();
    await this._withTimeout(this.auth.signInAnonymously(), 10000, 'autenticación Firebase');
    this.enabled = true;
    this.ready = true;
    this.lastError = null;
    this.setupConnectivityListeners();
    this.updateStatusElement();
    await this._flushOfflinePushes();
    this._listenerReady = true;
    return true;
  },

  _runBackgroundSync() {
    // Local primero: subir cambios ANTES de escuchar la nube (evita revivir borrados)
    this._localBootstrapped = false;
    this.pushAllLocal()
      .then(() => {
        this._localBootstrapped = true;
        return this.restoreFromCloudIfEmpty();
      })
      .then(() => {
        if (!this._unsubscribe) {
          this.setupRealtimeListener();
        }
      })
      .catch((error) => {
        console.warn('Respaldo en segundo plano:', error.message);
        this.lastError = error.message || 'Error al respaldar';
      })
      .finally(() => {
        this.updateStatusElement();
      });
  },

  getAllSyncKeys() {
    return [...FIREBASE_SYNC_KEYS, ...FIREBASE_META_KEYS];
  },

  loadSdk() {
    const version = '10.12.0';
    const scripts = [
      `https://www.gstatic.com/firebasejs/${version}/firebase-app-compat.js`,
      `https://www.gstatic.com/firebasejs/${version}/firebase-auth-compat.js`,
      `https://www.gstatic.com/firebasejs/${version}/firebase-firestore-compat.js`
    ];

    const loadScript = (src) => new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });

    return scripts.reduce((promise, src) => promise.then(() => loadScript(src)), Promise.resolve());
  },

  async restoreFromCloudIfEmpty() {
    if (!this.db) return { restored: 0 };

    let restored = 0;
    const deviceId = this.getDeviceId();

    for (const key of this.getAllSyncKeys()) {
      const localRaw = localStorage.getItem(key);
      if (localRaw) continue;

      const doc = await this.db.collection(FIREBASE_COLLECTION).doc(this.getDocId(key)).get();
      if (!doc.exists) continue;

      const remote = doc.data();
      if (this._isEmptyPayload(remote?.payload)) continue;

      Storage.setRemote(key, this._sanitizeRemotePayload(key, remote.payload));
      restored += 1;
    }

    if (restored > 0) {
      window.dispatchEvent(new CustomEvent('bca-data-changed', {
        detail: { source: 'firebase-restore', deviceId }
      }));
    }

    this.lastSyncAt = new Date().toISOString();
    return { restored };
  },

  async syncAll(options = {}) {
    if (!this.db) {
      throw new Error('Firebase no está conectado');
    }
    if (this.syncing) return { pushed: 0, pulled: 0 };

    this.syncing = true;
    this._pulling = true;
    let pushed = 0;
    let pulled = 0;

    try {
      await this.flushPendingWrites({ sync: true });

      const snapshot = await this._withTimeout(
        this.db.collection(FIREBASE_COLLECTION).get(),
        20000,
        'lectura de Firebase'
      );

      const remoteByKey = new Map();
      snapshot.forEach((doc) => {
        const key = doc.data()?.key || doc.id;
        if (!this.getAllSyncKeys().includes(key)) return;
        remoteByKey.set(key, doc.data());
      });

      const keysToPush = [];

      this.getAllSyncKeys().forEach((key) => {
        const localRaw = localStorage.getItem(key);
        const remote = remoteByKey.get(key);
        const localPayload = localRaw ? JSON.parse(localRaw) : null;

        if (!localPayload && remote?.payload !== undefined) {
          if (!this._isEmptyPayload(remote.payload)) {
            Storage.setRemote(key, this._sanitizeRemotePayload(key, remote.payload));
            pulled += 1;
          }
          return;
        }

        if (!localPayload) return;

        if (!remote) {
          keysToPush.push(key);
          return;
        }

        if (this._shouldApplyRemote(key, localPayload, remote)) {
          Storage.setRemote(key, this._sanitizeRemotePayload(key, remote.payload));
          pulled += 1;
        } else {
          keysToPush.push(key);
        }
      });

      const uniquePush = [...new Set(keysToPush)];
      if (uniquePush.length > 0) {
        pushed = await this.pushKeys(uniquePush);
      }

      this.lastSyncAt = new Date().toISOString();
      this.lastError = null;

      if (!options.silent) {
        window.dispatchEvent(new CustomEvent('bca-sync-complete', {
          detail: { pushed, pulled, at: this.lastSyncAt }
        }));
      }

      if (pulled > 0) {
        window.dispatchEvent(new CustomEvent('bca-data-changed', {
          detail: { source: 'firebase-sync' }
        }));
      }

      return { pushed, pulled };
    } catch (error) {
      this.lastError = error.message || 'Error al sincronizar';
      throw error;
    } finally {
      this._pulling = false;
      this.syncing = false;
      this._flushPendingPushQueue();
    }
  },

  async pushKeys(keys) {
    if (!this.db || keys.length === 0) return 0;

    const batch = this.db.batch();
    let count = 0;
    const now = Date.now();
    const deviceId = this.getDeviceId();

    keys.forEach((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      let payload = JSON.parse(raw);
      payload = this._sanitizeRemotePayload(key, payload);
      const ref = this.db.collection(FIREBASE_COLLECTION).doc(this.getDocId(key));
      batch.set(ref, {
        key,
        deviceId,
        payload,
        updatedAt: now
      });
      this._lastPushedAt[key] = now;
      count += 1;
    });

    if (count > 0) {
      await batch.commit();
    }

    return count;
  },

  async pushAllLocal() {
    const keys = this.getAllSyncKeys().filter((key) => localStorage.getItem(key));
    return this.pushKeys(keys);
  },

  setupConnectivityListeners() {
    if (this._connectivityBound) return;
    this._connectivityBound = true;

    window.addEventListener('online', () => {
      if (!this.isEnabled()) return;
      this.pushAllLocal().catch((error) => {
        console.warn('Reintento de respaldo en línea:', error.message);
      });
    });
  },

  setupRealtimeListener() {
    if (!this.db || this._unsubscribe) return;

    this._unsubscribe = this.db.collection(FIREBASE_COLLECTION)
      .onSnapshot((snapshot) => {
        if (this._pulling || this.syncing) return;

        let changed = false;

        snapshot.docChanges().forEach((change) => {
          const key = change.doc.data()?.key || change.doc.id;
          if (!this.getAllSyncKeys().includes(key)) return;
          if (change.type === 'removed') return;

          const remote = change.doc.data();
          const lastPush = this._lastPushedAt[key] || 0;
          if (Date.now() - lastPush < 1500) return;

        const localRaw = localStorage.getItem(key);
        const localPayload = localRaw
          ? this._sanitizeRemotePayload(key, JSON.parse(localRaw))
          : null;

          if (!remote?.payload && remote?.payload !== null) return;

          if (!localPayload || this._shouldApplyRemote(key, localPayload, remote)) {
            this._suppressRemote = true;
            Storage.setRemote(key, this._sanitizeRemotePayload(key, remote.payload));
            this._suppressRemote = false;
            changed = true;
          }
        });

        if (changed) {
          window.dispatchEvent(new CustomEvent('bca-data-changed', {
            detail: { source: 'firebase' }
          }));
        }

        this.updateStatusElement();
      }, (error) => {
        console.error('Listener Firebase:', error);
        this.lastError = error.message || 'Error en tiempo real';
      });
  },

  queuePush(key, value) {
    if (this._suppressRemote) return;
    if (!this.getAllSyncKeys().includes(key)) return;

    this._pendingPushKeys.add(key);

    if (this._pulling) {
      return;
    }

    if (!this.isEnabled()) {
      this._offlinePushKeys.add(key);
      return;
    }

    clearTimeout(this._writeTimers[key]);
    this._writeTimers[key] = setTimeout(() => {
      this._pushKeyNow(key).catch((error) => {
        console.error(`Error sincronizando ${key}:`, error);
        this.lastError = error.message || `Error al guardar ${key}`;
        this._offlinePushKeys.add(key);
      });
    }, 100);
  },

  pushKeyNow(key) {
    return this._pushKeyNow(key);
  },

  async _pushKeyNow(key) {
    if (!this.db) return;

    const raw = localStorage.getItem(key);
    if (!raw) return;

    let payload = JSON.parse(raw);
    payload = this._sanitizeRemotePayload(key, payload);
    const now = Date.now();

    await this.db.collection(FIREBASE_COLLECTION).doc(this.getDocId(key)).set({
      key,
      deviceId: this.getDeviceId(),
      payload,
      updatedAt: now
    });

    this._lastPushedAt[key] = now;
    this._pendingPushKeys.delete(key);
    this._offlinePushKeys.delete(key);
    this.lastSyncAt = new Date().toISOString();
  },

  queueDelete(key) {
    if (!this.getAllSyncKeys().includes(key)) return;

    this._pendingPushKeys.delete(key);

    if (this._pulling || !this.isEnabled()) return;

    clearTimeout(this._writeTimers[key]);
    this._writeTimers[key] = setTimeout(async () => {
      try {
        await this.db.collection(FIREBASE_COLLECTION).doc(this.getDocId(key)).delete();
      } catch (error) {
        console.error(`Error eliminando ${key} en Firebase:`, error);
      }
    }, 100);
  },

  flushPendingWrites({ sync = false } = {}) {
    const keys = [...this._pendingPushKeys, ...this._offlinePushKeys];
    if (keys.length === 0) return Promise.resolve();

    if (!this.isEnabled()) {
      return Promise.resolve();
    }

    if (sync) {
      return this.pushKeys([...new Set(keys)]).then(() => {
        keys.forEach((key) => {
          this._pendingPushKeys.delete(key);
          this._offlinePushKeys.delete(key);
        });
      });
    }

    return Promise.all([...new Set(keys)].map((key) => this._pushKeyNow(key)));
  },

  _flushPendingPushQueue() {
    if (this._pendingPushKeys.size === 0) return;
    const keys = [...this._pendingPushKeys];
    keys.forEach((key) => this.queuePush(key, Storage.get(key)));
  },

  async _flushOfflinePushes() {
    if (!this.isEnabled() || this._offlinePushKeys.size === 0) return;
    const keys = [...this._offlinePushKeys];
    this._offlinePushKeys.clear();
    await this.pushKeys(keys);
  },

  _getLocalUpdatedAt(key, payload) {
    const meta = typeof Storage !== 'undefined' ? Storage.getLocalSyncMeta() : {};
    const metaTs = meta[key] || 0;
    const contentTs = this._extractUpdatedAt(payload);
    const pushedTs = this._lastPushedAt[key] || 0;
    return Math.max(metaTs, contentTs, pushedTs);
  },

  _sanitizeRemotePayload(key, payload) {
    if (typeof Storage === 'undefined') return payload;
    if (Array.isArray(payload)) {
      return Storage.filterDeleted(key, payload);
    }
    return payload;
  },

  _shouldApplyRemote(key, localPayload, remote) {
    const localRaw = localStorage.getItem(key);
    if (localRaw && !this._localBootstrapped) {
      return false;
    }

    const localUpdated = this._getLocalUpdatedAt(key, localPayload);
    const remoteUpdated = remote?.updatedAt || 0;

    if (localUpdated >= remoteUpdated) {
      return false;
    }

    if (this._isEmptyPayload(remote?.payload) && !this._isEmptyPayload(localPayload)) {
      return false;
    }

    if (Array.isArray(localPayload) && Array.isArray(remote?.payload) && remote.payload.length > localPayload.length) {
      const localIds = new Set(localPayload.map((item) => item?.id).filter(Boolean));
      const resurrected = remote.payload.filter((item) => item?.id && !localIds.has(item.id));
      if (resurrected.length > 0) {
        const deleted = typeof Storage !== 'undefined' ? Storage.getDeletedIds(key) : new Set();
        if (resurrected.every((item) => deleted.has(item.id))) {
          return false;
        }
        if (localUpdated > 0) {
          return false;
        }
      }
    }

    return true;
  },

  _isEmptyPayload(payload) {
    if (payload === null || payload === undefined) return true;
    if (Array.isArray(payload)) return payload.length === 0;
    if (typeof payload === 'object') return Object.keys(payload).length === 0;
    return false;
  },

  _extractUpdatedAt(value) {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'string' || typeof value === 'number') {
      return Date.parse(String(value)) || 0;
    }
    if (Array.isArray(value)) {
      return value.reduce((max, item) => {
        const ts = Date.parse(item?.updatedAt || item?.createdAt || item?.soldAt || item?.lastUpdated || 0) || 0;
        return Math.max(max, ts);
      }, 0);
    }
    if (typeof value === 'object') {
      return Date.parse(value.lastUpdated || value.updatedAt || value.createdAt || 0) || 0;
    }
    return 0;
  },

  getStatusLabel() {
    if (!window.FIREBASE_CONFIG?.projectId) {
      return 'Guardado en este navegador';
    }
    if (this.syncing) {
      return 'Sincronizando...';
    }
    if (!this.ready) {
      return this.lastError ? `Error: ${this.lastError}` : 'Conectando respaldo en la nube...';
    }
    const when = this.lastSyncAt
      ? ` · ${new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(this.lastSyncAt))}`
      : '';
    return `Guardado local · respaldo en la nube${when}`;
  },

  updateStatusElement() {
    const el = document.getElementById('firebase-sync-status');
    if (el) el.textContent = this.getStatusLabel();
  }
};
