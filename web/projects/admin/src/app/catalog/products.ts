import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiClient, formatMoney } from '@camba/shared';
import { BehaviorSubject, EMPTY, catchError, switchMap } from 'rxjs';
import { Classification, Data, Page, Product, Status, admin, labels, photoOf, products, summaryError } from './catalog-api';

@Component({
  imports: [FormsModule, RouterLink],
  templateUrl: './products.html',
  styleUrls: ['./catalog.css', './products.css', './products-layout.css'],
})
export class Products {
  private readonly api = inject(ApiClient);
  private readonly destroy = inject(DestroyRef);
  private readonly request = new BehaviorSubject(1);
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

  constructor() {
    this.loadCategories();
    this.destroy.onDestroy(() => clearTimeout(this.searchTimer));
    this.request.pipe(
      switchMap((page) => {
        this.error.set('');
        this.loading.set(true);
        const query = { page, per_page: 12, q: this.q.trim(), category: this.category, status: this.status };
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
    this.request.next(page);
  }

  protected retry() {
    this.go(this.request.value);
  }

  protected clearFilters() {
    this.q = '';
    this.category = '';
    this.status = '';
    this.go(1);
  }
}
