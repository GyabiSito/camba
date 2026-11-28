import { expect, test } from '@playwright/test';

test('Admin and Store authenticate and sign out independently in one browser context', async ({ page, context, baseURL }) => {
  test.setTimeout(100_000);
  const admin = baseURL!;
  const store = `http://127.0.0.1:${process.env['CAMBA_E2E_STORE_PORT'] ?? '43821'}`;
  const buyer = await context.newPage();
  const password = 'Camba-test-only-2026';
  const storeStatus = async () => (await context.request.get(store + '/api/v1/auth/me', {
    headers: { Accept: 'application/json', Origin: store },
  })).status();
  const adminStatus = async () => (await context.request.get(admin + '/api/v1/admin/settings', {
    headers: { Accept: 'application/json' },
  })).status();

  await buyer.goto(store + '/cuenta');
  await buyer.getByLabel('Correo electrónico').fill('buyer-admin-denied@camba.test');
  await buyer.getByLabel('Contraseña', { exact: true }).fill(password);
  await buyer.getByRole('button', { name: 'Ingresar', exact: true }).click({ timeout: 10_000 });
  await expect(buyer.getByRole('heading', { name: 'Datos personales' })).toBeVisible();
  expect(await storeStatus()).toBe(200);
  expect(await adminStatus()).toBe(401);

  const signIn = async () => {
    await page.getByLabel('Correo electrónico').fill('a11y-admin@camba.test');
    await page.getByLabel('Contraseña', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    expect(await adminStatus()).toBe(200);
  };
  await page.goto('/ingresar');
  await page.getByLabel('Correo electrónico').fill('buyer-admin-denied@camba.test');
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  const rejected = page.waitForResponse(response => response.url().endsWith('/api/v1/admin/auth/login'));
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  expect((await rejected).status()).toBe(422);
  expect(await adminStatus()).toBe(401);
  await signIn();
  expect(await storeStatus()).toBe(200);

  const cookies = await context.cookies();
  const adminCookie = cookies.find(({ name }) => name === 'camba_admin_session');
  const storeCookie = cookies.find(({ name }) => name === 'camba_browser_e2e');
  expect(adminCookie?.httpOnly && storeCookie?.httpOnly && adminCookie.value !== storeCookie.value).toBe(true);
  const storeCsrf = cookies.find(({ name }) => name === 'XSRF-TOKEN');
  expect(storeCsrf !== undefined && cookies.some(({ name }) => name === 'CAMBA-ADMIN-XSRF-TOKEN')).toBe(true);
  const wrongCsrf = await context.request.post(admin + '/api/v1/admin/auth/logout', {
    headers: { Accept: 'application/json', Origin: admin, 'X-XSRF-TOKEN': decodeURIComponent(storeCsrf!.value) },
  });
  expect(wrongCsrf.status()).toBe(419);
  expect(await adminStatus()).toBe(200);

  await page.locator('header summary[aria-label="Opciones de Camba Mesa"]').click();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/ingresar/);
  expect(await adminStatus()).toBe(401);
  expect(await storeStatus()).toBe(200);

  await signIn();
  await buyer.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(buyer.getByRole('button', { name: 'Ingresar', exact: true })).toBeVisible();
  expect(await storeStatus()).toBe(401);
  expect(await adminStatus()).toBe(200);
});
