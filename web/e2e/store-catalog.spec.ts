import { expect, test } from '@playwright/test';

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
