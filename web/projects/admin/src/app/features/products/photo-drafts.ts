import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { formatMoney } from '@camba/shared';
import { finalize, firstValueFrom, forkJoin } from 'rxjs';
import { Classification, LocalPhoto, PhotoUploadState, Product, ProductFields, acceptedPhotos, disconnected, fieldErrors, fieldsFrom, hasPendingPhotoUpload, localPhotos, pendingPhotoDrafts, photoCleanupPending, photoClosePending, photoCloseReady, photoCloseUnconfirmed, photoUploadFailure, photoUploadState, productInput, productPhotoLimit, releasePhotos, summaryError, uploadError } from './data-access/catalog-api';
import { AdminCatalogApi } from './data-access/admin-catalog-api';
import { ProductFieldsForm } from './product-fields';

type Group = {
  key: number; fields: ProductFields; photos: LocalPhoto[]; checked: boolean; product: Product | null;
  upload: PhotoUploadState; done: boolean; uncertainCreate: boolean; retryUpload: boolean; error: string; notice?: string;
};

@Component({
  imports: [FormsModule, RouterLink, ProductFieldsForm],
  templateUrl: './photo-drafts.html',
  styleUrls: ['./catalog.css', './work.css', './batch-entry.css'],
})
export class PhotoDrafts {
  private readonly api = inject(AdminCatalogApi);
  private readonly destroy = inject(DestroyRef);
  private nextGroup = 0;
  protected readonly categories = signal<Classification[]>([]);
  protected readonly brands = signal<Classification[]>([]);
  protected readonly groups = signal<Group[]>([]);
  protected readonly loading = signal(false);
  protected readonly running = signal(false);
  protected readonly active = signal<number | null>(null);
  protected readonly closing = signal(false);
  protected readonly result = computed(() => this.groups().filter((group) => group.done).length);
  protected readonly loadError = signal('');
  protected readonly preview = signal(false);
  protected readonly interruptedDrafts = pendingPhotoDrafts();
  protected readonly common = { price: '', stock: '', category: null as number | null, brand: null as number | null };
  protected readonly acceptedPhotos = acceptedPhotos;
  protected readonly photoLimit = productPhotoLimit;
  protected readonly formatMoney = formatMoney;
  protected readonly cleanupPending = photoCleanupPending;
  protected readonly closePendingMessage = photoClosePending;

  constructor() {
    this.addGroup();
    this.load();
    this.destroy.onDestroy(() => this.groups().forEach((group) => releasePhotos(group.photos)));
  }

  protected load() {
    this.loading.set(true);
    this.loadError.set('');
    forkJoin({
      categories: this.api.categories(),
      brands: this.api.brands(),
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
      key: ++this.nextGroup, fields: fieldsFrom(), checked: true, photos: [], product: null, upload: {},
      done: false, uncertainCreate: false, retryUpload: false, error: '',
    }]);
  }

  protected removeGroup(group: Group) {
    releasePhotos(group.photos);
    this.groups.update((groups) => groups.filter((item) => item.key !== group.key));
  }

  protected choose(key: number, event: Event) {
    const input = event.target as HTMLInputElement;
    const files = [...(input.files ?? [])];
    input.value = '';
    const group = this.groups().find((item) => item.key === key);
    if (!files.length || !group || this.running() || group.uncertainCreate || group.retryUpload) return;
    if ((group.product?.images.length ?? 0) + group.photos.length + files.length > productPhotoLimit) {
      this.update(group.key, { error: `Podés guardar hasta ${productPhotoLimit} fotos por producto, incluida la portada.` });
      return;
    }
    this.update(group.key, { photos: [...group.photos, ...localPhotos(files)], error: '', notice: undefined });
  }

  protected removePhoto(key: number, photo: LocalPhoto) {
    const group = this.groups().find((item) => item.key === key);
    if (!group || this.running() || group.uncertainCreate || group.retryUpload) return;
    releasePhotos([photo]);
    this.update(group.key, { photos: group.photos.filter((item) => item.key !== photo.key), error: '' });
  }

  protected applyCommon() {
    for (const group of this.groups().filter((item) => item.checked && !item.product && !item.uncertainCreate)) {
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
    return this.groups().filter((item) => !item.done && !item.uncertainCreate && !item.retryUpload);
  }

  protected categoryName(id: number | null) {
    return this.categories().find((category) => category.id === id)?.name ?? 'Sin categoría';
  }

  protected price(group: Group) {
    const cents = productInput(group.fields).price_cents;
    return cents === null ? 'Sin precio' : formatMoney(cents);
  }

  protected retry(group: Group) {
    if (group.product && group.retryUpload && group.photos.length && !photoCleanupPending(group.upload) && !this.running()) return this.runGroups([group]);
    return;
  }

  protected async closeRecovery(group: Group) {
    if (!group.product || !group.retryUpload || this.running()) return;
    this.running.set(true);
    this.closing.set(true);
    this.active.set(group.key);
    this.update(group.key, { error: '', notice: undefined });
    try {
      const result = await this.api.closePhotoUpload(this.destroy, group.product.id, group.upload);
      if (this.destroy.destroyed) return;
      if (result.kind === 'unconfirmed') {
        this.update(group.key, { error: photoCloseUnconfirmed });
        return;
      }
      const product = result.product ?? group.product;
      if (result.kind === 'cleanup-pending') {
        this.update(group.key, { product });
        return;
      }
      const upload = photoUploadState(product.id);
      const another = !!upload.attempt || hasPendingPhotoUpload(product.id);
      releasePhotos(group.photos);
      this.update(group.key, {
        product, upload, photos: [], retryUpload: another,
        done: !another && product.images.length > 0, notice: photoCloseReady(another),
      });
    } finally {
      this.active.set(null);
      this.closing.set(false);
      this.running.set(false);
    }
  }

  protected run() {
    if (!this.preview() || this.running()) return;
    const groups = this.pending().filter((group) => !this.validate(group));
    if (groups.length) return this.runGroups(groups);
    return;
  }

  private async runGroups(groups: Group[]) {
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
        draft = (await firstValueFrom(this.api.createPhotoDraft(productInput(group.fields)).pipe(takeUntilDestroyed(this.destroy)))).data;
            this.update(group.key, { product: draft });
          }
      const response = await this.api.uploadPhotos(this.destroy, draft, group.photos, group.upload, true);
          if (this.destroy.destroyed) break;
          releasePhotos(group.photos);
          this.update(group.key, { product: response, photos: [], done: true, retryUpload: false });
        } catch (error) {
          if (this.destroy.destroyed) break;
          if (!draft && disconnected(error)) {
            this.update(group.key, {
              uncertainCreate: true,
              error: 'No recibimos confirmación de la creación. Buscá este nombre en Productos antes de volver a crearlo.',
            });
            continue;
          }
          const retryUpload = !!draft && (!!group.upload.attempt || hasPendingPhotoUpload(draft.id));
          const uploadMessage = draft && photoUploadFailure(error, retryUpload);
          if (uploadMessage) {
            this.update(group.key, { retryUpload, error: photoCleanupPending(group.upload) ? '' : uploadMessage });
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
