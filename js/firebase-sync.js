const FIREBASE_COLLECTION = 'bca_data';
const FIREBASE_SYNC_EXCLUDED = new Set([
  STORAGE_KEYS.SESSION,
  STORAGE_KEYS.USERS,
  STORAGE_KEYS.BIOMETRIC_CREDENTIALS,
  DEVICE_ID_KEY,
  LOCAL_SYNC_META_KEY
]);
const FIREBASE_SYNC_KEYS = Object.values(STORAGE_KEYS).filter((key) => !FIREBASE_SYNC_EXCLUDED.has(key));
const FIREBASE_META_KEYS = [
  'bca_data_version',
  'bca_email_queue',
  'bca_deleted_records',
  'bca_dismissed_supplier_services',
  'bca_supplier_templates_initialized'
];
const FIREBASE_LIST_MERGE_KEYS = new Set([
  STORAGE_KEYS.COFFEES,
  STORAGE_KEYS.CLIENTS,
  STORAGE_KEYS.SUPPLIERS,
  STORAGE_KEYS.INVENTORY,
  STORAGE_KEYS.QUOTATIONS,
  STORAGE_KEYS.PURCHASES,
  STORAGE_KEYS.SALES,
  STORAGE_KEYS.NOTIFICATIONS,
  STORAGE_KEYS.PRODUCTION_BATCHES,
  STORAGE_KEYS.AUDIT_LOG,
  STORAGE_KEYS.COST_SCENARIOS,
  STORAGE_KEYS.PROCESS_TEMPLATES,
  STORAGE_KEYS.DISMISSED_SUPPLIER_SERVICES,
  'bca_email_queue'
]);

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
  permissionDenied: false,

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

    try {
      await this._withTimeout(this.auth.signInAnonymously(), 10000, 'autenticación Firebase');
    } catch (error) {
      this.lastError = error.message || 'No se pudo autenticar con Firebase';
      return false;
    }

    this.enabled = true;
    this.ready = true;
    this.permissionDenied = false;
    this.lastError = null;
    this.setupConnectivityListeners();
    this.updateStatusElement();

    try {
      await this._verifyFirestoreAccess();
      await this._flushOfflinePushes();
    } catch (error) {
      if (this._isPermissionError(error)) {
        this.permissionDenied = true;
        this.lastError = 'Reglas de Firestore no publicadas — publique las reglas en Firebase Console';
      } else {
        this.lastError = error.message || 'Error al conectar con la nube';
      }
      console.warn('Firebase conectado pero la nube rechazó lectura/escritura:', this.lastError);
    }

    this._listenerReady = true;
    this._startPeriodicSync();
    this.updateStatusElement();
    window.dispatchEvent(new CustomEvent('bca-sync-status', { detail: { permissionDenied: this.permissionDenied } }));
    return true;
  },

  async _verifyFirestoreAccess() {
    await this._withTimeout(
      this.db.collection(FIREBASE_COLLECTION).limit(1).get(),
      10000,
      'verificación Firestore'
    );
  },

  _isPermissionError(error) {
    const message = error?.message || String(error);
    return error?.code === 'permission-denied' || /insufficient permissions/i.test(message);
  },

  _runBackgroundSync() {
    this._localBootstrapped = true;
    if (typeof Storage !== 'undefined') {
      Storage.purgeDeletedFromStorage();
    }

    if (this.permissionDenied) {
      this.updateStatusElement();
      return;
    }

    const pullEnabled = this._isPullEnabled();
    const syncPromise = (async () => {
      await this.pushAllLocal();
      if (pullEnabled) {
        await this.syncAll({ silent: true });
      }
    })();

    syncPromise
      .then(() => {
        if (pullEnabled) {
          this.ensureRealtimeListener();
        }
      })
      .catch((error) => {
        console.warn('Sincronización en segundo plano:', error.message);
        if (this._isPermissionError(error)) {
          this.permissionDenied = true;
          this.lastError = 'Reglas de Firestore no publicadas — publique las reglas en Firebase Console';
        } else {
          this.lastError = error.message || 'Error al sincronizar';
        }
        window.dispatchEvent(new CustomEvent('bca-sync-status', { detail: { permissionDenied: this.permissionDenied } }));
      })
      .finally(() => {
        this.updateStatusElement();
        this._startPeriodicSync();
      });
  },

  _startPeriodicSync() {
    if (this._periodicTimer || !this._isPullEnabled()) return;
    this._periodicTimer = setInterval(() => {
      if (!this.isEnabled() || !navigator.onLine) return;
      if (this.syncing) return;
      this.syncAll({ silent: true }).catch(() => {});
    }, 15000);
  },

  getAllSyncKeys() {
    return [...FIREBASE_SYNC_KEYS, ...FIREBASE_META_KEYS];
  },

  _isPullEnabled() {
    return Boolean(window.FIREBASE_CONFIG?.projectId);
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
    let pushed = 0;
    let pulled = 0;

    try {
      await this.flushPendingWrites({ sync: true });

      if (!this._isPullEnabled()) {
        if (typeof Storage !== 'undefined') {
          Storage.purgeDeletedFromStorage();
        }
        pushed = await this.pushAllLocal();
        this.lastSyncAt = new Date().toISOString();
        this.lastError = null;

        if (!options.silent) {
          window.dispatchEvent(new CustomEvent('bca-sync-complete', {
            detail: { pushed, pulled: 0, at: this.lastSyncAt }
          }));
        }

        return { pushed, pulled: 0 };
      }

      this._pulling = true;

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
        const localPayload = localRaw
          ? this._sanitizeRemotePayload(key, JSON.parse(localRaw))
          : null;

        const result = this._reconcilePayload(key, localPayload, remote);
        if (result.changed && result.merged !== null) {
          this._applyMergedLocal(key, result.merged);
          pulled += 1;
        }
        if (result.push && result.merged !== null) {
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

  async publishAllLocalData(options = {}) {
    if (!this.db) {
      throw new Error('Firebase no está conectado');
    }
    if (this.permissionDenied) {
      throw new Error('La nube rechaza los datos. Publique firestore.rules en Firebase Console y reintente.');
    }

    await this.flushPendingWrites({ sync: true });
    const pushed = await this.pushAllLocal();
    let pulled = 0;
    if (!options.skipPull) {
      const result = await this.syncAll({ silent: true });
      pulled = result.pulled;
    }

    this.lastSyncAt = new Date().toISOString();
    this.lastError = null;
    this.updateStatusElement();
    window.dispatchEvent(new CustomEvent('bca-sync-complete', {
      detail: { pushed, pulled, at: this.lastSyncAt, source: 'publish-local' }
    }));
    return { pushed, pulled };
  },

  getLocalDataSummary() {
    const keys = this.getAllSyncKeys();
    const summary = {};
    keys.forEach((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) {
        summary[key] = 0;
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        summary[key] = Array.isArray(parsed) ? parsed.length : 1;
      } catch {
        summary[key] = 1;
      }
    });
    return summary;
  },

  setupConnectivityListeners() {
    if (this._connectivityBound) return;
    this._connectivityBound = true;

    window.addEventListener('online', () => {
      if (!this.isEnabled()) return;
      const sync = this._isPullEnabled()
        ? this.syncAll({ silent: true })
        : this.pushAllLocal();
      sync
        .catch((error) => {
          console.warn('Reintento de sincronización en línea:', error.message);
          this.lastError = error.message || 'Error al sincronizar';
        })
        .finally(() => {
          this.updateStatusElement();
        });
    });

    window.addEventListener('offline', () => {
      this.updateStatusElement();
    });
  },

  ensureRealtimeListener() {
    if (!this.db || !this._isPullEnabled()) return;
    if (!this._unsubscribe) {
      this.setupRealtimeListener();
    }
  },

  stopRealtimeListener() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
  },

  reconfigurePullMode() {
    if (!this.isEnabled()) {
      this.updateStatusElement();
      return;
    }

    this.ensureRealtimeListener();
    this._startPeriodicSync();
    this.syncAll({ silent: true })
      .catch((error) => {
        console.warn('Re-sincronización completa:', error.message);
        this.lastError = error.message || 'Error al sincronizar';
      })
      .finally(() => {
        this.updateStatusElement();
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

          const result = this._reconcilePayload(key, localPayload, remote);

          if (result.changed && result.merged !== null) {
            this._applyMergedLocal(key, result.merged);
            changed = true;
            if (result.push) {
              this._scheduleMergedPush(key);
            }
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

  _stableStringify(value) {
    return JSON.stringify(value);
  },

  _itemTimestamp(item) {
    if (item === null || item === undefined) return 0;
    if (typeof item === 'string') return 0;
    return Date.parse(
      item.updatedAt || item.createdAt || item.soldAt || item.lastUpdated || item.sentAt || 0
    ) || 0;
  },

  _mergeDeletedRecords(local, remote) {
    const merged = { ...(local && typeof local === 'object' ? local : {}) };
    Object.entries(remote && typeof remote === 'object' ? remote : {}).forEach(([listKey, ids]) => {
      merged[listKey] = [...new Set([...(merged[listKey] || []), ...(ids || [])])].slice(-500);
    });
    return merged;
  },

  _mergeObjects(local, remote) {
    if (!local) return remote;
    if (!remote) return local;
    const localTs = this._extractUpdatedAt(local);
    const remoteTs = this._extractUpdatedAt(remote);
    if (remoteTs >= localTs) {
      return { ...local, ...remote };
    }
    return { ...remote, ...local };
  },

  _mergeLists(key, localArr, remoteArr) {
    const local = Array.isArray(localArr) ? localArr : [];
    const remote = Array.isArray(remoteArr) ? remoteArr : [];

    if (key === STORAGE_KEYS.DISMISSED_SUPPLIER_SERVICES) {
      return [...new Set([...local, ...remote])];
    }

    if (key === 'bca_email_queue') {
      const byKey = new Map();
      [...local, ...remote].forEach((item) => {
        if (!item) return;
        const composite = `${item.sentAt || ''}|${item.subject || ''}|${item.type || ''}`;
        const existing = byKey.get(composite);
        if (!existing || this._itemTimestamp(item) >= this._itemTimestamp(existing)) {
          byKey.set(composite, item);
        }
      });
      return [...byKey.values()].sort((a, b) => this._itemTimestamp(b) - this._itemTimestamp(a));
    }

    const deleted = typeof Storage !== 'undefined' ? Storage.getDeletedIds(key) : new Set();
    const byId = new Map();
    [...local, ...remote].forEach((item) => {
      if (!item?.id) return;
      if (deleted.has(item.id)) return;
      const existing = byId.get(item.id);
      if (!existing || this._itemTimestamp(item) >= this._itemTimestamp(existing)) {
        byId.set(item.id, item);
      }
    });
    return [...byId.values()];
  },

  _mergePayloads(key, local, remote) {
    const localPayload = this._sanitizeRemotePayload(key, local);
    const remotePayload = this._sanitizeRemotePayload(key, remote);

    if (localPayload === null || localPayload === undefined) {
      return remotePayload ?? null;
    }
    if (remotePayload === null || remotePayload === undefined) {
      return localPayload;
    }

    if (key === STORAGE_KEYS.DELETED_RECORDS || key === DELETED_RECORDS_KEY) {
      return this._mergeDeletedRecords(localPayload, remotePayload);
    }

    if (FIREBASE_LIST_MERGE_KEYS.has(key)) {
      return this._mergeLists(key, localPayload, remotePayload);
    }

    if (typeof localPayload === 'object' && typeof remotePayload === 'object'
      && !Array.isArray(localPayload) && !Array.isArray(remotePayload)) {
      return this._mergeObjects(localPayload, remotePayload);
    }

    const localTs = this._extractUpdatedAt(localPayload);
    const remoteTs = this._extractUpdatedAt(remotePayload);
    return remoteTs >= localTs ? remotePayload : localPayload;
  },

  _reconcilePayload(key, localPayload, remoteDoc) {
    const remotePayload = remoteDoc?.payload;

    if ((localPayload === null || localPayload === undefined)
      && (remotePayload === null || remotePayload === undefined)) {
      return { merged: null, changed: false, push: false };
    }

    if (localPayload === null || localPayload === undefined) {
      if (this._isEmptyPayload(remotePayload)) {
        return { merged: null, changed: false, push: false };
      }
      const merged = this._sanitizeRemotePayload(key, remotePayload);
      return { merged, changed: true, push: false };
    }

    if (remotePayload === null || remotePayload === undefined || !remoteDoc) {
      return { merged: localPayload, changed: false, push: true };
    }

    const merged = this._mergePayloads(key, localPayload, remotePayload);
    const sanitizedRemote = this._sanitizeRemotePayload(key, remotePayload);
    const changed = this._stableStringify(merged) !== this._stableStringify(localPayload);
    const push = this._stableStringify(merged) !== this._stableStringify(sanitizedRemote);

    return { merged, changed, push: changed || push };
  },

  _applyMergedLocal(key, merged) {
    this._suppressRemote = true;
    Storage.setRemote(key, merged);
    if (typeof Storage !== 'undefined') {
      Storage.markLocalWrite(key);
    }
    this._suppressRemote = false;
  },

  _scheduleMergedPush(key) {
    clearTimeout(this._writeTimers[key]);
    this._writeTimers[key] = setTimeout(() => {
      this._pushKeyNow(key).catch((error) => {
        console.warn(`Error publicando fusión ${key}:`, error.message);
      });
    }, 250);
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
    if (this.permissionDenied) {
      return 'Nube bloqueada — publique reglas Firestore (ver banner arriba)';
    }
    if (this.syncing) {
      return 'Sincronizando toda la información...';
    }
    if (!navigator.onLine) {
      return 'Sin internet — todo se guarda aquí y se sincroniza al reconectar';
    }
    if (!this.ready) {
      return this.lastError ? `Error: ${this.lastError}` : 'Conectando y uniendo datos...';
    }
    if (this.lastError) {
      return `Error de sync: ${this.lastError}`;
    }

    const when = this.lastSyncAt
      ? new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' }).format(new Date(this.lastSyncAt))
      : null;

    if (this._unsubscribe) {
      return when
        ? `Todo sincronizado en tiempo real · ${when}`
        : 'Todo sincronizado — cafés, clientes, ventas, inventario...';
    }
    return when
      ? `Uniendo toda la información · ${when}`
      : 'Sincronizando toda la plataforma...';
  },

  updateStatusElement() {
    const label = this.getStatusLabel();
    document.getElementById('firebase-sync-status')?.replaceChildren(document.createTextNode(label));
    document.getElementById('sidebar-sync-status')?.replaceChildren(document.createTextNode(label));
  }
};
