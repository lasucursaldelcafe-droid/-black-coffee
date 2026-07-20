/**
 * Black Coffee Administration — Sync en la nube (Google Apps Script)
 *
 * Despliegue (una vez, ~2 min):
 * 1. https://script.google.com → Nuevo proyecto → pegar este código
 * 2. Implementar → Nueva implementación → Aplicación web
 *    - Ejecutar como: Yo
 *    - Quién tiene acceso: Cualquier persona
 * 3. Copiar URL /exec y guardarla en GitHub Secret GAS_WEB_APP_URL
 *    (Actions → Instalar secretos → o workflow Desplegar)
 */

const BCA_SYNC_KEY = 'BCA-Ximena-Pablo-2026';
const BCA_FILE_NAME = 'bca-cloud-data.json';
const BCA_FOLDER_NAME = 'BlackCoffeeAdministration';

function doGet(e) {
  return handleRequest_(e, false);
}

function doPost(e) {
  return handleRequest_(e, true);
}

function handleRequest_(e, isPost) {
  try {
    const params = isPost ? parseBody_(e) : (e.parameter || {});
    const key = params.key || (e.parameter && e.parameter.key);

    if (key !== BCA_SYNC_KEY) {
      return jsonOut_({ error: 'Unauthorized' }, 401);
    }

    const action = params.action || 'pull';

    if (action === 'pull') {
      return jsonOut_(readDocument_());
    }

    if (action === 'push' || action === 'sync') {
      const localDoc = params.document || { keys: {} };
      const remoteDoc = readDocument_();
      const merged = mergeDocuments_(remoteDoc, localDoc);
      writeDocument_(merged);
      return jsonOut_({
        ok: true,
        updatedAt: merged.updatedAt,
        document: merged,
        pushed: Object.keys(localDoc.keys || {}).length,
        pulled: Object.keys(merged.keys || {}).length
      });
    }

    return jsonOut_({ error: 'Unknown action: ' + action }, 400);
  } catch (err) {
    return jsonOut_({ error: String(err.message || err) }, 500);
  }
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) return {};
  return JSON.parse(e.postData.contents);
}

function jsonOut_(data, status) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  if (status && status >= 400) {
    // Apps Script no expone status HTTP directo; el cliente valida el cuerpo
    data._httpStatus = status;
  }
  return output;
}

function getOrCreateFolder_() {
  const folders = DriveApp.getFoldersByName(BCA_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(BCA_FOLDER_NAME);
}

function readDocument_() {
  const folder = getOrCreateFolder_();
  const files = folder.getFilesByName(BCA_FILE_NAME);
  if (!files.hasNext()) {
    return { version: 1, updatedAt: 0, deviceId: 'gas', keys: {} };
  }
  const file = files.next();
  try {
    return JSON.parse(file.getBlob().getDataAsString('UTF-8'));
  } catch (e) {
    return { version: 1, updatedAt: 0, deviceId: 'gas', keys: {} };
  }
}

function writeDocument_(doc) {
  const folder = getOrCreateFolder_();
  const json = JSON.stringify(doc, null, 2);
  const blob = Utilities.newBlob(json, 'application/json', BCA_FILE_NAME);
  const files = folder.getFilesByName(BCA_FILE_NAME);
  if (files.hasNext()) {
    files.next().setContent(json);
  } else {
    folder.createFile(blob);
  }
}

function mergeDocuments_(remoteDoc, localDoc) {
  const mergedKeys = Object.assign({}, (remoteDoc && remoteDoc.keys) || {});
  const localKeys = (localDoc && localDoc.keys) || {};

  Object.keys(localKeys).forEach(function (key) {
    const localEntry = localKeys[key];
    const remoteEntry = mergedKeys[key];
    mergedKeys[key] = mergeEntry_(key, localEntry, remoteEntry);
  });

  return {
    version: 1,
    updatedAt: Date.now(),
    deviceId: 'gas-merge',
    keys: mergedKeys
  };
}

function mergeEntry_(key, localEntry, remoteEntry) {
  if (!remoteEntry) return localEntry;
  if (!localEntry) return remoteEntry;

  const localPayload = localEntry.payload;
  const remotePayload = remoteEntry.payload;
  const localTs = entryTimestamp_(localEntry);
  const remoteTs = entryTimestamp_(remoteEntry);

  if (Array.isArray(localPayload) && Array.isArray(remotePayload)) {
    return {
      payload: mergeArrays_(localPayload, remotePayload),
      updatedAt: Date.now(),
      deviceId: localEntry.deviceId || remoteEntry.deviceId
    };
  }

  if (localTs >= remoteTs) return localEntry;
  return remoteEntry;
}

function mergeArrays_(localArr, remoteArr) {
  const byId = {};
  (remoteArr || []).concat(localArr || []).forEach(function (item) {
    if (!item || !item.id) return;
    const existing = byId[item.id];
    if (!existing || itemTimestamp_(item) >= itemTimestamp_(existing)) {
      byId[item.id] = item;
    }
  });
  return Object.keys(byId).map(function (id) { return byId[id]; });
}

function entryTimestamp_(entry) {
  if (!entry) return 0;
  if (entry.updatedAt) return Number(entry.updatedAt) || 0;
  return itemTimestamp_(entry.payload);
}

function itemTimestamp_(item) {
  if (!item) return 0;
  if (typeof item === 'string') return 0;
  return Date.parse(item.updatedAt || item.createdAt || item.soldAt || item.lastUpdated || 0) || 0;
}

/** Ejecutar manualmente para verificar */
function testBcaSync() {
  const doc = readDocument_();
  Logger.log(JSON.stringify(doc).slice(0, 500));
}
