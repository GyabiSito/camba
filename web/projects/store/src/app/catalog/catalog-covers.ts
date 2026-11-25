import { inject, Injectable, signal } from '@angular/core';
import { ApiClient } from '@camba/shared';
import { catchError, map, of, timeout } from 'rxjs';
import type { Product, ProductImage } from './catalog-data';

@Injectable({ providedIn: 'root' })
export class CatalogCovers {
  private readonly api = inject(ApiClient);
  private readonly covers = signal(new Map<string, ProductImage | undefined>());
  private readonly pending = new Set<string>();

  photo(slug: string) {
    return this.covers().get(slug);
  }

  remember(products: readonly Pick<Product, 'slug' | 'images'>[]) {
    this.covers.update((photos) => {
      const next = new Map(photos);
      for (const product of products) next.set(product.slug, product.images[0]);
      return next;
    });
  }

  load(slug: string) {
    if (this.covers().has(slug) || this.pending.has(slug)) return;
    this.pending.add(slug);
    // ponytail: A cold cart looks up each unknown SKU once per app session. A later
    // catalog visit can replace a cached miss; re-renders and quantity edits do not retry.
    this.api
      .publicGet<{ data: Product }>('/api/v1/products/' + encodeURIComponent(slug))
      .pipe(
        timeout(3500),
        map(({ data }) => data.images[0]),
        catchError(() => of(undefined)),
      )
      .subscribe((image) => {
        this.pending.delete(slug);
        if (image || !this.covers().has(slug)) {
          this.remember([{ slug, images: image ? [image] : [] }]);
        }
      });
  }
}
