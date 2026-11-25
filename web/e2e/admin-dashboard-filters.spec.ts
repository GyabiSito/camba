import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/admin/session', (route) => route.fulfill({ json: { data: {
    id: 1, name: 'Filter operator', email: 'filters@example.test', role: 'admin', email_verified: true,
  } } }));
});

test('product drilldown survives reload, pagination, edits, clear and browser navigation', async ({ page }, testInfo) => {
  const reads: URLSearchParams[] = [];
  await page.route('**/api/v1/admin/categories', (route) => route.fulfill({ json: { data: [
    { id: 1, slug: 'clothing', name: 'Ropa', active: true },
  ] } }));
  await page.route('**/api/v1/admin/products?*', (route) => {
    const params = new URL(route.request().url()).searchParams;
    reads.push(params);
    const current_page = Number(params.get('page') || 1);
    return route.fulfill({ json: {
      data: [{ id: current_page, sku: `FILTER-${current_page}`, slug: `filter-${current_page}`,
        name: `Filter product ${current_page}`, description: null, price_cents: 12500, stock: 0,
        status: 'published', category: null, brand: null, images: [] }],
      meta: { current_page, last_page: 2, total: 13 },
    } });
  });
  await page.goto('/productos?status=published&availability=out_of_stock');
  await expect(page.getByRole('combobox', { name: 'Estado', exact: true })).toHaveValue('published');
  await expect(page.getByRole('combobox', { name: 'Disponibilidad' })).toHaveValue('out_of_stock');
  await expect(page.getByRole('status')).toHaveText('13 resultados');
  expect(reads.at(-1)?.get('status')).toBe('published');
  expect(reads.at(-1)?.get('availability')).toBe('out_of_stock');
  await page.screenshot({ path: testInfo.outputPath('product-filters-1440.png'), fullPage: true });
  await page.getByRole('button', { name: 'Página siguiente' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole('link', { name: 'Filter product 2', exact: true })).toBeVisible();
  expect(reads.at(-1)?.get('availability')).toBe('out_of_stock');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Disponibilidad' })).toHaveValue('out_of_stock');
  await expect(page.getByRole('link', { name: 'Filter product 2', exact: true })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Buscar por nombre o SKU' }).fill('FILTER');
  await expect(page).toHaveURL(/q=FILTER/);
  expect(new URL(page.url()).searchParams.has('page')).toBe(false);
  await expect(page.getByRole('link', { name: 'Filter product 1', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Categoría', exact: true }).selectOption('clothing');
  await expect(page).toHaveURL(/category=clothing/);
  await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
  await expect(page).toHaveURL(/\/productos$/);
  await expect(page.getByRole('combobox', { name: 'Disponibilidad' })).toHaveValue('');
  await expect.poll(() => reads.at(-1)?.get('availability') ?? '').toBe('');
  await page.goBack();
  await expect(page.getByRole('combobox', { name: 'Categoría', exact: true })).toHaveValue('clothing');
  await expect(page.getByRole('combobox', { name: 'Disponibilidad' })).toHaveValue('out_of_stock');
  await expect.poll(() => reads.at(-1)?.get('category')).toBe('clothing');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await expect(page.getByRole('combobox', { name: 'Disponibilidad' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('product-filters-390.png'), fullPage: true });
});

test('order drilldown is a list option only and keeps payment separate', async ({ page }) => {
  const reads: URLSearchParams[] = [];
  await page.route('**/api/v1/admin/orders?*', (route) => {
    const params = new URL(route.request().url()).searchParams;
    reads.push(params);
    return route.fulfill({ json: { data: [], meta: { current_page: 1, last_page: 1, total: 0 } } });
  });
  await page.goto('/pedidos?status=paid&fulfilment_status=needs_preparation');
  await expect(page.getByRole('combobox', { name: 'Estado del pago' })).toHaveValue('paid');
  await expect(page.getByRole('combobox', { name: 'Preparación y entrega' })).toHaveValue('needs_preparation');
  await expect.poll(() => reads.at(-1)?.get('fulfilment_status')).toBe('needs_preparation');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Preparación y entrega' })).toHaveValue('needs_preparation');
  await page.getByRole('combobox', { name: 'Preparación y entrega' }).selectOption('preparing');
  await expect.poll(() => reads.at(-1)?.get('fulfilment_status')).toBe('preparing');
  expect(reads.at(-1)?.get('status')).toBe('paid');
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(page).toHaveURL(/\/pedidos$/);
  await expect.poll(() => reads.at(-1)?.get('status')).toBe(null);
});

test('order filters combine in API reads, reset the page and survive a detail round trip', async ({ page }) => {
  const reads: URLSearchParams[] = [];
  const ref = 'a84c132d-4b2d-4c7a-a5f3-721be1630712';
  await page.route('**/api/v1/admin/orders?*', (route) => {
    const params = new URL(route.request().url()).searchParams;
    reads.push(params);
    return route.fulfill({ json: {
      data: [{ reference: ref, status: 'paid', shipping_method: 'pickup', fulfilment_status: 'unstarted',
        total_cents: 10000, created_at: '2026-10-21T12:00:00.000Z' }],
      meta: { current_page: Number(params.get('page')), last_page: 2, total: 26 },
    } });
  });
  await page.route(`**/api/v1/admin/orders/${ref}`, route => route.fulfill({ status: 500 }));

  await page.goto('/pedidos?status=paid&fulfilment_status=unstarted&page=2');
  const search = page.getByRole('searchbox', { name: 'Buscar pedido' });
  const modality = page.getByRole('combobox', { name: 'Modalidad' });
  await expect(search).toBeVisible();
  await modality.selectOption('pickup');
  await expect.poll(() => reads.at(-1)?.get('shipping_method')).toBe('pickup');
  expect(reads.at(-1)?.get('page')).toBe('1');
  await page.getByLabel('Desde', { exact: true }).fill('2026-10-21');
  await page.getByLabel('Hasta', { exact: true }).fill('2026-10-22');
  await search.fill('a84c132d');
  await expect.poll(() => Object.fromEntries(reads.at(-1) ?? [])).toEqual({
    status: 'paid', fulfilment_status: 'unstarted', shipping_method: 'pickup',
    date_from: '2026-10-21', date_to: '2026-10-22', q: 'a84c132d', page: '1',
  });
  await expect(page.getByRole('status').filter({ hasText: /^26 pedidos$/ })).toBeVisible();
  await page.getByRole('link', { name: 'Siguiente' }).click();
  await expect.poll(() => reads.at(-1)?.get('page')).toBe('2');
  await page.getByRole('link', { name: `Ver pedido ${ref}` }).click();
  await page.getByRole('link', { name: 'Volver a pedidos' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(search).toHaveValue('a84c132d');
  await expect(modality).toHaveValue('pickup');
  await expect(page.getByLabel('Desde', { exact: true })).toHaveValue('2026-10-21');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(page).toHaveURL(/\/pedidos$/);
  await expect(search).toHaveValue('');
  await expect(modality).toHaveValue('');
  await expect.poll(() => Object.fromEntries(reads.at(-1) ?? [])).toEqual({ page: '1' });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
