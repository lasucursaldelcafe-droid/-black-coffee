#!/usr/bin/env node
/**
 * Instalación automática — Black Coffee Administration
 * Ejecutar: node scripts/instalar-todo.mjs
 * Requiere: Node.js, gh (GitHub CLI), firebase-tools
 */

import { execSync, spawnSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const raiz = join(__dirname, '..');
const REPO = 'lasucursaldelcafe-droid/-black-coffee';

const c = {
  ok: (m) => console.log(`\x1b[32m✓\x1b[0m ${m}`),
  aviso: (m) => console.log(`\x1b[33m!\x1b[0m ${m}`),
  error: (m) => console.log(`\x1b[31m✗\x1b[0m ${m}`),
  titulo: (m) => console.log(`\n\x1b[36m=== ${m} ===\x1b[0m\n`)
};

function ejecutar(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: opts.silencioso ? 'pipe' : 'inherit', ...opts });
  } catch (e) {
    if (opts.permitirFallo) return null;
    throw e;
  }
}

function tiene(comando) {
  return spawnSync('which', [comando], { encoding: 'utf8' }).status === 0
    || spawnSync('where', [comando], { encoding: 'utf8', shell: true }).status === 0;
}

function leerFirebaseConfig() {
  const ruta = join(raiz, 'js/firebase-config.js');
  if (!existsSync(ruta)) throw new Error('No existe js/firebase-config.js');
  const texto = readFileSync(ruta, 'utf8');
  const extraer = (campo) => {
    const m = texto.match(new RegExp(`${campo}:\\s*'([^']*)'`));
    return m ? m[1] : '';
  };
  return {
    FIREBASE_API_KEY: extraer('apiKey'),
    FIREBASE_AUTH_DOMAIN: extraer('authDomain'),
    FIREBASE_PROJECT_ID: extraer('projectId'),
    FIREBASE_STORAGE_BUCKET: extraer('storageBucket'),
    FIREBASE_MESSAGING_SENDER_ID: extraer('messagingSenderId'),
    FIREBASE_APP_ID: extraer('appId')
  };
}

function ponerSecretoGithub(nombre, valor) {
  if (!valor) return false;
  ejecutar(`gh secret set ${nombre} --repo "${REPO}" --body "${valor.replace(/"/g, '\\"')}"`, { silencioso: true });
  c.ok(`Secreto GitHub: ${nombre}`);
  return true;
}

async function main() {
  c.titulo('Instalador automático BCA');

  console.log('Este script configura GitHub Secrets y despliega Firebase.');
  console.log('Todo en español. No guarda claves en archivos del proyecto.\n');

  if (!tiene('node')) {
    c.error('Instala Node.js: https://nodejs.org');
    process.exit(1);
  }

  if (!tiene('gh')) {
    c.error('Instala GitHub CLI: https://cli.github.com');
    c.aviso('Luego ejecuta: gh auth login');
    process.exit(1);
  }

  ejecutar('gh auth status', { permitirFallo: true });

  c.titulo('Paso 1 — Secretos de Firebase en GitHub');
  const fb = leerFirebaseConfig();
  Object.entries(fb).forEach(([k, v]) => ponerSecretoGithub(k, v));

  c.titulo('Paso 2 — Clave de Resend (correo)');
  let resendKey = process.env.RESEND_API_KEY || '';
  if (!resendKey) {
    c.aviso('Define la variable RESEND_API_KEY antes de ejecutar, ejemplo:');
    console.log('  Windows PowerShell:');
    console.log('    $env:RESEND_API_KEY="re_tu_clave_aqui"');
    console.log('    node scripts/instalar-todo.mjs');
    console.log('');
    console.log('  Obtener clave en: https://resend.com/api-keys');
    process.exit(1);
  }
  ponerSecretoGithub('RESEND_API_KEY', resendKey);
  ponerSecretoGithub('BCA_FROM_EMAIL', 'Black Coffee <onboarding@resend.dev>');

  c.titulo('Paso 3 — Token de Firebase (despliegue automático)');
  if (!tiene('firebase')) {
    c.aviso('Instalando firebase-tools...');
    ejecutar('npm install -g firebase-tools');
  }

  if (!process.env.FIREBASE_TOKEN) {
    c.aviso('Genera un token de Firebase (se abrirá el navegador):');
    console.log('  firebase login:ci');
    console.log('');
    console.log('Copia el token y ejecuta:');
    console.log('  Windows: $env:FIREBASE_TOKEN="el_token"');
    console.log('  Luego: node scripts/instalar-todo.mjs');
    process.exit(0);
  }

  ponerSecretoGithub('FIREBASE_TOKEN', process.env.FIREBASE_TOKEN);

  c.titulo('Paso 4 — Desplegar Functions y reglas Firestore');
  process.chdir(raiz);
  ejecutar('cd functions && npm install', { shell: true });
  process.env.RESEND_API_KEY = resendKey;
  process.env.BCA_FROM_EMAIL = 'Black Coffee <onboarding@resend.dev>';

  ejecutar(`echo -n "${resendKey}" | firebase functions:secrets:set RESEND_API_KEY --project ${fb.FIREBASE_PROJECT_ID} --data-file -`, { shell: true });
  ejecutar(`echo -n "Black Coffee <onboarding@resend.dev>" | firebase functions:secrets:set BCA_FROM_EMAIL --project ${fb.FIREBASE_PROJECT_ID} --data-file -`, { shell: true });
  ejecutar(`firebase deploy --only functions,firestore:rules --project ${fb.FIREBASE_PROJECT_ID}`, { shell: true });

  c.titulo('Listo');
  c.ok('GitHub Secrets configurados');
  c.ok('Firebase Functions desplegadas');
  console.log('\nPrueba: abre la app, registra una venta y revisa ghostspecialtycoffee@gmail.com');
  console.log('Panel Firebase: https://console.firebase.google.com/project/black-coffee-15ccc/functions');
}

main().catch((err) => {
  c.error(err.message || String(err));
  process.exit(1);
});
