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
  `,
  styles: `
    :host {
      display: grid;
      position: relative;
      overflow: hidden;
      width: 100%;
      background: color-mix(in srgb, var(--line) 36%, var(--paper));
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
      border-radius: 0.75rem;
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
      border-radius: 0.75rem;
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
  `,
})
export class ProductGrid {
  readonly products = input.required<Product[]>();
  readonly query = input<CatalogQuery>();
  readonly prioritizeFirst = input(false);
  protected readonly money = formatMoney;
  protected readonly backParams = computed(() => {
    const query = this.query();
    return query ? catalogParams(query) : null;
  });
}
