import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';

const store = process.env.CAMBA_DEMO_STORE ?? 'http://127.0.0.1:44822';
const buyer = 'cliente.diseno@camba.test';
const password = 'CambaDemo2026!';

test('auth exposes field-level validation and account remains legible at 320px', async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 320, height: 800 } });
    await page.goto(`${store}/cuenta`);
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await expect(page.getByText('Ingresá tu correo electrónico.', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Correo electrónico')).toHaveAttribute('aria-invalid', 'true');

    await page.getByLabel('Correo electrónico').fill('cliente-inválido');
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await expect(page.getByText('Ingresá un correo electrónico válido.', { exact: true })).toBeVisible();

    await page.getByLabel('Correo electrónico').fill(buyer);
    await page.getByLabel('Contraseña', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Datos personales' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mis pedidos' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);

  } finally {
    await browser.close();
  }
});
