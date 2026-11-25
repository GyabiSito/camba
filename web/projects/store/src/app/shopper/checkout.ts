import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiClient, apiMessage, CART_CHANGED, formatMoney } from '@camba/shared';
import { catchError, distinctUntilChanged, firstValueFrom, map, of, switchMap } from 'rxjs';
import { AddressFields } from './address-fields';
import { paymentsEnabled } from './payment-availability';
import {
  Address,
  AddressInput,
  addressGeography,
  api,
  Buyer,
  Cart,
  Data,
  httpStatus,
  makeAddressForm,
  Order,
  Quote,
  resetAddressForm,
  Shipping,
} from './shopper';

type OrderInput = {
  items: { product_id: number; quantity: number }[];
  shipping_method: Shipping['method'];
  quote_token: string;
  contact: { name: string; email: string; phone: string };
  address?: AddressInput;
};

@Component({
  imports: [AddressFields, ReactiveFormsModule, RouterLink],
  templateUrl: './checkout.html',
  styleUrls: ['./shopper.css', './purchase-design.css'],
})
export class CheckoutPage {
  protected readonly paymentsEnabled = paymentsEnabled;
  private readonly client = inject(ApiClient);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private pending: { key: string; body: OrderInput } | null = null;
  protected readonly quote = signal<Quote | null>(null);
  protected readonly method = signal<Shipping['method'] | null>(null);
  protected readonly buyer = signal<Buyer | null | undefined>(undefined);
  protected readonly addresses = signal<Address[]>([]);
  protected readonly savedAddress = signal<Address | null>(null);
  protected readonly savingAddress = signal(false);
  protected readonly addressFeedback = signal<{ error: boolean; text: string } | null>(null);
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
  private readonly geography = toSignal(
    this.address.valueChanges.pipe(
      map(() => addressGeography(this.address.getRawValue())),
      distinctUntilChanged(
        (a, b) => a?.department_id === b?.department_id && a?.locality_id === b?.locality_id,
      ),
    ),
    { initialValue: null },
  );
  private readonly retryDelivery = signal(0);
  private readonly deliveryRequest = computed(() => {
    const quote = this.quote();
    const address = this.geography();
    if (this.method() !== 'delivery' || !quote || !address) return null;
    return {
      address,
      items: quote.items.map(({ product_id, quantity }) => ({ product_id, quantity })),
      retry: this.retryDelivery(),
    };
  });
  private readonly deliveryResult = toSignal(
    toObservable(this.deliveryRequest).pipe(
      switchMap((request) =>
        request
          ? this.client
              .post<Data<Quote>>(api + '/checkout/quote', {
                items: request.items,
                address: request.address,
              })
              .pipe(
                map(({ data }) => {
                  const option = data.shipping_options.find(({ method }) => method === 'delivery');
                  return {
                    request,
                    option,
                    error: option ? '' : 'No hay entrega para esta dirección.',
                  };
                }),
                catchError((error: unknown) =>
                  of({
                    request,
                    option: undefined,
                    error: apiMessage(error, 'No pudimos cotizar el envío. Volvé a intentar.'),
                  }),
                ),
              )
          : of(null),
      ),
    ),
  );
  protected readonly deliveryState = computed(() => {
    const result = this.deliveryResult();
    return result?.request === this.deliveryRequest() ? result : null;
  });
  protected readonly deliveryLoading = computed(
    () => !!this.deliveryRequest() && !this.deliveryState(),
  );
  protected readonly selected = computed(() => {
    if (this.deliveryRequest()) return this.deliveryState()?.option;
    return this.quote()?.shipping_options.find((option) => option.method === this.method());
  });

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
      // An address saved while this request was in flight must stay in the selector.
      this.addresses.update((current) => [
        ...addresses.data.filter(({ id }) => !current.some((address) => address.id === id)),
        ...current,
      ]);
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
      if (!data.shipping_options.some((option) => option.method === this.method()))
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
    this.addressFeedback.set(null);
    const saved = this.addresses().find((address) => address.id === Number(id));
    this.savedAddress.set(saved ?? null);
    resetAddressForm(this.address, saved);
    if (
      this.contact.controls.phone.pristine &&
      !this.contact.controls.phone.value &&
      saved?.phone
    ) {
      this.contact.controls.phone.setValue(saved.phone);
    }
  }

  protected async saveAddress() {
    if (
      !this.buyer() ||
      this.method() !== 'delivery' ||
      this.savedAddress() ||
      this.savingAddress() ||
      this.busy() ||
      this.uncertain()
    ) {
      return;
    }

    this.addressFeedback.set(null);
    this.address.markAllAsTouched();
    const fields = this.address.getRawValue();
    const geography = addressGeography(fields);
    if (
      !geography ||
      this.address.invalid ||
      !fields.recipient.trim() ||
      !fields.street.trim() ||
      !fields.number.trim()
    ) {
      this.addressFeedback.set({
        error: true,
        text: 'Completá los campos obligatorios de la dirección.',
      });
      return;
    }

    this.savingAddress.set(true);
    try {
      const { data } = await firstValueFrom(
        this.client.post<Data<Address>>(api + '/account/addresses', { ...fields, ...geography }),
      );
      this.addresses.update((items) => [...items.filter((item) => item.id !== data.id), data]);
      this.applyAddress(String(data.id));
      if (this.deliveryState()?.error) this.refreshDeliveryQuote();
      this.addressFeedback.set({ error: false, text: 'Dirección guardada' });
    } catch (error) {
      this.addressFeedback.set({
        error: true,
        text: apiMessage(error, 'No pudimos guardar la dirección. Volvé a intentar.'),
      });
    } finally {
      this.savingAddress.set(false);
    }
  }

  protected refreshDeliveryQuote() {
    this.retryDelivery.update((attempt) => attempt + 1);
  }

  protected async placeOrder() {
    if (this.busy() || this.savingAddress()) return;
    this.orderError.set('');
    if (!this.pending) {
      const quote = this.quote();
      const option = this.selected();
      const fields = this.address.getRawValue();
      const geography = addressGeography(fields);
      if (this.method() === 'delivery' && !geography) {
        this.address.markAllAsTouched();
        this.orderError.set('Elegí un departamento y una localidad válidos para el envío.');
        return;
      }
      if (
        !quote ||
        !option ||
        this.contact.invalid ||
        (geography && option.method === 'delivery' && this.address.invalid)
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
          ...(option.method === 'delivery' && geography
            ? { address: { ...fields, ...geography } }
            : {}),
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
