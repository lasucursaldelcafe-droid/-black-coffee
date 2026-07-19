import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml'
};

function startServer(root, port) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const path = req.url === '/' ? '/index.html' : req.url.split('?')[0];
      const filePath = join(root, path);
      if (!existsSync(filePath)) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'text/plain' });
      res.end(readFileSync(filePath));
    });
    server.listen(port, () => resolve(server));
  });
}

async function testUrl(page, label, url) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.fill('#username', 'ximena.polo');
  await page.fill('#password', 'XimenaBCA2026!');
  await page.click('button[type="submit"]');
  await page.waitForURL(/app\.html/, { timeout: 15000 });
  await page.waitForTimeout(3000);

  const stats = await page.locator('#dashboard-stats .stat-card').count();
  const title = await page.locator('#page-title').textContent();
  const syncStatus = await page.locator('#firebase-sync-status').textContent().catch(() => 'n/a');

  return { label, url, stats, title, syncStatus, errors };
}

const port = 8877;
const server = await startServer(ROOT, port);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const results = [];
try {
  results.push(await testUrl(page, 'local', `http://127.0.0.1:${port}/app.html`));
  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  results.push(await testUrl(page, 'production', 'https://lasucursaldelcafe-droid.github.io/-black-coffee/app.html'));
} finally {
  await browser.close();
  server.close();
}

console.log(JSON.stringify(results, null, 2));
