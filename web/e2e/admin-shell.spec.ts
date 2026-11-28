import { expect, test } from '@playwright/test';

test('verified admin reaches the catalog and can sign out', async ({ page }, info) => {
  await page.goto('/productos');
  await expect(page).toHaveURL(/\/ingresar/);
  await page.getByLabel('Correo electrónico').fill('a11y-admin@camba.test');
  await page.getByLabel('Contraseña').fill('Camba-test-only-2026');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Productos', exact: true })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Inventario de productos' })).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Administración' }).getByText('Productos'),
  ).toHaveAttribute('aria-current', 'page');

  for (const width of [1440, 1920]) {
    await page.setViewportSize({ width, height: 992 });
    const workspace = await page.locator('.admin-body').boundingBox();
    const sidebar = await page.locator('.admin-sidebar').boundingBox();
    expect(Math.abs(workspace!.x - sidebar!.width - (width - workspace!.x - workspace!.width))).toBeLessThanOrEqual(1);

    const inventory = await page.getByRole('table', { name: 'Inventario de productos' }).boundingBox();
    const detail = await page.locator('.selection').boundingBox();
    expect(detail!.x).toBeGreaterThanOrEqual(inventory!.x + inventory!.width);
    expect(Math.abs(detail!.y - inventory!.y)).toBeLessThanOrEqual(1);
  }

  await page.screenshot({
    path: info.outputPath('admin-catalog-desktop.png'),
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 320, height: 880 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
    .toBeLessThanOrEqual(1);
  const menu = page.getByRole('button', { name: 'Menú' });
  const navigation = page.getByRole('navigation', { name: 'Administración' });
  await expect(navigation).toBeHidden();
  await menu.focus();
  await page.keyboard.press('Enter');
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Tab');
  await expect(navigation.getByRole('link', { name: 'Inicio', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await expect(navigation).toBeHidden();
  await page.screenshot({
    path: info.outputPath('admin-catalog-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  });

  await menu.click();
  await navigation.getByRole('link', { name: 'Configuración' }).click();
  await expect(page).toHaveURL(/\/configuracion$/);
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await page.setViewportSize({ width: 1920, height: 992 });
  await expect(page.locator('.settings-form')).toBeVisible();
  const settings = (await page.locator('.settings-form').boundingBox())!;
  const content = (await page.locator('.admin-body').boundingBox())!;
  expect(settings.width).toBeLessThanOrEqual(1024);
  expect(Math.abs(settings.x - content.x - (content.x + content.width - settings.x - settings.width))).toBeLessThanOrEqual(1);
  await page.locator('header summary[aria-label="Opciones de Camba Mesa"]').click();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/ingresar/);
  expect(
    (
      await page.request.get('/api/v1/admin/session', { headers: { Accept: 'application/json' } })
    ).status(),
  ).toBe(401);
});

test('admin login opens Dashboard by default and restores a protected deep link', async ({ browser }) => {
  for (const [entry, expected] of [
    ['/ingresar', '/dashboard'],
    ['/portada/secciones/hero', '/portada/secciones/hero'],
    ['/pedidos?status=pending_payment', '/pedidos?status=pending_payment'],
  ]) {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      const base = test.info().project.use.baseURL!;
      await page.goto(base + entry);
      await page.getByLabel('Correo electrónico').fill('a11y-admin@camba.test');
      await page.getByLabel('Contraseña').fill('Camba-test-only-2026');
      await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
      await expect(page).toHaveURL(base + expected);
      if (expected === '/dashboard') {
        await expect(page.getByRole('heading', { name: 'Inicio', exact: true })).toBeVisible();
        const first = page.getByRole('navigation', { name: 'Administración' }).getByRole('link').first();
        await expect(first).toHaveText('Inicio');
        await expect(first).toHaveAttribute('aria-current', 'page');
      }
    } finally {
      await context.close();
    }
  }
});

test('a verified buyer cannot enter administration', async ({ page }) => {
  await page.goto('/ingresar');
  await page.getByLabel('Correo electrónico').fill('buyer-admin-denied@camba.test');
  await page.getByLabel('Contraseña').fill('Camba-test-only-2026');
  const denied = page.waitForResponse((response) =>
    response.url().endsWith('/api/v1/admin/auth/login'),
  );
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  expect((await denied).status()).toBe(422);
  await expect(page.getByRole('alert')).toContainText(/correo o la contraseña no son correctos/i);
  await expect(page.getByRole('navigation', { name: 'Administración' })).toHaveCount(0);
});
