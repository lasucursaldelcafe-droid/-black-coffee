import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const expectedVersion = readFileSync(join(ROOT, 'js/data.js'), 'utf8')
  .match(/const DATA_VERSION = (\d+)/)?.[1];

if (!expectedVersion) {
  console.error('No se pudo leer DATA_VERSION de js/data.js');
  process.exit(1);
}

execSync('git fetch origin gh-pages --depth=1', { cwd: ROOT, stdio: 'inherit' });

const ghPagesApp = execSync('git show origin/gh-pages:app.html', { cwd: ROOT, encoding: 'utf8' });
const ghPagesData = execSync('git show origin/gh-pages:js/data.js', { cwd: ROOT, encoding: 'utf8' });

const deployedBuild = ghPagesApp.match(/window\.BCA_BUILD = '(\d+)'/)?.[1];
const deployedDataVersion = ghPagesData.match(/const DATA_VERSION = (\d+)/)?.[1];
const hasEnsureInInit = /init\(\)[\s\S]{0,400}ensureTransformationSuppliers\(\)/.test(ghPagesData);

const errors = [];

if (!deployedBuild) errors.push('gh-pages: falta BCA_BUILD en app.html');
if (!deployedDataVersion) errors.push('gh-pages: falta DATA_VERSION en js/data.js');
if (deployedBuild !== expectedVersion) {
  errors.push(`gh-pages BCA_BUILD (${deployedBuild}) ≠ main DATA_VERSION (${expectedVersion})`);
}
if (deployedDataVersion !== expectedVersion) {
  errors.push(`gh-pages DATA_VERSION (${deployedDataVersion}) ≠ main (${expectedVersion})`);
}
if (hasEnsureInInit) {
  errors.push('gh-pages: ensureTransformationSuppliers() sigue en init() — causa borrados fantasma');
}

if (errors.length > 0) {
  console.error('verify-gh-pages FAILED:\n' + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  deployedBuild,
  deployedDataVersion,
  url: 'https://lasucursaldelcafe-droid.github.io/-black-coffee/'
}, null, 2));
