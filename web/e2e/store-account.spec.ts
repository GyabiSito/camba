import { expect, test } from '@playwright/test';

test('registration shows an unverified account and handles a bad reset link', async ({ page }) => {
  const email = 'registro@camba.test';
  const password = 'Camba-account-test-2026';
  await page.goto('/cuenta');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await page.getByLabel('Nombre completo').fill('Cuenta de prueba');
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByLabel('Confirmá la contraseña').fill(password);
  await page.getByRole('button', { name: 'Registrarme' }).click();
  await expect(page.getByRole('status')).toContainText('Cuenta creada.');

  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Verificá tu correo' })).toBeVisible();
  await page.getByRole('button', { name: 'Pedir otro enlace' }).click();
  await expect(page.getByText('Solicitamos otro enlace.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Comprobar verificación' }).click();
  await expect(page.getByText('Todavía no figura verificado.', { exact: false })).toBeVisible();

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await page.getByRole('button', { name: 'Olvidé mi contraseña' }).click();
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByRole('button', { name: 'Solicitar enlace' }).click();
  await expect(page.getByRole('status')).toContainText('Si existe una cuenta');
  await page.goto('/cuenta/restablecer#token=invalid-test-token');
  await page.getByLabel('Correo electrónico').fill(email);
  await expect(page).toHaveURL(/\/cuenta\/restablecer$/);
  await page.getByLabel('Nueva contraseña').fill('Camba-reset-test-2026');
  await page.getByLabel('Confirmá la contraseña').fill('Camba-reset-test-2026');
  const result = page.waitForResponse((response) =>
    response.url().endsWith('/auth/reset-password'),
  );
  await page.getByRole('button', { name: 'Guardar contraseña' }).click();
  expect((await result).status()).toBe(422);
  await expect(page.getByRole('alert')).toBeVisible();
});
