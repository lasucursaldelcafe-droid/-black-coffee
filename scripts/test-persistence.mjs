import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';

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

async function login(page, baseUrl) {
  await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.fill('#username', 'ximena.polo');
  await page.fill('#password', 'XimenaBCA2026!');
  await page.click('button[type="submit"]');
  await page.waitForURL(/app\.html/, { timeout: 15000 });
  await page.waitForTimeout(1500);
  const costsModal = page.locator('#costs-check-modal.active');
  if (await costsModal.count()) {
    await page.click('#costs-no-change');
    await page.waitForTimeout(300);
  }
}

const port = 8878;
const server = await startServer('/workspace', port);
const baseUrl = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
});

const uniqueName = `Test Café ${Date.now()}`;

try {
  await login(page, baseUrl);

  await page.click('button[data-section="coffees"]');
  await page.waitForTimeout(500);
  await page.click('button:has-text("+ Nuevo Café")');
  await page.waitForSelector('#coffee-modal.active', { timeout: 5000 });
  await page.fill('#coffee-name', uniqueName);
  await page.fill('#coffee-price', '15000');
  await page.click('#save-coffee-btn');
  await page.waitForTimeout(800);

  const visibleBefore = await page.locator('.coffee-card').filter({ hasText: uniqueName }).count();
  const storedBefore = await page.evaluate(() => {
    const raw = localStorage.getItem('bca_coffees');
    return raw ? JSON.parse(raw).some((c) => c.name?.includes('Test Café')) : false;
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.click('#costs-no-change').catch(() => {});
  await page.click('button[data-section="coffees"]');
  await page.waitForTimeout(500);

  const visibleAfter = await page.locator('.coffee-card').filter({ hasText: uniqueName }).count();
  const storedAfter = await page.evaluate((name) => {
    const raw = localStorage.getItem('bca_coffees');
    return raw ? JSON.parse(raw).some((c) => c.name === name) : false;
  }, uniqueName);

  const result = {
    uniqueName,
    visibleBefore,
    storedBefore,
    visibleAfter,
    storedAfter,
    passed: visibleBefore === 1 && storedBefore && visibleAfter === 1 && storedAfter,
    errors
  };

  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exit(1);
} finally {
  await browser.close();
  server.close();
}
