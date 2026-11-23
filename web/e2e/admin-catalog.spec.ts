import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

async function signIn(page: Page) {
  await page.goto('/productos');
  await page.getByLabel('Correo electrónico').fill('admin@camba.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('Camba-test-only-2026');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: 'Productos', exact: true })).toBeVisible({ timeout: 15_000 });
}

function photo(name: string) {
  return resolve(__dirname, `../projects/admin/public/demo/${name}.webp`);
}

test('busca por SKU, guarda centésimos, publica con galería y archiva a 320 px', async ({ page }, testInfo) => {
  await signIn(page);
  await expect(page.getByRole('link', { name: 'Carga masiva' })).toBeVisible();
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
  const name = await row.getByRole('link', { name: 'Remera de prueba edición', exact: true }).boundingBox();
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
  const uploads: string[] = [];
  const targets = new Set<string>();
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/v1/admin/products')) creates++;
  });
  await page.route('**/api/v1/admin/products/*/images/uploads', (route) => {
    targets.add(route.request().url());
    uploads.push(route.request().headers()['idempotency-key']);
    return uploads.length === 1
      ? route.fulfill({ status: 422, json: { errors: { 'photos.0': ['No se pudo leer la imagen.'] } } })
      : route.continue();
  });
  const preview = page.getByRole('button', { name: 'Revisar borradores' });
  const confirm = page.getByRole('button', { name: 'Confirmar y crear borradores' });
  await preview.click();
  await confirm.click();
  await expect(page.getByText(/El borrador ya existe/).first()).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('No se pudo leer la imagen.');
  const invalid = edit.getByRole('button', { name: 'Quitar image-pocket.webp' });
  await invalid.click();
  await edit.getByLabel('Fotos de este producto').setInputFiles(photo('detail-photo'));
  await expect(invalid).toHaveCount(0);
  await preview.click();
  await confirm.click();
  await expect(page.getByRole('link', { name: 'Revisar y publicar' })).toBeVisible();
  expect({ creates, uploads: uploads.length, targets: targets.size }).toEqual({ creates: 1, uploads: 2, targets: 1 });
  expect(uploads[0]).toBeTruthy();
  expect(uploads[1]).not.toBe(uploads[0]);
});

async function uncertainUpload(page: Page, committed: boolean) {
  const uploads: string[] = [];
  const savedIds: number[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && /\/api\/v1\/admin\/products\/\d+\/images\/uploads$/.test(request.url())) {
      uploads.push(request.headers()['idempotency-key']);
    }
  });
  const failure = { message: 'Write was not confirmed' };
  if (!committed) {
    await page.route('**/api/v1/admin/products/*/images/uploads', (route) => route.fulfill({ status: 504, json: failure }), { times: 1 });
    return { uploads, savedIds };
  }

  // Chromium can drop a real response after Laravel commits without rebuilding a multipart request.
  const network = await page.context().newCDPSession(page);
  await network.send('Fetch.enable', { patterns: [{
    urlPattern: '*/api/v1/admin/products/*/images/uploads', requestStage: 'Response',
  }] });
  network.once('Fetch.requestPaused', async ({ requestId, responseStatusCode }) => {
    expect(responseStatusCode).toBe(201);
    const result = await network.send('Fetch.getResponseBody', { requestId });
    const body = result.base64Encoded ? Buffer.from(result.body, 'base64').toString('utf8') : result.body;
    savedIds.push(...JSON.parse(body).data.images.map((image: { id: number }) => image.id));
    await network.send('Fetch.fulfillRequest', {
      requestId, responseCode: 500, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
      body: Buffer.from(JSON.stringify(failure)).toString('base64'),
    });
    await network.send('Fetch.disable');
  });
  return { uploads, savedIds };
}

async function expectRecovered(page: Page, draftPath: string, attempts: Awaited<ReturnType<typeof uncertainUpload>>) {
  const saved = await page.request.get(draftPath, { headers: { Referer: page.url() } });
  expect(saved.status()).toBe(200);
  const product = (await saved.json()).data;
  const ids = product.images.map((image: { id: number }) => image.id);
  expect(new Set(ids).size).toBe(2);
  expect(ids).toHaveLength(2);
  if (attempts.savedIds.length) expect(ids).toEqual(attempts.savedIds);
  expect(attempts.uploads[0]).toMatch(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  expect(new Set(attempts.uploads).size).toBe(1);
  return product;
}

for (const committed of [true, false]) {
  const outcome = committed ? 'después de guardar' : 'antes de llegar al servidor';

  test(`reintenta una carga agrupada que pierde confirmación ${outcome}`, async ({ page }, testInfo) => {
    test.setTimeout(75_000);
    if (!committed) await page.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }));
    await signIn(page);
    await page.goto('/productos/carga-por-fotos');
    const name = committed ? 'Lote guardado sin confirmación' : 'Lote pendiente sin confirmación';
    await page.getByLabel('Nombre', { exact: true }).fill(name);
    const group = page.getByRole('group', { name });
    await group.getByLabel('Precio (UYU)').fill('750,00');
    await group.getByRole('combobox', { name: 'Categoría', exact: true }).selectOption({ label: 'Remeras' });
    await group.getByLabel('Fotos de este producto').setInputFiles([photo('image-pocket'), photo('detail-photo')]);
    const create = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith('/api/v1/admin/products'));
    const attempts = await uncertainUpload(page, committed);
    await page.getByRole('button', { name: 'Revisar borradores' }).click();
    await page.getByRole('button', { name: 'Confirmar y crear borradores' }).click();
    const created = await create;
    expect(created.status()).toBe(201);
    const draft = (await created.json()).data;
    const draftPath = `/api/v1/admin/products/${draft.id}`;
    await expect(group.getByRole('alert')).toContainText('confirmar');
    const pending = group.getByRole('list', { name: 'Fotos pendientes' }).getByRole('listitem');
    await expect(pending).toHaveCount(2);
    const retry = group.getByRole('button', { name: 'Reintentar carga' });
    await expect(retry).toBeEnabled();
    await expect(group.getByRole('button', { name: /^Quitar .*webp$/ })).toHaveCount(0);
    if (committed) {
      const resumed = await page.context().newPage();
      await resumed.goto('/productos/carga-por-fotos');
      const savedDrafts = resumed.getByRole('region', { name: 'Cargas pendientes' });
      const draftLink = savedDrafts.getByRole('link', { name: `Abrir borrador ${draft.sku}` });
      await expect(draftLink).toHaveAttribute('href', `/productos/${draft.id}`);
      await draftLink.click();
      await expect(resumed.getByRole('region', { name: 'Galería' }).getByRole('status')).toContainText('mismo orden');
      await resumed.close();
      await group.getByRole('link', { name: /abre en otra pestaña/ }).focus();
      await page.keyboard.press('Tab');
      await expect(retry).toBeFocused();
      await page.screenshot({ path: testInfo.outputPath('photo-drafts-retry-desktop.png') });
      await page.setViewportSize({ width: 320, height: 800 });
      await retry.scrollIntoViewIfNeeded();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
      expect((await pending.first().boundingBox())!.y).toBe((await pending.last().boundingBox())!.y);
      await page.screenshot({ path: testInfo.outputPath('photo-drafts-retry-mobile.png') });
    }
    if (committed) await page.keyboard.press('Enter');
    else await retry.press('Enter');
    await expect(group.getByRole('link', { name: 'Revisar y publicar' })).toHaveAttribute('href', `/productos/${draft.id}`);
    await expect(page.getByRole('status')).toContainText('1 borrador preparado');
    const product = await expectRecovered(page, draftPath, attempts);
    expect(attempts.uploads).toHaveLength(2);
    expect(product).toMatchObject({ id: draft.id, sku: draft.sku, status: 'draft' });
    const search = await page.request.get('/api/v1/admin/products', { headers: { Referer: page.url() }, params: { q: name } });
    expect(search.status()).toBe(200);
    expect((await search.json()).data.map((item: { id: number }) => item.id)).toEqual([draft.id]);
    await group.getByRole('link', { name: 'Revisar y publicar' }).click();
    const gallery = page.getByRole('region', { name: 'Galería' });
    await expect(gallery.getByText('Portada', { exact: true })).toBeVisible();
    await expect(gallery.getByRole('img').first()).toHaveAttribute('src', product.images[0].thumbnail_url);
  });

  test(`reintenta la galería que pierde confirmación ${outcome}`, async ({ page }, testInfo) => {
    test.setTimeout(75_000);
    await signIn(page);
    await page.getByRole('link', { name: 'Nuevo producto' }).click();
    const name = committed ? 'Galería guardada sin confirmación' : 'Galería pendiente sin confirmación';
    await page.getByLabel('Nombre', { exact: true }).fill(name);
    await page.getByRole('button', { name: 'Crear borrador' }).click();
    await expect(page.getByRole('heading', { name })).toBeVisible();
    const draftPath = `/api/v1/admin/products/${page.url().split('/').at(-1)}`;
    const attempts = await uncertainUpload(page, committed);
    const gallery = page.getByRole('region', { name: 'Galería' });
    const files = [photo('image-pocket'), photo('detail-photo')];
    await gallery.getByLabel('Agregar fotos').setInputFiles(files);
    await gallery.getByRole('button', { name: 'Subir fotos' }).click();
    await expect(gallery.getByRole('alert')).toContainText('confirmar');
    const retry = gallery.getByRole('button', { name: 'Reintentar carga' });
    await expect(retry).toBeEnabled();
    if (committed) {
      await retry.focus();
      await page.screenshot({ path: testInfo.outputPath('gallery-retry-desktop.png') });
      await page.setViewportSize({ width: 320, height: 800 });
      await retry.scrollIntoViewIfNeeded();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
      await page.screenshot({ path: testInfo.outputPath('gallery-retry-mobile.png') });
      await page.reload();
      const originals = gallery.getByLabel('Volver a elegir las fotos');
      await expect(originals).toBeVisible();
      await originals.setInputFiles([...files].reverse());
      await retry.click();
      await expect(gallery.getByRole('alert')).toContainText('mismo orden');
      expect(attempts.uploads).toHaveLength(1);
      await originals.setInputFiles(files);

      // Another tab may confirm the upload and clear the durable slot after this tab offered recovery.
      const other = await page.context().newPage();
      await other.goto(page.url());
      const otherGallery = other.getByRole('region', { name: 'Galería' });
      await otherGallery.getByLabel('Volver a elegir las fotos').setInputFiles(files);
      const otherRequest = other.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith(`${draftPath}/images/uploads`));
      await otherGallery.getByRole('button', { name: 'Reintentar carga' }).click();
      expect((await otherRequest).headers()['idempotency-key']).toBe(attempts.uploads[0]);
      await expect(otherGallery.getByRole('status')).toContainText('Fotos agregadas a la galería.');
      await other.close();

      const interruptedAgain = await uncertainUpload(page, true);
      await originals.focus();
      await page.keyboard.press('Tab');
      await expect(retry).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(gallery.getByRole('alert')).toContainText('confirmar');
      expect(interruptedAgain.uploads).toEqual([attempts.uploads[0]]);
      await page.reload();
      await expect(gallery.getByRole('status')).toContainText('mismo orden');
      await originals.setInputFiles(files);
    } else {
      await page.route(`**${draftPath}/images/uploads`, (route) => route.fulfill({ status: 409, json: { message: 'Upload conflicts' } }), { times: 1 });
      await retry.click();
      await expect(gallery.getByRole('alert')).toContainText('no coincide');
      await expect(gallery.getByText('Fotos agregadas a la galería.')).toHaveCount(0);
      expect(attempts.uploads).toHaveLength(2);
    }
    await retry.press('Enter');
    await expect(gallery.getByRole('status')).toContainText('Fotos agregadas a la galería.');
    const product = await expectRecovered(page, draftPath, attempts);
    expect(attempts.uploads).toHaveLength(3);
    await expect(gallery.getByText('Portada', { exact: true })).toBeVisible();
    await expect(gallery.getByRole('img').first()).toHaveAttribute('src', product.images[0].thumbnail_url);
    await expect(gallery.getByRole('list', { name: 'Fotos listas para subir' })).toHaveCount(0);
    await page.reload();
    await expect(gallery.getByLabel('Agregar fotos')).toBeVisible();
    await expect(gallery.getByRole('button', { name: 'Reintentar carga' })).toHaveCount(0);
  });
}

test('cierra una carga sin originales y permite subir otras fotos sin Web Locks', async ({ page }, info) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'locks', { value: undefined });
    Object.defineProperties(crypto, { subtle: { value: undefined }, randomUUID: { value: undefined } });
  });
  await page.setViewportSize({ width: 320, height: 800 });
  await signIn(page);
  await page.getByRole('link', { name: 'Nuevo producto' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Carga cerrada sin originales');
  await page.getByRole('button', { name: 'Crear borrador' }).click();
  const gallery = page.getByRole('region', { name: 'Galería' });
  await expect(gallery).toBeVisible();
  const { uploads } = await uncertainUpload(page, false);
  await gallery.getByLabel('Agregar fotos').setInputFiles([photo('image-pocket')]);
  await gallery.getByRole('button', { name: 'Subir fotos' }).click();
  await expect(gallery.getByRole('alert')).toContainText('confirmar');
  await page.reload();
  const close = gallery.getByRole('button', { name: 'Cerrar carga pendiente' });
  await close.focus();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.screenshot({ path: info.outputPath('close-gallery-320.png') });
  await close.press('Enter');
  await expect(gallery.getByRole('status').filter({ hasText: 'Recuperación terminada' })).toBeVisible();
  await gallery.getByLabel('Agregar fotos').setInputFiles([photo('detail-photo')]);
  await gallery.getByRole('button', { name: 'Subir fotos' }).click();
  await expect(gallery.getByRole('status').filter({ hasText: 'Fotos agregadas' })).toBeVisible();
  expect(new Set(uploads).size).toBe(2);
});

test('conserva las fotos y la portada cuando otra pestaña cambia la galería', async ({ page, context }) => {
  await signIn(page);
  await page.getByRole('link', { name: 'Nuevo producto' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Galería concurrente de prueba');
  await page.getByRole('button', { name: 'Crear borrador' }).click();
  await expect(page.getByRole('heading', { name: 'Galería concurrente de prueba' })).toBeVisible();
  const draftUrl = page.url();
  const draftPath = `/api/v1/admin/products/${draftUrl.split('/').at(-1)}`;
  await page.getByLabel('Agregar fotos').setInputFiles([photo('image-plain'), photo('detail-photo')]);
  const seed = page.waitForResponse((response) => response.url().endsWith(`${draftPath}/images/uploads`));
  await page.getByRole('button', { name: 'Subir fotos' }).click();
  const initial = await seed;
  expect(initial.status()).toBe(201);
  const original = (await initial.json()).data.images;
  const stale = await context.newPage();
  await stale.goto(draftUrl);
  await stale.getByRole('button', { name: 'Usar foto 2 como portada' }).click();
  await page.getByLabel('Agregar fotos').setInputFiles(photo('image-pocket'));

  const reorderQueued = stale.waitForRequest((request) => request.url().endsWith(`${draftPath}/images/order`));
  const uploadDone = page.waitForResponse((response) => response.url().endsWith(`${draftPath}/images/uploads`));
  await page.route('**/api/v1/admin/products/*/images/uploads', async (route) => {
    await reorderQueued;
    await route.continue();
  }, { times: 1 });
  await stale.route('**/api/v1/admin/products/*/images/order', async (route) => {
    await uploadDone;
    await route.continue();
  }, { times: 1 });
  const staleDone = stale.waitForResponse((response) => response.url().endsWith(`${draftPath}/images/order`));
  await Promise.all([
    page.getByRole('button', { name: 'Subir fotos' }).click(),
    stale.getByRole('button', { name: 'Guardar orden' }).click(),
  ]);
  const upload = await uploadDone;
  expect(upload.status()).toBe(201);
  const appended = (await upload.json()).data.images;
  expect(appended).toHaveLength(3);
  expect(appended.slice(0, 2)).toEqual(original);
  expect((await staleDone).status()).toBe(422);
  await expect(stale.getByRole('alert')).toContainText('Cambió el conjunto de fotos');
  await stale.getByRole('button', { name: 'Actualizar galería' }).click();
  const gallery = stale.getByRole('region', { name: 'Galería' });
  await expect(gallery.getByRole('img')).toHaveCount(3);
  await expect(gallery.getByRole('img').first()).toHaveAttribute('src', original[0].thumbnail_url);
  await gallery.getByRole('button', { name: 'Usar foto 2 como portada' }).click();
  await gallery.getByRole('button', { name: 'Guardar orden' }).click();
  await expect(gallery.getByText('Orden y portada guardados.')).toBeVisible();
  const detail = await page.request.get(draftPath, { headers: { Referer: page.url() } });
  expect(detail.status()).toBe(200);
  expect((await detail.json()).data.images).toEqual([appended[1], appended[0], appended[2]]);
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

test('crea, asigna, edita y desactiva una marca opcional', async ({ page }) => {
  await signIn(page);
  await page.goto('/productos/clasificaciones');
  const brands = page.getByRole('region', { name: 'Marcas' });
  await brands.getByRole('button', { name: 'Nueva marca' }).click();
  await brands.getByLabel('Nombre de la marca').fill('Sello de prueba');
  await brands.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Se guardó «Sello de prueba».');

  await page.goto('/productos/nuevo');
  await page.getByLabel('Nombre', { exact: true }).fill('Prenda con marca de prueba');
  const brand = page.getByRole('combobox', { name: 'Marca (opcional)' });
  await brand.selectOption({ label: 'Sello de prueba' });
  await page.getByRole('button', { name: 'Crear borrador' }).click();
  await expect(page.getByRole('heading', { name: 'Prenda con marca de prueba' })).toBeVisible();
  const draftUrl = page.url();

  await page.goto('/productos/clasificaciones');
  await brands.getByRole('button', { name: 'Editar Sello de prueba' }).click();
  await brands.getByLabel('Editar nombre').fill('Sello de prueba renovado');
  await brands.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Se guardó «Sello de prueba renovado».');
  await page.goto(draftUrl);
  await expect(brand.locator('option:checked')).toHaveText('Sello de prueba renovado');
  await brand.selectOption({ label: 'Sin marca' });
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Cambios guardados.')).toBeVisible();
  await page.reload();
  await expect(brand.locator('option:checked')).toHaveText('Sin marca');

  await page.goto('/productos/clasificaciones');
  await brands.getByRole('button', { name: 'Desactivar Sello de prueba renovado' }).click();
  await expect(brands.getByRole('button', { name: 'Activar Sello de prueba renovado' })).toBeVisible();
});
