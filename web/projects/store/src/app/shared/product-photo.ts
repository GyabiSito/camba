import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import type { ProductImage } from '@camba/shared';
@Component({
  selector: 'store-product-photo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (photo(); as image) {
      @if (!failed()) {
        <picture>
          @if (variant() === 'hero' && srcset()) {
            <source media="(max-width: 30rem)" [srcset]="srcset()" />
          }
          <img
            [src]="variant() === 'card' || variant() === 'thumb' ? image.thumbnail_url : image.url"
            [attr.srcset]="variant() === 'card' ? srcset() : null"
            [alt]="decorative() ? '' : image.alt || name()"
            width="400"
            height="500"
            [attr.loading]="priority() ? 'eager' : 'lazy'"
            [attr.fetchpriority]="priority() ? 'high' : null"
            (error)="failed.set(true)"
          />
        </picture>
      }
    }
    @if ((!photo() || failed()) && !decorative()) {
      <span class="unavailable">Foto no disponible</span>
    }
    @if ((!photo() || failed()) && decorative() && variant() === 'thumb') {
      <svg class="photo-placeholder" viewBox="0 0 24 24" aria-hidden="true" fill="none"
        stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 5 4 7 2.5 11l4 2L8 11.5V20h8v-8.5l1.5 1.5 4-2L20 7l-4-2a4 4 0 0 1-8 0Z" />
      </svg>
    }
  `,
  styles: `
    :host {
      display: grid;
      position: relative;
      overflow: hidden;
      width: 100%;
      background: var(--photo-background, color-mix(in srgb, var(--line) 36%, var(--paper)));
    }
    img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: var(--photo-fit, cover);
    }
    .unavailable {
      align-self: center;
      padding: 0.5rem;
      text-align: center;
      color: var(--muted);
      font-size: 0.875rem;
    }
    .photo-placeholder {
      place-self: center;
      width: 1.5rem;
      color: var(--muted);
      opacity: 0.68;
    }
  `,
})
export class ProductPhoto {
  readonly photo = input<ProductImage>();
  readonly name = input.required<string>();
  readonly decorative = input(false);
  readonly priority = input(false);
  readonly variant = input<'full' | 'hero' | 'card' | 'thumb'>('full');
  protected readonly failed = linkedSignal({ source: this.photo, computation: () => false });
  protected readonly srcset = computed(() => {
    const image = this.photo();
    return image && image.thumbnail_url !== image.url
      ? `${image.thumbnail_url} 1x, ${image.url} 2x`
      : null;
  });
}
