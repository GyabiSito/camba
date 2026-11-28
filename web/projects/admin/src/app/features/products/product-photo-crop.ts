import { Component, DestroyRef, ElementRef, afterNextRender, inject, input, output, signal, viewChild } from '@angular/core';
import type { LocalPhoto } from './data-access/catalog-api';

@Component({
  selector: 'app-product-photo-crop',
  templateUrl: './product-photo-crop.html',
  styleUrl: './product-photo-crop.css',
})
export class ProductPhotoCrop {
  private readonly destroy = inject(DestroyRef);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly preview = viewChild.required<ElementRef<HTMLCanvasElement>>('preview');
  readonly sources = input.required<readonly LocalPhoto[]>();
  readonly completed = output<File[]>();
  readonly canceled = output();

  protected readonly index = signal(0);
  protected readonly loading = signal(true);
  protected readonly encoding = signal(false);
  protected readonly error = signal('');
  protected readonly zoom = signal(100);
  protected readonly x = signal(50);
  protected readonly y = signal(50);
  private readonly crops: File[] = [];
  private source?: HTMLImageElement;
  private drag?: { id: number; x: number; y: number; clientX: number; clientY: number };

  constructor() {
    afterNextRender(() => {
      this.dialog().nativeElement.showModal();
      void this.load();
    });
  }

  protected cancel(event?: Event) {
    event?.preventDefault();
    this.dialog().nativeElement.close();
    this.canceled.emit();
  }

  private async load() {
    this.loading.set(true);
    this.error.set('');
    this.source = undefined;
    this.zoom.set(100);
    this.x.set(50);
    this.y.set(50);
    try {
      const source = new Image();
      source.src = this.sources()[this.index()].url;
      await source.decode();
      if (this.destroy.destroyed) return;
      if (Math.max(source.naturalWidth, source.naturalHeight) > 4096) {
        this.error.set('La foto supera los 4096 píxeles por lado. Elegí una imagen más chica.');
        return;
      }
      this.source = source;
      this.draw(this.preview().nativeElement);
    } catch {
      if (!this.destroy.destroyed) this.error.set('No pudimos leer esta imagen. Elegí otra foto.');
    } finally {
      if (!this.destroy.destroyed) this.loading.set(false);
    }
  }

  protected adjust(control: 'zoom' | 'x' | 'y', event: Event) {
    this[control].set(Number((event.target as HTMLInputElement).value));
    this.draw(this.preview().nativeElement);
  }

  protected beginDrag(event: PointerEvent) {
    if (!this.source || this.drag || event.button !== 0) return;
    this.drag = { id: event.pointerId, x: this.x(), y: this.y(), clientX: event.clientX, clientY: event.clientY };
    this.preview().nativeElement.setPointerCapture(event.pointerId);
  }

  protected moveDrag(event: PointerEvent) {
    if (!this.drag || event.pointerId !== this.drag.id || !this.source) return;
    const { width, height } = this.frame(this.source);
    const bounds = this.preview().nativeElement.getBoundingClientRect();
    const dx = this.source.naturalWidth - width;
    const dy = this.source.naturalHeight - height;
    if (dx > 0) this.x.set(this.clamp(this.drag.x - (event.clientX - this.drag.clientX) / bounds.width * width / dx * 100));
    if (dy > 0) this.y.set(this.clamp(this.drag.y - (event.clientY - this.drag.clientY) / bounds.height * height / dy * 100));
    this.draw(this.preview().nativeElement);
  }

  protected endDrag(event: PointerEvent) {
    if (event.pointerId !== this.drag?.id) return;
    this.drag = undefined;
    const canvas = this.preview().nativeElement;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }

  protected async useCrop() {
    if (!this.source || this.encoding() || this.loading() || this.error()) return;
    this.encoding.set(true);
    const canvas = document.createElement('canvas');
    const units = Math.max(1, Math.min(320, Math.floor(this.frame(this.source).height / 5)));
    canvas.width = units * 4;
    canvas.height = units * 5;
    this.draw(canvas);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', .94));
    if (this.destroy.destroyed) return;
    this.encoding.set(false);
    if (!blob) {
      this.error.set('No se pudo preparar el recorte. Cerrá esta ventana y volvé a elegir la foto.');
      return;
    }
    const name = this.sources()[this.index()].file.name.replace(/\.[^.]*$/, '');
    this.crops.push(new File([blob], `${name}.${blob.type === 'image/webp' ? 'webp' : 'png'}`, { type: blob.type }));
    if (this.crops.length === this.sources().length) {
      this.dialog().nativeElement.close();
      this.completed.emit(this.crops);
    } else {
      this.index.update(index => index + 1);
      void this.load();
    }
  }

  private clamp(value: number) {
    return Math.round(Math.max(0, Math.min(100, value)));
  }

  private frame(image: HTMLImageElement) {
    const height = Math.min(image.naturalHeight, image.naturalWidth * 5 / 4) * 100 / this.zoom();
    const width = height * 4 / 5;
    return {
      height, width,
      left: (image.naturalWidth - width) * this.x() / 100,
      top: (image.naturalHeight - height) * this.y() / 100,
    };
  }

  private draw(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (!context || !this.source) return;
    const { left, top, width, height } = this.frame(this.source);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(this.source, left, top, width, height, 0, 0, canvas.width, canvas.height);
  }
}
