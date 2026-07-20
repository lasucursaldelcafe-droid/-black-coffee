const BACKUP_VERSION = 1;
const BACKUP_EXCLUDED = new Set([STORAGE_KEYS.SESSION, STORAGE_KEYS.USERS]);

const BackupManager = {
  getExportKeys() {
    return [
      ...Object.values(STORAGE_KEYS).filter((key) => !BACKUP_EXCLUDED.has(key)),
      'bca_data_version',
      'bca_email_queue',
      LOCAL_SYNC_META_KEY
    ];
  },

  exportAll() {
    const data = {};
    this.getExportKeys().forEach((key) => {
      const value = Storage.get(key);
      if (value !== null && value !== undefined) {
        data[key] = value;
      }
    });

    return {
      app: 'Black Coffee Administration',
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      data
    };
  },

  download(filename = null) {
    const payload = this.exportAll();
    const name = filename || `bca-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
    return payload;
  },

  importFromObject(payload, options = { merge: false }) {
    if (!payload?.data || typeof payload.data !== 'object') {
      throw new Error('Archivo de respaldo inválido');
    }

    const keys = Object.keys(payload.data);
    if (keys.length === 0) {
      throw new Error('El respaldo está vacío');
    }

    if (!options.merge) {
      this.getExportKeys().forEach((key) => {
        if (localStorage.getItem(key)) {
          Storage.remove(key);
        }
      });
    }

    keys.forEach((key) => {
      if (BACKUP_EXCLUDED.has(key)) return;
      Storage.set(key, payload.data[key]);
    });

    if (payload.data[DATA_VERSION_KEY]) {
      Storage.set(DATA_VERSION_KEY, payload.data[DATA_VERSION_KEY]);
    }

    DataSeed.init();

    if (typeof FirebaseSync !== 'undefined' && FirebaseSync.isEnabled()) {
      FirebaseSync.pushAllLocal().catch((error) => {
        console.warn('Respaldo importado; error al subir a Firebase:', error.message);
      });
    }

    return keys.length;
  },

  importFromFile(file, options = { merge: false }) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const payload = JSON.parse(String(event.target?.result || ''));
          const count = this.importFromObject(payload, options);
          resolve(count);
        } catch (error) {
          reject(error instanceof Error ? error : new Error('No se pudo leer el respaldo'));
        }
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsText(file);
    });
  }
};
