import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, linkedSignal, output, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize } from 'rxjs';
import { CropUpload, Data, LocalPhoto, Photo, Product, acceptedPhotos, fieldErrors, hasPendingPhotoUpload, localPhotos, photoCleanupPending, photoClosePending, photoCloseReady, photoCloseUnconfirmed, photoUploadFailure, photoUploadState, productPhotoLimit, releasePhotos, summaryError, uploadError } from './data-access/catalog-api';
import { AdminCatalogApi } from './data-access/admin-catalog-api';
import { readCroppedPhotos } from './data-access/photo-crop-recovery';
import { ProductPhotoCrop } from './product-photo-crop';

type CropSelection = { sources: LocalPhoto[]; crop: CropUpload; trigger: HTMLElement };

@Component({
  selector: 'app-product-gallery',
  imports: [ProductPhotoCrop],
  templateUrl: './product-gallery.html',
  styleUrls: ['./catalog.css', './work.css', './product-gallery.css'],
})
export class ProductGallery {
  private readonly destroy = inject(DestroyRef);
  private readonly api = inject(AdminCatalogApi);
  private readonly replacementInput = viewChild<ElementRef<HTMLInputElement>>('replacementInput');
  private readonly uploadButton = viewChild<ElementRef<HTMLButtonElement>>('uploadButton');
  readonly product = input.required<Product>();
  readonly disabled = input(false);
  readonly changed = output<Product>();
  readonly busyChange = output<boolean>();

  protected readonly pending = signal<LocalPhoto[]>([]);
  protected readonly pendingCrop = signal<CropUpload | undefined>(undefined);
  protected readonly cropSelection = signal<CropSelection | null>(null);
  protected readonly alternateOrder = signal<Photo[] | null>(null);
  protected readonly gallery = computed(() => this.alternateOrder() ?? this.product().images);
  protected readonly openSlots = computed(() => Array.from({ length: Math.max(0, productPhotoLimit - Math.max(1, this.gallery().length)) }));
  protected readonly limit = productPhotoLimit;
  protected readonly remaining = computed(() => Math.max(0, productPhotoLimit - this.gallery().length - this.pending().length));
  protected readonly busy = signal<'upload' | 'order' | 'refresh' | ''>('');
  protected readonly needsReview = signal(false);
  private readonly productId = computed(() => this.product().id);
  private readonly uploadState = linkedSignal(() => photoUploadState(this.productId()));
  protected readonly recovering = linkedSignal(() => !!this.uploadState().attempt || hasPendingPhotoUpload(this.productId()));
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly acceptedPhotos = acceptedPhotos;
  protected readonly hasError = (photo: LocalPhoto) => !!photo.error;
  protected readonly closePendingMessage = photoClosePending;
  protected readonly cleanupPending = () => photoCleanupPending(this.uploadState());
  protected readonly cropRecovery = () => this.uploadState().attempt?.crop;
  protected readonly locked = computed(() => this.disabled() || !!this.busy() || this.needsReview());
  protected readonly orderLocked = computed(() => this.locked() || this.recovering());
  private dragged: number | null = null;
  private replacement?: { id: number; trigger: HTMLElement };

  constructor() {
    afterNextRender(() => void this.restoreCrop());
    this.destroy.onDestroy(() => {
      releasePhotos(this.pending());
      releasePhotos(this.cropSelection()?.sources ?? []);
    });
  }

  protected choose(event: Event, replacing = false) {
    const control = event.target as HTMLInputElement;
    const files = [...(control.files ?? [])];
    control.value = '';
    if (!files.length || this.locked() || this.cleanupPending() || this.cropSelection()) return;
    this.error.set('');
    const recovery = this.recovering();
    const crop = recovery ? this.cropRecovery() : { replaceImageId: replacing ? this.replacement?.id : undefined };
    if ((!recovery && crop?.replaceImageId === undefined && files.length > this.remaining()) ||
        (crop?.replaceImageId !== undefined && files.length !== 1) || (recovery && files.length > 12)) {
      this.error.set(crop?.replaceImageId !== undefined ? 'Elegí una sola foto para el reemplazo.'
        : 'Podés guardar hasta 5 fotos por producto, incluida la portada. Elegí menos fotos.');
      return;
    }
    const selected = localPhotos(files);
    if (!crop) {
      // Previously queued uploads (including batch drafts) must retry the untouched original bytes.
      this.replacePending(selected);
      return;
    }
    const invalid = selected.find(photo => photo.error);
    if (invalid) {
      this.error.set(`${invalid.file.name}: ${invalid.error}`);
      releasePhotos(selected);
      return;
    }
    this.cropSelection.set({ sources: selected, crop, trigger: replacing ? this.replacement?.trigger ?? control : control });
  }

  protected replacePhoto(id: number, event: Event) {
    this.replacement = { id, trigger: event.currentTarget as HTMLElement };
    this.replacementInput()?.nativeElement.click();
  }

  protected acceptCrop(files: File[]) {
    const selection = this.cropSelection();
    if (!selection) return;
    const processed = localPhotos(files);
    if (selection.crop.replaceImageId !== undefined || this.recovering()) {
      this.replacePending(processed, selection.crop);
    } else {
      this.pendingCrop.set(selection.crop);
      this.pending.update(pending => [...pending, ...processed]);
    }
    this.cancelCrop();
    requestAnimationFrame(() => this.uploadButton()?.nativeElement.focus());
  }

  protected cancelCrop() {
    const selection = this.cropSelection();
    if (!selection) return;
    releasePhotos(selection.sources);
    this.cropSelection.set(null);
    if (!selection.trigger.matches(':disabled')) selection.trigger.focus();
  }

  private replacePending(photos: LocalPhoto[], crop?: CropUpload) {
    releasePhotos(this.pending());
    this.pendingCrop.set(crop);
    this.pending.set(photos);
  }

  private async restoreCrop() {
    const attempt = this.uploadState().attempt;
    if (!attempt?.crop || this.cleanupPending()) return;
    const files = await readCroppedPhotos(attempt.key);
    if (!files?.length || this.destroy.destroyed || this.uploadState().attempt?.key !== attempt.key ||
        !this.recovering() || this.pending().length || this.cropSelection()) return;
    if (!crypto.subtle) this.uploadState().files = files;
    this.replacePending(localPhotos(files), attempt.crop);
  }

  protected remove(photo: LocalPhoto) {
    releasePhotos([photo]);
    this.pending.update((list) => list.filter((item) => item.key !== photo.key));
    if (!this.pending().length) this.pendingCrop.set(undefined);
    this.error.set('');
  }

  protected async closeRecovery() {
    if (!this.recovering() || this.busy() || this.disabled()) return;
    this.start('refresh');
    const id = this.product().id;
    try {
      const result = await this.api.closePhotoUpload(this.destroy, id, this.uploadState());
      if (this.destroy.destroyed || this.product().id !== id) return;
      if (result.kind === 'unconfirmed') {
        this.error.set(photoCloseUnconfirmed);
        return;
      }
      if (result.product) this.changed.emit(result.product);
      if (result.kind === 'cleanup-pending') return;
      const next = photoUploadState(id);
      this.uploadState.set(next);
      const another = !!next.attempt || hasPendingPhotoUpload(id);
      this.recovering.set(another);
      this.replacePending([]);
      this.message.set(photoCloseReady(another));
      if (another) void this.restoreCrop();
    } finally {
      if (!this.destroy.destroyed) this.finish();
    }
  }

  protected async upload() {
    const list = this.pending();
    if (this.busy() || this.disabled() || this.cleanupPending() || !list.length || list.some((photo) => photo.error) || this.needsReview() || this.alternateOrder()) return;
    const product = this.product();
    const crop = this.pendingCrop();
    this.start('upload');
    try {
      const updated = await this.api.uploadPhotos(this.destroy, product, list, this.uploadState(), false, crop);
      if (this.destroy.destroyed) return;
      this.changed.emit(updated);
      this.replacePending([]);
      this.recovering.set(hasPendingPhotoUpload(product.id));
      this.message.set(crop?.replaceImageId === undefined ? 'Fotos agregadas a la galería.' : 'Foto reemplazada.');
    } catch (error) {
      if (this.destroy.destroyed) return;
      const recovering = !!this.uploadState().attempt || hasPendingPhotoUpload(product.id);
      this.recovering.set(recovering);
      if (this.cleanupPending()) return;
      const stateError = photoUploadFailure(error, recovering);
      const fields = fieldErrors(error);
      if (stateError) {
        this.error.set(stateError);
      } else if (fields['photos'] || fields['replace_image_id']) {
        this.error.set([...(fields['photos'] ?? []), ...(fields['replace_image_id'] ?? [])].map(uploadError).join(' '));
      } else if (Object.keys(fields).length) {
        this.pending.update((photos) => photos.map((photo, index) => ({
          ...photo, error: fields[`photos.${index}`]?.map(uploadError).join(' ') ?? photo.error,
        })));
        this.error.set('No se agregó ninguna foto. Revisá los archivos indicados y volvé a intentar.');
      } else {
        this.error.set(summaryError(error, 'No se pudieron agregar las fotos. Revisá los archivos y volvé a intentar.'));
      }
    } finally {
      if (!this.destroy.destroyed) this.finish();
    }
  }

  protected move(from: number, to: number) {
    if (this.disabled() || this.busy() || this.needsReview() || this.recovering() || from === to || from < 0 || to < 0 || to >= this.gallery().length) return;
    const next = [...this.gallery()];
    next.splice(to, 0, next.splice(from, 1)[0]);
    this.alternateOrder.set(next.map((photo) => photo.id).join() === this.product().images.map((photo) => photo.id).join() ? null : next);
    this.message.set(`Foto movida a la posición ${to + 1}.`);
  }

  protected drag(event: DragEvent, index: number) {
    if (this.disabled() || this.busy() || this.needsReview() || this.recovering()) {
      event.preventDefault();
      return;
    }
    this.dragged = index;
    event.dataTransfer?.setData('text/plain', String(index));
  }

  protected drop(event: DragEvent, index: number) {
    event.preventDefault();
    if (this.dragged !== null) this.move(this.dragged, index);
    this.endDrag();
  }

  protected endDrag() {
    this.dragged = null;
  }

  protected commitOrder() {
    if (!this.alternateOrder() || this.busy() || this.disabled()) return;
    this.run(this.api.reorderPhotos(this.product().id, this.gallery().map((photo) => photo.id)), 'order', 'Orden y portada guardados.');
  }

  protected reload() {
    if (this.busy() || this.disabled()) return;
    this.run(this.api.product(this.product().id), 'refresh', 'Galería actualizada.');
  }

  private start(action: 'upload' | 'order' | 'refresh') {
    this.busy.set(action);
    this.busyChange.emit(true);
    this.error.set('');
    this.message.set('');
  }

  private finish() {
    this.busy.set('');
    this.busyChange.emit(false);
  }

  private run(request: Observable<Data<Product>>, action: 'order' | 'refresh', message: string) {
    this.start(action);
    request.pipe(
      takeUntilDestroyed(this.destroy),
      finalize(() => this.finish()),
    ).subscribe({
      next: ({ data }) => {
        this.changed.emit(data);
        this.alternateOrder.set(null);
        this.needsReview.set(false);
        this.message.set(message);
      },
      error: (error) => {
        if (action === 'order' && fieldErrors(error)['ids']) {
          this.needsReview.set(true);
          this.error.set('Cambió el conjunto de fotos. Actualizá la galería antes de volver a ordenar.');
        } else {
          this.error.set(summaryError(error, 'No se pudieron guardar o cargar las fotos.'));
        }
      },
    });
  }
}
