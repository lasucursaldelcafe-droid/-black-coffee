import { chromium } from 'playwright';

const BASE = 'https://lasucursaldelcafe-droid.github.io/-black-coffee';
const BUILD = '30';

const USERS = {
  ximena: { username: 'ximena.polo', password: 'XimenaBCA2026!' },
  pablo: { username: 'pablo.colorado', password: 'PabloBCA2026!' }
};

async function login(page, user) {
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.fill('#username', user.username);
  await page.fill('#password', user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/app\.html/, { timeout: 30000 });
  await page.waitForFunction(
    () => typeof Storage !== 'undefined' && typeof FirebaseSync !== 'undefined',
    null,
    { timeout: 30000 }
  );
  await page.waitForFunction(
    () => window.BCA_BUILD === '29' || window.BCA_BUILD === 29,
    null,
    { timeout: 15000 }
  ).catch(() => {});
}

async function waitForSync(page, maxMs = 45000) {
  await page.waitForFunction(
    () => {
      if (typeof FirebaseSync === 'undefined') return false;
      if (!FirebaseSync.ready) return false;
      if (FirebaseSync.syncing) return false;
      return Boolean(FirebaseSync.lastSyncAt);
    },
    null,
    { timeout: maxMs }
  ).catch(() => {});

  await page.waitForTimeout(3000);
}

async function forceSync(page) {
  return page.evaluate(async () => {
    try {
      if (typeof FirebaseSync === 'undefined') return { skipped: true };
      if (FirebaseSync.permissionDenied) {
        return { permissionDenied: true, label: FirebaseSync.getStatusLabel() };
      }
      if (FirebaseSync.syncAll) {
        await FirebaseSync.syncAll({ silent: true });
      }
      return {
        ok: true,
        permissionDenied: FirebaseSync.permissionDenied,
        label: FirebaseSync.getStatusLabel()
      };
    } catch (error) {
      return {
        ok: false,
        permissionDenied: /insufficient permissions/i.test(error.message || ''),
        message: error.message
      };
    }
  });
}

function snapshotScript() {
  const keys = [
    'bca_coffees', 'bca_clients', 'bca_suppliers', 'bca_inventory',
    'bca_quotations', 'bca_sales', 'bca_purchases', 'bca_notifications'
  ];
  const counts = {};
  const names = {};
  keys.forEach((key) => {
    try {
      const raw = localStorage.getItem(key);
      const data = raw ? JSON.parse(raw) : [];
      counts[key] = Array.isArray(data) ? data.length : (data ? 1 : 0);
      if (Array.isArray(data)) {
        names[key] = data.slice(0, 5).map((item) => item.name || item.number || item.id || '?');
      }
    } catch {
      counts[key] = -1;
    }
  });
  return {
    build: window.BCA_BUILD,
    syncReady: typeof FirebaseSync !== 'undefined' ? FirebaseSync.ready : false,
    permissionDenied: typeof FirebaseSync !== 'undefined' ? FirebaseSync.permissionDenied : false,
    syncLabel: typeof FirebaseSync !== 'undefined' ? FirebaseSync.getStatusLabel() : '',
    lastSyncAt: typeof FirebaseSync !== 'undefined' ? FirebaseSync.lastSyncAt : null,
    counts,
    names,
    coffeeTotal: typeof CoffeeManager !== 'undefined' ? CoffeeManager.getAll().length : null,
    clientTotal: typeof ClientManager !== 'undefined' ? ClientManager.getAll().length : null
  };
}

const browser = await chromium.launch({ headless: true });
const errors = [];

try {
  const ximenaContext = await browser.newContext();
  const ximenaPage = await ximenaContext.newPage();
  ximenaPage.on('pageerror', (e) => errors.push(`Ximena pageerror: ${e.message}`));

  await login(ximenaPage, USERS.ximena);
  await waitForSync(ximenaPage);
  const ximenaSyncProbe = await forceSync(ximenaPage);
  await ximenaPage.waitForTimeout(2000);
  const ximenaBefore = await ximenaPage.evaluate(snapshotScript);

  if (ximenaSyncProbe?.permissionDenied || /insufficient permissions/i.test(ximenaSyncProbe?.message || '')) {
    console.log(JSON.stringify({
      build: ximenaBefore.build,
      blocked: true,
      reason: 'Firestore rules not deployed — sync cannot work until rules are published',
      ximena: ximenaBefore,
      fix: 'Publish firestore.rules in Firebase Console or run GitHub workflow publicar-reglas-firestore'
    }, null, 2));
    process.exit(2);
  }

  const pabloContext = await browser.newContext();
  const pabloPage = await pabloContext.newPage();
  pabloPage.on('pageerror', (e) => errors.push(`Pablo pageerror: ${e.message}`));

  await login(pabloPage, USERS.pablo);
  await waitForSync(pabloPage);
  await forceSync(pabloPage);
  const pabloAfterPull = await pabloPage.evaluate(snapshotScript);

  const testClientName = `SyncTest ${Date.now()}`;
  await pabloPage.evaluate((name) => {
    ClientManager.save({
      name,
      type: 'mayorista',
      contact: 'Test',
      email: 'sync-test@test.com',
      phone: '300',
      city: 'Cali',
      department: 'Valle del Cauca',
      address: 'Test'
    });
  }, testClientName);

  await forceSync(pabloPage);
  await pabloPage.waitForTimeout(3000);

  await forceSync(ximenaPage);
  await ximenaPage.waitForTimeout(5000);
  await ximenaPage.evaluate(() => {
    window.dispatchEvent(new CustomEvent('bca-data-changed', { detail: { source: 'test' } }));
  });
  await ximenaPage.click('[data-section="clients"]').catch(() => {});
  await ximenaPage.waitForTimeout(2000);

  const ximenaAfterUpdate = await ximenaPage.evaluate((name) => ({
    ...(() => {
      const keys = ['bca_clients'];
      const clients = JSON.parse(localStorage.getItem('bca_clients') || '[]');
      return {
        clientTotal: clients.length,
        hasTestClient: clients.some((c) => c.name === name),
        clientNames: clients.map((c) => c.name).slice(0, 10)
      };
    })(),
    syncLabel: FirebaseSync.getStatusLabel()
  }), testClientName);

  const pabloHasXimenaCoffees = pabloAfterPull.counts.bca_coffees >= ximenaBefore.counts.bca_coffees
    || (ximenaBefore.counts.bca_coffees === 0 && pabloAfterPull.counts.bca_coffees === 0);

  const countsMatch = ['bca_coffees', 'bca_clients', 'bca_suppliers', 'bca_inventory', 'bca_quotations', 'bca_sales']
    .every((key) => pabloAfterPull.counts[key] >= ximenaBefore.counts[key] || ximenaBefore.counts[key] === 0);

  const result = {
    build: ximenaBefore.build,
    ximena: ximenaBefore,
    pabloAfterPull,
    ximenaAfterUpdate,
    testClientName,
    checks: {
      ximenaSyncReady: ximenaBefore.syncReady,
      pabloSyncReady: pabloAfterPull.syncReady,
      pabloLoadedData: countsMatch,
      pabloHasXimenaCoffees,
      ximenaReceivedPabloClient: ximenaAfterUpdate.hasTestClient,
      passed: ximenaBefore.syncReady && pabloAfterPull.syncReady && countsMatch && ximenaAfterUpdate.hasTestClient
    },
    errors
  };

  console.log(JSON.stringify(result, null, 2));
  if (!result.checks.passed) process.exit(1);
} finally {
  await browser.close();
}
