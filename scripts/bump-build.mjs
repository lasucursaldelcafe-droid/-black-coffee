#!/usr/bin/env node
/**
 * Unifica BCA_BUILD, ?v= en scripts y CACHE_VERSION del service worker.
 * Uso: node scripts/bump-build.mjs [buildNumber]
 * Sin argumento: incrementa el build actual en app.html.
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '..');
const files = ['app.html', 'index.html', 'sw.js'];

function readBuildFromApp() {
  const appHtml = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
  const match = appHtml.match(/BCA_BUILD\s*=\s*['"](\d+)['"]/);
  return match ? parseInt(match[1], 10) : 0;
}

const argBuild = process.argv[2] ? parseInt(process.argv[2], 10) : null;
const nextBuild = Number.isFinite(argBuild) && argBuild > 0
  ? argBuild
  : readBuildFromApp() + 1;

const buildStr = String(nextBuild);
const cacheVersion = `bca-v${buildStr}`;

function bumpHtml(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  html = html.replace(/BCA_BUILD\s*=\s*['"]\d+['"]/, `BCA_BUILD = '${buildStr}'`);
  html = html.replace(/\?v=\d+/g, `?v=${buildStr}`);
  fs.writeFileSync(filePath, html);
}

function bumpSw() {
  const swPath = path.join(root, 'sw.js');
  let sw = fs.readFileSync(swPath, 'utf8');
  sw = sw.replace(/const CACHE_VERSION = 'bca-v\d+';/, `const CACHE_VERSION = '${cacheVersion}';`);
  fs.writeFileSync(swPath, sw);
}

bumpHtml(path.join(root, 'app.html'));
bumpHtml(path.join(root, 'index.html'));
bumpSw();

console.log(JSON.stringify({ build: buildStr, cacheVersion, files }));
