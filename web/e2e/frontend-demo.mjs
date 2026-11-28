import { test } from 'node:test';
import { chromium, expect } from '@playwright/test';

const store = process.env.CAMBA_DEMO_STORE ?? 'http://127.0.0.1:44822';
const admin = process.env.CAMBA_DEMO_ADMIN ?? 'http://127.0.0.1:44823';
const buyer = 'cliente.diseno@camba.test';
const operator = 'admin.diseno@camba.test';
const password = 'CambaDemo2026!';

test('demo renders catalog and account on the server, and keeps local roles after reload', async () => {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const calls = [];
    context.on('request', request => {
      if (/^\/(api|sanctum)\//.test(new URL(request.url()).pathname)) calls.push(request.url());
    });
    const page = await context.newPage();
    const getHtml = async (url, status = 200) => {
      const response = await context.request.get(url);
      expect(response.status(), url).toBe(status);
      return response.text();
    };
    const signIn = async (email, secret = password) => {
      await page.getByLabel('Correo electrónico').fill(email);
      await page.getByLabel('Contraseña', { exact: true }).fill(secret);
      await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    };

    const detail = `${store}/producto/remera-lisa-negra`;
    expect(await getHtml(detail)).toMatch(/<h1[^>]*>Remera lisa negra<\/h1>/);
    await getHtml(`${store}/producto/demo-no-existe`, 404);
    await page.goto(`${store}/tienda?page=2`);
    await expect(page.getByRole('link', { name: 'Remera lisa negra', exact: true })).toBeVisible();
    await page.goto(`${store}/tienda?q=negra&category=remeras&brand=taller-sur`);
    await expect(page.getByRole('link', { name: 'Remera lisa negra', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Pantalón recto negro', exact: true })).toHaveCount(0);
    await page.getByRole('link', { name: 'Remera lisa negra', exact: true }).click();
    await page.getByRole('button', { name: 'Ver foto 2' }).click();
    await expect.poll(() => page.getByRole('img', { name: 'Remera lisa negra — vista frontal más cercana' })
      .evaluate(image => image.naturalWidth)).toBeGreaterThan(0);

    const account = `${store}/cuenta`;
    expect(await getHtml(account)).toContain('Ingresá a tu cuenta');
    await page.goto(account);
    await page.waitForFunction(() => window.ng?.getComponent(document.querySelector('app-root')));
    await signIn(buyer, 'wrong-password');
    await expect(page.getByRole('alert')).toContainText('contraseña no son correctos');
    await signIn(buyer);
    await expect(page.getByText(buyer, { exact: true })).toBeVisible();
    expect(await getHtml(account)).toContain(buyer);
    expect(await getHtml(account)).not.toContain('CambaDemo2026!');
    await page.reload();
    await expect(page.getByText(buyer, { exact: true })).toBeVisible();
    const other = await browser.newContext();
    const guest = await other.request.get(account);
    expect(await guest.text()).not.toContain(buyer);
    await other.close();

    await page.goto(`${admin}/productos`);
    await expect(page).toHaveURL(/\/ingresar/);
    await signIn(buyer);
    await expect(page.getByRole('alert')).toContainText('no tiene acceso administrativo');
    await signIn(operator);
    await expect(page.getByRole('table', { name: 'Inventario de productos' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('table', { name: 'Inventario de productos' })).toBeVisible();
    await page.getByRole('link', { name: 'Pantalón recto negro', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Pantalón recto negro', exact: true })).toBeVisible();
    await page.locator('summary[aria-label="Opciones de Administración Demo"]').click();
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await page.goto(`${admin}/productos`);
    await expect(page).toHaveURL(/\/ingresar/);
    await page.goto(account);
    await expect(page.getByText(buyer, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Ingresá a tu cuenta' })).toBeVisible();
    expect(await getHtml(account)).not.toContain(buyer);
    await page.getByRole('button', { name: 'Olvidé mi contraseña' }).click();
    await page.getByLabel('Correo electrónico').fill(buyer);
    await page.getByRole('button', { name: 'Solicitar enlace' }).click();
    await expect(page.getByRole('alert')).toContainText('no está disponible en modo demo');
    expect(calls).toEqual([]);
  } finally {
    await browser.close();
  }
});
