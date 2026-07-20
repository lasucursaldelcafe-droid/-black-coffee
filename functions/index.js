const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { Resend } = require('resend');

initializeApp();

const resendApiKey = defineSecret('RESEND_API_KEY');
const fromEmail = defineSecret('BCA_FROM_EMAIL');

const BCA_SYNC_KEY = 'BCA-Ximena-Pablo-2026';
const BCA_COLLECTION = 'bca_data';

function mergePayloads(local, remote) {
  if (remote === null || remote === undefined) return local;
  if (local === null || local === undefined) return remote;
  if (Array.isArray(local) && Array.isArray(remote)) {
    const byId = new Map();
    [...remote, ...local].forEach((item) => {
      if (!item?.id) return;
      const existing = byId.get(item.id);
      const ts = (v) => Date.parse(v?.updatedAt || v?.createdAt || v?.soldAt || 0) || 0;
      if (!existing || ts(item) >= ts(existing)) byId.set(item.id, item);
    });
    return [...byId.values()];
  }
  if (typeof local === 'object' && typeof remote === 'object' && !Array.isArray(local)) {
    return { ...remote, ...local };
  }
  return local;
}

async function readAllSyncData(db) {
  const snap = await db.collection(BCA_COLLECTION).get();
  const keys = {};
  snap.forEach((doc) => {
    const data = doc.data();
    keys[data.key || doc.id] = {
      payload: data.payload,
      updatedAt: data.updatedAt || 0,
      deviceId: data.deviceId || 'firebase'
    };
  });
  return { version: 1, updatedAt: Date.now(), deviceId: 'firebase-admin', keys };
}

async function writeMergedSyncData(db, document) {
  const batch = db.batch();
  const keys = document.keys || {};
  Object.entries(keys).forEach(([key, entry]) => {
    const ref = db.collection(BCA_COLLECTION).doc(key);
    batch.set(ref, {
      key,
      payload: entry.payload,
      updatedAt: entry.updatedAt || Date.now(),
      deviceId: entry.deviceId || 'sync-api'
    });
  });
  await batch.commit();
}

exports.bcaSync = onRequest(
  { cors: true, region: 'southamerica-east1', invoker: 'public' },
  async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, x-bca-sync-key');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    const syncKey = req.headers['x-bca-sync-key'] || req.query.key || req.body?.key;
    if (syncKey !== BCA_SYNC_KEY) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const db = getFirestore();

    try {
      if (req.method === 'GET' || req.body?.action === 'pull') {
        const document = await readAllSyncData(db);
        res.json(document);
        return;
      }

      if (req.method === 'POST') {
        const remote = await readAllSyncData(db);
        const local = req.body?.document || { keys: {} };
        const mergedKeys = { ...remote.keys };

        Object.entries(local.keys || {}).forEach(([key, entry]) => {
          const remoteEntry = mergedKeys[key];
          if (!remoteEntry) {
            mergedKeys[key] = entry;
            return;
          }
          mergedKeys[key] = {
            payload: mergePayloads(entry.payload, remoteEntry.payload),
            updatedAt: Date.now(),
            deviceId: entry.deviceId || remoteEntry.deviceId
          };
        });

        const merged = {
          version: 1,
          updatedAt: Date.now(),
          deviceId: 'firebase-merge',
          keys: mergedKeys
        };

        await writeMergedSyncData(db, merged);
        res.json({
          ok: true,
          pushed: Object.keys(local.keys || {}).length,
          document: merged
        });
        return;
      }

      res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
      console.error('bcaSync error:', error);
      res.status(500).json({ error: error.message || 'Sync failed' });
    }
  }
);

exports.processEmailOutbox = onDocumentCreated(
  {
    document: 'bca_email_outbox/{emailId}',
    secrets: [resendApiKey, fromEmail],
    region: 'southamerica-east1'
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const data = snapshot.data();
    const db = getFirestore();
    const docRef = snapshot.ref;

    if (data.delivered || data.failed) {
      return;
    }

    const resend = new Resend(resendApiKey.value());
    const from = fromEmail.value() || 'Black Coffee <onboarding@resend.dev>';

    try {
      const result = await resend.emails.send({
        from,
        to: data.to,
        subject: data.subject,
        text: data.body
      });

      await docRef.update({
        delivered: true,
        deliveredAt: FieldValue.serverTimestamp(),
        providerId: result.data?.id || null
      });
    } catch (error) {
      console.error('Error enviando correo BCA:', error);
      await docRef.update({
        failed: true,
        failedAt: FieldValue.serverTimestamp(),
        error: error.message || 'Error desconocido'
      });
    }
  }
);
