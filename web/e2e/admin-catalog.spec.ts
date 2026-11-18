import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

async function signIn(page: Page) {
  await page.goto('/productos');
  await page.getByLabel('Correo electrónico').fill('admin@camba.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('Camba-test-only-2026');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: 'Productos', exact: true })).toBeVisible();
}

function photo(name: string) {
  return resolve(__dirname, `../projects/admin/public/demo/${name}.webp`);
}

test('busca por SKU, guarda centésimos, publica con galería y archiva a 320 px', async ({ page }, testInfo) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Seleccionar Remera lisa' }).click();
  await expect(page.getByRole('complementary', { name: 'Producto seleccionado' })).toContainText('REM-002');
  await page.screenshot({ path: testInfo.outputPath('admin-catalog-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 320, height: 800 });
  const search = page.getByRole('searchbox', { name: 'Buscar por nombre o SKU' });
  await search.fill('REM-002');
  await expect(page.getByRole('status')).toHaveText('1 resultado');
  await page.screenshot({ path: testInfo.outputPath('admin-catalog-mobile.png'), fullPage: true });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.getByRole('link', { name: 'Nuevo producto' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Remera de prueba edición');
  await page.getByLabel('Precio (UYU)').fill('900,75');
  await page.getByLabel('Stock', { exact: true }).fill('8');
  await page.getByRole('combobox', { name: 'Categoría', exact: true }).selectOption({ label: 'Remeras' });
  await page.getByRole('button', { name: 'Crear borrador' }).click();
  await expect(page.getByRole('heading', { name: 'Remera de prueba edición' })).toBeVisible();
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Agregá al menos una foto');
  await page.getByLabel('Agregar fotos').setInputFiles([photo('image-plain'), photo('detail-photo')]);
  await page.getByRole('button', { name: 'Subir fotos' }).click();
  await expect(page.getByText('Fotos agregadas a la galería.')).toBeVisible();
  const gallery = page.getByRole('region', { name: 'Galería' });
  const before = await gallery.getByRole('img').first().getAttribute('src');
  const thumbnail = await page.request.get(before!);
  expect(thumbnail.status(), `Newly uploaded thumbnail: ${before}`).toBe(200);
  expect(thumbnail.headers()['content-type']).toContain('image/webp');
  await expect.poll(() => gallery.getByRole('img').first().evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await gallery.getByRole('button', { name: 'Usar foto 2 como portada' }).click();
  await gallery.getByRole('button', { name: 'Guardar orden' }).click();
  await expect(gallery.getByText('Orden y portada guardados.')).toBeVisible();
  await expect(gallery.getByRole('img').first()).not.toHaveAttribute('src', before!);
  const publication = page.waitForResponse((response) => response.url().endsWith('/publish') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  const published = await publication;
  expect((await published.json()).data).toMatchObject({ price_cents: 90075, stock: 8, status: 'published' });
  await expect(page.getByText('Producto publicado.')).toBeVisible();
  await page.getByLabel('Stock', { exact: true }).fill('9');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Cambios guardados.')).toBeVisible();
  await page.getByText('Historial de precio y stock').click();
  await expect(page.getByRole('cell', { name: '8 / 9' })).toBeVisible();
  await page.getByRole('button', { name: 'Archivar', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar archivo' }).click();
  await expect(page.getByText('Producto archivado.')).toBeVisible();
  await page.goto('/productos');
  const row = page.getByRole('row', { name: /Remera de prueba edición/ });
  const name = await row.getByRole('link', { name: 'Remera de prueba edición' }).boundingBox();
  const select = await row.getByRole('button', { name: 'Seleccionar Remera de prueba edición' }).boundingBox();
  expect(name!.x + name!.width).toBeLessThanOrEqual(select!.x);
});

test('el reintento de fotos continúa en el mismo borrador', async ({ page }) => {
  await signIn(page);
  await page.goto('/productos/carga-por-fotos');
  const group = page.getByRole('group', { name: 'Grupo 1' });
  await group.getByLabel('Nombre', { exact: true }).fill('Remera de prueba fotos');
  const edit = page.getByRole('group', { name: 'Remera de prueba fotos' });
  await edit.getByLabel('Precio (UYU)').fill('750,00');
  await edit.getByRole('combobox', { name: 'Categoría', exact: true }).selectOption({ label: 'Remeras' });
  await edit.getByLabel('Fotos de este producto').setInputFiles(photo('image-pocket'));
  let creates = 0;
  let uploads = 0;
  const targets = new Set<string>();
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/v1/admin/products')) creates++;
  });
  await page.route('**/api/v1/admin/products/*/images', (route) => {
    targets.add(route.request().url());
    return ++uploads === 1 ? route.fulfill({ status: 503, json: { message: 'No se pudo guardar la foto.' } }) : route.continue();
  });
  const preview = page.getByRole('button', { name: 'Revisar borradores' });
  const confirm = page.getByRole('button', { name: 'Confirmar y crear borradores' });
  await preview.click();
  await confirm.click();
  await expect(page.getByText(/El borrador ya existe/).first()).toBeVisible();
  await expect(page.getByRole('alert')).toBeVisible();
  await preview.click();
  await confirm.click();
  await expect(page.getByRole('link', { name: 'Revisar y publicar' })).toBeVisible();
  expect({ creates, uploads, targets: targets.size }).toEqual({ creates: 1, uploads: 2, targets: 1 });
});

test('importa CSV y XLSX, muestra errores por fila y recupera el resultado', async ({ page }) => {
  await signIn(page);
  await page.goto('/productos/importar');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar plantilla CSV' }).click();
  expect((await downloaded).suggestedFilename()).toBe('camba-catalogo.csv');
  const csv = Buffer.from([
    'codigo,nombre,precio_uyu,stock,categoria,marca,descripcion,fotos',
    'TEST-W1-001,Producto de prueba importado,108.23,5,remeras,,,',
    'TEST-W1-002,Producto inválido,109.99,3,categoria-inexistente,,,',
    '',
  ].join('\n'));
  await page.getByLabel('Archivo CSV o XLSX').setInputFiles({ name: 'catalogo.csv', mimeType: 'text/csv', buffer: csv });
  await page.getByRole('button', { name: 'Ver vista previa' }).click();
  await expect(page.getByRole('heading', { name: 'Vista previa' })).toBeVisible();
  await expect(page.getByText(/Categoría: Usá el identificador de una clasificación activa/)).toBeVisible();
  const confirm = page.getByRole('button', { name: 'Confirmar importación' });
  await expect(confirm).toBeDisabled();
  await page.getByRole('checkbox', { name: /Revisé las filas/ }).check();
  await confirm.click();
  await expect(page.getByRole('heading', { name: 'Resultado de la importación' })).toBeVisible({ timeout: 15_000 });
  const url = page.url();
  expect(url).toMatch(/\/productos\/importar\/\d+$/);
  await page.reload();
  await expect(page).toHaveURL(url);
  await expect(page.getByRole('link', { name: 'TEST-W1-001' })).toBeVisible();
  await page.getByLabel('Archivo CSV o XLSX').setInputFiles({ name: 'catalogo.csv', mimeType: 'text/csv', buffer: csv });
  const repeated = page.waitForResponse((response) => response.url().endsWith('/api/v1/admin/catalog-imports') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Ver vista previa' }).click();
  const deduped = await repeated;
  expect(deduped.status()).toBe(200);
  expect((await deduped.json()).data.id).toBe(Number(url.split('/').at(-1)));
  await expect(page.getByRole('heading', { name: 'Resultado de la importación' })).toBeVisible();
  await expect(page).toHaveURL(url);
  await expect(page.getByRole('status')).toHaveText('0 listas · 1 inválidas · 1 aplicadas · 0 no aplicadas');

  const workbook = execFileSync('php', [resolve(__dirname, 'fixtures/catalog-workbook.php')]);
  await page.getByLabel('Archivo CSV o XLSX').setInputFiles({
    name: 'catalogo.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: workbook,
  });
  await page.getByRole('button', { name: 'Ver vista previa' }).click();
  await expect(page.getByRole('heading', { name: 'Vista previa' })).toBeVisible();
  await expect(page.getByText('BROWSER-XLSX-001', { exact: true })).toBeVisible();
  await expect(confirm).toBeDisabled();
  await page.getByRole('checkbox', { name: /Revisé las filas/ }).check();
  await confirm.click();
  await expect(page.getByRole('heading', { name: 'Resultado de la importación' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'BROWSER-XLSX-001' })).toBeVisible();
  expect(page.url()).not.toBe(url);
  await expect(page.getByRole('status')).toHaveText('0 listas · 0 inválidas · 1 aplicadas · 0 no aplicadas');
});

test('gestiona una categoría plana y protege las categorías en uso', async ({ page }) => {
  await signIn(page);
  await page.goto('/productos/clasificaciones');
  await page.getByRole('button', { name: 'Nueva categoría' }).click();
  await page.getByLabel('Nombre de la categoría').fill('Categoría de prueba');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText('Se guardó «Categoría de prueba».')).toBeVisible();
  await page.getByRole('button', { name: 'Editar Categoría de prueba' }).click();
  await page.getByLabel('Editar nombre').fill('Categoría de prueba editada');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.getByRole('button', { name: 'Desactivar Categoría de prueba editada' }).click();
  await expect(page.getByRole('button', { name: 'Activar Categoría de prueba editada' })).toBeVisible();
  await page.getByRole('button', { name: 'Desactivar Remeras' }).click();
  await expect(page.getByRole('alert')).toContainText('Reasigná o archivá los productos publicados');
});
