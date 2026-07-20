const CLOUD_GITHUB_REPO = 'lasucursaldelcafe-droid/-black-coffee';
const CLOUD_DATA_PATH = 'sync/cloud-data.json';
const CLOUD_READ_URL = `https://raw.githubusercontent.com/${CLOUD_GITHUB_REPO}/main/${CLOUD_DATA_PATH}`;
const CLOUD_PAGES_URL = `https://lasucursaldelcafe-droid.github.io/-black-coffee/${CLOUD_DATA_PATH}`;
const GITHUB_TOKEN_KEY = 'bca_github_sync_token';
const GITHUB_DEVICE_KEY = 'bca_github_device_flow';
const GITHUB_CLIENT_ID = '178c6fc778ccc68e1d6a';
const GITHUB_CLIENT_SECRET = '34ddeff2b558a23d38fba8a6de74f086ede1cc0b';

const CloudSync = {
  enabled: true,
  ready: false,
  syncing: false,
  hasWriteAccess: false,
  lastSyncAt: null,
  lastError: null,
  _fileSha: null,
  _writeTimers: {},
  _pendingPushKeys: new Set(),
  _pulling: false,
  _suppressRemote: false,
  _periodicTimer: null,
  _devicePollTimer: null,

  isEnabled() {
    return this.enabled && this.ready;
  },

  canWrite() {
    return Boolean(this.getToken() || window.CLOUD_SYNC_CONFIG?.githubWriteToken);
  },

  getWriteToken() {
    return this.getToken() || window.CLOUD_SYNC_CONFIG?.githubWriteToken || '';
  },

  getToken() {
    try {
      return localStorage.getItem(GITHUB_TOKEN_KEY) || '';
    } catch {
      return '';
    }
  },

  setToken(token) {
    if (token) {
      localStorage.setItem(GITHUB_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(GITHUB_TOKEN_KEY);
    }
    this.hasWriteAccess = Boolean(token);
  },

  getDeviceId() {
    return Storage.getDeviceId();
  },

  getAllSyncKeys() {
    return SyncShared.getAllSyncKeys();
  },

  startInBackground() {
    if (this._initPromise) return this._initPromise;

    this._initPromise = this._bootstrap()
      .catch((error) => {
        console.error('CloudSync no disponible:', error);
        this.lastError = error.message || 'Error de sync en la nube';
        this.updateStatusElement();
        return false;
      });

    return this._initPromise;
  },

  async _bootstrap() {
    this.hasWriteAccess = this.canWrite();
    this.ready = true;
    this.updateStatusElement();
    window.dispatchEvent(new CustomEvent('bca-sync-status', { detail: { cloud: true } }));

    if (typeof Storage !== 'undefined') {
      Storage.purgeDeletedFromStorage();
    }

    await this.syncAll({ silent: true }).catch((error) => {
      console.warn('CloudSync pull inicial:', error.message);
    });

    this._startPeriodicSync();
    return true;
  },

  _startPeriodicSync() {
    if (this._periodicTimer) return;
    this._periodicTimer = setInterval(() => {
      if (!navigator.onLine || document.visibilityState === 'hidden') return;
      if (this.syncing) return;
      this.syncAll({ silent: true }).catch(() => {});
    }, 45000);
  },

  async fetchRemoteDocument() {
    const urls = [
      `${CLOUD_READ_URL}?t=${Date.now()}`,
      `${CLOUD_PAGES_URL}?t=${Date.now()}`
    ];

    let lastError = null;
    for (const url of urls) {
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (response.status === 404) {
          return { document: { keys: {}, updatedAt: 0 }, sha: null };
        }
        if (!response.ok) {
          lastError = new Error(`HTTP ${response.status}`);
          continue;
        }
        const document = await response.json();
        return { document: document || { keys: {}, updatedAt: 0 }, sha: document?.sha || null };
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('No se pudo leer la nube compartida');
  },

  async fetchRemoteWithSha() {
    const token = this.getWriteToken();
    if (!token) {
      const { document } = await this.fetchRemoteDocument();
      return { document, sha: this._fileSha };
    }

    const response = await fetch(
      `https://api.github.com/repos/${CLOUD_GITHUB_REPO}/contents/${CLOUD_DATA_PATH}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28'
        }
      }
    );

    if (response.status === 404) {
      return { document: { keys: {}, updatedAt: 0 }, sha: null };
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitHub read failed (${response.status}): ${text.slice(0, 200)}`);
    }

    const meta = await response.json();
    const decoded = JSON.parse(atob(meta.content.replace(/\n/g, '')));
    this._fileSha = meta.sha;
    return { document: decoded, sha: meta.sha };
  },

  _buildCloudDocument() {
    const keys = {};
    const now = Date.now();
    this.getAllSyncKeys().forEach((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      let payload = JSON.parse(raw);
      payload = SyncShared.sanitizeRemotePayload(key, payload);
      keys[key] = {
        payload,
        updatedAt: now,
        deviceId: this.getDeviceId()
      };
    });
    return {
      version: 1,
      updatedAt: now,
      deviceId: this.getDeviceId(),
      keys
    };
  },

  _mergeCloudDocuments(localDoc, remoteDoc) {
    const mergedKeys = { ...(remoteDoc?.keys || {}) };
    const localKeys = localDoc?.keys || {};

    Object.entries(localKeys).forEach(([key, entry]) => {
      const remoteEntry = mergedKeys[key];
      if (!remoteEntry) {
        mergedKeys[key] = entry;
        return;
      }

      const result = SyncShared.reconcilePayload(
        key,
        entry?.payload ?? entry,
        { payload: remoteEntry?.payload ?? remoteEntry }
      );

      if (result.merged !== null) {
        mergedKeys[key] = {
          payload: result.merged,
          updatedAt: Date.now(),
          deviceId: this.getDeviceId()
        };
      }
    });

    return {
      version: 1,
      updatedAt: Date.now(),
      deviceId: this.getDeviceId(),
      keys: mergedKeys
    };
  },

  async writeCloudDocument(document) {
    const token = this.getWriteToken();
    if (!token) {
      throw new Error('Conecte GitHub o configure GITHUB_SYNC_TOKEN para publicar.');
    }

    let sha = this._fileSha;
    if (!sha) {
      try {
        const current = await this.fetchRemoteWithSha();
        sha = current.sha;
      } catch {
        sha = null;
      }
    }

    const content = btoa(unescape(encodeURIComponent(JSON.stringify(document, null, 2))));
    const body = {
      message: `BCA sync ${new Date().toISOString()}`,
      content,
      committer: {
        name: 'Black Coffee Administration',
        email: 'lasucursaldelcafe@gmail.com'
      }
    };
    if (sha) body.sha = sha;

    const response = await fetch(
      `https://api.github.com/repos/${CLOUD_GITHUB_REPO}/contents/${CLOUD_DATA_PATH}`,
      {
        method: 'PUT',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 409) {
        this._fileSha = null;
        const refreshed = await this.fetchRemoteWithSha();
        const merged = this._mergeCloudDocuments(document, refreshed.document);
        return this.writeCloudDocument(merged);
      }
      throw new Error(`GitHub write failed (${response.status}): ${text.slice(0, 300)}`);
    }

    const result = await response.json();
    this._fileSha = result.content?.sha || null;
    return result;
  },

  async syncAll(options = {}) {
    if (this.syncing) return { pushed: 0, pulled: 0 };

    this.syncing = true;
    let pushed = 0;
    let pulled = 0;

    try {
      await this.flushPendingWrites();

      const { document: remoteDoc } = await this.fetchRemoteDocument();
      const remoteKeys = remoteDoc?.keys || {};

      const keysToPush = [];

      this.getAllSyncKeys().forEach((key) => {
        const localRaw = localStorage.getItem(key);
        const remoteEntry = remoteKeys[key];
        const localPayload = localRaw
          ? SyncShared.sanitizeRemotePayload(key, JSON.parse(localRaw))
          : null;

        const result = SyncShared.reconcilePayload(key, localPayload, {
          payload: remoteEntry?.payload ?? remoteEntry
        });

        if (result.changed && result.merged !== null) {
          this._applyMergedLocal(key, result.merged);
          pulled += 1;
        }
        if (result.push && result.merged !== null) {
          keysToPush.push(key);
        }
      });

      if (keysToPush.length > 0 && this.canWrite()) {
        const localDoc = this._buildCloudDocument();
        const mergedDoc = this._mergeCloudDocuments(localDoc, remoteDoc);
        await this.writeCloudDocument(mergedDoc);
        pushed = keysToPush.length;
      }

      this.lastSyncAt = new Date().toISOString();
      this.lastError = null;

      if (!options.silent) {
        window.dispatchEvent(new CustomEvent('bca-sync-complete', {
          detail: { pushed, pulled, at: this.lastSyncAt, source: 'cloud' }
        }));
      }

      if (pulled > 0) {
        window.dispatchEvent(new CustomEvent('bca-data-changed', {
          detail: { source: 'cloud-sync' }
        }));
      }

      return { pushed, pulled };
    } catch (error) {
      this.lastError = error.message || 'Error al sincronizar con la nube';
      throw error;
    } finally {
      this.syncing = false;
      this.updateStatusElement();
    }
  },

  async publishAllLocalData(options = {}) {
    if (!this.canWrite()) {
      throw new Error('Conecte GitHub para publicar (botón «Conectar GitHub» en Configuración).');
    }

    await this.flushPendingWrites();
    const { document: remoteDoc } = await this.fetchRemoteWithSha();
    const localDoc = this._buildCloudDocument();
    const merged = this._mergeCloudDocuments(localDoc, remoteDoc);
    await this.writeCloudDocument(merged);

    let pulled = 0;
    if (!options.skipPull) {
      const result = await this.syncAll({ silent: true });
      pulled = result.pulled;
    }

    this.lastSyncAt = new Date().toISOString();
    this.lastError = null;
    this.updateStatusElement();

    window.dispatchEvent(new CustomEvent('bca-sync-complete', {
      detail: {
        pushed: Object.keys(localDoc.keys || {}).length,
        pulled,
        at: this.lastSyncAt,
        source: 'cloud-publish'
      }
    }));

    return { pushed: Object.keys(localDoc.keys || {}).length, pulled };
  },

  queuePush(key) {
    if (this._suppressRemote) return;
    if (!this.getAllSyncKeys().includes(key)) return;

    this._pendingPushKeys.add(key);

    if (!this.canWrite()) return;

    clearTimeout(this._writeTimers[key]);
    this._writeTimers[key] = setTimeout(() => {
      this.syncAll({ silent: true }).catch((error) => {
        console.warn(`CloudSync push ${key}:`, error.message);
        this.lastError = error.message;
      });
    }, 500);
  },

  async flushPendingWrites() {
    if (this._pendingPushKeys.size === 0 || !this.canWrite()) return;
    this._pendingPushKeys.clear();
    await this.syncAll({ silent: true });
  },

  _applyMergedLocal(key, merged) {
    this._suppressRemote = true;
    SyncShared.applyMergedLocal(key, merged);
    this._suppressRemote = false;
  },

  getLocalDataSummary() {
    return SyncShared.getLocalDataSummary();
  },

  async startDeviceFlow() {
    const response = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        scope: 'repo'
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`No se pudo iniciar GitHub (${response.status}): ${text.slice(0, 200)}`);
    }

    const data = await response.json();
    localStorage.setItem(GITHUB_DEVICE_KEY, JSON.stringify({
      device_code: data.device_code,
      interval: data.interval || 5,
      expires_at: Date.now() + (data.expires_in || 900) * 1000
    }));

    return {
      userCode: data.user_code,
      verificationUri: data.verification_uri,
      expiresIn: data.expires_in
    };
  },

  async pollDeviceFlow() {
    const stored = localStorage.getItem(GITHUB_DEVICE_KEY);
    if (!stored) {
      throw new Error('No hay autorización pendiente');
    }

    const { device_code: deviceCode, interval, expires_at: expiresAt } = JSON.parse(stored);
    if (Date.now() > expiresAt) {
      localStorage.removeItem(GITHUB_DEVICE_KEY);
      throw new Error('El código expiró. Vuelva a conectar GitHub.');
    }

    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
      })
    });

    const data = await response.json();

    if (data.error === 'authorization_pending') {
      return { pending: true, interval: interval || 5 };
    }

    if (data.error) {
      localStorage.removeItem(GITHUB_DEVICE_KEY);
      throw new Error(data.error_description || data.error);
    }

    if (!data.access_token) {
      return { pending: true, interval: interval || 5 };
    }

    localStorage.removeItem(GITHUB_DEVICE_KEY);
    this.setToken(data.access_token);
    this.hasWriteAccess = true;
    this.lastError = null;
    this.updateStatusElement();
    window.dispatchEvent(new CustomEvent('bca-sync-status', { detail: { cloud: true, connected: true } }));

    await this.publishAllLocalData({ skipPull: false }).catch((error) => {
      console.warn('Auto-publish tras GitHub:', error.message);
    });

    return { pending: false, connected: true };
  },

  disconnectGitHub() {
    this.setToken('');
    this._fileSha = null;
    this.updateStatusElement();
  },

  getStatusLabel() {
    if (this.syncing) {
      return 'Sincronizando con la nube compartida...';
    }
    if (!navigator.onLine) {
      return 'Sin internet — datos guardados localmente';
    }
    if (this.lastError && !this.lastSyncAt) {
      return `Nube: ${this.lastError}`;
    }
    if (!this.canWrite()) {
      const when = this.lastSyncAt
        ? new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' }).format(new Date(this.lastSyncAt))
        : null;
      return when
        ? `Leyendo nube compartida · ${when} · conecte GitHub para publicar`
        : 'Leyendo nube compartida — conecte GitHub para publicar cambios';
    }

    const when = this.lastSyncAt
      ? new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit' }).format(new Date(this.lastSyncAt))
      : null;

    return when
      ? `Nube GitHub activa · ${when}`
      : 'Nube GitHub activa — datos compartidos entre usuarios';
  },

  updateStatusElement() {
    const label = this.getStatusLabel();
    const el = document.getElementById('cloud-sync-status');
    if (el) el.replaceChildren(document.createTextNode(label));

    const combined = document.getElementById('firebase-sync-status');
    if (combined && typeof FirebaseSync !== 'undefined' && FirebaseSync.permissionDenied) {
      combined.replaceChildren(document.createTextNode(label));
    }
  }
};
