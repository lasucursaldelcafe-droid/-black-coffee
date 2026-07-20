const SYNC_EXCLUDED = new Set([
  STORAGE_KEYS.SESSION,
  STORAGE_KEYS.USERS,
  STORAGE_KEYS.BIOMETRIC_CREDENTIALS,
  DEVICE_ID_KEY,
  LOCAL_SYNC_META_KEY
]);

const SYNC_META_KEYS = [
  'bca_data_version',
  'bca_email_queue',
  'bca_deleted_records',
  'bca_dismissed_supplier_services',
  'bca_supplier_templates_initialized'
];

const SYNC_LIST_MERGE_KEYS = new Set([
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

const SyncShared = {
  getSyncKeys() {
    return Object.values(STORAGE_KEYS).filter((key) => !SYNC_EXCLUDED.has(key));
  },

  getAllSyncKeys() {
    return [...this.getSyncKeys(), ...SYNC_META_KEYS];
  },

  getLocalUpdatedAt(key) {
    if (typeof Storage === 'undefined') return 0;
    return Storage.getLocalSyncMeta()[key] || 0;
  },

  buildDocumentEntry(key, payload, deviceId, fallbackNow = Date.now()) {
    const updatedAt = this.getLocalUpdatedAt(key) || fallbackNow;
    return {
      payload: this.sanitizeRemotePayload(key, payload),
      updatedAt,
      deviceId
    };
  },

  buildLocalDocument(getAllSyncKeys, getDeviceId) {
    const keys = {};
    const now = Date.now();
    const deviceId = getDeviceId();
    getAllSyncKeys().forEach((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      try {
        keys[key] = this.buildDocumentEntry(key, JSON.parse(raw), deviceId, now);
      } catch {
        /* omit corrupt key */
      }
    });
    return { version: 1, updatedAt: now, deviceId, keys };
  },

  /** El dispositivo local gana si editó recientemente (evita que nubes secundarias borren datos de PC). */
  shouldPreferLocal(localUpdatedAt, remoteUpdatedAt, localPayload, remotePayload) {
    if (localUpdatedAt <= 0) return false;
    if (this.isEmptyPayload(localPayload)) return false;

    if (!remoteUpdatedAt || remoteUpdatedAt === 0) return true;
    if (this.isEmptyPayload(remotePayload)) return true;

    // 5 s de tolerancia: latencia de red / reloj no deben pisar una edición local reciente
    if (localUpdatedAt >= remoteUpdatedAt - 5000) {
      return localUpdatedAt >= remoteUpdatedAt;
    }
    return localUpdatedAt > remoteUpdatedAt;
  },

  getReconcileContext(key, remoteEntry) {
    const remotePayload = remoteEntry?.payload ?? remoteEntry;
    return {
      remoteEntry: remoteEntry && typeof remoteEntry === 'object' && 'payload' in remoteEntry
        ? remoteEntry
        : { payload: remotePayload, updatedAt: remoteEntry?.updatedAt },
      localUpdatedAt: this.getLocalUpdatedAt(key),
      remoteUpdatedAt: remoteEntry?.updatedAt || this.extractUpdatedAt(remotePayload)
    };
  },

  stableStringify(value) {
    return JSON.stringify(value);
  },

  itemTimestamp(item) {
    if (item === null || item === undefined) return 0;
    if (typeof item === 'string') return 0;
    return Date.parse(
      item.updatedAt || item.createdAt || item.soldAt || item.lastUpdated || item.sentAt || 0
    ) || 0;
  },

  sanitizeRemotePayload(key, payload) {
    if (typeof Storage === 'undefined') return payload;
    if (Array.isArray(payload)) {
      return Storage.filterDeleted(key, payload);
    }
    return payload;
  },

  isEmptyPayload(payload) {
    if (payload === null || payload === undefined) return true;
    if (Array.isArray(payload)) return payload.length === 0;
    if (typeof payload === 'object') return Object.keys(payload).length === 0;
    return false;
  },

  extractUpdatedAt(value) {
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

  mergeDeletedRecords(local, remote) {
    const merged = { ...(local && typeof local === 'object' ? local : {}) };
    Object.entries(remote && typeof remote === 'object' ? remote : {}).forEach(([listKey, ids]) => {
      merged[listKey] = [...new Set([...(merged[listKey] || []), ...(ids || [])])].slice(-500);
    });
    return merged;
  },

  mergeObjects(local, remote) {
    if (!local) return remote;
    if (!remote) return local;
    const localTs = this.extractUpdatedAt(local);
    const remoteTs = this.extractUpdatedAt(remote);
    if (remoteTs >= localTs) {
      return { ...local, ...remote };
    }
    return { ...remote, ...local };
  },

  mergeLists(key, localArr, remoteArr) {
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
        if (!existing || this.itemTimestamp(item) >= this.itemTimestamp(existing)) {
          byKey.set(composite, item);
        }
      });
      return [...byKey.values()].sort((a, b) => this.itemTimestamp(b) - this.itemTimestamp(a));
    }

    const deleted = typeof Storage !== 'undefined' ? Storage.getDeletedIds(key) : new Set();
    const byId = new Map();
    [...local, ...remote].forEach((item) => {
      if (!item?.id) return;
      if (deleted.has(item.id)) return;
      const existing = byId.get(item.id);
      if (!existing || this.itemTimestamp(item) >= this.itemTimestamp(existing)) {
        byId.set(item.id, item);
      }
    });
    return [...byId.values()];
  },

  mergePayloads(key, local, remote) {
    const localPayload = this.sanitizeRemotePayload(key, local);
    const remotePayload = this.sanitizeRemotePayload(key, remote);

    if (localPayload === null || localPayload === undefined) {
      return remotePayload ?? null;
    }
    if (remotePayload === null || remotePayload === undefined) {
      return localPayload;
    }

    if (key === STORAGE_KEYS.DELETED_RECORDS || key === DELETED_RECORDS_KEY) {
      return this.mergeDeletedRecords(localPayload, remotePayload);
    }

    if (SYNC_LIST_MERGE_KEYS.has(key)) {
      return this.mergeLists(key, localPayload, remotePayload);
    }

    if (typeof localPayload === 'object' && typeof remotePayload === 'object'
      && !Array.isArray(localPayload) && !Array.isArray(remotePayload)) {
      return this.mergeObjects(localPayload, remotePayload);
    }

    const localTs = this.extractUpdatedAt(localPayload);
    const remoteTs = this.extractUpdatedAt(remotePayload);
    return remoteTs >= localTs ? remotePayload : localPayload;
  },

  reconcilePayload(key, localPayload, remoteEntry, options = {}) {
    const remotePayload = remoteEntry?.payload ?? remoteEntry;
    const remoteUpdatedAt = remoteEntry?.updatedAt
      || this.extractUpdatedAt(remotePayload);
    const localUpdatedAt = options.localUpdatedAt || 0;

    if ((localPayload === null || localPayload === undefined)
      && (remotePayload === null || remotePayload === undefined)) {
      return { merged: null, changed: false, push: false };
    }

    if (localPayload === null || localPayload === undefined) {
      if (this.isEmptyPayload(remotePayload)) {
        return { merged: null, changed: false, push: false };
      }
      const merged = this.sanitizeRemotePayload(key, remotePayload);
      return { merged, changed: true, push: false };
    }

    if (remotePayload === null || remotePayload === undefined || !remoteEntry) {
      return { merged: localPayload, changed: false, push: true };
    }

    if (this.shouldPreferLocal(localUpdatedAt, remoteUpdatedAt, localPayload, remotePayload)) {
      return { merged: localPayload, changed: false, push: true };
    }

    const merged = this.mergePayloads(key, localPayload, remotePayload);
    const sanitizedRemote = this.sanitizeRemotePayload(key, remotePayload);
    const changed = this.stableStringify(merged) !== this.stableStringify(localPayload);
    const push = this.stableStringify(merged) !== this.stableStringify(sanitizedRemote);

    return { merged, changed, push: changed || push };
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

  applyMergedLocal(key, merged, hooks = {}) {
    if (hooks.beforeApply) hooks.beforeApply();
    Storage.setRemote(key, merged);
    if (typeof Storage !== 'undefined') {
      Storage.markLocalWrite(key);
    }
    if (hooks.afterApply) hooks.afterApply();
  }
};
