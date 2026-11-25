import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiClient } from '@camba/shared';
import { EMPTY, Subject, catchError, finalize, startWith, switchMap } from 'rxjs';
import { Classification, Data, Page, admin, catalogPageSize, fieldErrors, localize, summaryError } from './catalog-api';
import { CatalogPagination } from './catalog-pagination';

@Component({
  imports: [FormsModule, RouterLink, CatalogPagination],
  templateUrl: './classifications.html',
  styleUrls: ['./catalog.css', './inventory-table.css', './classifications.css'],
  styles: `
    .inventory { border-top: 1px solid var(--line); }
    .classification-name, code { overflow-wrap: anywhere; }
    .classification-form { padding: 1rem; margin-block: 1rem; }
    .classification-form .actions { margin-block-start: .75rem; }
    th.classification-actions { text-align: right; }
    .row-actions { justify-content: flex-end; }
    @container (inline-size <= 35em) {
      .classification-name, .classification-actions { grid-column: 1 / -1; }
      .row-actions { justify-content: flex-start; }
    }
  `,
})
export class Classifications {
  private readonly api = inject(ApiClient);
  private readonly destroy = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly refresh = new Subject<void>();
  private searchTimer: ReturnType<typeof setTimeout> | undefined;
  protected readonly group = this.route.snapshot.data['classification'] === 'brands'
    ? { key: 'brands', label: 'Marcas', singular: 'marca', caption: 'Asignar una marca no es obligatorio.' }
    : { key: 'categories', label: 'Categorías', singular: 'categoría', caption: 'Cada producto publicado necesita una categoría activa.' };
  private readonly endpoint = `${admin}/${this.group.key}`;
  private currentPage = 1;
  protected readonly result = signal<Page<Classification> | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal('');
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly saving = signal(false);
  protected readonly edit = signal<{ id?: number; name: string } | null>(null);
  protected q = '';
  protected status = '';

  constructor() {
    this.destroy.onDestroy(() => clearTimeout(this.searchTimer));
    this.route.queryParamMap.pipe(
      switchMap((params) => {
        const q = (params.get('q') ?? '').trim();
        const status = ['active', 'inactive'].includes(params.get('status') ?? '') ? params.get('status')! : '';
        const number = Number(params.get('page') ?? 1);
        const page = Number.isInteger(number) && number > 0 && number <= 2147483647 ? number : 1;
        this.q = q;
        this.status = status;
        this.currentPage = page;
        const canonical = this.query(page);
        if (params.keys.length !== Object.keys(canonical).length || Object.entries(canonical).some(([key, value]) => params.get(key) !== String(value))) {
          void this.router.navigate([], { relativeTo: this.route, queryParams: canonical, replaceUrl: true });
          return EMPTY;
        }
        return this.refresh.pipe(startWith(undefined), switchMap(() => {
          this.loading.set(true);
          this.loadError.set('');
          return this.api.get<Page<Classification>>(this.endpoint + '/page', { ...canonical, page, per_page: catalogPageSize }).pipe(
            catchError((error) => {
              this.loadError.set(summaryError(error, `No se pudieron cargar las ${this.group.label.toLowerCase()}.`));
              this.loading.set(false);
              return EMPTY;
            }),
          );
        }));
      }),
      takeUntilDestroyed(this.destroy),
    ).subscribe((result) => {
      if (this.currentPage > result.meta.last_page) {
        this.go(result.meta.last_page);
        return;
      }
      this.result.set(result);
      this.loading.set(false);
    });
  }

  protected load() {
    this.refresh.next();
  }

  protected search(value: string) {
    this.q = value;
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.go(1), 250);
  }

  protected go(page: number) {
    clearTimeout(this.searchTimer);
    void this.router.navigate([], { relativeTo: this.route, queryParams: this.query(page) });
  }

  protected clearFilters() {
    this.q = '';
    this.status = '';
    this.go(1);
  }

  private query(page: number): Record<string, string | number> {
    return { ...(this.q.trim() && { q: this.q.trim() }), ...(this.status && { status: this.status }), ...(page > 1 && { page }) };
  }

  protected select(item?: Classification) {
    this.edit.set({ id: item?.id, name: item?.name ?? '' });
    this.error.set('');
    this.notice.set('');
  }

  protected save(event: Event) {
    event.preventDefault();
    const edit = this.edit();
    if (!edit || this.saving()) return;
    const name = edit.name.trim();
    if (!name) {
      this.error.set('Ingresá un nombre.');
      return;
    }
    this.mutate({ name }, edit.id);
  }

  protected toggle(item: Classification) {
    if (!this.saving() && !this.edit()) this.mutate({ active: !item.active }, item.id);
  }

  private mutate(body: { name?: string; active?: boolean }, id?: number) {
    this.saving.set(true);
    this.error.set('');
    this.notice.set('');
    const request = id ? this.api.patch<Data<Classification>>(`${this.endpoint}/${id}`, body)
      : this.api.post<Data<Classification>>(this.endpoint, body);
    request.pipe(takeUntilDestroyed(this.destroy), finalize(() => this.saving.set(false))).subscribe({
      next: ({ data }) => {
        this.edit.set(null);
        this.notice.set(body.active === true ? `Se activó «${data.name}».`
          : body.active === false ? `Se desactivó «${data.name}».` : `Se guardó «${data.name}».`);
        this.load();
      },
      error: (error) => this.error.set(fieldErrors(error)['name']?.map(localize).join(' ') || summaryError(error, 'No se pudo guardar el cambio.')),
    });
  }
}
