import { expect, type Browser } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const photo = {
  name: 'image-cotton.webp',
  mimeType: 'image/webp',
  buffer: readFileSync(resolve(__dirname, '../../projects/admin/public/demo/image-cotton.webp')),
};

type Classification = { id: number; slug: string };
type Product = { id: number; slug: string; name: string; price_cents: number; stock: number };

export async function fixtureCatalog(browser: Browser, baseURL: string) {
  if (new URL(baseURL).hostname !== '127.0.0.1')
    throw new Error('Use the isolated browser fixture.');
  const context = await browser.newContext({
    baseURL,
    extraHTTPHeaders: { Accept: 'application/json', Origin: baseURL },
  });
  const { request } = context;
  const headers = async () => {
    const token = (await context.cookies(baseURL)).find(({ name }) => name === 'CAMBA-ADMIN-XSRF-TOKEN');
    expect(token, 'Laravel CSRF cookie').toBeDefined();
    return { 'X-XSRF-TOKEN': decodeURIComponent(token!.value) };
  };
  const products = '/api/v1/admin/products';
  const published: number[] = [];
  try {
    await expect(await request.get('/api/v1/admin/auth/csrf-cookie')).toBeOK();
    await expect(
      await request.post('/api/v1/admin/auth/login', {
        data: { email: 'a11y-admin@camba.test', password: 'Camba-test-only-2026' },
        headers: await headers(),
      }),
    ).toBeOK();
  } catch (error) {
    await context.close();
    throw error;
  }

  return {
    async classification(path: 'categories' | 'brands', slug: string) {
      const response = await request.get(`/api/v1/${path}`);
      await expect(response).toBeOK();
      const { data }: { data: Classification[] } = await response.json();
      const row = data.find((item) => item.slug === slug);
      expect(row, `Fixture classification ${slug}`).toBeDefined();
      return row!.id;
    },
    async publish(
      data: Pick<Product, 'name' | 'price_cents' | 'stock'> & {
        category_id: number;
        brand_id?: number;
      },
    ) {
      const csrf = await headers();
      const created = await request.post(products, { data, headers: csrf });
      expect(created.status(), 'Create fixture product').toBe(201);
      const { data: product }: { data: Product } = await created.json();
      const path = `${products}/${product.id}`;
      await expect(
        await request.post(`${path}/images`, {
          multipart: { 'photos[]': photo },
          headers: csrf,
        }),
      ).toBeOK();
      await expect(await request.post(`${path}/publish`, { headers: csrf })).toBeOK();
      published.push(product.id);
      return product;
    },
    async adjust(id: number, data: Pick<Product, 'price_cents' | 'stock'>) {
      const response = await request.patch(`${products}/${id}`, { data, headers: await headers() });
      await expect(response).toBeOK();
      expect((await response.json()).data).toMatchObject(data);
    },
    async close() {
      try {
        const csrf = await headers();
        for (const id of published) {
          await expect(await request.post(`${products}/${id}/archive`, { headers: csrf })).toBeOK();
        }
      } finally {
        await context.close();
      }
    },
  };
}
