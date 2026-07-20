import { chromium } from 'playwright';

const BASE = 'https://lasucursaldelcafe-droid.github.io/-black-coffee';
const BUILD = '33';

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
    () => typeof Storage !== 'undefined' && typeof SyncHub !== 'undefined',
    null,
    { timeout: 30000 }
  );
  await page.waitForFunction(
    (build) => window.BCA_BUILD === build || window.BCA_BUILD === Number(build),
    BUILD,
    { timeout: 20000 }
  ).catch(() => {});
}

async function waitForCloudSync(page, maxMs = 45000) {
  await page.waitForFunction(
    () => {
      if (typeof SyncHub === 'undefined') return false;
      return SyncHub.ready || SyncHub.lastSyncAt;
    },
    null,
    { timeout: maxMs }
  ).catch(() => {});
  await page.waitForTimeout(2000);
}

async function forceSync(page) {
  return page.evaluate(async () => {
    try {
      if (typeof SyncHub === 'undefined') return { skipped: true };
      await SyncHub.forceSync({ silent: true });
      return {
        ok: true,
        label: SyncHub.getStatusLabel(),
        primary: SyncHub.getPrimary()?.constructor?.name || 'none'
      };
    } catch (error) {
      return { ok: false, message: error.message };
    }
  });
}

function snapshotScript() {
  const keys = [
    'bca_coffees', 'bca_clients', 'bca_suppliers', 'bca_inventory',
    'bca_quotations', 'bca_sales', 'bca_purchases', 'bca_notifications'
  ];
  const counts = {};
  keys.forEach((key) => {
    try {
      const raw = localStorage.getItem(key);
      const data = raw ? JSON.parse(raw) : [];
      counts[key] = Array.isArray(data) ? data.length : (data ? 1 : 0);
    } catch {
      counts[key] = -1;
    }
  });
  return {
    build: window.BCA_BUILD,
    cloudReady: typeof SyncHub !== 'undefined' ? SyncHub.ready : false,
    cloudLabel: typeof SyncHub !== 'undefined' ? SyncHub.getStatusLabel() : '',
    gasConfigured: typeof GasSync !== 'undefined' && GasSync.isConfigured(),
    firebaseBlocked: typeof FirebaseSync !== 'undefined' ? FirebaseSync.permissionDenied : false,
    lastSyncAt: typeof SyncHub !== 'undefined' ? SyncHub.lastSyncAt : null,
    counts
  };
}

const browser = await chromium.launch({ headless: true });
const errors = [];

try {
  const ximenaContext = await browser.newContext();
  const ximenaPage = await ximenaContext.newPage();
  ximenaPage.on('pageerror', (e) => errors.push(`Ximena pageerror: ${e.message}`));

  await login(ximenaPage, USERS.ximena);
  await waitForCloudSync(ximenaPage);
  await forceSync(ximenaPage);
  const ximenaBefore = await ximenaPage.evaluate(snapshotScript);

  const pabloContext = await browser.newContext();
  const pabloPage = await pabloContext.newPage();
  pabloPage.on('pageerror', (e) => errors.push(`Pablo pageerror: ${e.message}`));

  await login(pabloPage, USERS.pablo);
  await waitForCloudSync(pabloPage);
  await forceSync(pabloPage);
  const pabloAfterPull = await pabloPage.evaluate(snapshotScript);

  const cloudDataReachable = await ximenaPage.evaluate(async () => {
    try {
      const res = await fetch('https://raw.githubusercontent.com/lasucursaldelcafe-droid/-black-coffee/main/sync/cloud-data.json');
      return res.ok;
    } catch {
      return false;
    }
  });

  const result = {
    build: ximenaBefore.build,
    cloudDataReachable,
    ximena: ximenaBefore,
    pabloAfterPull,
    checks: {
      build31: ximenaBefore.build === BUILD || ximenaBefore.build === 31,
      cloudSyncReady: ximenaBefore.cloudReady && pabloAfterPull.cloudReady,
      syncHubActive: Boolean(ximenaBefore.lastSyncAt),
      passed: ximenaBefore.cloudReady && pabloAfterPull.cloudReady
    },
    errors
  };

  console.log(JSON.stringify(result, null, 2));
  if (!result.checks.passed) process.exit(1);
} finally {
  await browser.close();
}
