#!/usr/bin/env node

const config = {
  apiKey: process.env.FIREBASE_API_KEY || '',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.FIREBASE_APP_ID || ''
};

const hasAllValues = Object.values(config).every(Boolean);
const output = hasAllValues
  ? `window.FIREBASE_CONFIG = ${JSON.stringify(config, null, 2)};\n`
  : `window.FIREBASE_CONFIG = null;\n`;

process.stdout.write(output);
