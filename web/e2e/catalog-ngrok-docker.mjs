import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const tunnel = new URL(process.argv[2]).origin;
assert.match(tunnel, /^https:\/\/[a-z0-9.-]+\.ngrok-free\.(?:app|dev)$/);
const header = 'ngrok-skip-browser-warning';
const browser = await chromium.launch();

async function open(page, url) {
  const hydrated = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/v1/cart');
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  if (response.headers()['ngrok-error-code'] === 'ERR_NGROK_6024') {
    await page.getByText('Visit Site', { exact: true }).click();
  }
  const cart = await hydrated;
  assert.equal(cart.status(), 401);
  assert.equal((await cart.request().allHeaders())[header], undefined);
}

const products = (page, query = null) => page.waitForResponse((response) => {
  const url = new URL(response.url());
  return url.pathname === '/api/v1/products' && url.searchParams.get('q') === query;
});

async function assertCatalog(page) {
  await page.getByRole('heading', { name: 'Tienda', exact: true }).waitFor();
  await page.locator('store-product-grid a[href^="/producto/"]').first().waitFor();
}

async function assertResponse(response, origin, expectedHeader) {
  assert.equal(new URL(response.url()).origin, origin);
  assert.equal(response.status(), 200);
  assert.match(response.headers()['content-type'], /^application\/json/);
  const sent = await response.request().allHeaders();
  assert.equal(sent[header], expectedHeader);
  assert.equal(sent.cookie, undefined, 'Public catalog must not send cookies');
  assert.ok((await response.json()).data.length, 'Expected published products');
}

try {
  for (const origin of [tunnel, 'http://localhost:4200']) {
    const expectedHeader = origin === tunnel ? '1' : undefined;
    const home = await browser.newPage();
    await open(home, origin + '/');
    const navigation = products(home);
    await home.locator('store-header a[href="/tienda"]').first().click();
    await assertResponse(await navigation, origin, expectedHeader);
    await assertCatalog(home);
    await home.context().close();

    const direct = await browser.newPage();
    await open(direct, origin + '/tienda');
    await assertCatalog(direct);
    await direct.locator('store-catalog:not([ngh])').waitFor();
    const filtered = products(direct, 'camisa');
    const search = direct.getByLabel('Buscar en la tienda');
    await search.fill('camisa');
    await search.press('Enter');
    await assertResponse(await filtered, origin, expectedHeader);
    await assertCatalog(direct);

    const cart = await direct.evaluate(async () => {
      const response = await fetch('/api/v1/cart', { headers: { Accept: 'application/json' } });
      return response.status;
    });
    assert.equal(cart, 401);
    await direct.goto(origin + '/carrito');
    await direct.waitForURL((url) => url.pathname === '/cuenta' && url.searchParams.get('volver') === 'carrito');
    await direct.getByRole('button', { name: 'Iniciar sesión', exact: true }).waitFor();
    await direct.context().close();
    console.log(`${origin}: Home → Catalog, direct Catalog, search and signed-out cart passed`);
  }
} finally {
  await browser.close();
}
