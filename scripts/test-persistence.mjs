import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = '38';

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json'
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

async function openApp(page, baseUrl) {
  await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.evaluate(() => {
    const users = [{
      id: 'user_ximena',
      username: 'ximena.polo',
      password: 'XimenaBCA2026!',
      name: 'Ximena Polo',
      role: 'Administradora',
      email: 'ximena@blackcoffee.admin'
    }];
    localStorage.setItem('bca_users', JSON.stringify(users));
    localStorage.setItem('bca_session', JSON.stringify({
      userId: 'user_ximena',
      name: 'Ximena Polo',
      role: 'Administradora',
      loginTime: new Date().toISOString()
    }));
  });
  await page.goto(`${baseUrl}/app.html?v=${BUILD}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => typeof SupplierManager !== 'undefined' && typeof DataSeed !== 'undefined', null, { timeout: 20000 });
}

const port = 8878;
const server = await startServer(ROOT, port);
const baseUrl = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await openApp(page, baseUrl);

  const result = await page.evaluate(() => {
    const build = window.BCA_BUILD || 'missing';
    const suppliers = SupplierManager.getAll();
    const trilla = suppliers.find((s) => s.services?.includes('trilla'));
    const generic = suppliers[0];

    const cases = [];

    if (trilla) {
      const targetId = trilla.id;
      SupplierManager.delete(targetId);
      const afterDelete = SupplierManager.getAll().some((s) => s.id === targetId);
      DataSeed.init();
      const afterReload = SupplierManager.getAll().some((s) => s.id === targetId);
      const tomb = Storage.getRaw('bca_deleted_records') || {};
      cases.push({
        type: 'transformation_supplier',
        targetName: trilla.name,
        afterDelete,
        afterReload,
        tombHas: (tomb.bca_suppliers || []).includes(targetId),
        passed: !afterDelete && !afterReload
      });
    }

    if (generic) {
      const targetId = generic.id;
      SupplierManager.delete(targetId);
      const afterDelete = SupplierManager.getAll().some((s) => s.id === targetId);
      DataSeed.init();
      const afterReload = SupplierManager.getAll().some((s) => s.id === targetId);
      cases.push({
        type: 'generic_supplier',
        targetName: generic.name,
        afterDelete,
        afterReload,
        passed: !afterDelete && !afterReload
      });
    }

    const ensureTransformationNoOp = (() => {
      const before = SupplierManager.getAll().length;
      DataSeed.ensureTransformationSuppliers();
      return SupplierManager.getAll().length === before;
    })();

    return {
      build,
      ensureTransformationNoOp,
      cases,
      passed: cases.every((c) => c.passed) && ensureTransformationNoOp
    };
  });

  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exit(1);
} finally {
  await browser.close();
  server.close();
}
