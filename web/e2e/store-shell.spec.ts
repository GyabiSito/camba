import { expect, test } from '@playwright/test';

test('store captures real catalog data and offers a visible keyboard skip link', async ({
  page,
}, info) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Camba, inicio' })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await page.getByRole('banner').getByRole('link', { name: 'Buscar', exact: true }).click();
  const search = page.getByRole('main').getByRole('searchbox', { name: 'Buscar en la tienda' });
  await search.fill('Remera lisa');
  await search.press('Enter');
  await expect(page).toHaveURL(
    (url) => url.pathname === '/tienda' && url.searchParams.get('q') === 'Remera lisa',
  );
  await expect(page.getByRole('link', { name: 'Remera lisa', exact: true })).toBeVisible();
  await page.getByRole('banner').getByRole('link', { name: 'Contacto', exact: true }).click();
  await expect(page).toHaveURL(/\/contacto$/);
  await expect(page.getByRole('heading', { name: 'Contactanos', level: 1 })).toBeInViewport();
  await expect(page.getByRole('main').locator('store-contact')).toHaveCount(1);
  await page.goBack();
  await expect(page).toHaveURL(
    (url) => url.pathname === '/tienda' && url.searchParams.get('q') === 'Remera lisa',
  );
  await expect(search).toHaveValue('Remera lisa');
  await expect(page.getByRole('link', { name: 'Remera lisa', exact: true })).toBeVisible();
  await page.screenshot({
    path: info.outputPath('store-catalog-desktop.png'),
    fullPage: true,
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 320, height: 880 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
    .toBeLessThanOrEqual(1);
  await page.screenshot({
    path: info.outputPath('store-catalog-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  });
});

test('public product is in the SSR HTML and an unknown product is HTTP 404', async ({
  request,
}) => {
  const catalog = await request.get('/tienda');
  expect(catalog.status()).toBe(200);
  const images = ((await catalog.text()).match(/<img\b[^>]*>/g) ?? [])
    .filter((image) => image.includes('/storage/products/'));
  expect(images.length).toBeGreaterThan(1);
  expect(images[0]).toContain('loading="eager"');
  expect(images[0]).toContain('fetchpriority="high"');
  expect(images.slice(1).every((image) => image.includes('loading="lazy"'))).toBe(true);

  const product = await request.get('/producto/remera-lisa');
  expect(product.status()).toBe(200);
  expect(await product.text()).toMatch(/<h1[^>]*>Remera lisa<\/h1>/);
  const missing = await request.get('/producto/no-existe');
  expect(missing.status()).toBe(404);
});
