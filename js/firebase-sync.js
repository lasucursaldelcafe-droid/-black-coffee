const FIREBASE_COLLECTION = 'bca_data';
const FIREBASE_SYNC_EXCLUDED = new Set([STORAGE_KEYS.SESSION]);
const FIREBASE_SYNC_KEYS = Object.values(STORAGE_KEYS).filter((key) => !FIREBASE_SYNC_EXCLUDED.has(key));
const FIREBASE_META_KEYS = ['bca_data_version', 'bca_email_queue'];

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
  _unsubscribe: null,

  isEnabled() {
    return this.enabled && this.ready;
  },

  async init() {
    const config = window.FIREBASE_CONFIG;
    if (!config?.projectId) {
      return false;
    }

    try {
      await this.loadSdk();
      if (!firebase.apps.length) {
        firebase.initializeApp(config);
      }
      this.auth = firebase.auth();
      this.db = firebase.firestore();
      await this.auth.signInAnonymously();
      await this.syncAll({ silent: true });
      this.setupRealtimeListener();
      this.enabled = true;
      this.ready = true;
      return true;
    } catch (error) {
      console.error('Firebase sync no disponible:', error);
      this.lastError = error.message || 'Error de conexión';
      this.enabled = false;
      this.ready = false;
      return false;
    }
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
      const snapshot = await this.db.collection(FIREBASE_COLLECTION).get();
      const remoteByKey = new Map();

      snapshot.forEach((doc) => {
        remoteByKey.set(doc.id, doc.data());
      });

      const keysToPush = [];

      this.getAllSyncKeys().forEach((key) => {
        const localRaw = localStorage.getItem(key);
        const remote = remoteByKey.get(key);
        const localPayload = localRaw ? JSON.parse(localRaw) : null;
        const localUpdated = this._extractUpdatedAt(localPayload);
        const remoteUpdated = remote?.updatedAt || 0;

        if (!localPayload && remote?.payload !== undefined) {
          localStorage.setItem(key, JSON.stringify(remote.payload));
          pulled += 1;
          return;
        }

        if (!localPayload) return;

        if (!remote) {
          keysToPush.push(key);
          return;
        }

        if (remoteUpdated > localUpdated) {
          localStorage.setItem(key, JSON.stringify(remote.payload));
          pulled += 1;
        } else {
          keysToPush.push(key);
        }
      });

      if (remoteByKey.size === 0) {
        this.getAllSyncKeys().forEach((key) => {
          if (localStorage.getItem(key)) keysToPush.push(key);
        });
      }

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

      return { pushed, pulled };
    } catch (error) {
      this.lastError = error.message || 'Error al sincronizar';
      throw error;
    } finally {
      this._pulling = false;
      this.syncing = false;
    }
  },

  async pushKeys(keys) {
    if (!this.db || keys.length === 0) return 0;

    const batch = this.db.batch();
    let count = 0;
    const now = Date.now();

    keys.forEach((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const payload = JSON.parse(raw);
      const ref = this.db.collection(FIREBASE_COLLECTION).doc(key);
      batch.set(ref, { payload, updatedAt: now });
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

  setupRealtimeListener() {
    if (!this.db || this._unsubscribe) return;

    this._unsubscribe = this.db.collection(FIREBASE_COLLECTION).onSnapshot((snapshot) => {
      if (this._pulling || this.syncing) return;

      let changed = false;

      snapshot.docChanges().forEach((change) => {
        const key = change.doc.id;
        if (!this.getAllSyncKeys().includes(key)) return;

        if (change.type === 'removed') {
          return;
        }

        const remote = change.doc.data();
        const lastPush = this._lastPushedAt[key] || 0;
        if (Date.now() - lastPush < 1500) return;

        const localRaw = localStorage.getItem(key);
        const localPayload = localRaw ? JSON.parse(localRaw) : null;
        const localUpdated = this._extractUpdatedAt(localPayload);
        const remoteUpdated = remote?.updatedAt || 0;

        if (!remote?.payload && remote?.payload !== null) return;

        if (!localPayload || remoteUpdated > localUpdated) {
          this._suppressRemote = true;
          localStorage.setItem(key, JSON.stringify(remote.payload));
          this._suppressRemote = false;
          changed = true;
        }
      });

      if (changed) {
        window.dispatchEvent(new CustomEvent('bca-data-changed', {
          detail: { source: 'firebase' }
        }));
      }
    }, (error) => {
      console.error('Listener Firebase:', error);
      this.lastError = error.message || 'Error en tiempo real';
    });
  },

  queuePush(key, value) {
    if (!this.db || this._pulling || this._suppressRemote) return;
    if (!this.getAllSyncKeys().includes(key)) return;

    clearTimeout(this._writeTimers[key]);
    this._writeTimers[key] = setTimeout(async () => {
      try {
        const now = Date.now();
        await this.db.collection(FIREBASE_COLLECTION).doc(key).set({
          payload: value,
          updatedAt: now
        });
        this._lastPushedAt[key] = now;
        this.lastSyncAt = new Date().toISOString();
      } catch (error) {
        console.error(`Error sincronizando ${key}:`, error);
        this.lastError = error.message || `Error al guardar ${key}`;
      }
    }, 350);
  },

  queueDelete(key) {
    if (!this.db || this._pulling) return;
    if (!this.getAllSyncKeys().includes(key)) return;

    clearTimeout(this._writeTimers[key]);
    this._writeTimers[key] = setTimeout(async () => {
      try {
        await this.db.collection(FIREBASE_COLLECTION).doc(key).delete();
      } catch (error) {
        console.error(`Error eliminando ${key} en Firebase:`, error);
      }
    }, 350);
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
      return 'Solo navegador (Firebase no configurado)';
    }
    if (this.syncing) {
      return 'Sincronizando...';
    }
    if (!this.ready) {
      return this.lastError ? `Error: ${this.lastError}` : 'Conectando con Firebase...';
    }
    const when = this.lastSyncAt
      ? ` · ${new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(this.lastSyncAt))}`
      : '';
    return `Sincronizado · ${window.FIREBASE_CONFIG.projectId}${when}`;
  },

  updateStatusElement() {
    const el = document.getElementById('firebase-sync-status');
    if (el) el.textContent = this.getStatusLabel();
  }
};
