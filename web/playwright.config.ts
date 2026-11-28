import { defineConfig } from '@playwright/test';

const apiPort = process.env['CAMBA_E2E_API_PORT'] ?? '43819';
const adminPort = process.env['CAMBA_E2E_ADMIN_PORT'] ?? '43820';
const storePort = process.env['CAMBA_E2E_STORE_PORT'] ?? '43821';
const origin = (port: string) => {
  if (!/^\d{4,5}$/.test(port) || Number(port) < 1024 || Number(port) > 65535) {
    throw new Error('E2E ports must be valid non-privileged loopback ports.');
  }
  return `http://127.0.0.1:${port}`;
};
const api = origin(apiPort);
const admin = origin(adminPort);
const store = origin(storePort);
if (new Set([api, admin, store]).size !== 3) throw new Error('Use three different E2E ports.');
const browser = process.env['CAMBA_E2E_BROWSER'] ?? 'chromium';
if (browser !== 'chromium' && browser !== 'firefox') throw new Error('Use chromium or firefox for browser tests.');

const angular = (app: string, port: string) => ({
  command: `npm exec -- ng serve ${app} --host 127.0.0.1 --port ${port} --proxy-config proxy.conf.cjs`,
  url: origin(port),
  env: { CAMBA_DEV_API_ORIGIN: api, CAMBA_SSR_API_ORIGIN: api },
  timeout: 180_000,
  reuseExistingServer: false,
});

export default defineConfig({
  testDir: './e2e',
  ...(process.env['CAMBA_E2E_MAIL_RUN'] && { outputDir: 'test-results/transactional-mail-run' }),
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  timeout: 45_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    browserName: browser,
    headless: true,
    viewport: { width: 1586, height: 992 },
    deviceScaleFactor: 1,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'admin', testMatch: /admin.*\.spec\.ts/, use: { baseURL: admin } },
    { name: 'store', testMatch: /(?:store|shopper).*\.spec\.ts/, use: { baseURL: store } },
  ],
  webServer: [
    {
      command: 'node e2e/fixtures/start-api.mjs',
      url: `${api}/api/v1/products`,
      env: {
        CAMBA_E2E_API_PORT: apiPort,
        CAMBA_E2E_ADMIN_PORT: adminPort,
        CAMBA_E2E_STORE_PORT: storePort,
      },
      timeout: 60_000,
      reuseExistingServer: false,
    },
    angular('admin', adminPort),
    angular('store', storePort),
  ],
});
