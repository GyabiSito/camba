import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiClient, formatDate, formatMoney } from '@camba/shared';
import { Observable, finalize, forkJoin, of } from 'rxjs';
import { Classification, Data, Product, admin, disconnected, fieldErrors, fieldsFrom, labels, localize, productInput, products, summaryError } from './catalog-api';
import { ProductFieldsForm } from './product-fields';
import { ProductGallery } from './product-gallery';

type Adjustment = {
  id: number; actor_id: number | null; old_price_cents: number | null; price_cents: number | null;
  old_stock: number; stock: number; created_at: string;
};
type HistoryPage = { data: Adjustment[]; current_page: number; last_page: number };
type ProductDetail = Data<Product> & { store_url?: string };

@Component({
  imports: [RouterLink, ProductFieldsForm, ProductGallery],
  templateUrl: './product-editor.html',
  styleUrls: ['./catalog.css', './work.css'],
})
export class ProductEditor {
  private readonly api = inject(ApiClient);
  private readonly destroy = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly id = this.route.snapshot.paramMap.get('id');
  protected readonly product = signal<Product | null>(null);
  private readonly storeUrl = signal<string | null>(null);
  protected readonly storefrontProductUrl = computed(() => {
    const product = this.product();
    const storeUrl = this.storeUrl();
    if (product?.status !== 'published' || !product.slug || !storeUrl) return null;

    try {
      const store = new URL(storeUrl);
      if (store.protocol !== 'http:' && store.protocol !== 'https:') return null;
      return new URL('/producto/' + encodeURIComponent(product.slug), store.origin).href;
    } catch {
      return null;
    }
  });
  protected readonly categories = signal<Classification[]>([]);
  protected readonly brands = signal<Classification[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly galleryBusy = signal(false);
  protected readonly loadError = signal('');
  protected readonly error = signal('');
  protected readonly errors = signal<Record<string, string[]>>({});
  protected readonly message = signal('');
  protected readonly archivePrompt = signal(false);
  protected readonly createUncertain = signal(false);
  protected readonly history = signal<HistoryPage | null>(null);
  protected readonly historyLoading = signal(false);
  protected readonly historyError = signal('');
  protected readonly labels = labels;
  protected readonly formatDate = formatDate;
  protected readonly formatMoney = formatMoney;
  protected fields = fieldsFrom();

  constructor() {
    this.load();
  }

  protected load() {
    if (this.id !== null && !/^[1-9]\d*$/.test(this.id)) {
      this.loadError.set('No encontramos ese producto.');
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.loadError.set('');
    forkJoin({
      categories: this.api.get<Data<Classification[]>>(`${admin}/categories`),
      brands: this.api.get<Data<Classification[]>>(`${admin}/brands`),
      current: this.id ? this.api.get<ProductDetail>(`${products}/${this.id}`) : of(null),
    }).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.loading.set(false))).subscribe({
      next: ({ categories, brands, current }) => {
        this.categories.set(categories.data);
        this.brands.set(brands.data);
        this.product.set(current?.data ?? null);
        this.storeUrl.set(current?.store_url ?? null);
        this.fields = fieldsFrom(current?.data);
      },
      error: (error) => this.loadError.set(summaryError(error, 'No se pudo abrir el producto. Verificá que siga disponible.')),
    });
  }

  protected save(event: Event) {
    event.preventDefault();
    if (this.saving() || this.galleryBusy() || this.createUncertain()) return;
    this.clearMessages();
    const current = this.product();
    try {
      const input = productInput(this.fields);
      const before = current && productInput(fieldsFrom(current));
      const patch = before && Object.fromEntries(
        (Object.keys(input) as (keyof typeof input)[]).filter((key) => input[key] !== before[key]).map((key) => [key, input[key]]),
      );
      if (patch && Object.keys(patch).length === 0) {
        this.message.set('No hay cambios para guardar.');
        return;
      }
      this.mutate(current ? this.api.patch<Data<Product>>(`${products}/${current.id}`, patch) : this.api.post<Data<Product>>(products, input),
        current ? 'Cambios guardados.' : 'Borrador creado.', current === null);
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Revisá los datos del producto.');
    }
  }

  protected transition(action: 'archive' | 'publish') {
    const current = this.product();
    if (!current || this.saving() || this.galleryBusy()) return;
    this.clearMessages();
    this.archivePrompt.set(false);
    try {
      if (JSON.stringify(productInput(this.fields)) !== JSON.stringify(productInput(fieldsFrom(current)))) {
        this.error.set('Guardá los cambios del producto antes de cambiar su estado.');
        return;
      }
    } catch {
      this.error.set('Corregí y guardá los cambios del producto antes de cambiar su estado.');
      return;
    }
    this.mutate(this.api.post<Data<Product>>(`${products}/${current.id}/${action}`),
      action === 'publish' ? 'Producto publicado.' : 'Producto archivado.');
  }

  protected loadHistory(page = 1) {
    if (!this.id || this.historyLoading()) return;
    this.historyLoading.set(true);
    this.historyError.set('');
    this.api.get<HistoryPage>(`${products}/${this.id}/history`, { page }).pipe(
      takeUntilDestroyed(this.destroy), finalize(() => this.historyLoading.set(false)),
    ).subscribe({
      next: (result) => this.history.set(result),
      error: (error) => this.historyError.set(summaryError(error, 'No se pudo cargar el historial.')),
    });
  }

  protected openedHistory(event: Event) {
    if ((event.target as HTMLDetailsElement).open && !this.history()) this.loadHistory();
  }

  protected updateGallery(next: Product) {
    this.product.update((current) => current && { ...current, images: next.images });
    this.errors.update(({ images, ...remaining }) => remaining);
  }

  private clearMessages() {
    this.error.set('');
    this.errors.set({});
    this.message.set('');
  }

  private mutate(request: Observable<Data<Product>>, message: string, creates = false) {
    this.saving.set(true);
    request.pipe(takeUntilDestroyed(this.destroy), finalize(() => this.saving.set(false))).subscribe({
      next: ({ data }) => {
        this.product.set(data);
        this.fields = fieldsFrom(data);
        this.message.set(message);
        if (creates) void this.router.navigate(['/productos', data.id], { replaceUrl: true });
        else if (this.history()) this.loadHistory();
      },
      error: (error) => {
        if (creates && disconnected(error)) {
          this.createUncertain.set(true);
          this.error.set('Se perdió la conexión al crear. Buscá el borrador en Productos antes de volver a crearlo.');
          return;
        }
        const fields = Object.fromEntries(Object.entries(fieldErrors(error)).map(([name, list]) => [name, list.map(localize)]));
        this.errors.set(fields);
        this.error.set(Object.keys(fields).length ? 'Revisá los campos indicados.' : summaryError(error, 'No se pudo guardar el producto.'));
      },
    });
  }
}
