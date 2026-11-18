import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiClient } from '@camba/shared';
import { finalize, forkJoin } from 'rxjs';
import { Classification, Collection, Data, admin, fieldErrors, localize, summaryError } from './catalog-api';

@Component({
  imports: [FormsModule, RouterLink],
  templateUrl: './classifications.html',
  styleUrls: ['./catalog.css', './work.css'],
})
export class Classifications {
  private readonly api = inject(ApiClient);
  private readonly destroy = inject(DestroyRef);
  protected readonly groups = [
    { key: 'categories' as const, label: 'Categorías', singular: 'categoría' },
    { key: 'brands' as const, label: 'Marcas', singular: 'marca' },
  ];
  protected readonly items = signal<Record<Collection, Classification[]>>({ categories: [], brands: [] });
  protected readonly loading = signal(false);
  protected readonly loadError = signal('');
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly saving = signal(false);
  protected readonly edit = signal<{ key: Collection; id?: number; name: string } | null>(null);

  constructor() {
    this.load();
  }

  protected load() {
    this.loading.set(true);
    this.loadError.set('');
    forkJoin({
      categories: this.api.get<Data<Classification[]>>(`${admin}/categories`),
      brands: this.api.get<Data<Classification[]>>(`${admin}/brands`),
    }).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.loading.set(false))).subscribe({
      next: ({ categories, brands }) => this.items.set({ categories: categories.data, brands: brands.data }),
      error: (error) => this.loadError.set(summaryError(error, 'No se pudieron cargar las categorías y marcas.')),
    });
  }

  protected select(key: Collection, item?: Classification) {
    this.edit.set({ key, id: item?.id, name: item?.name ?? '' });
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
    this.mutate(edit.key, { name }, edit.id);
  }

  protected toggle(key: Collection, item: Classification) {
    if (!this.saving() && !this.edit()) this.mutate(key, { active: !item.active }, item.id);
  }

  private mutate(key: Collection, body: { name?: string; active?: boolean }, id?: number) {
    this.saving.set(true);
    this.error.set('');
    this.notice.set('');
    const request = id ? this.api.patch<Data<Classification>>(`${admin}/${key}/${id}`, body)
      : this.api.post<Data<Classification>>(`${admin}/${key}`, body);
    request.pipe(takeUntilDestroyed(this.destroy), finalize(() => this.saving.set(false))).subscribe({
      next: ({ data }) => {
        this.items.update((current) => ({
          ...current, [key]: [...current[key].filter((item) => item.id !== data.id), data].sort((a, b) => a.name.localeCompare(b.name, 'es-UY')),
        }));
        this.edit.set(null);
        this.notice.set(body.active === true ? `Se activó «${data.name}».`
          : body.active === false ? `Se desactivó «${data.name}».` : `Se guardó «${data.name}».`);
      },
      error: (error) => this.error.set(fieldErrors(error)['name']?.map(localize).join(' ') || summaryError(error, 'No se pudo guardar el cambio.')),
    });
  }
}
