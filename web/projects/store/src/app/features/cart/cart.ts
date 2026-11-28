import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Component, computed, DestroyRef, inject, PLATFORM_ID, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { apiMessage, CART_CHANGED, formatMoney } from '@camba/shared';
import { firstValueFrom, map } from 'rxjs';
import { CatalogCovers } from '../../shared/catalog-covers';
import { readPublicStoreInfo } from '../../shared/data-access/public-store-info';
import { ProductPhoto } from '../../shared/product-photo';
import { OrdersApi } from '../orders/data-access/orders.api';
import { CartApi } from './data-access/cart.api';
import { Cart, CartCheckout, CartItem } from './data-access/cart.models';

@Component({
  imports: [RouterLink, FormsModule, ProductPhoto],
  templateUrl: './cart.html',
  styleUrls: ['../../shared/shopper.css', '../../shared/purchase-design.css', './cart-media.css'],
})
export class CartPage {
  private readonly client = inject(CartApi);
  private readonly orders = inject(OrdersApi);
  private readonly router = inject(Router);
  private readonly browser = inject(DOCUMENT).defaultView;
  private readonly inBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);
  protected readonly covers = inject(CatalogCovers);
  protected readonly items = signal<CartItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly updated = signal(false);
  protected readonly error = signal('');
  protected readonly action = signal<number | null>(null);
  protected readonly checkout = signal<CartCheckout | null>(null);
  protected readonly paymentBusy = signal(false);
  protected readonly paymentNote = signal('');
  protected readonly quantities = signal<Record<number, number | null>>({});
  protected readonly freeDeliveryMinimum = toSignal(
    readPublicStoreInfo().pipe(map((info) => info?.free_delivery_minimum_cents ?? null)),
    { initialValue: null },
  );
  protected readonly total = computed(() =>
    this.items().reduce((sum, item) => sum + (item.product?.price_cents ?? 0) * item.quantity, 0),
  );
  protected readonly hasUnavailable = computed(() =>
    this.items().some((item) => !item.available || item.quantity > this.maxQuantity(item)),
  );
  protected readonly unsaved = computed(() =>
    this.items().some((item) => this.quantities()[item.product_id] !== item.quantity),
  );
  protected readonly money = formatMoney;

  constructor() {
    void this.refresh();
  }

  protected maxQuantity(item: CartItem) {
    return Math.min(item.product?.stock ?? 0, 1000);
  }

  private updateCart(cart: Cart) {
    this.items.set(cart.items);
    this.checkout.set(cart.checkout ?? null);
    for (const item of cart.items) if (item.product?.slug) this.covers.load(item.product.slug);
    const previous = this.quantities();
    this.quantities.set(
      Object.fromEntries(
        cart.items.map((item) => [item.product_id, previous[item.product_id] ?? item.quantity]),
      ),
    );
    if (this.inBrowser && !this.destroyRef.destroyed) this.browser?.dispatchEvent(new Event(CART_CHANGED));
  }

  protected async refresh(showLoading = true) {
    this.loading.set(showLoading);
    this.error.set('');
    try {
      const { data } = await firstValueFrom(this.client.getCart());
      this.quantities.set({});
      this.updateCart(data);
    } catch (error) {
      this.error.set(apiMessage(error, 'No pudimos cargar el carrito.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected async resumePayment(checkout: CartCheckout) {
    if (this.paymentBusy() || this.action() !== null || this.unsaved()) return;
    this.paymentBusy.set(true);
    this.error.set('');
    this.paymentNote.set('');
    try {
      const { data } = await firstValueFrom(this.client.resumeCheckout(checkout.reference));
      this.checkout.set(data);
      if (data.state === 'paid') await this.router.navigate(['/pedidos', data.reference]);
      if (data.state === 'ready' && data.checkout_url && new URL(data.checkout_url).protocol === 'https:') {
        window.location.assign(data.checkout_url);
      }
    } catch {
      await this.refresh(false);
      this.error.set('No pudimos reabrir el pago. Revisá el estado del carrito antes de continuar.');
    } finally {
      this.paymentBusy.set(false);
    }
  }

  protected async checkPayment(checkout: CartCheckout) {
    if (this.paymentBusy() || this.action() !== null) return;
    this.paymentBusy.set(true);
    this.paymentNote.set('');
    this.error.set('');
    try {
      await firstValueFrom(this.orders.refreshPayment(checkout.reference));
      await this.refresh(false);
      if (this.checkout()?.state === 'checking') {
        this.paymentNote.set('Solicitamos la verificación. Si todavía no hay novedades, volvé a consultar en un momento.');
      }
    } catch {
      this.error.set('No pudimos consultar el estado del pago. Volvé a intentar.');
    } finally {
      this.paymentBusy.set(false);
    }
  }

  protected setQuantity(id: number, quantity: number | null) {
    this.quantities.update((values) => ({ ...values, [id]: quantity }));
    this.updated.set(false);
  }

  protected async save(item: CartItem, remove: boolean) {
    if (this.action() !== null || this.paymentBusy()) return;
    const id = item.product_id;
    const quantity = this.quantities()[id];
    if (
      !remove &&
      (quantity === null ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > this.maxQuantity(item))
    )
      return;
    this.action.set(id);
    this.error.set('');
    this.updated.set(false);
    try {
      if (remove) {
        await firstValueFrom(this.client.removeItem(id));
        await this.refresh(false);
      } else {
        const { data } = await firstValueFrom(this.client.updateItem(id, quantity!));
        this.updateCart(data);
        const saved = data.items.find((current) => current.product_id === id);
        if (saved) this.setQuantity(id, saved.quantity);
      }
      this.updated.set(true);
    } catch (error) {
      this.error.set(
        apiMessage(
          error,
          'No pudimos actualizar el carrito. Revisá la disponibilidad y volvé a intentar.',
        ),
      );
    } finally {
      this.action.set(null);
    }
  }
}
