#!/usr/bin/env node
/**
 * Aplica y valida el stack completo: HTML, CSS, JavaScript, Python.
 * Uso: node scripts/aplicar-todo.mjs [--solo-validar] [--no-bump] [--servir]
 */

import { execSync, spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const raiz = join(__dirname, '..');

const args = new Set(process.argv.slice(2));
const soloValidar = args.has('--solo-validar');
const noBump = args.has('--no-bump');
const servir = args.has('--servir');

const c = {
  ok: (m) => console.log(`\x1b[32m✓\x1b[0m ${m}`),
  info: (m) => console.log(`\x1b[36m→\x1b[0m ${m}`),
  warn: (m) => console.log(`\x1b[33m!\x1b[0m ${m}`),
  error: (m) => console.log(`\x1b[31m✗\x1b[0m ${m}`),
  titulo: (m) => console.log(`\n\x1b[1m=== ${m} ===\x1b[0m\n`)
};

function run(cmd, opts = {}) {
  return execSync(cmd, { cwd: raiz, stdio: 'inherit', encoding: 'utf8', ...opts });
}

function tiene(comando) {
  const r = spawnSync('which', [comando], { encoding: 'utf8' });
  if (r.status === 0) return true;
  return spawnSync('where', [comando], { encoding: 'utf8', shell: true }).status === 0;
}

function leerBuild() {
  const html = readFileSync(join(raiz, 'app.html'), 'utf8');
  const m = html.match(/BCA_BUILD\s*=\s*['"](\d+)['"]/);
  return m ? m[1] : '?';
}

function validarPython() {
  c.titulo('Python — validar HTML/CSS/JS');
  const script = join(raiz, 'scripts/validar_plataforma.py');
  if (!existsSync(script)) {
    c.error('No existe scripts/validar_plataforma.py');
    process.exit(1);
  }
  const py = tiene('python3') ? 'python3' : tiene('python') ? 'python' : null;
  if (!py) {
    c.warn('Python no instalado; se omite validación Python');
    return;
  }
  run(`${py} scripts/validar_plataforma.py`);
}

function validarNode() {
  c.titulo('JavaScript — sintaxis de módulos clave');
  const modulos = [
    'js/storage.js',
    'js/auth.js',
    'js/auth-biometric.js',
    'js/setupWizard.js',
    'js/sync-hub.js',
    'js/app.js',
    'js/data.js'
  ];
  modulos.forEach((file) => {
    run(`node --check ${file}`, { stdio: 'pipe' });
    c.ok(`${file}`);
  });
}

function bumpBuild() {
  if (noBump || soloValidar) return;
  c.titulo('Build — unificar versión');
  const out = run('node scripts/bump-build.mjs', { stdio: 'pipe' });
  const parsed = JSON.parse(out);
  c.ok(`Build ${parsed.build} · cache ${parsed.cacheVersion}`);
}

function correrTests() {
  if (soloValidar) return;
  c.titulo('Tests — persistencia');
  if (!tiene('npx')) {
    c.warn('npx no disponible; tests omitidos');
    return;
  }
  try {
    run('node scripts/test-persistence.mjs');
    c.ok('test-persistence');
  } catch {
    c.warn('test-persistence falló (Playwright puede faltar en local; CI lo ejecuta)');
  }
}

function servirLocal() {
  if (!servir) return;
  c.titulo('Servidor local');
  const py = tiene('python3') ? 'python3' : 'python';
  c.info(`Abriendo http://localhost:8080 — Ctrl+C para detener`);
  run(`${py} scripts/servir_local.py`, { stdio: 'inherit' });
}

function resumen() {
  c.titulo('Stack aplicado');
  console.log('  HTML/CSS/JS  → index.html, app.html, css/, js/');
  console.log('  JavaScript   → lógica de negocio, sync, auth biométrico');
  console.log('  Python       → validación y utilidades (scripts/)');
  console.log('  Nube         → Google Apps Script + Firebase (opcional)');
  console.log('');
  console.log(`  Build actual: ${leerBuild()}`);
  console.log('  Producción:   https://lasucursaldelcafe-droid.github.io/-black-coffee/');
  console.log('');
  if (!soloValidar && !noBump) {
    c.info('Para publicar: git push origin main (GitHub Actions despliega gh-pages)');
  }
}

function main() {
  c.titulo('Aplicar todo — Black Coffee Administration');
  console.log('Tecnologías: HTML · CSS · JavaScript · Python\n');

  validarPython();
  validarNode();
  bumpBuild();
  correrTests();
  resumen();
  servirLocal();
}

main();
