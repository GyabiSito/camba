import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiClient, apiMessage, CART_CHANGED, formatMoney } from '@camba/shared';
import { firstValueFrom } from 'rxjs';
import { api, Cart, CartItem, Data } from './shopper';

@Component({
  imports: [RouterLink, FormsModule],
  templateUrl: './cart.html',
  styleUrls: ['./shopper.css', './purchase-design.css'],
})
export class CartPage {
  private readonly client = inject(ApiClient);
  protected readonly items = signal<CartItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly updated = signal(false);
  protected readonly error = signal('');
  protected readonly action = signal<number | null>(null);
  protected readonly quantities = signal<Record<number, number | null>>({});
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

  private updateCart(items: CartItem[]) {
    this.items.set(items);
    const previous = this.quantities();
    this.quantities.set(
      Object.fromEntries(
        items.map((item) => [item.product_id, previous[item.product_id] ?? item.quantity]),
      ),
    );
  }

  protected async refresh() {
    this.loading.set(true);
    this.error.set('');
    try {
      const { data } = await firstValueFrom(this.client.get<Data<Cart>>(api + '/cart'));
      this.quantities.set({});
      this.updateCart(data.items);
    } catch (error) {
      this.error.set(apiMessage(error, 'No pudimos cargar el carrito.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected setQuantity(id: number, quantity: number | null) {
    this.quantities.update((values) => ({ ...values, [id]: quantity }));
    this.updated.set(false);
  }

  protected async save(item: CartItem, remove: boolean) {
    if (this.action() !== null) return;
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
      const url = api + '/cart/items/' + id;
      if (remove) {
        await firstValueFrom(this.client.delete<void>(url));
        this.updateCart(this.items().filter((current) => current.product_id !== id));
      } else {
        const { data } = await firstValueFrom(this.client.put<Data<Cart>>(url, { quantity }));
        this.updateCart(data.items);
        const saved = data.items.find((current) => current.product_id === id);
        if (saved) this.setQuantity(id, saved.quantity);
      }
      this.updated.set(true);
      window.dispatchEvent(new Event(CART_CHANGED));
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
