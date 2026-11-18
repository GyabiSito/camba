import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiClient, formatMoney } from '@camba/shared';
import { Subscription, exhaustMap, finalize, take, timer } from 'rxjs';
import { Classification, Data, admin, fieldErrors, imports, localize, summaryError } from './catalog-api';

type RowStatus = 'ready' | 'invalid' | 'applied' | 'failed';
type Value = string | number | string[] | null;
type ImportRow = {
  line: number; sku: string | null; product_id: number | null; status: RowStatus; action: 'create' | 'update' | null;
  values: Record<string, Value>; errors: Record<string, string[]>; changes: Record<string, { before: Value; after: Value }>;
};
type Import = {
  id: number; status: 'completed' | 'queued' | 'preview'; counts: Record<RowStatus, number>; rows: ImportRow[];
};
type Filter = 'all' | 'errors' | 'ready' | 'applied';

@Component({
  imports: [FormsModule, RouterLink],
  templateUrl: './spreadsheet-import.html',
  styleUrls: ['./catalog.css', './work.css'],
})
export class SpreadsheetImport {
  private readonly api = inject(ApiClient);
  private readonly destroy = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private currentId: string | null = null;
  private poll: Subscription | undefined;
  private readonly categories = signal<Classification[]>([]);
  private readonly brands = signal<Classification[]>([]);
  protected readonly active = signal<Import | null>(null);
  protected readonly file = signal<File | null>(null);
  protected readonly loading = signal(false);
  protected readonly downloading = signal(false);
  protected readonly running = signal(false);
  protected readonly analyzing = signal(false);
  protected readonly polling = signal(false);
  protected readonly loadError = signal('');
  protected readonly fileError = signal('');
  protected readonly runError = signal('');
  protected readonly confirmed = signal(false);
  protected readonly filter = signal<Filter>('all');
  protected readonly rowPage = signal(1);
  protected readonly pageSize = 20;
  protected readonly labels = { ready: 'Lista', invalid: 'Con errores', applied: 'Aplicada', failed: 'No aplicada' };
  protected readonly rows = computed(() => {
    const filter = this.filter();
    return (this.active()?.rows ?? []).filter((row) => filter === 'all'
      || (filter === 'errors' ? row.status === 'invalid' || row.status === 'failed' : row.status === filter));
  });
  protected readonly visibleRows = computed(() => this.rows().slice((this.rowPage() - 1) * this.pageSize, this.rowPage() * this.pageSize));

  constructor() {
    this.destroy.onDestroy(() => this.poll?.unsubscribe());
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroy)).subscribe((params) => {
      const id = params.get('id');
      this.currentId = id;
      this.poll?.unsubscribe();
      this.runError.set('');
      this.loadError.set('');
      this.chooseFilter('all');
      this.confirmed.set(false);
      if (id !== String(this.active()?.id)) this.active.set(null);
      if (id) this.load();
    });
    for (const [path, target] of [['categories', this.categories], ['brands', this.brands]] as const) {
      this.api.get<Data<Classification[]>>(`${admin}/${path}`).pipe(takeUntilDestroyed(this.destroy)).subscribe({
        next: ({ data }) => target.set(data),
        // IDs still identify the proposed classifications if their labels are unavailable.
        error: () => {},
      });
    }
  }

  protected choose(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.fileError.set('');
    this.file.set(file);
  }

  protected preview(event: Event) {
    event.preventDefault();
    const file = this.file();
    if (this.running() || this.loading() || !file) return;
    if (!/\.(csv|xlsx)$/i.test(file.name) || file.size > 2 * 1024 * 1024 || file.size === 0) {
      this.fileError.set('Elegí un CSV o XLSX de hasta 2 MB que no esté vacío.');
      return;
    }
    this.fileError.set('');
    this.running.set(true);
    this.analyzing.set(true);
    const body = new FormData();
    body.append('file', file, file.name);
    this.api.post<Data<Import>>(imports, body).pipe(
      takeUntilDestroyed(this.destroy), finalize(() => { this.running.set(false); this.analyzing.set(false); }),
    ).subscribe({
      next: ({ data }) => {
        this.active.set(data);
        this.confirmed.set(false);
        this.chooseFilter('all');
        if (this.currentId !== String(data.id)) void this.router.navigate(['/productos/importar', data.id]);
        else if (data.status === 'queued') this.startPoll();
      },
      error: (error) => this.fileError.set(fieldErrors(error)['file']?.map(localize).join(' ')
        || summaryError(error, 'No se pudo leer la planilla. Comprobá el formato y volvé a subirla.')),
    });
  }

  protected downloadTemplate() {
    if (this.downloading()) return;
    this.downloading.set(true);
    this.fileError.set('');
    this.api.download(`${imports}/template`).pipe(
      takeUntilDestroyed(this.destroy), finalize(() => this.downloading.set(false)),
    ).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'camba-catalogo.csv';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: () => this.fileError.set('No se pudo descargar la plantilla. Volvé a intentar.'),
    });
  }

  protected load() {
    const id = this.currentId;
    if (!id || !/^[1-9]\d*$/.test(id)) {
      this.loadError.set('No encontramos esa importación.');
      return;
    }
    this.poll?.unsubscribe();
    this.loadError.set('');
    this.loading.set(true);
    this.api.get<Data<Import>>(`${imports}/${id}`).pipe(
      takeUntilDestroyed(this.destroy), finalize(() => this.loading.set(false)),
    ).subscribe({
      next: ({ data }) => {
        if (id !== this.currentId) return;
        this.accept(data);
        if (data.status === 'queued') this.startPoll();
      },
      error: (error) => {
        if (id === this.currentId) this.loadError.set(summaryError(error, 'No se pudo consultar la importación.'));
      },
    });
  }

  protected run() {
    const current = this.active();
    if (!current || this.running() || this.loading() || current.status === 'completed'
      || (current.status === 'preview' && (!this.confirmed() || current.counts.ready < 1))) return;
    this.poll?.unsubscribe();
    this.runError.set('');
    this.running.set(true);
    this.api.post<Data<Import>>(`${imports}/${current.id}/confirm`).pipe(
      takeUntilDestroyed(this.destroy), finalize(() => this.running.set(false)),
    ).subscribe({
      next: ({ data }) => {
        this.confirmed.set(false);
        this.accept(data);
        if (data.status === 'queued') this.startPoll();
      },
      error: (error) => {
        this.runError.set(summaryError(error, 'No se pudo confirmar. Consultá el estado antes de reintentar.'));
        this.load();
      },
    });
  }

  protected chooseFilter(filter: Filter) {
    this.filter.set(filter);
    this.rowPage.set(1);
  }

  protected fieldLabel(key: string): string {
    const names: Record<string, string> = {
      row: 'Fila', codigo: 'SKU', description: 'Descripción', descripcion: 'Descripción', name: 'Nombre', nombre: 'Nombre',
      price_cents: 'Precio (UYU)', precio_uyu: 'Precio (UYU)', stock: 'Stock', category_id: 'Categoría', categoria: 'Categoría',
      brand_id: 'Marca', marca: 'Marca', photos: 'Fotos', fotos: 'Fotos', images: 'Fotos',
    };
    return names[key] ?? key;
  }

  protected formatValue(key: string, value: Value) {
    if (value === null) return 'Sin valor';
    if (typeof value === 'number' && key === 'price_cents') return formatMoney(value);
    if (typeof value === 'number' && (key === 'category_id' || key === 'brand_id')) {
      return (key === 'category_id' ? this.categories() : this.brands()).find((item) => item.id === value)?.name ?? `#${value}`;
    }
    return Array.isArray(value) ? `${value.length} fotos` : value;
  }

  protected entries<T>(value: Record<string, T>) {
    return Object.entries(value);
  }

  protected readonly localize = localize;

  private accept(data: Import) {
    this.active.set(data);
    this.rowPage.update((page) => Math.min(page, Math.max(1, Math.ceil(this.rows().length / this.pageSize))));
  }

  private startPoll() {
    const current = this.active();
    if (!current || current.status !== 'queued') return;
    this.poll?.unsubscribe();
    this.polling.set(true);
    // ponytail: stop after two minutes on this view; the durable server job can be checked or resumed explicitly.
    this.poll = timer(2500, 3000).pipe(
      exhaustMap(() => this.api.get<Data<Import>>(`${imports}/${current.id}`)),
      take(40), takeUntilDestroyed(this.destroy), finalize(() => this.polling.set(false)),
    ).subscribe({
      next: ({ data }) => {
        this.accept(data);
        if (data.status === 'completed') {
          this.runError.set('');
          this.poll?.unsubscribe();
        }
      },
      error: () => this.runError.set('No se pudo seguir el progreso. Actualizá el estado o reanudá la misma importación.'),
    });
  }
}
