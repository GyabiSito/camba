import { expect, test } from '@playwright/test';

test('verified admin reaches the catalog and can sign out', async ({ page }, info) => {
  await page.goto('/productos');
  await expect(page).toHaveURL(/\/ingresar/);
  await page.getByLabel('Correo electrónico').fill('admin@camba.test');
  await page.getByLabel('Contraseña').fill('Camba-test-only-2026');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Productos', exact: true })).toBeVisible();
  await expect(page.getByText('Remera lisa', { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Administración' }).getByText('Productos'),
  ).toHaveAttribute('aria-current', 'page');

  await page.screenshot({
    path: info.outputPath('admin-catalog-desktop.png'),
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 320, height: 880 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
    .toBeLessThanOrEqual(1);
  await page.screenshot({
    path: info.outputPath('admin-catalog-mobile.png'),
    fullPage: true,
    animations: 'disabled',
  });

  await page.getByRole('navigation', { name: 'Administración' }).getByText('Configuración').click();
  await expect(page).toHaveURL(/\/configuracion$/);
  await page.locator('header summary[aria-label="Opciones de Camba Mesa"]').click();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/ingresar/);
  expect(
    (
      await page.request.get('/api/v1/admin/session', { headers: { Accept: 'application/json' } })
    ).status(),
  ).toBe(401);
});

test('a verified buyer cannot enter administration', async ({ page }) => {
  await page.goto('/ingresar');
  await page.getByLabel('Correo electrónico').fill('buyer@camba.test');
  await page.getByLabel('Contraseña').fill('Camba-test-only-2026');
  const denied = page.waitForResponse((response) =>
    response.url().endsWith('/api/v1/admin/session'),
  );
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  expect((await denied).status()).toBe(403);
  await expect(page.getByRole('alert')).toContainText('no tiene acceso administrativo');
  await expect(page.getByRole('navigation', { name: 'Administración' })).toHaveCount(0);
});
