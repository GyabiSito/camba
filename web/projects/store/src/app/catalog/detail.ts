import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  inject,
  linkedSignal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiClient, apiMessage, CART_CHANGED, formatMoney } from '@camba/shared';
import { firstValueFrom, map } from 'rxjs';
import type { Cart, Data } from '../shopper/shopper';
import { catalogParams, PageResult, Product, readCatalogQuery, useStoreMeta } from './catalog-data';
import { ProductPhoto } from './product-media';

interface CartFeedback {
  kind: 'idle' | 'working' | 'done' | 'error';
  message?: string;
}

@Component({
  selector: 'store-product',
  imports: [RouterLink, ProductPhoto],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './detail.html',
  styleUrl: './detail.css',
})
export class StoreProduct {
  private readonly api = inject(ApiClient);
  private readonly document = inject(DOCUMENT);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly result = toSignal(
    this.route.data.pipe(map((data) => data['result'] as PageResult<Product>)),
    { requireSync: true },
  );
  protected readonly product = computed(() => {
    const result = this.result();
    return result.kind === 'ready' ? result.data : undefined;
  });
  protected readonly backParams = toSignal(
    this.route.queryParamMap.pipe(map((params) => catalogParams(readCatalogQuery(params)))),
    { requireSync: true },
  );
  protected readonly activePhoto = linkedSignal({ source: this.product, computation: () => 0 });
  protected readonly cart = linkedSignal({
    source: this.product,
    computation: (): CartFeedback => ({ kind: 'idle' }),
  });
  protected readonly amount = formatMoney;
  protected readonly retryUrl = computed(() => {
    const segments = this.route.snapshot.url.map((segment) => segment.path);
    return this.router.serializeUrl(
      this.router.createUrlTree(['/', ...segments], {
        queryParams: this.backParams(),
      }),
    );
  });

  constructor() {
    useStoreMeta(() => {
      const product = this.product();
      if (product) {
        return {
          title: product.name,
          description:
            product.description?.trim().replace(/\s+/g, ' ').slice(0, 155) ||
            `Consultá el precio, las fotos y la disponibilidad de ${product.name} en Camba.`,
          canonical: `/producto/${product.slug}`,
        };
      }
      return this.result().kind === 'missing'
        ? {
            title: 'Producto no disponible',
            description: 'Explorá otros productos en la tienda Camba.',
            noindex: true,
          }
        : {
            title: 'Producto temporalmente no disponible',
            description: 'Volvé a intentar en unos instantes.',
            noindex: true,
          };
    });
  }

  protected async add(product: Product): Promise<void> {
    if (!product.in_stock || this.cart().kind === 'working') return;
    this.cart.set({ kind: 'working' });
    try {
      await firstValueFrom(this.api.post(`/api/v1/cart/items/${product.id}`));
      this.document.defaultView?.dispatchEvent(new Event(CART_CHANGED));
      if (this.product()?.id === product.id) {
        this.cart.set({ kind: 'done', message: 'Producto agregado al carrito.' });
      }
    } catch (error) {
      if (this.product()?.id !== product.id) return;
      let message =
        'No pudimos comprobar si se agregó. Revisá tu carrito antes de intentarlo de nuevo.';
      if (error instanceof HttpErrorResponse && error.status >= 400 && error.status < 500) {
        message = apiMessage(error, 'No pudimos agregar el producto. Volvé a intentarlo.');
        if (error.status === 400)
          message = 'No pudimos acceder a tu carrito. Actualizá la página y volvé a intentar.';
        if (error.status === 404) message = 'El producto ya no está disponible.';
        if (error.status === 409)
          message = 'Tu sesión cambió. Actualizá la página antes de volver a intentar.';
        if (error.status === 422) {
          message = 'No hay stock para agregar otra unidad. Revisá tu carrito.';
          if (error.error?.errors?.quantity) {
            const atLimit = await firstValueFrom(
              this.api.get<Data<Cart>>('/api/v1/cart').pipe(
                map(({ data }) =>
                  data.items.some(
                    (item) => item.product_id === product.id && item.quantity === item.product?.stock,
                  ),
                ),
              ),
            ).catch(() => false);
            if (this.product() !== product) return;
            if (atLimit) {
              this.cart.set({
                kind: 'done',
                message: 'Ya tenés en el carrito todas las unidades disponibles.',
              });
              return;
            }
          }
        }
      }
      this.cart.set({ kind: 'error', message });
    }
  }
}
