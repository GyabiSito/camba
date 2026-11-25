import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiClient, formatMoney } from '@camba/shared';
import { BehaviorSubject, EMPTY, catchError, combineLatest, switchMap } from 'rxjs';
import { Classification, Data, Page, Product, Status, admin, catalogPageSize, labels, photoOf, products, summaryError } from './catalog-api';
import { CatalogPagination } from './catalog-pagination';

@Component({
  imports: [FormsModule, RouterLink, CatalogPagination],
  templateUrl: './products.html',
  styleUrls: ['./catalog.css', './inventory-table.css', './products.css', './products-layout.css'],
})
export class Products {
  private readonly api = inject(ApiClient);
  private readonly destroy = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly refresh = new BehaviorSubject(0);
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  protected readonly categories = signal<Classification[]>([]);
  protected readonly categoryError = signal('');
  protected readonly result = signal<Page<Product> | null>(null);
  protected readonly selected = signal<Product | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly labels = labels;
  protected readonly photoOf = photoOf;
  protected readonly formatMoney = formatMoney;
  protected q = '';
  protected category = '';
  protected status: Status | '' = '';
  protected availability = '';

  constructor() {
    this.loadCategories();
    this.destroy.onDestroy(() => clearTimeout(this.searchTimer));
    combineLatest([this.route.queryParamMap, this.refresh]).pipe(
      switchMap(([params]) => {
        this.q = params.get('q') ?? '';
        this.category = params.get('category') ?? '';
        const status = params.get('status') ?? '';
        this.status = Object.hasOwn(labels, status) ? status as Status : '';
        this.availability = params.get('availability') === 'out_of_stock' ? 'out_of_stock' : '';
        const number = Number(params.get('page') ?? 1);
        const page = Number.isInteger(number) && number >= 1 && number <= 2147483647 ? number : 1;
        this.error.set('');
        this.loading.set(true);
        const query = { page, per_page: catalogPageSize, q: this.q.trim(), category: this.category, status: this.status, availability: this.availability };
        return this.api.get<Page<Product>>(products, query).pipe(
          catchError((error) => {
            this.error.set(summaryError(error, 'No se pudieron cargar los productos.'));
            this.loading.set(false);
            return EMPTY;
          }),
        );
      }),
      takeUntilDestroyed(this.destroy),
    ).subscribe((result) => {
      this.result.set(result);
      this.selected.set(result.data.find((product) => product.id === this.selected()?.id) ?? result.data[0] ?? null);
      this.loading.set(false);
    });
  }

  protected loadCategories() {
    this.categoryError.set('');
    this.api.get<Data<Classification[]>>(`${admin}/categories`).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: ({ data }) => this.categories.set(data),
      error: (error) => this.categoryError.set(summaryError(error, 'No se pudieron cargar las categorías.')),
    });
  }

  protected search(value: string) {
    this.q = value;
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.go(1), 250);
  }

  protected go(page: number) {
    clearTimeout(this.searchTimer);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: this.q.trim() || null,
        category: this.category || null,
        status: this.status || null,
        availability: this.availability || null,
        page: page > 1 ? page : null,
      },
    });
  }

  protected retry() {
    this.refresh.next(0);
  }

  protected clearFilters() {
    this.q = '';
    this.category = '';
    this.status = '';
    this.availability = '';
    this.go(1);
  }
}
