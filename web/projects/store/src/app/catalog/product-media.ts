import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatMoney } from '@camba/shared';
import { CatalogQuery, catalogParams, Product, ProductImage } from './catalog-data';

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

@Component({
  selector: 'store-product-grid',
  imports: [RouterLink, ProductPhoto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="products" role="list">
      @for (product of products(); track product.id) {
        <li>
          <store-product-photo
            [photo]="product.images[0]"
            [name]="product.name"
            [priority]="prioritizeFirst() && $first"
            variant="card"
          />
          @let gallery = featuredGallery();
          @if (gallery?.slug === product.slug && gallery?.images?.[1]; as alternate) {
            <store-product-photo class="alternate" [photo]="alternate" [name]="product.name"
              [decorative]="true" variant="card" />
          }
          <div class="caption">
            <h3>
              <a [routerLink]="['/producto', product.slug]" [queryParams]="backParams()">{{
                product.name
              }}</a>
            </h3>
            <p class="classification">
              {{ product.category.name }}
              @if (product.brand; as brand) {
                · {{ brand.name }}
              }
            </p>
            <p class="price">{{ money(product.price_cents) }}</p>
            @if (!product.in_stock) {
              <p class="stock">Sin stock</p>
            }
          </div>
        </li>
      }
    </ul>
  `,
  styles: `
    .products {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: clamp(1rem, 2vw, 2rem) clamp(0.625rem, 2vw, 1.5rem);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      position: relative;
      min-width: 0;
    }
    a {
      color: inherit;
      text-decoration: none;
    }
    a::after {
      position: absolute;
      inset: 0;
      content: '';
      border-radius: var(--home-card-radius, 0.75rem);
    }
    a:focus-visible::after {
      outline: inherit;
      outline-offset: 3px;
    }
    a:hover {
      text-decoration: underline;
    }
    store-product-photo {
      aspect-ratio: 4 / 5;
      border-radius: var(--home-card-radius, 0.75rem);
    }
    .alternate { position: absolute; inset: 0 0 auto; opacity: 0; pointer-events: none; }
    @media (hover: hover) and (pointer: fine) {
      li:hover .alternate:has(img) { opacity: 1; }
    }
    .caption {
      padding-block: 0.75rem 0.25rem;
      overflow-wrap: anywhere;
    }
    .caption :is(p, h3) {
      margin: 0;
    }
    .classification {
      color: var(--muted);
      font-size: 0.8125rem;
    }
    .caption h3 {
      margin-block: 0 0.2rem;
      font-size: clamp(1rem, 2vw, 1.25rem);
      line-height: 1.25;
    }
    .price {
      font-variant-numeric: tabular-nums;
      font-weight: 650;
    }
    .stock {
      padding-top: 0.25rem;
      color: var(--muted);
      font-size: 0.875rem;
    }
    @media (max-width: 62rem) {
      .products {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }
    @media (max-width: 38rem) {
      .products {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
    :host(.home-products) .products {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      row-gap: .15rem;
    }
    :host(.home-products) li { display: grid; grid-row: span 4; grid-template-rows: subgrid; margin-bottom: .75rem; }
    :host(.home-products) .caption { display: contents; }
    :host(.home-products) h3 { grid-row: 2; overflow-wrap: anywhere; }
    :host(.home-products) .price { grid-row: 3; }
    :host(.home-products) .stock { grid-row: 4; }
    @media (max-width: 48rem) {
      :host(.home-products) .products { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    :host(.home-products) .classification { display: none; }
    :host(.home-products) .caption h3 { font-size: clamp(1rem, 1.28vw, 1.18rem); margin-block: .5rem .1rem; }
    :host(.home-products) a:focus-visible {
      outline-color: var(--home-action);
    }
    :host(.catalog-products) store-product-photo {
      --photo-background: var(--paper, #fcfaf6);
      border-radius: 0.45rem;
    }
    :host(.catalog-products) .caption { padding: 0.7rem 0.1rem 0.25rem; }
    :host(.catalog-products) .caption h3 { font-size: clamp(1rem, 1.35vw, 1.2rem); }
    :host(.catalog-products) .classification { margin-bottom: 0.3rem !important; }
    :host(.catalog-products) .price { color: var(--ink, #24201e); }
    :host(.catalog-products) .stock { color: var(--muted, #635956); }
    :host(.catalog-products) a:focus-visible::after {
      outline: 3px solid var(--home-action, #821f40);
      outline-offset: 3px;
    }
  `,
})
export class ProductGrid {
  readonly products = input.required<Product[]>();
  readonly query = input<CatalogQuery>();
  readonly prioritizeFirst = input(false);
  readonly featuredGallery = input<Product>();
  protected readonly money = formatMoney;
  protected readonly backParams = computed(() => {
    const query = this.query();
    return query ? catalogParams(query) : null;
  });
}
