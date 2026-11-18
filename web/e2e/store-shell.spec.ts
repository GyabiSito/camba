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
  const search = page.getByRole('searchbox', { name: 'Buscar productos' });
  await search.fill('Remera lisa');
  await search.press('Enter');
  await expect(page).toHaveURL(
    (url) => url.pathname === '/tienda' && url.searchParams.get('q') === 'Remera lisa',
  );
  await expect(page.getByRole('link', { name: 'Remera lisa', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Contacto', exact: true }).click();
  await expect(page).toHaveURL(/#contacto$/);
  await expect(page.getByRole('link', { name: 'Contacto por correo' })).toHaveAttribute(
    'href',
    'mailto:hola@camba.test',
  );
  await page
    .getByRole('navigation', { name: 'Tienda', exact: true })
    .getByRole('link', { name: 'Tienda', exact: true })
    .click();
  await expect(page.getByRole('link', { name: /Remera lisa/i }).first()).toBeVisible();
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
  const product = await request.get('/producto/remera-lisa');
  expect(product.status()).toBe(200);
  expect(await product.text()).toMatch(/<h1[^>]*>Remera lisa<\/h1>/);
  const missing = await request.get('/producto/no-existe');
  expect(missing.status()).toBe(404);
});
