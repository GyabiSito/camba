import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  convertToParamMap,
  PRIMARY_OUTLET,
  Router,
  RouterLink,
} from '@angular/router';
import { map } from 'rxjs';
import {
  CatalogData,
  catalogParams,
  PageResult,
  Product,
  productSorts,
  readCatalogQuery,
  useStoreMeta,
} from './catalog-data';
import { ProductGrid, ProductPhoto } from './product-media';

@Component({
  selector: 'store-home',
  imports: [RouterLink, ProductGrid, ProductPhoto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class StoreHome {
  protected readonly result = toSignal(
    inject(ActivatedRoute).data.pipe(map((data) => data['result'] as PageResult<Product[]>)),
    { requireSync: true },
  );
  protected readonly featured = computed(() => {
    const result = this.result();
    if (result.kind !== 'ready') return undefined;
    return (
      result.data.find((product) => product.in_stock && product.images.length) ?? result.data[0]
    );
  });
  protected readonly selection = computed(() => {
    const result = this.result();
    if (result.kind !== 'ready') return [];
    return result.data.filter((product) => product.id !== this.featured()?.id);
  });

  constructor() {
    useStoreMeta(() => ({
      title: 'Ropa, accesorios y más',
      description:
        'Camba: ropa, accesorios y más. Explorá el catálogo, los precios y la disponibilidad.',
      canonical: '/',
      noindex: this.result().kind !== 'ready',
    }));
  }
}

@Component({
  selector: 'store-catalog',
  imports: [RouterLink, ProductGrid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './catalog.html',
  styleUrl: './catalog.css',
})
export class StoreCatalog {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly result = toSignal(
    this.route.data.pipe(map((data) => data['result'] as PageResult<CatalogData>)),
    { requireSync: true },
  );
  protected readonly query = toSignal(this.route.queryParamMap.pipe(map(readCatalogQuery)), {
    requireSync: true,
  });
  protected readonly sorts = Object.entries(productSorts);
  protected readonly paramsFor = catalogParams;
  protected readonly filtered = computed(() => {
    const { q, category, brand, sort } = this.query();
    return Boolean(q || category || brand || sort !== 'newest');
  });
  protected readonly loading = computed(() => {
    const navigation = this.router.currentNavigation();
    return (
      Boolean(this.router.lastSuccessfulNavigation()) &&
      navigation?.initialUrl.root.children[PRIMARY_OUTLET]?.segments[0]?.path === 'tienda'
    );
  });
  protected readonly currentUrl = computed(() => this.url(catalogParams(this.query())));

  constructor() {
    useStoreMeta(() => ({
      title: 'Tienda',
      description:
        'Buscá por nombre, categoría o marca. Consultá los precios y el stock disponible en Camba.',
      canonical: this.url(catalogParams({ ...this.query(), sort: 'newest', q: '' })),
      noindex: this.result().kind !== 'ready' || !!this.query().q,
    }));
  }

  protected apply(event: SubmitEvent): void {
    event.preventDefault();
    if (!(event.currentTarget instanceof HTMLFormElement)) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const filters = readCatalogQuery(convertToParamMap(fields));
    void this.router.navigate(['/tienda'], { queryParams: catalogParams(filters) });
  }

  private url(queryParams: ReturnType<typeof catalogParams>): string {
    return this.router.serializeUrl(this.router.createUrlTree(['/tienda'], { queryParams }));
  }
}
