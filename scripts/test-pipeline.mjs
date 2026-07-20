import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = '35';

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
    localStorage.clear();
    const users = [{
      id: 'user_test',
      username: 'test.user',
      password: 'Test123!',
      name: 'Test User',
      role: 'Administradora',
      email: 'test@blackcoffee.admin'
    }];
    localStorage.setItem('bca_users', JSON.stringify(users));
    localStorage.setItem('bca_session', JSON.stringify({
      userId: 'user_test',
      name: 'Test User',
      role: 'Administradora',
      loginTime: new Date().toISOString()
    }));
    localStorage.setItem('bca_platform_setup', JSON.stringify({
      completed: true,
      step: 4,
      completedAt: new Date().toISOString(),
      completedBy: 'user_test',
      version: 1
    }));
    localStorage.setItem('bca_data_version', 17);
  });
  await page.goto(`${baseUrl}/app.html?v=${BUILD}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(
    () => typeof InventoryManager !== 'undefined'
      && typeof ProductionCosts !== 'undefined'
      && typeof QuotationManager !== 'undefined',
    null,
    { timeout: 20000 }
  );
}

const port = 8879;
const server = await startServer(ROOT, port);
const baseUrl = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await openApp(page, baseUrl);

  const result = await page.evaluate(() => {
    const build = window.BCA_BUILD || 'missing';
    const cases = [];

    ProductionCosts.save({
      ...ProductionCosts.get(),
      mermas: {
        trilla: 10,
        greenSelection: 5,
        tostion: 15,
        seleccion: 8
      }
    });

    const coffeeId = Storage.generateId();
    const clientId = Storage.generateId();
    Storage.set('bca_coffees', [{
      id: coffeeId,
      name: 'Test Verde',
      state: 'verde',
      variety: 'Caturra',
      region: 'Cauca',
      pricePerKg: 20000,
      transportIncluded: true,
      createdAt: new Date().toISOString()
    }]);
    Storage.set('bca_inventory', [{
      id: Storage.generateId(),
      coffeeId,
      greenKg: 100,
      roastedKg: 0,
      selectedKg: 0,
      groundKg: 0,
      packagedUnits: {},
      minStockKg: 0,
      lastUpdated: new Date().toISOString()
    }]);
    Storage.set('bca_clients', [{
      id: clientId,
      name: 'Cliente Test',
      type: 'final',
      createdAt: new Date().toISOString()
    }]);
    Storage.set('bca_quotations', []);
    Storage.set('bca_sales', []);
    Storage.set('bca_purchases', []);

    const coffee = CoffeeManager.getById(coffeeId);
    const itemBefore = InventoryManager.getByCoffeeId(coffeeId);

    const roastOutput = InventoryManager.calculateTransferOutput('green_to_roasted', 10, coffee);
    const expectedRoast = ProductionCosts.calculateGreenToRoasted(
      10,
      'verde',
      getRoastMermaSteps('verde')
    );
    cases.push({
      name: 'roast_mermas_verde',
      passed: Math.abs(roastOutput.outputKg - expectedRoast.roastedKg) < 0.001,
      outputKg: roastOutput.outputKg,
      expectedKg: expectedRoast.roastedKg
    });

    const transfersGreen = getAvailableTransfersForItem(itemBefore, coffee).map((t) => t.key);
    cases.push({
      name: 'transfers_filter_verde',
      passed: transfersGreen.includes('green_to_roasted') && !transfersGreen.includes('roasted_to_selected'),
      transfers: transfersGreen
    });

    const blockedEntry = InventoryManager.addStageEntry(coffeeId, 'roasted', {
      quantity: 5,
      cost: 1000,
      suppliers: {}
    });
    cases.push({
      name: 'block_downstream_entry_with_upstream_stock',
      passed: blockedEntry === false
    });

    const roastOk = InventoryManager.processStageTransfer(coffeeId, 'green_to_roasted', 10, {});
    const afterRoast = InventoryManager.getByCoffeeId(coffeeId);
    cases.push({
      name: 'green_to_roasted_transfer',
      passed: roastOk === true
        && Math.abs(afterRoast.greenKg - 90) < 0.001
        && Math.abs(afterRoast.roastedKg - expectedRoast.roastedKg) < 0.001,
      greenKg: afterRoast.greenKg,
      roastedKg: afterRoast.roastedKg
    });

    const selectOk = InventoryManager.processStageTransfer(coffeeId, 'roasted_to_selected', afterRoast.roastedKg, {});
    const afterSelect = InventoryManager.getByCoffeeId(coffeeId);
    const expectedSelected = afterRoast.roastedKg * (1 - 0.08);
    cases.push({
      name: 'roasted_to_selected_transfer',
      passed: selectOk === true && Math.abs(afterSelect.selectedKg - expectedSelected) < 0.01,
      selectedKg: afterSelect.selectedKg
    });

    const grindOk = InventoryManager.processStageTransfer(coffeeId, 'selected_to_ground', afterSelect.selectedKg, {});
    const afterGrind = InventoryManager.getByCoffeeId(coffeeId);
    cases.push({
      name: 'selected_to_ground_transfer',
      passed: grindOk === true && afterGrind.groundKg > 0,
      groundKg: afterGrind.groundKg
    });

    const packOk = InventoryManager.processStageTransfer(coffeeId, 'ground_to_packaged', 4, {
      packaging: '250g',
      clientProvidesPackaging: true,
      materialCost: 0,
      laborCost: 500
    });
    const afterPack = InventoryManager.getByCoffeeId(coffeeId);
    const packedTotal = getPackagedUnitsTotal(afterPack.packagedUnits);
    cases.push({
      name: 'ground_to_packaged_transfer',
      passed: packOk === true && packedTotal === 4,
      packagedUnits: afterPack.packagedUnits
    });

    const quotId = Storage.generateId();
    Storage.set('bca_quotations', [{
      id: quotId,
      number: 'Q-TEST-001',
      clientId,
      clientName: 'Cliente Test',
      coffeeId,
      coffeeName: 'Test Verde',
      productionMode: 'maquila',
      clientProvidesCoffee: true,
      packagingLines: [
        { packaging: '250g', quantity: 2, unitPrice: 15000, linePrice: 30000 },
        { packaging: '500g', quantity: 1, unitPrice: 28000, linePrice: 28000 }
      ],
      packaging: '250g',
      quantity: 3,
      unitPrice: 15000,
      totalPrice: 58000,
      status: 'paid',
      paidAt: new Date().toISOString(),
      labels: ['small'],
      grindType: 'grano',
      createdAt: new Date().toISOString()
    }]);

    const stockBeforeSale = getPackagedUnitsTotal(InventoryManager.getByCoffeeId(coffeeId).packagedUnits);
    const sale = QuotationManager.convertToSale(quotId);
    const stockAfterSale = getPackagedUnitsTotal(InventoryManager.getByCoffeeId(coffeeId).packagedUnits);
    const sales = Storage.get('bca_sales') || [];
    cases.push({
      name: 'convert_maquila_client_coffee_no_deduct',
      passed: sale !== null
        && sales.length === 2
        && stockBeforeSale === stockAfterSale,
      salesCount: sales.length,
      stockBeforeSale,
      stockAfterSale
    });

    const quotPendingId = Storage.generateId();
    Storage.set('bca_quotations', [...Storage.get('bca_quotations'), {
      id: quotPendingId,
      number: 'Q-TEST-002',
      clientId,
      clientName: 'Cliente Test',
      coffeeId,
      coffeeName: 'Test Verde',
      productionMode: 'full_pack',
      clientProvidesCoffee: false,
      packaging: '250g',
      quantity: 1,
      unitPrice: 20000,
      totalPrice: 20000,
      status: 'pending',
      labels: ['small'],
      grindType: 'grano',
      createdAt: new Date().toISOString()
    }]);
    const blockedConvert = QuotationManager.convertToSale(quotPendingId);
    cases.push({
      name: 'block_convert_from_pending',
      passed: blockedConvert === null
    });

    return {
      build,
      cases,
      passed: build === '35' && cases.every((c) => c.passed)
    };
  });

  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exit(1);
} finally {
  await browser.close();
  server.close();
}
