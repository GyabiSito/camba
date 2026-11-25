import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';

const base = process.env.CAMBA_DEMO_STORE ?? 'http://127.0.0.1:44822';

test('mobile catalog filters stay compact and detail returns to the filtered listing', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    });
    await page.goto(`${base}/tienda`);

    await expect(page.getByRole('heading', { level: 1, name: 'Tienda' })).toBeVisible();
    const search = page.getByRole('searchbox', { name: 'Buscar en la tienda' });
    await expect(search).toBeVisible();
    const filterToggle = page.locator('.filter-toggle');
    await expect(filterToggle).toBeVisible();
    await expect(page.getByLabel('Categoría')).toBeHidden();
    await filterToggle.click();
    await page.getByLabel('Categoría').selectOption('remeras');
    await page.getByLabel('Orden').selectOption('price_asc');
    await search.fill('Remera');
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
    await expect(page).toHaveURL(/q=Remera&category=remeras&sort=price_asc/);
    await expect(page.getByRole('status').filter({ hasText: /producto/ })).toBeVisible();

    const firstProduct = page.locator('store-product-grid a').first();
    await expect(firstProduct).toContainText('Remera');
    const name = await firstProduct.textContent();
    await firstProduct.click();
    await expect(page.getByRole('heading', { level: 1, name: name?.trim() ?? '' })).toBeVisible();
    await expect(page.getByLabel('Cantidad')).toHaveValue('1');
    await expect(page.locator('.main-photo img')).toBeVisible();
    const secondPhoto = page.getByRole('button', { name: 'Ver foto 2' });
    await secondPhoto.focus();
    await secondPhoto.press('Enter');
    await expect(secondPhoto).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);

    await page.getByRole('link', { name: 'Volver a la tienda' }).click();
    await expect(page).toHaveURL(/q=Remera&category=remeras&sort=price_asc/);
    await expect(filterToggle).toContainText('2 activos');
    await filterToggle.click();
    await expect(page.getByLabel('Categoría')).toHaveValue('remeras');
    await expect(page.getByLabel('Orden')).toHaveValue('price_asc');

    await search.fill('no-existe-en-camba');
    await page.getByRole('button', { name: 'Aplicar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'No encontramos productos' })).toBeVisible();
    await page.goto(`${base}/producto/no-existe-camba`);
    await expect(
      page.getByRole('heading', { name: 'Este producto no está disponible' }),
    ).toBeVisible();
    await page.close();

    const noScript = await browser.newPage({
      viewport: { width: 390, height: 844 },
      javaScriptEnabled: false,
    });
    await noScript.goto(`${base}/tienda`);
    await expect(noScript.locator('.filter-toggle')).toBeHidden();
    await noScript.getByLabel('Categoría').selectOption('remeras');
    await noScript.getByRole('button', { name: 'Aplicar', exact: true }).click();
    await expect(noScript).toHaveURL(/category=remeras/);
    await noScript.close();
  } finally {
    await browser.close();
  }
});
