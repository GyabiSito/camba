import { Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiClient } from '@camba/shared';
import { Observable, finalize } from 'rxjs';
import { Data, LocalPhoto, Photo, Product, acceptedPhotos, disconnected, fieldErrors, localPhotos, products, releasePhotos, summaryError, uploadBody, uploadError } from './catalog-api';

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
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly acceptedPhotos = acceptedPhotos;
  protected readonly hasError = (photo: LocalPhoto) => !!photo.error;
  private dragged: number | null = null;

  constructor() {
    this.destroy.onDestroy(() => releasePhotos(this.pending()));
  }

  protected choose(event: Event) {
    const control = event.target as HTMLInputElement;
    const files = [...(control.files ?? [])];
    control.value = '';
    this.error.set('');
    if (files.length + this.pending().length > 12) {
      this.error.set('Podés subir hasta 12 fotos por vez. Quitá algunas de la selección o elegí un grupo más chico.');
      return;
    }
    this.pending.update((list) => [...list, ...localPhotos(files)]);
  }

  protected remove(photo: LocalPhoto) {
    releasePhotos([photo]);
    this.pending.update((list) => list.filter((item) => item.key !== photo.key));
  }

  protected upload() {
    const list = this.pending();
    if (!list.length || list.some((photo) => photo.error) || this.needsReview() || this.alternateOrder() || this.busy() || this.disabled()) return;
    this.run(
      this.api.post<Data<Product>>(`${products}/${this.product().id}/images`, uploadBody(list.map((photo) => photo.file))),
      'upload',
      'Fotos agregadas a la galería.',
    );
  }

  protected move(from: number, to: number) {
    if (this.disabled() || this.busy() || this.needsReview() || from === to || from < 0 || to < 0 || to >= this.gallery().length) return;
    const next = [...this.gallery()];
    next.splice(to, 0, next.splice(from, 1)[0]);
    this.alternateOrder.set(next.map((photo) => photo.id).join() === this.product().images.map((photo) => photo.id).join() ? null : next);
    this.message.set(`Foto movida a la posición ${to + 1}.`);
  }

  protected drag(event: DragEvent, index: number) {
    if (this.disabled() || this.busy() || this.needsReview()) {
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
    this.run(this.api.get<Data<Product>>(`${products}/${this.product().id}`), 'refresh', 'Galería actualizada. Quitá de la selección las fotos que ya se hayan guardado.');
  }

  private run(request: Observable<Data<Product>>, action: 'upload' | 'order' | 'refresh', message: string) {
    this.busy.set(action);
    this.busyChange.emit(true);
    this.error.set('');
    this.message.set('');
    request.pipe(
      takeUntilDestroyed(this.destroy),
      finalize(() => {
        this.busy.set('');
        this.busyChange.emit(false);
      }),
    ).subscribe({
      next: ({ data }) => {
        this.changed.emit(data);
        if (action === 'upload') {
          releasePhotos(this.pending());
          this.pending.set([]);
        }
        this.alternateOrder.set(null);
        this.needsReview.set(false);
        this.message.set(message);
      },
      error: (error) => {
        if (action === 'upload' && disconnected(error)) {
          this.needsReview.set(true);
          this.error.set('Se perdió la conexión durante la carga. Actualizá la galería y revisá qué fotos se guardaron antes de subirlas de nuevo.');
          return;
        }
        const fields = fieldErrors(error);
        if (action === 'upload' && Object.keys(fields).length) {
          this.pending.update((list) => list.map((photo, index) => ({
            ...photo, error: fields[`photos.${index}`]?.map(uploadError).join(' ') ?? photo.error,
          })));
          this.error.set('No se agregó ninguna foto. Revisá los archivos indicados y volvé a intentar.');
        } else if (action === 'order' && fields['ids']) {
          this.needsReview.set(true);
          this.error.set('Cambió el conjunto de fotos. Actualizá la galería antes de volver a ordenar.');
        } else {
          this.error.set(summaryError(error, 'No se pudieron guardar o cargar las fotos.'));
        }
      },
    });
  }
}
