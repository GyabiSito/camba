import { expect, test } from '@playwright/test';
import type { HomeDocument, HomeEditorState } from '../projects/shared/src/homepage';

const image = { key: 'hero', alt: 'Prendas en el atelier' };
const document: HomeDocument = {
  order: ['hero', 'categories', 'selection', 'look', 'story', 'mosaic'], hidden: [],
  hero: { desktop: image, mobile: null, title: 'Vestite distinto.', text: 'Camba', primary: { type: 'catalog', label: 'Ver catálogo' }, secondary: null },
  categories: { mode: 'manual', cards: [{ categoryId: 1, image, label: '' }] },
  selection: { title: 'Selección de Camba', action: null, mode: 'manual', categoryId: null, productIds: [1, 2] },
  look: { title: 'Armá el look', text: '', image, mode: 'manual', productIds: [1] },
  story: { title: 'Texturas y detalles', text: '', image, details: [image, image], action: null },
  mosaic: { image, action: null, tiles: Array.from({ length: 6 }, () => ({ image: { ...image }, action: null })) },
};

test('edits a saved draft, preserves failures and prevents stale publication on mobile', async ({ page }, testInfo) => {
  let state: HomeEditorState = { revision: 1, published_version: 1, published: document, draft: null, assets: { hero: { url: '/demo-home/atelier-hero-wide.webp', thumbnail_url: '/demo-home/atelier-hero-wide.webp', width: 1600, height: 900 } }, store_url: 'http://127.0.0.1:4200' };
  let failSave = false;
  let publishes = 0;
  await page.route('**/sanctum/csrf-cookie', route => route.fulfill({ status: 204 }));
  await page.route('**/api/v1/admin/session', route => route.fulfill({ json: { data: { name: 'Admin', email: 'admin@camba.test' } } }));
  await page.route('**/api/v1/admin/categories', route => route.fulfill({ json: { data: [{ id: 1, slug: 'ropa', name: 'Ropa', active: true }] } }));
  await page.route('**/api/v1/admin/products?*', route => route.fulfill({ json: { data: [1, 2].map(id => ({ id, name: `Prenda ${id}`, sku: `P${id}`, slug: `prenda-${id}`, price_cents: 45000, stock: 2, category: { id: 1, name: 'Ropa' }, status: 'published', images: [] })), meta: { current_page: 1, last_page: 1, total: 2 } } }));
  await page.route('**/api/v1/admin/homepage**', async route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { data: state } });
    if (route.request().url().endsWith('/media')) {
      const asset = state.assets['hero']; state.assets['uploaded'] = asset;
      return route.fulfill({ json: { data: { key: 'uploaded', asset } } });
    }
    if (route.request().url().endsWith('/publish')) { publishes++; return route.fulfill({ status: 409, json: { message: 'Stale' } }); }
    if (failSave) return route.fulfill({ status: 503, json: { message: 'Unavailable' } });
    state = { ...state, revision: state.revision + 1, draft: route.request().postDataJSON().document };
    return route.fulfill({ json: { data: state } });
  });
  await page.goto('/portada');
  await expect(page.getByRole('heading', { name: 'Portada', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Editar Categorías', exact: true }).click();
  await page.getByRole('button', { name: 'Quitar Ropa', exact: true }).click();
  await page.getByRole('button', { name: 'Agregar categoría Ropa', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Agregar categoría Ropa' })).toBeDisabled();
  await page.getByRole('button', { name: 'Editar Selección de Camba', exact: true }).click();
  await page.getByRole('button', { name: 'Subir Prenda 2 en selección', exact: true }).click();
  await page.getByRole('button', { name: 'Editar Hero', exact: true }).click();
  const photo = page.getByRole('group', { name: 'Imagen de escritorio', exact: true });
  await photo.getByText('Elegir otra foto', { exact: true }).click();
  await photo.getByLabel('Subir foto · JPEG, PNG o WebP').setInputFiles({ name: 'invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('not a photo') });
  await expect(photo.getByRole('alert')).toContainText('hasta 10 MiB');
  await photo.getByLabel('Subir foto · JPEG, PNG o WebP').setInputFiles({ name: 'valid.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64') });
  await expect(photo.getByRole('button', { name: 'Elegir foto uploaded', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Título del hero', { exact: true }).fill('Nueva portada');
  await page.screenshot({ path: testInfo.outputPath('editor-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Editar Mosaico final', exact: true }).click();
  await page.getByText('Casilla 2', { exact: true }).click();
  const tile = page.getByRole('group', { name: 'Foto de casilla 2', exact: true });
  await tile.getByText('Elegir otra foto', { exact: true }).click();
  await tile.getByRole('button', { name: 'Elegir foto uploaded', exact: true }).click();
  await tile.getByLabel('Descripción de la foto').fill('Textura nueva');
  await page.getByRole('button', { name: 'Editar Hero', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Publicar', exact: true })).toBeDisabled();
  await expect(page.getByText('Guardá el borrador para abrir la vista previa.')).toBeVisible();
  failSave = true;
  await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Título del hero', { exact: true })).toHaveValue('Nueva portada');
  failSave = false;
  await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Vista previa', exact: true })).toHaveAttribute('href', 'http://127.0.0.1:4200/portada/vista-previa');
  expect(state.draft?.selection.productIds).toEqual([2, 1]);
  expect(state.draft?.hero.desktop?.key).toBe('uploaded');
  expect(state.draft?.mosaic.tiles[1].image).toMatchObject({ key: 'uploaded', alt: 'Textura nueva' });
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Otra sesión');
  expect(publishes).toBe(1);
  await page.setViewportSize({ width: 320, height: 800 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await expect(page.getByLabel('Título del hero', { exact: true })).toHaveValue('Nueva portada');
  await page.getByLabel('Título del hero', { exact: true }).fill('Portada todavía en edición');
  await expect(page.getByRole('alert')).toContainText('Otra sesión');
  await expect(page.getByRole('button', { name: 'Guardar borrador', exact: true })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('editor-mobile.png'), fullPage: true });
});
