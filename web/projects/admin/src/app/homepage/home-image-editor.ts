import { Component, input, model, output, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiClient, apiMessage, HomeAsset, HomeImage } from '@camba/shared';
import { firstValueFrom } from 'rxjs';
import { acceptedPhotos } from '../catalog/catalog-api';

@Component({
  selector: 'camba-home-image-editor', imports: [FormsModule], styleUrl: './homepage-media.css',
  template: `
    <fieldset class="image-editor">
      <legend>{{ label() }}</legend>
      <div class="crop-previews" [class.crop-previews--portrait]="portrait()">
        @if (image(); as photo) {
          <figure><img [src]="url(photo.key)" [alt]="photo.alt" [style.object-position]="position(photo)" [class.portrait]="portrait()"><figcaption>{{ portrait() ? 'Móvil' : 'Escritorio' }} · aproximación</figcaption></figure>
          @if (!portrait()) { <figure><img class="portrait" [src]="url(photo.key)" [alt]="photo.alt" [style.object-position]="position(photo)"><figcaption>Móvil · aproximación</figcaption></figure> }
        } @else { <p class="muted">{{ optional() ? 'Sin variante: se usa la foto principal.' : 'Elegí una foto de la biblioteca o subila.' }}</p> }
      </div>
      @if (image(); as photo) {
        <label class="field">Descripción de la foto<input [ngModel]="photo.alt" (ngModelChange)="edit({alt: $event})" maxlength="300"></label>
        <details><summary>Ajustar punto de recorte</summary>
          <p class="muted">Estos marcos son aproximados; revisá el resultado en Vista previa. Sin ajustes se conserva el recorte original de la tienda.</p>
          <label class="field">Horizontal · {{ photo.x ?? 'original' }}<input type="range" min="0" max="100" [ngModel]="photo.x ?? 50" (ngModelChange)="edit({x: +$event})"></label>
          <label class="field">Vertical · {{ photo.y ?? 'original' }}<input type="range" min="0" max="100" [ngModel]="photo.y ?? 50" (ngModelChange)="edit({y: +$event})"></label>
          <button class="button button--quiet" type="button" (click)="edit({x: null, y: null})">Usar recorte original</button>
        </details>
      }
      <details><summary>Elegir otra foto</summary>
        <label class="field upload">Subir foto · JPEG, PNG o WebP<input type="file" [accept]="accepted" [disabled]="busy()" (change)="upload($event)"></label>
        <p class="muted">Hasta 10 MiB y 4096 píxeles por lado. Se valida y optimiza en el servidor; las fotos publicadas se conservan.</p>
        @if (busy()) { <p role="status">Subiendo foto…</p> }
        @if (error()) { <p role="alert">{{ error() }}</p> }
        <div class="image-library" aria-label="Biblioteca de fotos">
          @for (entry of entries(); track entry[0]) {
            <button type="button" [attr.aria-label]="'Elegir foto ' + photoName(entry[0], $index)" [attr.aria-pressed]="image()?.key === entry[0]" (click)="choose(entry[0])"><img [src]="url(entry[0], true)" alt="" loading="lazy"><span>{{ photoName(entry[0], $index) }}</span></button>
          }
        </div>
      </details>
      @if (optional() && image()) { <button type="button" class="button button--quiet" (click)="image.set(null)">Quitar variante</button> }
    </fieldset>
  `,
})
export class HomeImageEditor {
  readonly image = model<HomeImage | null>(null);
  readonly label = input.required<string>();
  readonly assets = input.required<Record<string, HomeAsset>>();
  readonly storeUrl = input.required<string>();
  readonly optional = input(false);
  readonly portrait = input(false);
  readonly uploaded = output<{ key: string; asset: HomeAsset }>();
  protected readonly accepted = acceptedPhotos;
  protected readonly busy = signal(false);
  isUploading() { return this.busy(); }
  protected readonly error = signal('');
  private readonly api = inject(ApiClient);
  protected entries() { return Object.entries(this.assets()); }
  protected photoName(key: string, index: number) { return this.assets()[key]?.url.startsWith('/demo-home/') ? key.replace(/^atelier-/, '').replace(/[-_]/g, ' ') : `Cargada ${index + 1}`; }
  protected position(photo: HomeImage) { return `${photo.x ?? 50}% ${photo.y ?? 50}%`; }
  protected url(key: string, thumbnail = false) {
    const asset = this.assets()[key];
    const url = (thumbnail ? asset?.thumbnail_url : asset?.url) ?? '';
    return url.startsWith('/demo-home/') ? new URL(url, this.storeUrl()).href : url;
  }
  protected edit(fields: Partial<HomeImage>) { this.image.update(image => image ? { ...image, ...fields } : image); }
  protected choose(key: string) { this.image.set({ key, alt: this.image()?.alt ?? '', x: null, y: null }); }
  protected async upload(event: Event) {
    const field = event.target as HTMLInputElement;
    const file = field.files?.[0];
    if (!file) return;
    this.error.set('');
    if (!acceptedPhotos.split(',').includes(file.type) || file.size > 10 * 1024 * 1024) {
      this.error.set('Elegí una imagen JPEG, PNG o WebP de hasta 10 MiB.'); field.value = ''; return;
    }
    this.busy.set(true);
    try {
      const body = new FormData(); body.append('photo', file);
      const { data } = await firstValueFrom(this.api.post<{ data: { key: string; asset: HomeAsset } }>('/api/v1/admin/homepage/media', body));
      this.uploaded.emit(data); this.choose(data.key);
    } catch (error) { this.error.set(apiMessage(error, 'No se pudo subir la foto. Conservamos la selección anterior.')); }
    finally { this.busy.set(false); field.value = ''; }
  }
}
