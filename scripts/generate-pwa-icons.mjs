#!/usr/bin/env node
/**
 * Genera iconos PWA desde icons/icon-512.png (requiere sharp).
 * Uso: npm install sharp --no-save && node scripts/generate-pwa-icons.mjs
 */
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'icons');
const src = join(iconsDir, 'icon-512.png');

if (!existsSync(src)) {
  console.error('Falta icons/icon-512.png — coloque el icono base primero.');
  process.exit(1);
}

const sharp = require('sharp');

await Promise.all([
  sharp(src).resize(192, 192).png().toFile(join(iconsDir, 'icon-192.png')),
  sharp(src).resize(180, 180).png().toFile(join(iconsDir, 'apple-touch-icon.png')),
  sharp(src)
    .resize(512, 512)
    .extend({ top: 64, bottom: 64, left: 64, right: 64, background: { r: 10, g: 10, b: 10, alpha: 1 } })
    .resize(512, 512)
    .png()
    .toFile(join(iconsDir, 'icon-maskable-512.png'))
]);

console.log('Iconos PWA generados en icons/');
