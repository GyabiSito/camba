import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';

const origin = process.env.CAMBA_DEMO_STORE ?? 'http://127.0.0.1:44822';
const capture = 'test-results/shopper-demo';
const blocked = [];
const browser = await chromium.launch();

async function client() {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  page.setDefaultTimeout(8_000);
  await page.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === origin) return route.continue();
    blocked.push(route.request().url());
    return route.abort();
  });
  await page.goto(origin + '/cuenta');
  await page.getByLabel('Correo electrónico').fill('cliente.diseno@camba.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('CambaDemo2026!');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Datos personales' })).toBeVisible();
  return page;
}

async function screenshot(page, name) {
  await page.screenshot({ path: `${capture}/${name}.png`, fullPage: true });
}

try {
  await mkdir(capture, { recursive: true });
  const page = await client();
  await expect(page.getByLabel('Nombre completo')).toHaveValue('Lucía Pereira');
  await expect(
    page.getByText('Los recordatorios por correo no están disponibles por ahora.'),
  ).toBeVisible();
  await expect(page.getByText(/Calle Muestra 120/)).toBeVisible();
  await expect(page.getByText(/Camino de Prueba 42/)).toBeVisible();
  await screenshot(page, '01-mi-cuenta');

  await page.getByRole('link', { name: 'Mis pedidos' }).click();
  for (const [reference, status, delivery] of [
    ['10000000-0000-4000-8000-000000000001', 'Pago confirmado', 'Calle Muestra 120'],
    ['20000000-0000-4000-8000-000000000002', 'Pendiente de pago', 'Mostrador Camba'],
    ['30000000-0000-4000-8000-000000000003', 'Reserva vencida', 'Camino de Prueba 42'],
  ]) {
    await page.getByRole('link', { name: 'Ver pedido ' + reference.slice(0, 8) }).click();
    await expect(page.getByText(status, { exact: true })).toBeVisible();
    await expect(page.getByText(delivery, { exact: false })).toBeVisible();
    const summary = page.getByRole('complementary', { name: 'Resumen del pedido' });
    await expect(summary).toContainText('UYU');
    await expect(summary).toContainText('×');
    await page.getByRole('link', { name: 'Ver compras' }).click();
  }
  await page.goto(origin + '/carrito');
  const cartSummary = page.getByRole('complementary', { name: 'Resumen del carrito' });
  await expect(cartSummary).toContainText('UYU 2.280');
  const quantity = page.getByRole('spinbutton', { name: 'Cantidad de Remera lisa negra' });
  await quantity.fill('2');
  await page
    .getByRole('listitem')
    .filter({ has: quantity })
    .getByRole('button', { name: 'Actualizar' })
    .click();
  await expect(cartSummary).toContainText('UYU 3.070');
  await page.reload();
  await expect(quantity).toHaveValue('2');
  await page.getByRole('button', { name: 'Quitar Pantalón con pinzas arena' }).click();
  await expect(cartSummary).toContainText('UYU 1.580');

  async function add(slug, source = page) {
    await source.goto(origin + '/producto/' + slug);
    await source.getByRole('button', { name: 'Agregar al carrito' }).click();
    await expect(
      source.getByRole('dialog').getByRole('heading', { name: 'Agregado al carrito' }),
    ).toBeVisible();
  }

  await add('pantalon-pinzas-arena');
  await page.goto(origin + '/carrito');
  await expect(cartSummary).toContainText('UYU 3.070');
  await screenshot(page, '02-carrito');
  await page.getByRole('link', { name: 'Continuar la compra' }).click();
  await page.getByRole('radio', { name: /Entrega a domicilio/ }).check();
  await page
    .getByLabel('Usar una dirección guardada')
    .selectOption({ label: 'Calle Muestra 120, Montevideo' });
  await expect(page.getByLabel('Calle', { exact: true })).toHaveValue('Calle Muestra');
  await expect(page.getByRole('complementary', { name: 'Resumen de la compra' })).toContainText(
    'UYU 3.260',
  );
  await screenshot(page, '03-checkout');
  await page.getByRole('button', { name: 'Confirmar pedido' }).click();
  await expect(page.getByText('Pendiente de pago', { exact: true })).toBeVisible();
  const reference = new URL(page.url()).pathname.split('/').at(-1);
  assert.match(reference, /^[0-9a-f-]{36}$/i);
  await expect(page.getByRole('button', { name: /Pagar|Simular/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Consultar estado del pago', exact: true }).click();
  await expect(page.getByText('El estado sigue pendiente.', { exact: false })).toBeVisible();
  await expect(page.getByText('Pendiente de pago', { exact: true })).toBeVisible();
  await screenshot(page, '04-confirmacion');

  const independent = await client();
  await independent.getByRole('link', { name: 'Mis pedidos' }).click();
  await expect(independent).toHaveURL(origin + '/pedidos');
  await independent.reload();
  await independent.getByRole('link', { name: 'Ver pedido ' + reference.slice(0, 8) }).click();
  await expect(independent).toHaveURL(origin + '/pedidos/' + reference);
  await expect(independent.getByText('Pendiente de pago', { exact: true })).toBeVisible();
  await expect(
    independent.getByRole('complementary', { name: 'Resumen del pedido' }),
  ).toContainText('UYU 3.260');
  await expect(independent.getByText(/Calle Muestra 120/)).toBeVisible();
  await screenshot(independent, '05-detalle-pedido');
  await independent.goto(origin + '/carrito');
  await expect(independent.getByRole('heading', { name: 'Tu carrito está vacío' })).toBeVisible();
  await add('remera-lisa-negra', independent);
  await add('pantalon-pinzas-arena', independent);
  await independent.goto(origin + '/carrito');
  await independent.reload();
  await expect(
    independent.getByRole('complementary', { name: 'Resumen del carrito' }),
  ).toContainText('UYU 2.280');
  assert.deepEqual(blocked, [], 'the shopper demo must not call external services');
  console.log('Verified pending order without provider mutation: ' + reference);
} finally {
  await browser.close();
}
