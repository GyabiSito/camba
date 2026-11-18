import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiClient, formatMoney } from '@camba/shared';
import { finalize, firstValueFrom, forkJoin } from 'rxjs';
import { Classification, Data, LocalPhoto, Product, ProductFields, acceptedPhotos, admin, disconnected, fieldErrors, fieldsFrom, localPhotos, products, productInput, releasePhotos, summaryError, uploadBody, uploadError } from './catalog-api';
import { ProductFieldsForm } from './product-fields';

type Group = {
  key: number; fields: ProductFields; photos: LocalPhoto[]; checked: boolean; product: Product | null;
  done: boolean; uncertain: boolean; error: string;
};

@Component({
  imports: [FormsModule, RouterLink, ProductFieldsForm],
  templateUrl: './photo-drafts.html',
  styleUrls: ['./catalog.css', './work.css'],
})
export class PhotoDrafts {
  private readonly api = inject(ApiClient);
  private readonly destroy = inject(DestroyRef);
  private nextGroup = 0;
  protected readonly categories = signal<Classification[]>([]);
  protected readonly brands = signal<Classification[]>([]);
  protected readonly groups = signal<Group[]>([]);
  protected readonly loading = signal(false);
  protected readonly running = signal(false);
  protected readonly active = signal<number | null>(null);
  protected readonly result = computed(() => this.groups().filter((group) => group.done).length);
  protected readonly loadError = signal('');
  protected readonly preview = signal(false);
  protected readonly common = { price: '', stock: '', category: null as number | null, brand: null as number | null };
  protected readonly acceptedPhotos = acceptedPhotos;
  protected readonly formatMoney = formatMoney;

  constructor() {
    this.addGroup();
    this.load();
    this.destroy.onDestroy(() => this.groups().forEach((group) => releasePhotos(group.photos)));
  }

  protected load() {
    this.loading.set(true);
    this.loadError.set('');
    forkJoin({
      categories: this.api.get<Data<Classification[]>>(`${admin}/categories`),
      brands: this.api.get<Data<Classification[]>>(`${admin}/brands`),
    }).pipe(takeUntilDestroyed(this.destroy), finalize(() => this.loading.set(false))).subscribe({
      next: ({ categories, brands }) => {
        this.categories.set(categories.data);
        this.brands.set(brands.data);
      },
      error: (error) => this.loadError.set(summaryError(error, 'No se pudieron cargar las categorías y marcas.')),
    });
  }

  protected addGroup() {
    this.groups.update((groups) => [...groups, {
      key: ++this.nextGroup, fields: fieldsFrom(), checked: true, photos: [], product: null, done: false, uncertain: false, error: '',
    }]);
  }

  protected removeGroup(group: Group) {
    releasePhotos(group.photos);
    this.groups.update((groups) => groups.filter((item) => item.key !== group.key));
  }

  protected choose(group: Group, event: Event) {
    const input = event.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    if (!files.length) return;
    if (group.photos.length + files.length > 12) {
      this.update(group.key, { error: 'Podés agregar hasta 12 fotos por producto en esta carga.' });
      return;
    }
    this.update(group.key, { photos: [...group.photos, ...localPhotos(files)], error: '' });
  }

  protected removePhoto(group: Group, photo: LocalPhoto) {
    releasePhotos([photo]);
    this.update(group.key, { photos: group.photos.filter((item) => item.key !== photo.key), error: '' });
  }

  protected applyCommon() {
    for (const group of this.groups().filter((item) => item.checked && !item.product && !item.uncertain)) {
      const fields = { ...group.fields };
      for (const key of ['price', 'stock'] as const) {
        if (this.common[key].trim()) fields[key] = this.common[key];
      }
      for (const key of ['category', 'brand'] as const) {
        if (this.common[key] !== null) fields[key] = this.common[key];
      }
      this.update(group.key, { fields });
    }
  }

  protected check() {
    let valid = false;
    for (const group of this.pending()) {
      const error = this.validate(group);
      this.update(group.key, { error });
      if (!error) valid = true;
    }
    this.preview.set(valid);
  }

  protected pending() {
    return this.groups().filter((item) => !item.done && !item.uncertain);
  }

  protected categoryName(id: number | null) {
    return this.categories().find((category) => category.id === id)?.name ?? 'Sin categoría';
  }

  protected price(group: Group) {
    const cents = productInput(group.fields).price_cents;
    return cents === null ? 'Sin precio' : formatMoney(cents);
  }

  protected async run() {
    if (!this.preview() || this.running()) return;
    const groups = this.pending().filter((group) => !this.validate(group));
    if (!groups.length) return;
    this.preview.set(false);
    this.running.set(true);
    try {
      for (const group of groups) {
        if (this.destroy.destroyed) break;
        this.active.set(group.key);
        this.update(group.key, { error: '' });
        let draft = group.product;
        try {
          if (!draft) {
            draft = (await firstValueFrom(this.api.post<Data<Product>>(products, productInput(group.fields)).pipe(takeUntilDestroyed(this.destroy)))).data;
            this.update(group.key, { product: draft });
          }
          const response = await firstValueFrom(this.api.post<Data<Product>>(
            `${products}/${draft.id}/images`, uploadBody(group.photos.map((photo) => photo.file)),
          ).pipe(takeUntilDestroyed(this.destroy)));
          releasePhotos(group.photos);
          this.update(group.key, { product: response.data, photos: [], done: true });
        } catch (error) {
          if (this.destroy.destroyed) break;
          if (disconnected(error)) {
            this.update(group.key, {
              uncertain: true,
              error: draft
                ? 'La carga no devolvió una confirmación. Abrí el borrador y revisá su galería antes de subir las fotos que falten.'
                : 'No recibimos confirmación de la creación. Buscá este nombre en Productos antes de volver a crearlo.',
            });
            continue;
          }
          const fields = fieldErrors(error);
          const photos = group.photos.map((photo, index) => ({
            ...photo, error: fields[`photos.${index}`]?.map(uploadError).join(' ') ?? photo.error,
          }));
          this.update(group.key, { photos, error: summaryError(error, draft
            ? 'El borrador ya existe. Revisá las fotos para volver a intentar solo la carga.'
            : 'No se pudo crear el borrador.') });
        }
      }
    } finally {
      this.active.set(null);
      this.running.set(false);
    }
  }

  private validate(group: Group) {
    if (!group.photos.length || group.photos.some((photo) => photo.error)) return 'Agregá fotos válidas y quitá las marcadas con error.';
    if (group.product) return '';
    try {
      const input = productInput(group.fields);
      if (!input.name || input.price_cents === null || input.category_id === null) return 'Completá nombre, precio, stock y categoría para preparar este grupo.';
      return '';
    } catch (error) {
      return error instanceof Error ? error.message : 'Revisá los datos del grupo.';
    }
  }

  private update(key: number, patch: Partial<Group>) {
    this.groups.update((groups) => groups.map((group) => group.key === key ? { ...group, ...patch } : group));
  }
}
