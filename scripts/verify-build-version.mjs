import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataJs = readFileSync(join(ROOT, 'js/data.js'), 'utf8');
const appHtml = readFileSync(join(ROOT, 'app.html'), 'utf8');

const dataVersion = dataJs.match(/const DATA_VERSION = (\d+)/)?.[1];
const bcaBuild = appHtml.match(/window\.BCA_BUILD = '(\d+)'/)?.[1];
const scriptVersions = [...appHtml.matchAll(/\.js\?v=(\d+)/g)].map((m) => m[1]);
const uniqueScriptVersions = [...new Set(scriptVersions)];

const errors = [];

if (!dataVersion) errors.push('No se encontró DATA_VERSION en js/data.js');
if (!bcaBuild) errors.push('No se encontró window.BCA_BUILD en app.html');
if (dataVersion && bcaBuild && dataVersion !== bcaBuild) {
  errors.push(`DATA_VERSION (${dataVersion}) ≠ BCA_BUILD (${bcaBuild})`);
}
if (uniqueScriptVersions.length > 1) {
  errors.push(`Versiones de cache-bust inconsistentes: ${uniqueScriptVersions.join(', ')}`);
}
if (bcaBuild && uniqueScriptVersions.some((v) => v !== bcaBuild)) {
  errors.push(`Scripts ?v= deben coincidir con BCA_BUILD (${bcaBuild})`);
}

if (errors.length > 0) {
  console.error('verify-build-version FAILED:\n' + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  dataVersion,
  bcaBuild,
  scriptCount: scriptVersions.length
}, null, 2));
