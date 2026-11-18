import { DOCUMENT, effect, inject, InjectionToken, REQUEST, RESPONSE_INIT } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ParamMap, Params, ResolveFn } from '@angular/router';
import { ApiClient } from '@camba/shared';
import { catchError, forkJoin, map, of } from 'rxjs';

export interface Classification {
  id: number;
  name: string;
  slug: string;
}

export interface ProductImage {
  id: number;
  url: string;
  thumbnail_url: string;
  alt: string;
}

export interface Product {
  id: number;
  sku: string;
  slug: string;
  name: string;
  description: string | null;
  price_cents: number;
  stock: number;
  in_stock: boolean;
  category: Classification;
  brand: Classification | null;
  images: ProductImage[];
}

export const productSorts = {
  newest: 'Más recientes',
  name: 'Nombre de A a Z',
  price_asc: 'Menor precio',
  price_desc: 'Mayor precio',
};

type Sort = keyof typeof productSorts;

export interface CatalogQuery {
  q: string;
  category: string;
  brand: string;
  sort: Sort;
  page: number;
}

export type PageResult<T> =
  { kind: 'ready'; data: T } | { kind: 'missing' } | { kind: 'unavailable' };

interface Collection<T> {
  data: T[];
}

interface ProductPage extends Collection<Product> {
  meta: { current_page: number; last_page: number; total: number };
}

export interface CatalogData {
  products: ProductPage;
  categories: Classification[];
  brands: Classification[];
}

export function readCatalogQuery(params: ParamMap): CatalogQuery {
  const slug = (key: string) => {
    const value = params.get(key) ?? '';
    return /^[a-z0-9-]{1,160}$/.test(value) ? value : '';
  };
  const sort = params.get('sort') ?? '';
  const rawPage = params.get('page') ?? '';
  const page = /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  return {
    q: (params.get('q') ?? '').trim().slice(0, 120),
    category: slug('category'),
    brand: slug('brand'),
    sort: Object.hasOwn(productSorts, sort) ? (sort as Sort) : 'newest',
    page: page > 0 && page <= 2147483647 ? page : 1,
  };
}

export function catalogParams(query: CatalogQuery, page = query.page): Params {
  return {
    ...(query.q && { q: query.q }),
    ...(query.category && { category: query.category }),
    ...(query.brand && { brand: query.brand }),
    ...(query.sort !== 'newest' && { sort: query.sort }),
    ...(page > 1 && { page }),
  };
}

function markStatus(response: ResponseInit | null, status: number): void {
  if (!response) return;
  response.status = status;
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  response.headers = headers;
}

export const resolveHome: ResolveFn<PageResult<Product[]>> = () => {
  const response = inject(RESPONSE_INIT, { optional: true });
  return inject(ApiClient)
    .publicGet<ProductPage>('/api/v1/products', { per_page: 5 })
    .pipe(
      map(({ data }) => ({ kind: 'ready', data }) as const),
      catchError(() => {
        markStatus(response, 503);
        return of({ kind: 'unavailable' } as const);
      }),
    );
};

export const resolveCatalog: ResolveFn<PageResult<CatalogData>> = (route) => {
  const response = inject(RESPONSE_INIT, { optional: true });
  const api = inject(ApiClient);
  return forkJoin({
    products: api.publicGet<ProductPage>('/api/v1/products', {
      ...catalogParams(readCatalogQuery(route.queryParamMap)),
      per_page: 12,
    }),
    categories: api.publicGet<Collection<Classification>>('/api/v1/categories'),
    brands: api.publicGet<Collection<Classification>>('/api/v1/brands'),
  }).pipe(
    map(
      ({ products, categories, brands }) =>
        ({
          kind: 'ready',
          data: { products, categories: categories.data, brands: brands.data },
        }) as const,
    ),
    catchError(() => {
      markStatus(response, 503);
      return of({ kind: 'unavailable' } as const);
    }),
  );
};

export const resolveProduct: ResolveFn<PageResult<Product>> = (route) => {
  const response = inject(RESPONSE_INIT, { optional: true });
  const slug = route.paramMap.get('slug') ?? '';
  if (!/^[A-Za-z0-9-]{1,160}$/.test(slug)) {
    markStatus(response, 404);
    return { kind: 'missing' };
  }
  return inject(ApiClient)
    .publicGet<{ data: Product }>(`/api/v1/products/${slug}`)
    .pipe(
      map(({ data }) => ({ kind: 'ready', data }) as const),
      catchError((error: { status?: number }) => {
        if (error?.status === 404) {
          markStatus(response, 404);
          return of({ kind: 'missing' } as const);
        }
        markStatus(response, 503);
        return of({ kind: 'unavailable' } as const);
      }),
    );
};

export const resolveMissing: ResolveFn<null> = () => {
  markStatus(inject(RESPONSE_INIT, { optional: true }), 404);
  return null;
};

export const STORE_CANONICAL_ORIGIN = new InjectionToken<string>('Public storefront origin');

export function useStoreMeta(
  read: () => { title: string; description: string; canonical?: string; noindex?: boolean },
) {
  const title = inject(Title);
  const meta = inject(Meta);
  const document = inject(DOCUMENT);
  const origin =
    inject(STORE_CANONICAL_ORIGIN, { optional: true }) ||
    inject(REQUEST, { optional: true })?.url ||
    document.location?.origin;
  let canonical: HTMLLinkElement | null = null;
  effect((onCleanup) => {
    const state = read();
    title.setTitle(`${state.title} | Camba`);
    meta.updateTag({ name: 'description', content: state.description });
    if (state.noindex) meta.updateTag({ name: 'robots', content: 'noindex' });
    if (state.canonical) {
      canonical =
        document.head.querySelector('link[rel="canonical"]') ?? document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      canonical.setAttribute(
        'href',
        origin && /^https?:\/\//.test(origin)
          ? new URL(state.canonical, origin).href
          : state.canonical,
      );
      if (!canonical.parentNode) document.head.appendChild(canonical);
    }
    onCleanup(() => {
      if (canonical?.parentNode) canonical.parentNode.removeChild(canonical);
      meta.removeTag('name="description"');
      if (state.noindex) meta.removeTag('name="robots"');
    });
  });
}
