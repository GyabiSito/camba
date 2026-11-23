import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const password = process.env.CAMBA_DEMO_PASSWORD;
assert(password, 'Set CAMBA_DEMO_PASSWORD to the documented local demo password.');

const canonical = 'http://127.0.0.1:4300';
const store = 'http://127.0.0.1:4200';
const paths = ['/sanctum/csrf-cookie', '/api/v1/auth/login', '/api/v1/admin/session'];
const browser = await chromium.launch();

async function signIn(page, origin, email, expected) {
  await page.goto(`${origin}/ingresar`);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  const csrf = page.waitForResponse((r) => new URL(r.url()).pathname === paths[0]);
  const login = page.waitForResponse((r) => new URL(r.url()).pathname === paths[1]);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  const [csrfResponse, loginResponse] = await Promise.all([csrf, login]);
  const failure = loginResponse.ok() ? '' : (await loginResponse.json().catch(() => ({}))).message;
  assert.equal(csrfResponse.status(), 204);
  assert((await csrfResponse.headerValues('set-cookie')).some((v) => v.startsWith('XSRF-TOKEN=')));
  assert(await loginResponse.request().headerValue('x-xsrf-token'), 'Login must send the XSRF header');
  assert.equal(loginResponse.status(), 204, `${origin}: login POST ${loginResponse.status()} ${failure ?? ''}`);
  if (expected === 403) {
    await expect(page.getByRole('alert')).toContainText(/no tiene acceso administrativo/);
    await expect(page).toHaveURL(/\/ingresar/);
  } else {
    await expect(page).toHaveURL(`${origin}/productos`);
    await expect(page.getByRole('heading', { name: 'Productos', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Productos', exact: true })).toBeVisible();
  }
  const session = await page.request.get(`${origin}${paths[2]}`, { headers: { Referer: `${origin}/` } });
  assert.equal(session.status(), expected);
  assert.match(session.headers()['content-type'] ?? '', /^application\/json/);
  console.log(`${origin} ${expected === 200 ? 'admin' : 'buyer'}: CSRF 204 → POST 204 → session ${expected}`);
}

try {
  for (const origin of [canonical, 'http://localhost:4300']) {
    const context = await browser.newContext();
    const anonymous = await context.request.get(`${origin}${paths[2]}`, {
      headers: { Accept: 'application/json', Referer: `${origin}/` },
    });
    assert.equal(anonymous.status(), 401);

    const nonStateful = await context.request.post(`${origin}${paths[1]}`, {
      headers: { Accept: 'application/json' },
      data: { email: 'origin-probe@camba.test', password: 'not-a-demo-login' },
    });
    assert.equal(nonStateful.status(), 400);
    assert.equal((await nonStateful.json()).message, 'La sesión no está disponible.');

    const withoutToken = await context.request.post(`${origin}${paths[1]}`, {
      headers: { Origin: origin, Referer: `${origin}/`, Accept: 'application/json' },
      data: { email: 'no-csrf-probe@camba.test', password: 'not-a-demo-login' },
    });
    assert.equal(withoutToken.status(), 419, `${origin} must still enforce CSRF`);
    await signIn(await context.newPage(), origin, 'admin.diseno@camba.test', 200);
    await context.close();
  }

  const shared = await browser.newContext();
  const shop = await shared.newPage();
  await shop.goto(store);
  const products = await shop.request.get(`${store}/api/v1/products`);
  assert.equal(products.status(), 200);
  assert((await products.json()).data.length > 0);
  const admin = await shared.newPage();
  await signIn(admin, canonical, 'cliente.diseno@camba.test', 403);
  const buyer = await shop.request.get(`${store}/api/v1/auth/me`, { headers: { Referer: `${store}/` } });
  assert.equal(buyer.status(), 200);
  assert.equal((await buyer.json()).data.role, 'buyer');
  await signIn(admin, canonical, 'admin.diseno@camba.test', 200);
  const sharedAdmin = await shop.request.get(`${store}/api/v1/auth/me`, { headers: { Referer: `${store}/` } });
  assert.equal(sharedAdmin.status(), 200);
  assert.equal((await sharedAdmin.json()).data.role, 'admin');
  assert((await shared.cookies()).some((cookie) => cookie.name === 'laravel-session' && cookie.httpOnly));
  console.log('Shared browser profile: storefront catalog 200; distinct ports share the same 127.0.0.1 session.');
} finally {
  await browser.close();
}
