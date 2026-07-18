const FIREBASE_COLLECTION = 'bca_data';
const FIREBASE_SYNC_KEYS = Object.values(STORAGE_KEYS);

const FirebaseSync = {
  enabled: false,
  ready: false,
  db: null,
  auth: null,
  _writeTimers: {},
  _pulling: false,

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
      const app = firebase.initializeApp(config);
      this.auth = firebase.auth();
      this.db = firebase.firestore();
      await this.auth.signInAnonymously();
      await this.pullAll();
      this.enabled = true;
      this.ready = true;
      return true;
    } catch (error) {
      console.error('Firebase sync no disponible:', error);
      this.enabled = false;
      this.ready = false;
      return false;
    }
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

  async pullAll() {
    if (!this.db || this._pulling) return;
    this._pulling = true;

    try {
      const snapshot = await this.db.collection(FIREBASE_COLLECTION).get();
      if (snapshot.empty) {
        await this.pushAllLocal();
        return;
      }

      snapshot.forEach((doc) => {
        const key = doc.id;
        if (!FIREBASE_SYNC_KEYS.includes(key)) return;
        const remote = doc.data();
        const localRaw = localStorage.getItem(key);
        const localUpdated = localRaw ? this._extractUpdatedAt(JSON.parse(localRaw)) : 0;
        const remoteUpdated = remote?.updatedAt || 0;

        if (!localRaw || remoteUpdated >= localUpdated) {
          localStorage.setItem(key, JSON.stringify(remote.payload));
        }
      });
    } finally {
      this._pulling = false;
    }
  },

  async pushAllLocal() {
    if (!this.db) return;
    const batch = this.db.batch();
    let count = 0;

    FIREBASE_SYNC_KEYS.forEach((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const payload = JSON.parse(raw);
      const ref = this.db.collection(FIREBASE_COLLECTION).doc(key);
      batch.set(ref, {
        payload,
        updatedAt: Date.now()
      });
      count += 1;
    });

    if (count > 0) {
      await batch.commit();
    }
  },

  queuePush(key, value) {
    if (!this.db || this._pulling) return;

    clearTimeout(this._writeTimers[key]);
    this._writeTimers[key] = setTimeout(async () => {
      try {
        await this.db.collection(FIREBASE_COLLECTION).doc(key).set({
          payload: value,
          updatedAt: Date.now()
        });
      } catch (error) {
        console.error(`Error sincronizando ${key}:`, error);
      }
    }, 400);
  },

  queueDelete(key) {
    if (!this.db || this._pulling) return;

    clearTimeout(this._writeTimers[key]);
    this._writeTimers[key] = setTimeout(async () => {
      try {
        await this.db.collection(FIREBASE_COLLECTION).doc(key).delete();
      } catch (error) {
        console.error(`Error eliminando ${key} en Firebase:`, error);
      }
    }, 400);
  },

  _extractUpdatedAt(value) {
    if (!value) return 0;
    if (Array.isArray(value)) {
      return value.reduce((max, item) => Math.max(max, Date.parse(item.updatedAt || item.createdAt || item.soldAt || 0) || 0), 0);
    }
    if (typeof value === 'object') {
      return Date.parse(value.lastUpdated || value.updatedAt || 0) || 0;
    }
    return 0;
  },

  getStatusLabel() {
    if (!window.FIREBASE_CONFIG?.projectId) {
      return 'Solo navegador (configura Firebase en GitHub Secrets)';
    }
    if (!this.ready) {
      return 'Conectando con Firebase...';
    }
    return `Sincronizado · ${window.FIREBASE_CONFIG.projectId}`;
  }
};
