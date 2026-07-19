import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

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

const port = 8880;
const server = await startServer(ROOT, port);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

try {
  await page.goto(`http://127.0.0.1:${port}/app.html?v=23`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => typeof AuditLog !== 'undefined' && typeof InventoryManager !== 'undefined', null, { timeout: 15000 });

  const check = await page.evaluate(() => ({
    build: window.BCA_BUILD,
    auditLog: typeof AuditLog,
    inventory: typeof InventoryManager,
    getRoastMermaSteps: typeof getRoastMermaSteps
  }));

  console.log(JSON.stringify({ check, errors, passed: errors.length === 0 && check.auditLog === 'object' }, null, 2));
  if (errors.length > 0 || check.auditLog !== 'object') process.exit(1);
} finally {
  await browser.close();
  server.close();
}
