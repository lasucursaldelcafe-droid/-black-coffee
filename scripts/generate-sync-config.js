#!/usr/bin/env node

const syncKey = process.env.BCA_SYNC_KEY || 'BCA-Ximena-Pablo-2026';
const DEFAULT_GAS_URL =
  'https://script.google.com/macros/s/AKfycbwbN42x_9ed0m2cAAXPg5fEhucERXsJNvNflGhgl0oMTJKzvSssfEwHxK42H2erLvDgYQ/exec';
const gasUrl = (process.env.GAS_WEB_APP_URL || DEFAULT_GAS_URL).trim();
const githubToken = (process.env.GITHUB_SYNC_TOKEN || '').trim();
const firebaseSyncUrl = (process.env.FIREBASE_SYNC_URL || 'https://southamerica-east1-black-coffee-15ccc.cloudfunctions.net/bcaSync').trim();

const gasConfig = `window.GAS_SYNC_CONFIG = ${JSON.stringify({
  webAppUrl: gasUrl,
  syncKey,
  enabled: Boolean(gasUrl)
}, null, 2)};\n`;

const cloudConfig = `window.CLOUD_SYNC_CONFIG = ${JSON.stringify({
  githubWriteToken: githubToken,
  syncKey,
  enabled: Boolean(githubToken)
}, null, 2)};\n`;

const firebaseHttpConfig = `window.FIREBASE_HTTP_SYNC_CONFIG = ${JSON.stringify({
  syncUrl: firebaseSyncUrl,
  syncKey,
  enabled: Boolean(firebaseSyncUrl)
}, null, 2)};\n`;

process.stdout.write(JSON.stringify({ gasConfig, cloudConfig, firebaseHttpConfig }));
