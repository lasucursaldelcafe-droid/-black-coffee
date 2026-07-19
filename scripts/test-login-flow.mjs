import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

function startServer(root, port) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const path = req.url === '/' ? '/index.html' : req.url.split('?')[0];
      const filePath = join(root, path);
      if (!existsSync(filePath)) { res.writeHead(404); res.end('not found'); return; }
      res.end(readFileSync(filePath));
    });
    server.listen(port, () => resolve(server));
  });
}

const errors = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push(`PAGE: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`); });

// Test 1: app.html without session (redirect case)
await page.goto('https://lasucursaldelcafe-droid.github.io/-black-coffee/app.html', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
errors.push(`After app no-auth URL: ${page.url()}`);

// Test 2: login from index
await page.goto('https://lasucursaldelcafe-droid.github.io/-black-coffee/', { waitUntil: 'domcontentloaded' });
await page.fill('#username', 'ximena.polo');
await page.fill('#password', 'XimenaBCA2026!');
await page.click('button[type="submit"]');
await page.waitForTimeout(4000);
errors.push(`After login URL: ${page.url()}`);
errors.push(`Stats cards: ${await page.locator('#dashboard-stats .stat-card').count()}`);
errors.push(`Hero visible: ${await page.locator('#dashboard-hero h2').isVisible()}`);

// Test 3: corrupted users
await page.evaluate(() => {
  localStorage.setItem('bca_users', JSON.stringify([{ id: 'bad', username: 'x' }]));
});
await page.goto('https://lasucursaldelcafe-droid.github.io/-black-coffee/index.html');
await page.fill('#username', 'ximena.polo');
await page.fill('#password', 'XimenaBCA2026!');
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);
errors.push(`Corrupted users login URL: ${page.url()}`);

await browser.close();
console.log(errors.join('\n'));
