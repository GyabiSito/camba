import { Component, DestroyRef, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiClient } from '@camba/shared';
import { Observable, finalize } from 'rxjs';
import { Data, LocalPhoto, Photo, Product, acceptedPhotos, closePhotoUpload, fieldErrors, hasPendingPhotoUpload, localPhotos, photoCleanupPending, photoClosePending, photoCloseReady, photoCloseUnconfirmed, photoUploadFailure, photoUploadState, products, releasePhotos, summaryError, uploadError, uploadPhotos } from './catalog-api';

@Component({
  selector: 'app-product-gallery',
  templateUrl: './product-gallery.html',
  styleUrls: ['./catalog.css', './work.css'],
})
export class ProductGallery {
  private readonly destroy = inject(DestroyRef);
  private readonly api = inject(ApiClient);
  readonly product = input.required<Product>();
  readonly disabled = input(false);
  readonly changed = output<Product>();
  readonly busyChange = output<boolean>();

  protected readonly pending = signal<LocalPhoto[]>([]);
  protected readonly alternateOrder = signal<Photo[] | null>(null);
  protected readonly gallery = computed(() => this.alternateOrder() ?? this.product().images);
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
  private dragged: number | null = null;

  constructor() {
    this.destroy.onDestroy(() => releasePhotos(this.pending()));
  }

  protected choose(event: Event) {
    const control = event.target as HTMLInputElement;
    const files = [...(control.files ?? [])];
    control.value = '';
    if (!files.length || this.cleanupPending()) return;
    this.error.set('');
    const replace = this.recovering();
    if (files.length + (replace ? 0 : this.pending().length) > 12) {
      this.error.set('Podés subir hasta 12 fotos por vez. Quitá algunas de la selección o elegí un grupo más chico.');
      return;
    }
    const selected = localPhotos(files);
    if (replace) releasePhotos(this.pending());
    this.pending.update((list) => replace ? selected : [...list, ...selected]);
  }

  protected remove(photo: LocalPhoto) {
    releasePhotos([photo]);
    this.pending.update((list) => list.filter((item) => item.key !== photo.key));
  }

  protected async closeRecovery() {
    if (!this.recovering() || this.busy() || this.disabled()) return;
    this.start('refresh');
    const id = this.product().id;
    try {
      const result = await closePhotoUpload(this.api, this.destroy, id, this.uploadState());
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
      releasePhotos(this.pending());
      this.pending.set([]);
      this.message.set(photoCloseReady(another));
    } finally {
      if (!this.destroy.destroyed) this.finish();
    }
  }

  protected async upload() {
    const list = this.pending();
    if (this.busy() || this.disabled() || this.cleanupPending() || !list.length || list.some((photo) => photo.error) || this.needsReview() || this.alternateOrder()) return;
    const product = this.product();
    this.start('upload');
    try {
      const updated = await uploadPhotos(this.api, this.destroy, product, list, this.uploadState());
      if (this.destroy.destroyed) return;
      this.changed.emit(updated);
      releasePhotos(list);
      this.pending.set([]);
      this.recovering.set(hasPendingPhotoUpload(product.id));
      this.message.set('Fotos agregadas a la galería.');
    } catch (error) {
      if (this.destroy.destroyed) return;
      const recovering = !!this.uploadState().attempt || hasPendingPhotoUpload(product.id);
      this.recovering.set(recovering);
      if (this.cleanupPending()) return;
      const stateError = photoUploadFailure(error, recovering);
      const fields = fieldErrors(error);
      if (stateError) {
        this.error.set(stateError);
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
    this.run(this.api.put<Data<Product>>(`${products}/${this.product().id}/images/order`, { ids: this.gallery().map((photo) => photo.id) }), 'order', 'Orden y portada guardados.');
  }

  protected reload() {
    if (this.busy() || this.disabled()) return;
    this.run(this.api.get<Data<Product>>(`${products}/${this.product().id}`), 'refresh', 'Galería actualizada.');
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
