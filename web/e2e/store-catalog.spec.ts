import { expect, test } from '@playwright/test';
import { fixtureCatalog } from './fixtures/store-products';

test('renders the public catalog on the server and preserves selection across the mobile browse flow', async ({
  page,
  request,
}, testInfo) => {
  const home = await request.get('/');
  expect(home.status()).toBe(200);
  const homeHtml = await home.text();
  expect(homeHtml).toContain('Ver tienda');
  expect(homeHtml).toContain('Más en la tienda');
  expect(homeHtml).toContain('Remera lisa');

  const product = await request.get('/producto/remera-lisa');
  expect(product.status()).toBe(200);
  const html = await product.text();
  expect(html).toContain('<title>Remera lisa | Camba</title>');
  expect(html).toContain(`rel="canonical" href="${product.url()}"`);

  const unknown = await request.get('/producto/no-existe-camba');
  expect(unknown.status()).toBe(404);
  expect(await unknown.text()).toContain('Este producto no está disponible');
  expect((await request.get('/seccion-no-existe-camba')).status()).toBe(404);

  const capture = process.env['CAMBA_E2E_CAPTURE'] === '1';
  if (capture) {
    await page.setViewportSize({ width: 1586, height: 992 });
    await page.goto('/');
    const hero = page.locator('.hero-photo img');
    await expect
      .poll(() => hero.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
    await expect
      .poll(() =>
        page
          .locator('store-home store-product-grid img')
          .evaluateAll(
            (images: HTMLImageElement[]) =>
              images.length > 0 && images.every((image) => image.naturalWidth > 0),
          ),
      )
      .toBe(true);
    await page.screenshot({ path: testInfo.outputPath('store-home-1586x992.png') });
  }

  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/tienda');
  await page.getByRole('searchbox', { name: 'Buscar en la tienda' }).fill('Remera');
  await page.getByLabel('Categoría').selectOption('remeras');
  await page.getByLabel('Orden').selectOption('price_asc');
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(page).toHaveURL(/q=Remera&category=remeras&sort=price_asc/);
  await expect(page.getByRole('link', { name: 'Camisa de algodón' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Remera lisa', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Remera lisa' })).toBeVisible();
  const second = page.getByRole('button', { name: 'Ver foto 2' });
  await second.focus();
  await second.press('Enter');
  await expect(second).toHaveAttribute('aria-pressed', 'true');
  const image = page.getByRole('img', { name: 'Remera lisa — detalle' });
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  if (capture) {
    await page.screenshot({ path: testInfo.outputPath('store-detail-320.png'), fullPage: true });
  }

  await page.getByRole('link', { name: 'Volver a la tienda' }).click();
  await expect(page.getByLabel('Categoría')).toHaveValue('remeras');
  await expect(page.getByLabel('Orden')).toHaveValue('price_asc');
  await page.getByRole('searchbox', { name: 'Buscar en la tienda' }).fill('no-existe-en-camba');
  await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No encontramos productos' })).toBeVisible();
  await page.getByRole('link', { name: 'Limpiar filtros' }).click();
  await expect(page.getByRole('link', { name: 'Camisa de algodón', exact: true })).toBeVisible();

  await page.goto('/tienda?brand=taller&page=2');
  await expect(page.getByRole('heading', { name: 'Esta página no tiene productos' })).toBeVisible();
  await page.getByRole('link', { name: 'Ir a la última página' }).click();
  await expect(page.getByLabel('Marca')).toHaveValue('taller');
  await expect(page.getByRole('link', { name: 'Camisa de algodón', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Remera lisa', exact: true })).toHaveCount(0);
});

test('filtered catalog pages preserve controls, product order and browser history', async ({
  baseURL,
  browser,
  page,
  request,
}) => {
  test.slow(); // Publish enough real products to reach page two.
  const fixture = await fixtureCatalog(browser, baseURL!);
  try {
    const q = 'Paginacion E2E';
    const names = Array.from({ length: 13 }, (_, i) => `${q} ${i + 1}`);
    const category_id = await fixture.classification('categories', 'camisas');
    const brand_id = await fixture.classification('brands', 'taller');
    for (const [i, name] of names.entries()) {
      await fixture.publish({ name, category_id, brand_id, price_cents: 10000 + i, stock: 1 });
    }
    await fixture.publish({ name: `${q} sin marca`, category_id, price_cents: 9999, stock: 1 });
    await fixture.publish({
      name: `${q} otra categoría`,
      brand_id,
      price_cents: 9999,
      stock: 1,
      category_id: await fixture.classification('categories', 'remeras'),
    });

    const params = { q, category: 'camisas', brand: 'taller', sort: 'price_asc' };
    const api = await request.get('/api/v1/products', {
      params: { ...params, page: 2, per_page: 12 },
    });
    await expect(api).toBeOK();
    expect(await api.json()).toMatchObject({
      data: [{ name: names[12] }],
      meta: { current_page: 2, last_page: 2, total: 13 },
    });

    await page.goto('/tienda');
    const search = page.getByRole('searchbox', { name: 'Buscar en la tienda' });
    const category = page.getByLabel('Categoría');
    const brand = page.getByLabel('Marca');
    const sort = page.getByLabel('Orden');
    await search.fill(q);
    await category.selectOption(params.category);
    await brand.selectOption(params.brand);
    await sort.selectOption(params.sort);
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click();

    const navigation = page.getByRole('navigation', { name: 'Páginas de productos' });
    const results = page.getByRole('region', { name: 'Productos' });
    const checkPage = async (number: 1 | 2) => {
      await expect(navigation.locator('[aria-current="page"]')).toHaveText(
        `Página ${number} de 2`,
        {
          timeout: 10_000, // The Windows PHP fixture serializes the three resolver requests.
        },
      );
      await expect(page).toHaveURL(
        (url) =>
          url.pathname === '/tienda' &&
          url.searchParams.size === (number === 1 ? 4 : 5) &&
          Object.entries(params).every(([key, value]) => url.searchParams.get(key) === value) &&
          url.searchParams.get('page') === (number === 1 ? null : '2'),
      );
      await expect(search).toHaveValue(q);
      await expect(category).toHaveValue(params.category);
      await expect(brand).toHaveValue(params.brand);
      await expect(sort).toHaveValue(params.sort);
      await expect(results.getByRole('status')).toHaveText('13 productos');
      await expect(results.getByRole('list').getByRole('link')).toHaveText(
        number === 1 ? names.slice(0, 12) : names.slice(12),
      );
    };
    await checkPage(1);
    await navigation.getByRole('link', { name: 'Siguiente' }).click();
    await checkPage(2);
    await navigation.getByRole('link', { name: 'Anterior' }).click();
    await checkPage(1);
    await page.goBack();
    await checkPage(2);
    await page.goForward();
    await checkPage(1);
    await page.goBack();
    await results.getByRole('link', { name: names[12], exact: true }).click();
    await expect(page.getByRole('heading', { name: names[12] })).toBeVisible();
    await page.getByRole('link', { name: 'Volver a la tienda' }).click();
    await checkPage(2);
  } finally {
    await fixture.close();
  }
});
