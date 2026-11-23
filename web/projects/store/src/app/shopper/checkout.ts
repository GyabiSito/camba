import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiClient, apiMessage, CART_CHANGED, formatMoney } from '@camba/shared';
import { firstValueFrom } from 'rxjs';
import { AddressFields } from './address-fields';
import {
  Address,
  api,
  Buyer,
  Cart,
  Data,
  httpStatus,
  makeAddressForm,
  Order,
  Quote,
  Shipping,
} from './shopper';

type OrderInput = {
  items: { product_id: number; quantity: number }[];
  shipping_method: Shipping['method'];
  quote_token: string;
  contact: { name: string; email: string; phone: string };
  address?: ReturnType<ReturnType<typeof makeAddressForm>['getRawValue']>;
};

@Component({
  imports: [AddressFields, ReactiveFormsModule, RouterLink],
  templateUrl: './checkout.html',
  styleUrls: ['./shopper.css', './purchase-design.css'],
})
export class CheckoutPage {
  private readonly client = inject(ApiClient);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private pending: { key: string; body: OrderInput } | null = null;
  protected readonly quote = signal<Quote | null>(null);
  protected readonly method = signal<Shipping['method'] | null>(null);
  protected readonly selected = computed(() =>
    this.quote()?.shipping_options.find((option) => option.method === this.method()),
  );
  protected readonly buyer = signal<Buyer | null | undefined>(undefined);
  protected readonly addresses = signal<Address[]>([]);
  protected readonly empty = signal(false);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly uncertain = signal(false);
  protected readonly quoteError = signal('');
  protected readonly orderError = signal('');
  protected readonly money = formatMoney;
  protected readonly contact = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    phone: ['', Validators.maxLength(30)],
  });
  protected readonly address = makeAddressForm(this.fb);

  constructor() {
    void this.getQuote();
    void this.getBuyer();
  }

  private async getBuyer() {
    try {
      const { data } = await firstValueFrom(this.client.get<Data<Buyer>>(api + '/auth/me'));
      this.buyer.set(data);
      if (this.contact.controls.name.pristine) this.contact.controls.name.setValue(data.name);
      if (this.contact.controls.email.pristine) this.contact.controls.email.setValue(data.email);
      const addresses = await firstValueFrom(
        this.client.get<Data<Address[]>>(api + '/account/addresses'),
      );
      this.addresses.set(addresses.data);
    } catch (error) {
      if (httpStatus(error) === 401) this.buyer.set(null);
      // Saved addresses and prefilled details are optional; the shopper can enter them manually.
    }
  }

  protected async getQuote() {
    if (this.pending) return;
    this.loading.set(true);
    this.empty.set(false);
    this.quote.set(null);
    this.quoteError.set('');
    this.orderError.set('');
    try {
      const { data: cart } = await firstValueFrom(this.client.get<Data<Cart>>(api + '/cart'));
      if (cart.items.length === 0) {
        this.empty.set(true);
        return;
      }
      if (
        cart.items.some((item) => !item.available || item.quantity > 1000) ||
        cart.items.length > 50
      ) {
        this.quoteError.set(
          'El carrito tiene productos no disponibles o supera el límite de compra. Ajustalo antes de continuar.',
        );
        return;
      }
      const { data } = await firstValueFrom(
        this.client.post<Data<Quote>>(api + '/checkout/quote', {
          items: cart.items.map(({ product_id, quantity }) => ({ product_id, quantity })),
        }),
      );
      this.quote.set(data);
      if (!this.selected())
        this.method.set(
          data.shipping_options.length === 1 ? data.shipping_options[0].method : null,
        );
    } catch (error) {
      this.quoteError.set(
        httpStatus(error) === 422
          ? 'No hay stock para alguna de las cantidades. Volvé al carrito para ajustarlas.'
          : apiMessage(error, 'No pudimos cotizar la compra. Volvé a intentar.'),
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected applyAddress(id: string) {
    const saved = this.addresses().find((address) => address.id === Number(id));
    if (!saved) {
      this.address.reset();
      return;
    }
    this.address.reset({
      ...saved,
      details: saved.details ?? '',
      postal_code: saved.postal_code ?? '',
    });
    if (this.contact.controls.phone.pristine && !this.contact.controls.phone.value && saved.phone) {
      this.contact.controls.phone.setValue(saved.phone);
    }
  }

  protected async placeOrder() {
    if (this.busy()) return;
    this.orderError.set('');
    if (!this.pending) {
      const quote = this.quote();
      const option = this.selected();
      if (
        !quote ||
        !option ||
        this.contact.invalid ||
        (option.method === 'delivery' && this.address.invalid)
      ) {
        this.orderError.set('Completá el contacto y elegí cómo recibir tu pedido.');
        return;
      }
      if (!globalThis.crypto?.randomUUID) {
        this.orderError.set('Esta acción necesita una conexión segura. Abrí la tienda por HTTPS.');
        return;
      }
      this.pending = {
        key: crypto.randomUUID(),
        body: {
          items: quote.items.map(({ product_id, quantity }) => ({ product_id, quantity })),
          shipping_method: option.method,
          quote_token: option.quote_token,
          contact: this.contact.getRawValue(),
          ...(option.method === 'delivery' ? { address: this.address.getRawValue() } : {}),
        },
      };
    }
    this.busy.set(true);
    try {
      const { data } = await firstValueFrom(
        this.client.post<Data<Order>>(api + '/orders', this.pending.body, {
          'Idempotency-Key': this.pending.key,
        }),
      );
      this.uncertain.set(false);
      window.dispatchEvent(new Event(CART_CHANGED));
      await this.router.navigate(['/pedidos', data.reference]);
    } catch (error) {
      const status = httpStatus(error);
      // A transport/server failure can be reported after the transaction committed. Retry exactly the same request.
      if (status === undefined || status === 0 || status >= 500) {
        this.uncertain.set(true);
        this.orderError.set(
          'No pudimos comprobar si el pedido se creó. Reintentá el mismo pedido, o buscá la confirmación en tus compras.',
        );
      } else {
        this.pending = null;
        this.uncertain.set(false);
        if (status === 409 || status === 422) {
          this.orderError.set(
            status === 409
              ? 'La cotización cambió o venció. Revisá el carrito y pedí una nueva cotización.'
              : 'Revisá los datos ingresados y la disponibilidad de los productos.',
          );
          if (status === 409) this.quote.set(null);
        } else {
          this.orderError.set(
            apiMessage(error, 'No pudimos confirmar el pedido. Podés volver a intentar.'),
          );
        }
      }
    } finally {
      this.busy.set(false);
    }
  }
}
