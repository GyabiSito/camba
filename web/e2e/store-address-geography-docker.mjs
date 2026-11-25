import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';

const origin = 'http://127.0.0.1:4200';
const password = process.env.CAMBA_DEMO_PASSWORD;
assert(password, 'Set CAMBA_DEMO_PASSWORD to the local demo password.');
const artifacts = new URL('../dist/artifacts/address-geography/', import.meta.url);
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch();
const name = `Prueba dirección ${randomUUID().slice(0, 8)}`;
const dept = (page) => page.getByRole('combobox', { name: 'Departamento', exact: true });
const town = (page) => page.getByRole('combobox', { name: 'Localidad', exact: true });
const option = (page, value) => page.getByRole('option', { name: value, exact: true });
const choose = async (page, control, search, label) => {
  await control.fill(search);
  await option(page, label).click();
};
const apiResponse = (page, path, method) => page.waitForResponse((response) =>
  new URL(response.url()).pathname === '/api/v1' + path && response.request().method() === method);
const screenshot = (page, file) => page.screenshot({ path: fileURLToPath(new URL(file, artifacts)), animations: 'disabled', fullPage: true });

try {
  const buyer = await browser.newPage({ locale: 'es-UY', viewport: { width: 1440, height: 1000 } });
  await buyer.goto(origin + '/cuenta');
  await buyer.getByLabel('Correo electrónico').fill('cliente.diseno@camba.test');
  await buyer.getByLabel('Contraseña', { exact: true }).fill(password);
  const savedList = apiResponse(buyer, '/account/addresses', 'GET');
  await buyer.getByRole('button', { name: 'Ingresar', exact: true }).click();
  const original = (await (await savedList).json()).data;
  const legacy = original.find((address) => address.locality_id === null);
  assert(legacy, 'The demo must contain an unlinked historic address.');
  let created;
  try {
    await buyer.getByRole('button', { name: 'Agregar dirección' }).click();
    await expect(town(buyer)).toBeDisabled();
    await buyer.getByLabel('Nombre de quien recibe').fill('Cliente de prueba');
    await choose(buyer, dept(buyer), 'monte', 'Montevideo');
    await choose(buyer, town(buyer), 'monte', 'Montevideo');
    await buyer.getByLabel('Calle', { exact: true }).fill(name);
    await buyer.getByLabel('Número de puerta').fill('42');
    const saving = apiResponse(buyer, '/account/addresses', 'POST');
    await buyer.getByRole('button', { name: 'Guardar dirección' }).click();
    const saved = await saving;
    assert.equal(saved.status(), 201);
    created = (await saved.json()).data;
    assert.equal(created.department_id, 10);

    await buyer.getByRole('button', { name: `Editar ${name} 42`, exact: true }).click();
    await expect(dept(buyer)).toHaveValue('Montevideo');
    await expect(town(buyer)).toHaveValue('Montevideo');
    await choose(buyer, dept(buyer), 'canelones', 'Canelones');
    await expect(town(buyer)).toHaveValue('');
    await choose(buyer, town(buyer), 'las piedras', 'Las Piedras');
    const updating = apiResponse(buyer, `/account/addresses/${created.id}`, 'PATCH');
    await buyer.getByRole('button', { name: 'Guardar dirección' }).click();
    const updated = await updating;
    assert.equal(updated.status(), 200);
    const address = (await updated.json()).data;
    assert.equal(address.department_id, 2);
    assert.notEqual(address.locality_id, created.locality_id);

    await buyer.reload();
    await buyer.getByRole('button', { name: `Editar ${name} 42`, exact: true }).click();
    await expect(dept(buyer)).toHaveValue('Canelones');
    await expect(town(buyer)).toHaveValue('Las Piedras');
    await screenshot(buyer, 'cuenta-1440.png');

    await buyer.goto(origin + '/checkout');
    await buyer.getByRole('radio', { name: /Entrega a domicilio/i }).check();
    const savedAddresses = buyer.getByLabel('Usar una dirección guardada');
    await savedAddresses.selectOption(String(legacy.id));
    await expect(buyer.getByText(/Dirección anterior:/)).toContainText(legacy.locality);
    await expect(town(buyer)).toBeDisabled();
    await buyer.getByRole('button', { name: 'Confirmar pedido' }).click();
    await expect(buyer.getByText('Elegí un departamento y una localidad válidos para el envío.')).toBeVisible();
    await expect(buyer).toHaveURL(origin + '/checkout');
    await savedAddresses.selectOption(String(address.id));
    await expect(dept(buyer)).toHaveValue(address.department);
    await expect(town(buyer)).toHaveValue(address.locality);
  } finally {
    if (created) {
      await buyer.goto(origin + '/cuenta');
      await buyer.getByRole('button', { name: `Eliminar ${name} 42`, exact: true }).click();
      const deleting = apiResponse(buyer, `/account/addresses/${created.id}`, 'DELETE');
      await buyer.getByRole('button', { name: 'Eliminar dirección', exact: true }).click();
      assert.equal((await deleting).status(), 204);
    }
  }

  const guest = await browser.newPage({ locale: 'es-UY', viewport: { width: 390, height: 844 }, hasTouch: true });
  const catalog = await guest.request.get(origin + '/api/v1/products');
  const products = (await catalog.json()).data;
  const item = products.find((product) => product.stock > 0);
  assert(item, 'A stocked demo product is required.');
  await guest.goto(origin + '/producto/' + item.slug);
  await guest.getByRole('button', { name: 'Agregar al carrito' }).click();
  await expect(guest.getByRole('dialog', { name: 'Agregado al carrito' })).toBeVisible();
  await guest.goto(origin + '/checkout');
  await guest.getByRole('radio', { name: /Entrega a domicilio/i }).check();
  // The query has no accent. Commit with the keyboard instead of typing a free-text name.
  await dept(guest).fill('San Jose');
  await expect(option(guest, 'San José')).toBeVisible();
  await dept(guest).press('ArrowDown');
  await dept(guest).press('Enter');
  await expect(dept(guest)).toHaveValue('San José');
  await town(guest).fill('San Jose');
  const locality = guest.getByRole('listbox').getByRole('option').first();
  const label = await locality.innerText();
  const quoted = apiResponse(guest, '/checkout/quote', 'POST');
  await locality.click();
  const quote = await quoted;
  assert.equal(quote.status(), 200);
  const request = quote.request().postDataJSON();
  assert.equal(request.address.department_id, 16);
  assert.equal(typeof request.address.locality_id, 'number');
  await expect(town(guest)).toHaveValue(label);
  await expect.poll(() => guest.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await screenshot(guest, 'checkout-invitado-390.png');
  await guest.setViewportSize({ width: 320, height: 844 });
  await expect.poll(() => guest.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  console.log('Docker store: create, edit, reload, legacy and linked saved addresses, accent-insensitive guest delivery quote, and 320/390 px verified.');
} finally {
  await browser.close();
}
