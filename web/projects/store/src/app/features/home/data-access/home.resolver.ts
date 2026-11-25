import { inject, makeStateKey, RESPONSE_INIT, TransferState } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { ApiClient, HomePublication, StoreProduct } from '@camba/shared';
import { catchError, map, of, switchMap, tap, timeout } from 'rxjs';
import { CatalogCovers } from '../../../shared/catalog-covers';
import { PageResult } from '../../../shared/page-result';
import { editorialEnabled } from '../editorial-config';
import { publicationHome } from '../home-config';
import { HomeData } from '../home.model';

const lookCovers = new Map([
  ['camisa-liviana-blanca', 'image-cotton.webp'],
  ['pantalon-pinzas-arena', 'image-straight.webp'],
]);

function hasLookCover(product: StoreProduct, image: string): boolean {
  const cover = product.images[0]?.url;
  if (!cover) return false;
  try {
    const path = new URL(cover, 'https://assets.invalid').pathname;
    return path === '/demo/' + image || path === '/storage/demo/' + image;
  } catch {
    return false;
  }
}

export function homeSelection(products: StoreProduct[], editorial = editorialEnabled): HomeData {
  const groups = new Map<string, StoreProduct[]>();
  for (const product of products) {
    const group = groups.get(product.category.slug);
    if (group) group.push(product);
    else groups.set(product.category.slug, [product]);
  }
  // ponytail: rank categories within the public sample, not by unverified popularity.
  const ordered = [...groups.values()].sort((a, b) => b.length - a.length ||
    a[0].category.id - b[0].category.id);
  const preferred = editorial
    ? ['remeras', 'camisas', 'pantalones'].map(slug => groups.get(slug)).filter(group => group !== undefined)
    : [];
  const categories = [...new Set([...preferred, ...ordered])].slice(0, 3).map(group =>
    group.find(product => product.in_stock && product.images.length) ??
    group.find(product => product.images.length) ?? group[0]);
  const orderedProducts = [...new Set([...ordered.map(group => group[0]), ...products])];
  const covers = new Set<string>();
  const distinct = orderedProducts.filter(product => {
    const photo = product.images[0]?.url;
    if (!photo) return true;
    if (covers.has(photo)) return false;
    covers.add(photo);
    return true;
  });
  const selection = (distinct.length >= 4 ? distinct : orderedProducts).slice(0, 8);
  const look = editorial ? [...lookCovers].flatMap(([slug, cover]) => {
    const product = products.find(item => item.slug === slug && hasLookCover(item, cover));
    return product ? [product] : [];
  }) : [];
  return { categories, selection, look };
}

function markUnavailable(response: ResponseInit | null): void {
  if (!response) return;
  response.status = 503;
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  response.headers = headers;
}

function resolveLegacyHome() {
  const response = inject(RESPONSE_INIT, { optional: true });
  const api = inject(ApiClient);
  const state = inject(TransferState);
  const covers = inject(CatalogCovers);
  const skippedEditorial = makeStateKey<boolean>('home:editorial-unavailable');
  return api.publicGet<{ data: StoreProduct[]; meta: { current_page: number; last_page: number; total: number } }>('/api/v1/products', { per_page: 12 })
    .pipe(
      tap(({ data }) => covers.remember(data)),
      switchMap(({ data }) => {
        const home = homeSelection(data);
        const candidate = home.categories[0];
        if (state.get(skippedEditorial, false)) {
          state.remove(skippedEditorial);
          return of(home);
        }
        if (!candidate?.in_stock || !candidate.images.length ||
            !/^[a-z0-9-]{1,160}$/i.test(candidate.slug)) return of(home);
        // The list exposes only the cover. Check one SKU; never block the shop on its optional gallery.
        return api.publicGet<{ data: StoreProduct }>(`/api/v1/products/${candidate.slug}`).pipe(
          timeout(500),
          map(({ data: editorial }) => editorial.images[1]?.url &&
            editorial.images[1].url !== editorial.images[0]?.url ? { ...home, editorial } : home),
          catchError(() => {
            if (response) state.set(skippedEditorial, true);
            return of(home);
          }),
        );
      }),
      map(data => ({ kind: 'ready', data }) as const),
      catchError(() => {
        markUnavailable(response);
        return of({ kind: 'unavailable' } as const);
      }),
    );
}

export const resolveHome: ResolveFn<PageResult<HomeData>> = () => {
  const response = inject(RESPONSE_INIT, { optional: true });
  const api = inject(ApiClient);
  const covers = inject(CatalogCovers);
  const legacy = resolveLegacyHome();
  return api.publicGet<{ data: HomePublication<StoreProduct> }>('/api/v1/homepage').pipe(
    map(({ data }) => {
      covers.remember(data.products);
      return { kind: 'ready', data: publicationHome(data, homeSelection(data.products.slice(0, 12))) } as const;
    }),
    catchError((error: { status?: number }) => {
      if (error.status === 404) return legacy;
      markUnavailable(response);
      return of({ kind: 'unavailable' } as const);
    }),
  );
};
