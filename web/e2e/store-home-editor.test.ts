import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { homeCategoryCards, homeCrop, homeHref, homeImage, homeSectionExists, homeSrcset, legacyHomeDocument, publicationHome } from '../projects/store/src/app/catalog/home-config.ts';
import type { HomePublication } from '../projects/shared/src/homepage.ts';
import type { Product } from '../projects/store/src/app/catalog/catalog-data.ts';

const product = (id: number, categoryId = 1): Product => ({ id, sku: 'SKU-' + id, slug: 'item-' + id, name: 'Item ' + id,
  description: null, price_cents: 12345 + id, stock: 2, in_stock: true,
  category: { id: categoryId, name: 'Category ' + categoryId, slug: 'category-' + categoryId }, brand: null,
  images: [{ id, url: '/photo.webp', thumbnail_url: '/thumb.webp', alt: 'Item' }] });
const products = [product(1), product(2), product(3, 2)];
const fallback = { categories: [products[0], products[2]], selection: products, look: [products[0]] };
const published = (): HomePublication<Product> => ({ document: legacyHomeDocument(fallback), version: 1, assets: {},
  categories: products.filter(item => item.id !== 2).map(item => item.category), products });

test('draft preview belongs only to Admin; Store wildcard retains server-side 404 resolution', () => {
  const routes = readFileSync(new URL('../projects/store/src/app/catalog/routes.ts', import.meta.url), 'utf8');
  const server = readFileSync(new URL('../projects/store/src/app/app.routes.server.ts', import.meta.url), 'utf8');
  const resolvers = readFileSync(new URL('../projects/store/src/app/catalog/catalog-data.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(routes + server, /portada\/vista-previa/);
  assert.doesNotMatch(resolvers, /admin\/homepage\/preview|resolveHomePreview/);
  assert.match(routes, /path: '\*\*'.*resolveMissing/);
  assert.match(resolvers, /markStatus\(inject\(RESPONSE_INIT.*404/);
  assert.match(resolvers, /api\.publicGet<[^\n]+\('\/api\/v1\/homepage'\)/);
});

test('Admin preview loads private data locally and uses the existing renderer inside a real viewport', () => {
  const read = (name: string) => readFileSync(new URL('../projects/admin/src/app/homepage/preview/' + name, import.meta.url), 'utf8');
  const routes = read('routes.ts');
  const canvas = read('homepage-preview-canvas.ts');
  const wrapper = read('homepage-preview.ts');
  assert.match(routes, /api\.get<[^\n]+\('\/api\/v1\/admin\/homepage\/preview'\)/);
  assert.match(routes, /api\.get<[^\n]+\('\/api\/v1\/admin\/homepage'\)/);
  assert.doesNotMatch(routes, /publicGet|TransferState/);
  assert.match(canvas, /import \{ StoreHome \}/);
  assert.match(canvas, /<store-home/);
  assert.match(canvas, /stopImmediatePropagation\(\)/);
  assert.match(wrapper, /src="\/portada\/vista-previa\/lienzo"/);
  assert.match(wrapper, /iframe\.mobile \{ inline-size: min\(390px, 100%\)/);
  assert.match(wrapper, /aria-pressed/);
});

test('manual cards and products retain declared order, omit unpublished references, keep live prices and stock', () => {
  const publication = published();
  publication.document.categories = { mode: 'manual', cards: [
    { categoryId: 2, image: null, label: 'Custom' }, { categoryId: 999, image: null, label: '' }, { categoryId: 1, image: null, label: '' },
  ] };
  publication.document.selection.mode = 'manual';
  publication.document.selection.productIds = [3, 999, 1, 2];
  publication.document.look.mode = 'manual';
  publication.document.look.productIds = [2, 999, 1];
  const home = publicationHome(publication, fallback);
  assert.deepEqual(home.selection.map(item => item.id), [3, 1, 2]);
  assert.equal(home.selection[0], products[2]);
  assert.equal(home.selection[0].price_cents, 12348);
  assert.equal(home.selection[0].in_stock, true);
  assert.deepEqual(home.look.map(item => item.id), [2, 1]);
  assert.deepEqual(homeCategoryCards(home, publication.document).map(card => [card.category.id, card.label]), [[2, 'Custom'], [1, 'Category 1']]);
});

test('automatic defaults keep old grouping; an explicit category selects only its live products', () => {
  const publication = published();
  assert.deepEqual(publicationHome(publication, fallback).selection, fallback.selection);
  assert.deepEqual(publicationHome(publication, fallback).look, fallback.look);
  publication.document.selection.categoryId = 2;
  assert.deepEqual(publicationHome(publication, fallback).selection, [products[2]]);
});

test('links resolve from current catalog and hidden or missing references have no action', () => {
  const publication = published();
  const document = publication.document;
  assert.equal(homeHref({ type: 'product', id: 2, label: 'Product' }, publication, document), '/producto/item-2');
  assert.equal(homeHref({ type: 'category', id: 2, label: 'Category' }, publication, document), '/tienda?category=category-2');
  assert.equal(homeHref({ type: 'product', id: 999, label: 'Gone' }, publication, document), undefined);
  assert.equal(homeHref({ type: 'category', id: 999, label: 'Gone' }, publication, document), undefined);
  assert.equal(homeHref({ type: 'section', section: 'look', label: 'Look' }, publication, document), '#look-title');
  document.hidden.push('look');
  assert.equal(homeHref({ type: 'section', section: 'look', label: 'Look' }, publication, document), undefined);
  document.categories = { mode: 'manual', cards: [] };
  const home = publicationHome(publication, fallback);
  assert.equal(homeHref({ type: 'section', section: 'categories', label: 'Categories' }, publication, document,
    block => homeSectionExists(block, document, home, true)), undefined);
});

test('uploads always render, builtins require opt-in, and null crops retain CSS defaults', () => {
  const upload = { url: '/storage/home/full.webp', thumbnail_url: '/storage/home/thumb.webp', width: 1600, height: 900 };
  assert.equal(homeImage({ key: 'media:1', alt: 'Upload' }, { 'media:1': upload }, false), upload);
  assert.equal(homeImage({ key: 'hero-wide', alt: '' }, {}, false), undefined);
  assert.equal(homeImage({ key: 'unknown', alt: '' }, {}, true), undefined);
  assert.equal(homeImage({ key: '__proto__', alt: '' }, {}, true), undefined);
  assert.equal(homeImage({ key: 'hero-wide', alt: '' }, {}, true)?.width, 1800);
  assert.equal(homeImage({ key: 'media:1', alt: 'Upload' }, { 'media:1': upload }, false, 'http://localhost:4200'), upload);
  assert.equal(homeSrcset(homeImage({ key: 'hero-mobile', alt: '' }, {}, true, 'http://localhost:4200')!),
    'http://localhost:4200/demo-home/atelier-hero-mobile-small.webp 480w, http://localhost:4200/demo-home/atelier-hero-mobile.webp 800w');
  assert.equal(homeSrcset(homeImage({ key: 'hero-mobile', alt: '' }, {}, true)!), '/demo-home/atelier-hero-mobile-small.webp 480w, /demo-home/atelier-hero-mobile.webp 800w');
  assert.equal(homeCrop({ key: 'hero-wide', alt: '', x: null, y: null }), null);
  assert.equal(homeCrop({ key: 'media:1', alt: '', x: 18, y: 75 }), '18% 75%');
  assert.equal(homeCrop({ key: 'media:1', alt: '', x: 0 }), '0% 50%');
  assert.equal(legacyHomeDocument(fallback).mosaic.tiles.length, 6);
});
