import { useStoreMeta } from '../core/seo/store-meta';
import { afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  convertToParamMap,
  PRIMARY_OUTLET,
  Router,
  RouterLink,
} from '@angular/router';
import { formatMoney, type HomeDocument, type HomeLink } from '@camba/shared';
import { map } from 'rxjs';
import {
  CatalogData,
  catalogParams,
  HomeData,
  PageResult,
  productSorts,
  readCatalogQuery,
} from './catalog-data';
import { ProductGrid, ProductPhoto } from './product-media';
import { HOME_RENDER_OPTIONS } from './home-render-options';
import { HomePhoto } from './home-photo';
import { HomeMosaic } from './home-mosaic';
import { homeCatalog, homeCategoryCards, homeCrop, homeHref, homeImage, homeSectionExists, homeSrcset, legacyHomeDocument } from './home-config';

@Component({
  selector: 'store-home-editorial',
  imports: [RouterLink, NgTemplateOutlet, ProductPhoto, HomePhoto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home-editorial.html',
  styleUrl: './home-editorial.css',
})
export class HomeEditorial {
  readonly shop = input.required<HomeData>();
  readonly document = input.required<HomeDocument>();
  readonly block = input.required<'look' | 'story'>();
  protected readonly image = (image: HomeDocument['look']['image']) => homeImage(image, this.shop().publication?.assets ?? {}, this.editorial, this.visuals.assetOrigin);
  protected readonly srcset = homeSrcset;
  protected readonly crop = homeCrop;
  protected readonly href = (link: HomeLink | null) => homeHref(link, homeCatalog(this.shop()), this.document(),
    block => homeSectionExists(block, this.document(), this.shop(), this.editorial));
  protected readonly lookPhoto = computed(() => this.image(this.document().look.image));
  protected readonly storyPhoto = computed(() => this.image(this.document().story.image));
  protected readonly details = computed(() => this.document().story.details.flatMap((image, index) => {
    const asset = this.image(image);
    return image && asset ? [{ image, asset, part: index === 0 ? 'weave' as const : 'finish' as const }] : [];
  }));
  protected readonly showLook = computed(() => homeSectionExists('look', this.document(), this.shop(), this.editorial));

  private readonly visuals = inject(HOME_RENDER_OPTIONS);
  protected readonly editorial = this.visuals.editorial;
  protected readonly money = formatMoney;
  protected readonly failedPhotos = signal<Partial<Record<'look' | 'lead' | 'weave' | 'finish', true>>>({});
  protected failPhoto(part: keyof ReturnType<typeof this.failedPhotos>): void {
    this.failedPhotos.update(failed => ({ ...failed, [part]: true }));
  }
  protected readonly lookCategories = computed(() => {
    const shop = this.shop();
    if (this.document().look.mode === 'manual') return [];
    return shop.categories.map(product => product.category).filter(category =>
      ['camisas', 'pantalones'].includes(category.slug) &&
      !shop.look.some(item => item.category.slug === category.slug));
  });

}

@Component({
  selector: 'store-home',
  imports: [RouterLink, NgTemplateOutlet, ProductGrid, HomePhoto, HomeEditorial, HomeMosaic],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class StoreHome {
  protected readonly result = toSignal(
    inject(ActivatedRoute).data.pipe(map((data) => data['result'] as PageResult<HomeData>)),
    { requireSync: true },
  );
  protected readonly home = computed(() => {
    const result = this.result();
    return result.kind === 'ready' ? result.data : undefined;
  });
  private readonly visuals = inject(HOME_RENDER_OPTIONS);
  protected readonly editorial = this.visuals.editorial;
  protected readonly document = computed(() => this.home()?.publication?.document ?? legacyHomeDocument(this.home()));
  protected readonly blocks = computed(() => this.document().order.filter(block => !this.document().hidden.includes(block)));
  protected readonly cards = computed(() => {
    const shop = this.home();
    return shop ? homeCategoryCards(shop, this.document()) : [];
  });
  protected readonly image = (image: HomeDocument['look']['image']) => homeImage(image, this.home()?.publication?.assets ?? {}, this.editorial, this.visuals.assetOrigin);
  protected readonly srcset = homeSrcset;
  protected readonly crop = homeCrop;
  protected readonly href = (link: HomeLink | null) => homeHref(link, this.home() ? homeCatalog(this.home()!) : undefined, this.document(),
    block => homeSectionExists(block, this.document(), this.home(), this.editorial));
  protected readonly heroPhoto = computed(() => this.image(this.document().hero.desktop));
  protected readonly mobilePhoto = computed(() => this.image(this.document().hero.mobile));
  protected readonly selected = signal('');
  protected readonly products = computed(() => {
    const slug = this.selected();
    const selection = this.home()?.selection ?? [];
    const matching = slug ? selection.filter(product => product.category.slug === slug) : selection;
    return this.document().selection.mode === 'manual' || this.document().selection.categoryId !== null ? matching : matching.slice(0, 4);
  });
  protected readonly filters = computed(() => {
    const shop = this.home();
    return shop?.categories.map(product => product.category).filter(category =>
      shop.selection.some(product => product.category.slug === category.slug)) ?? [];
  });
  protected readonly campaignFailed = signal(false);
  protected readonly failedCategoryPhotos = signal<Record<string, true>>({});

  constructor() {
    useStoreMeta(() => ({
      title: this.visuals.preview ? 'Vista previa de portada' : this.document().hero.title,
      description: 'Ropa y accesorios para armar tu estilo. Explorá el catálogo de Camba.',
      canonical: '/',
      noindex: this.visuals.preview || this.result().kind !== 'ready',
    }));
    const root = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const lifetime = inject(DestroyRef);
    afterNextRender(() => {
      const view = root.ownerDocument.defaultView;
      const reduced = view?.matchMedia('(prefers-reduced-motion: reduce)');
      if (!reduced || reduced.matches) return;

      void import('./home-motion').then(({ attachHomeMotion }) => {
        if (!lifetime.destroyed && !reduced.matches && root.isConnected) {
          lifetime.onDestroy(attachHomeMotion(root, reduced));
        }
      }).catch(() => { /* Browsing and focus feedback do not depend on motion. */ });
    });
  }

  protected markCategoryPhotoFailed(slug: string): void {
    this.failedCategoryPhotos.update(current => ({ ...current, [slug]: true }));
  }


}

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
    event.preventDefault();
    if (!(event.currentTarget instanceof HTMLFormElement)) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const filters = readCatalogQuery(convertToParamMap(fields));
    void this.router.navigate(['/tienda'], { queryParams: catalogParams(filters), scroll: 'manual' });
  }

  protected followFilterLink(event: MouseEvent): void {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const href = event.currentTarget instanceof HTMLAnchorElement && event.currentTarget.getAttribute('href');
    if (!href) return;
    event.preventDefault();
    void this.router.navigateByUrl(href, { scroll: 'manual' });
  }

  protected url(queryParams: ReturnType<typeof catalogParams> = {}): string {
    return this.router.serializeUrl(this.router.createUrlTree(['/tienda'], { queryParams }));
  }
}
