import { useStoreMeta } from '../../core/seo/store-meta';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap, PRIMARY_OUTLET, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { ProductGrid } from './product-grid';
import { catalogParams, productSorts, readCatalogQuery } from './application/catalog-query';
import { CatalogData } from './data-access/catalog.resolver';
import { PageResult } from '../../shared/page-result';

@Component({
  selector: 'store-catalog',
  imports: [ProductGrid],
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
  protected readonly filtersOpen = signal(false);
  protected readonly activeFilterCount = computed(() => {
    const query = this.query();
    return Number(Boolean(query.category)) + Number(Boolean(query.brand)) + Number(query.sort !== 'newest');
  });
  protected toggleFilters(): void {
    this.filtersOpen.update(open => !open);
  }
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
    preventLiveDefault(event);
    if (!(event.currentTarget instanceof HTMLFormElement)) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const filters = readCatalogQuery(convertToParamMap(fields));
    void this.router.navigate(['/tienda'], { queryParams: catalogParams(filters), scroll: 'manual' });
  }

  protected followFilterLink(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const href = event.currentTarget instanceof HTMLAnchorElement && event.currentTarget.getAttribute('href');
    if (!href) return;
    preventLiveDefault(event);
    void this.router.navigateByUrl(href, { scroll: 'manual' });
  }

  protected url(queryParams: ReturnType<typeof catalogParams> = {}): string {
    return this.router.serializeUrl(this.router.createUrlTree(['/tienda'], { queryParams }));
  }
}

function preventLiveDefault(event: Event): void {
  // Replayed hydration events run after browser dispatch and cannot cancel it.
  if (event.eventPhase <= Event.BUBBLING_PHASE) event.preventDefault();
}
