import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { usePhotoCrops } from './fixtures/use-photo-crops';

const uploadPath = /\/api\/v1\/admin\/products\/\d+\/images\/uploads$/;
const closePath = /\/api\/v1\/admin\/products\/\d+\/images\/uploads\/close$/;
const photo = (name: string) => resolve(__dirname, `../projects/admin/public/demo/${name}.webp`);

async function signIn(page: Page) {
  await page.goto('/productos');
  await page.getByLabel('Correo electrónico').fill('a11y-admin@camba.test');
  await page.getByLabel('Contraseña', { exact: true }).fill('Camba-test-only-2026');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page.getByRole('heading', { name: 'Productos', exact: true })).toBeVisible({ timeout: 25_000 });
}

async function useFallback(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'locks', { value: undefined });
    const open = indexedDB.open.bind(indexedDB);
    Object.defineProperty(indexedDB, 'open', { value: (name: string, version?: number) => {
      if (sessionStorage.getItem('fixture-block-upload-cleanup')) {
        throw new DOMException('Fixture denies IndexedDB', 'InvalidStateError');
      }
      return open(name, version);
    } });
  });
}

function persistedKey(page: Page, id: string) {
  return page.evaluate((id) => {
    const record = localStorage.getItem('camba:photo-upload:v1:' + id);
    return record ? JSON.parse(record).key as string : null;
  }, id);
}

async function uploadWithKey(page: Page, id: string, key: string, name: string) {
  const origin = new URL(page.url()).origin;
  const csrf = (await page.context().cookies(origin)).find((cookie) => cookie.name === 'CAMBA-ADMIN-XSRF-TOKEN');
  expect(csrf).toBeDefined();
  return page.request.post(`/api/v1/admin/products/${id}/images/uploads`, {
    headers: { Origin: origin, 'X-XSRF-TOKEN': decodeURIComponent(csrf!.value), 'Idempotency-Key': key },
    multipart: { 'photos[]': { name: `${name}.webp`, mimeType: 'image/webp', buffer: readFileSync(photo(name)) } },
  });
}

test('a full crop cache does not block a keyed upload or duplicate a replay', async ({ page }) => {
  test.setTimeout(85_000);
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) {
      if (this.transaction.db.name === 'camba-product-photo-crops') {
        throw new DOMException('Fixture crop quota exhausted', 'QuotaExceededError');
      }
      return put.apply(this, args);
    };
  });
  await signIn(page);
  await page.getByRole('link', { name: 'Nuevo producto' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Remera con recorte sin caché');
  await page.getByLabel('Precio (UYU)').fill('990');
  await page.getByLabel('Stock', { exact: true }).fill('2');
  await page.getByRole('combobox', { name: 'Categoría', exact: true }).selectOption({ label: 'Remeras' });
  await page.getByRole('button', { name: 'Crear borrador' }).click();
  const gallery = page.getByRole('region', { name: 'Galería' });
  const writes: Array<{ key: string | undefined; status: number }> = [];
  await page.route(uploadPath, async route => {
    const received = await route.fetch();
    writes.push({ key: route.request().headers()['idempotency-key'], status: received.status() });
    await route.fulfill({ status: 504, json: {} });
  }, { times: 1 });
  await gallery.getByLabel('Agregar fotos').setInputFiles(photo('image-pocket'));
  await usePhotoCrops(page);
  await gallery.getByRole('button', { name: 'Subir fotos' }).click();
  await expect(gallery.getByRole('alert')).toContainText('No pudimos confirmar la carga');
  const id = new URL(page.url()).pathname.split('/').at(-1)!;
  const key = await persistedKey(page, id);
  expect(key).toMatch(/^[a-f0-9-]{36}$/);
  expect(writes).toEqual([{ key, status: 201 }]);

  await page.reload();
  await expect(gallery.getByText('1 de 5 fotos', { exact: true })).toBeVisible();
  await gallery.getByLabel('Volver a elegir las fotos').setInputFiles(photo('image-pocket'));
  await usePhotoCrops(page);
  const replay = page.waitForResponse(response => uploadPath.test(response.url()) && response.request().method() === 'POST');
  await gallery.getByRole('button', { name: 'Reintentar carga' }).click();
  const response = await replay;
  expect(response.status()).toBe(201);
  expect(response.request().headers()['idempotency-key']).toBe(key);
  expect((await response.json()).data.images).toHaveLength(1);
  await expect.poll(() => persistedKey(page, id)).toBeNull();
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByText('Producto publicado.', { exact: true })).toBeVisible();
});

test('TV-001 distinguishes a real close 200 from failed browser cleanup', async ({ page, context }, info) => {
  test.setTimeout(85_000);
  const writes: (string | undefined)[] = [];
  context.on('request', (request) => {
    if (request.method() === 'POST' && (uploadPath.test(request.url()) || closePath.test(request.url()))) {
      writes.push(request.headers()['idempotency-key']);
    }
  });
  await useFallback(page);
  await page.setViewportSize({ width: 320, height: 800 });
  await signIn(page);
  await page.getByRole('link', { name: 'Nuevo producto' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('TV-001 carga incierta');
  await page.getByRole('button', { name: 'Crear borrador' }).click();
  const gallery = page.getByRole('region', { name: 'Galería' });
  await page.route(uploadPath, (request) => request.fulfill({ status: 504, json: {} }), { times: 1 });
  await gallery.getByLabel('Agregar fotos').setInputFiles(photo('image-pocket'));
  await usePhotoCrops(page);
  await gallery.getByRole('button', { name: 'Subir fotos' }).click();
  await expect(gallery.getByRole('alert')).toContainText('confirmar');
  const id = new URL(page.url()).pathname.split('/').at(-1)!;
  const key = await persistedKey(page, id);
  expect(key).toMatch(/^[a-f0-9-]{36}$/);
  await page.reload();
  await page.evaluate(() => sessionStorage.setItem('fixture-block-upload-cleanup', '1'));
  const closed = page.waitForResponse((response) => closePath.test(response.url()) && response.request().method() === 'POST');
  await gallery.getByRole('button', { name: 'Cerrar carga pendiente' }).press('Enter');
  const response = await closed;
  expect(response.status()).toBe(200);
  expect(response.request().headers()['idempotency-key']).toBe(key);
  const pending = gallery.getByRole('status').filter({ hasText: 'El servidor confirmó el cierre' });
  await expect(pending).toBeVisible();
  await expect(gallery.getByRole('status').filter({ hasText: 'Recuperación terminada' })).toHaveCount(0);
  await expect(gallery.locator('input[type="file"]')).toHaveCount(0);
  await expect(gallery.getByRole('button', { name: 'Reintentar carga', exact: true })).toHaveCount(0);
  const recover = gallery.getByRole('button', { name: 'Reintentar recuperación' });
  await expect(recover).toBeVisible();
  expect(await persistedKey(page, id)).toBe(key);
  await recover.focus();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await page.screenshot({ path: info.outputPath('tv001-local-pending-320.png') });

  await page.reload();
  await expect(pending).toBeVisible();
  const other = await context.newPage();
  await useFallback(other);
  await other.goto(page.url());
  const otherGallery = other.getByRole('region', { name: 'Galería' });
  await expect(otherGallery.getByRole('status').filter({ hasText: 'El servidor confirmó el cierre' })).toBeVisible();
  const otherRecover = otherGallery.getByRole('button', { name: 'Reintentar recuperación' });
  await otherRecover.focus();
  await other.screenshot({ path: info.outputPath('tv001-local-pending-desktop.png') });
  const productPath = `/api/v1/admin/products/${id}`;
  await other.route(`**${productPath}`, (route) => route.fulfill({ status: 504, json: {} }), { times: 1 });
  const failedRefresh = other.waitForResponse((response) => response.request().method() === 'GET' && response.url().endsWith(productPath));
  await otherRecover.press('Enter');
  expect((await failedRefresh).status()).toBe(504);
  expect(await persistedKey(other, id)).toBe(key);
  await expect(otherGallery.getByRole('status').filter({ hasText: 'El servidor confirmó el cierre' })).toBeVisible();
  await expect(otherGallery.getByRole('status').filter({ hasText: 'Recuperación terminada' })).toHaveCount(0);
  await expect(otherRecover).toBeEnabled();
  await otherRecover.press('Enter');
  await expect(otherGallery.getByRole('status').filter({ hasText: 'Recuperación terminada' })).toBeVisible();
  expect(await persistedKey(other, id)).toBeNull();
  expect(writes).toEqual([key, key]);

  await other.route(uploadPath, (request) => request.fulfill({ status: 504, json: {} }), { times: 1 });
  await otherGallery.getByLabel('Agregar fotos').setInputFiles(photo('detail-photo'));
  await usePhotoCrops(other);
  await otherGallery.getByRole('button', { name: 'Subir fotos' }).click();
  await expect(otherGallery.getByRole('alert')).toContainText('confirmar');
  const newer = await persistedKey(other, id);
  expect(newer).toMatch(/^[a-f0-9-]{36}$/);
  expect(newer).not.toBe(key);

  await page.evaluate(() => sessionStorage.removeItem('fixture-block-upload-cleanup'));
  await recover.press('Enter');
  await expect(gallery.getByRole('status').filter({ hasText: 'Hay otra carga pendiente' })).toBeVisible();
  expect(await persistedKey(page, id)).toBe(newer);
  expect(writes).toEqual([key, key, newer]);

  const late = await uploadWithKey(other, id, key!, 'image-pocket');
  expect(late.status()).toBe(409);
  await otherGallery.getByRole('button', { name: 'Reintentar carga' }).click();
  await expect(otherGallery.getByRole('status').filter({ hasText: 'Fotos agregadas' })).toBeVisible();
  expect(await persistedKey(other, id)).toBeNull();
  const product = await other.request.get(`/api/v1/admin/products/${id}`, { headers: { Referer: other.url() } });
  expect(product.ok()).toBe(true);
  expect((await product.json()).data.images).toHaveLength(1);
});

test('grouped recovery distinguishes an unconfirmed close and keeps the original cover', async ({ page }) => {
  test.setTimeout(75_000);
  await useFallback(page);
  await signIn(page);
  await page.goto('/productos/carga-por-fotos');
  const name = 'TV-001 grupo con portada';
  await page.getByLabel('Nombre', { exact: true }).fill(name);
  const group = page.getByRole('group', { name });
  await group.getByLabel('Precio (UYU)').fill('750,00');
  await group.getByRole('combobox', { name: 'Categoría', exact: true }).selectOption({ label: 'Remeras' });
  await group.getByLabel('Fotos de este producto').setInputFiles(photo('image-pocket'));
  await page.route(uploadPath, (request) => request.fulfill({ status: 504, json: {} }), { times: 1 });
  const created = page.waitForResponse((response) => response.url().endsWith('/api/v1/admin/products') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Revisar borradores' }).click();
  await page.getByRole('button', { name: 'Confirmar y crear borradores' }).click();
  const draft = await created;
  expect(draft.status()).toBe(201);
  const id = String((await draft.json()).data.id);
  await expect(group.getByRole('alert')).toContainText('confirmar');
  const key = await persistedKey(page, id);
  expect(key).toMatch(/^[a-f0-9-]{36}$/);
  const committed = await uploadWithKey(page, id, key!, 'image-pocket');
  expect(committed.status()).toBe(201);
  const cover = (await committed.json()).data.images[0].id;

  await page.route(closePath, (request) => request.fulfill({ status: 504, json: {} }), { times: 1 });
  const close = group.getByRole('button', { name: 'Cerrar carga pendiente' });
  await close.press('Enter');
  await expect(group.getByRole('alert')).toContainText('Todavía no pudimos confirmar el cierre');
  expect(await persistedKey(page, id)).toBe(key);
  await page.evaluate(() => sessionStorage.setItem('fixture-block-upload-cleanup', '1'));
  const closed = page.waitForResponse((response) => closePath.test(response.url()) && response.request().method() === 'POST');
  await close.press('Enter');
  const response = await closed;
  expect(response.status()).toBe(200);
  expect(response.request().headers()['idempotency-key']).toBe(key);
  await expect(group.getByRole('status').filter({ hasText: 'El servidor confirmó el cierre' })).toBeVisible();
  await expect(group.getByText('Borrador preparado')).toHaveCount(0);
  expect(await persistedKey(page, id)).toBe(key);

  const writes: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST') writes.push(request.url());
  });
  await page.evaluate(() => sessionStorage.removeItem('fixture-block-upload-cleanup'));
  await group.getByRole('button', { name: 'Reintentar recuperación' }).press('Enter');
  await expect(group.getByRole('status').filter({ hasText: 'Recuperación terminada' })).toBeVisible();
  await expect(group.getByRole('link', { name: 'Revisar y publicar' })).toHaveAttribute('href', `/productos/${id}`);
  expect(await persistedKey(page, id)).toBeNull();
  expect(writes).toEqual([]);
  const product = await page.request.get(`/api/v1/admin/products/${id}`, { headers: { Referer: page.url() } });
  expect(product.ok()).toBe(true);
  expect((await product.json()).data.images.map((image: { id: number }) => image.id)).toEqual([cover]);
});

test('a retry already hashing in another tab cannot recreate a closed reservation', async ({ page, context }) => {
  await signIn(page);
  await page.getByRole('link', { name: 'Nuevo producto' }).click();
  await page.getByLabel('Nombre', { exact: true }).fill('Subida cerrada mientras se vuelve a comprobar');
  await page.getByRole('button', { name: 'Crear borrador' }).click();
  const gallery = page.getByRole('region', { name: 'Galería' });
  await page.route(uploadPath, (route) => route.fulfill({ status: 504, json: {} }), { times: 1 });
  await gallery.getByLabel('Agregar fotos').setInputFiles(photo('image-pocket'));
  await usePhotoCrops(page);
  await gallery.getByRole('button', { name: 'Subir fotos' }).click();
  await expect(gallery.getByRole('alert')).toContainText('confirmar');
  const id = new URL(page.url()).pathname.split('/').at(-1)!;

  const stale = await context.newPage();
  await stale.goto(page.url());
  const staleGallery = stale.getByRole('region', { name: 'Galería' });
  let posted = 0;
  stale.on('request', (request) => { if (request.method() === 'POST' && uploadPath.test(request.url())) posted++; });
  await stale.evaluate(() => {
    const digest = crypto.subtle.digest.bind(crypto.subtle);
    const barrier = new Promise<void>((release) => window.addEventListener('fixture-release-hash', () => release(), { once: true }));
    Object.defineProperty(crypto.subtle, 'digest', { value: async (...args: Parameters<SubtleCrypto['digest']>) => {
      document.documentElement.dataset.fixtureHashing = 'yes';
      await barrier;
      return digest(...args);
    } });
  });
  await staleGallery.getByRole('button', { name: 'Reintentar carga' }).click();
  await expect(stale.locator('html')).toHaveAttribute('data-fixture-hashing', 'yes');

  await gallery.getByRole('button', { name: 'Cerrar carga pendiente' }).click();
  await expect(gallery.getByRole('status').filter({ hasText: 'Recuperación terminada' })).toBeVisible();
  expect(await persistedKey(page, id)).toBeNull();
  await stale.evaluate(() => window.dispatchEvent(new Event('fixture-release-hash')));
  await expect(staleGallery.getByRole('button', { name: 'Reintentar recuperación' })).toBeVisible();
  expect(posted).toBe(0);
  expect(await persistedKey(stale, id)).toBeNull();
  await staleGallery.getByRole('button', { name: 'Reintentar recuperación' }).press('Enter');
  await expect(staleGallery.getByRole('status').filter({ hasText: 'Recuperación terminada' })).toBeVisible();
  expect(posted).toBe(0);
});
