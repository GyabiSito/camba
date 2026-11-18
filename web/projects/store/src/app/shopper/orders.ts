import { DOCUMENT, Location } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiClient, apiMessage, formatDate, formatMoney } from '@camba/shared';
import { firstValueFrom, timer } from 'rxjs';
import { api, Data, fulfilmentStatus, httpStatus, Order, orderStatus, Page } from './shopper';

@Component({
  imports: [RouterLink],
  templateUrl: './orders-history.html',
  styleUrl: './shopper.css',
})
export class OrderHistoryPage {
  private readonly client = inject(ApiClient);
  protected readonly orders = signal<Order[]>([]);
  protected readonly page = signal(1);
  protected readonly lastPage = signal(1);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly money = formatMoney;
  protected readonly date = formatDate;
  protected readonly states = orderStatus;

  constructor() {
    void this.load(1);
  }

  protected async load(page: number) {
    this.loading.set(true);
    this.error.set('');
    try {
      const { data, meta } = await firstValueFrom(
        this.client.get<Page<Order>>(api + '/orders', { page }),
      );
      this.orders.set(data);
      this.page.set(meta.current_page);
      this.lastPage.set(meta.last_page);
    } catch (error) {
      this.error.set(apiMessage(error, 'No pudimos cargar los pedidos. Probá de nuevo.'));
    } finally {
      this.loading.set(false);
    }
  }
}

@Component({
  imports: [RouterLink],
  templateUrl: './order.html',
  styleUrl: './shopper.css',
})
export class OrderPage {
  private readonly route = inject(ActivatedRoute);
  private readonly client = inject(ApiClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly browser = inject(DOCUMENT).defaultView;
  private readonly reference = this.route.snapshot.paramMap.get('reference') ?? '';
  private readonly uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
  private readonly path = api + '/orders/' + encodeURIComponent(this.reference);
  private paymentKey?: string;

  protected readonly order = signal<Order | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly paying = signal(false);
  protected readonly notFound = signal(false);
  protected readonly error = signal('');
  protected readonly paymentError = signal('');
  protected readonly message = signal('');
  protected readonly uncertain = signal(false);
  protected readonly money = formatMoney;
  protected readonly date = formatDate;
  protected readonly states = orderStatus;
  protected readonly fulfilment = fulfilmentStatus;

  constructor() {
    // The browser may report a return, never a successful payment. Do not store or forward its parameters.
    const query = this.route.snapshot.queryParamMap;
    const returned = [
      'payment_id',
      'collection_id',
      'status',
      'collection_status',
      'external_reference',
      'preference_id',
    ].some((parameter) => query.has(parameter));
    if (returned) inject(Location).replaceState('/pedidos/' + encodeURIComponent(this.reference));
    void this.initialize(returned);
  }

  protected async initialize(returned = false) {
    this.loading.set(true);
    await this.load();
    this.loading.set(false);
    if (returned && this.order() && !this.destroyRef.destroyed) await this.refreshPayment();
  }

  private async load() {
    this.error.set('');
    if (!this.uuid.test(this.reference)) {
      this.notFound.set(true);
      return;
    }
    try {
      const { data } = await firstValueFrom(this.client.get<Data<Order>>(this.path));
      this.order.set(data);
    } catch (error) {
      const status = httpStatus(error);
      if (status === 404 || status === 401 || status === 403) {
        this.order.set(null);
        this.notFound.set(true);
      } else {
        this.error.set(apiMessage(error, 'No pudimos cargar el pedido. Probá de nuevo.'));
      }
    }
  }

  protected async refreshPayment() {
    if (this.busy() || this.paying()) return;
    this.busy.set(true);
    this.paymentError.set('');
    this.message.set('Estamos consultando el estado del pedido.');
    try {
      await firstValueFrom(this.client.post<void>(this.path + '/payments/refresh'));
      await this.load();
      for (const delay of [1400, 2400]) {
        if (!this.awaitingPayment() || this.destroyRef.destroyed) break;
        await firstValueFrom(timer(delay));
        if (this.destroyRef.destroyed) return;
        await this.load();
      }
      this.message.set(
        this.awaitingPayment()
          ? 'El estado sigue pendiente. Podés volver a consultar en unos minutos.'
          : 'Consultamos el estado registrado por la tienda.',
      );
    } catch {
      await this.load();
      this.paymentError.set(
        'No pudimos solicitar la actualización. Podés volver a intentar más tarde.',
      );
      this.message.set('');
    } finally {
      this.busy.set(false);
    }
  }

  private awaitingPayment() {
    const status = this.order()?.status;
    return status === 'pending_payment' || status === 'payment_review';
  }

  protected async openPayment() {
    if (this.paying() || this.busy() || this.order()?.status !== 'pending_payment' || !this.browser)
      return;
    this.paying.set(true);
    this.paymentError.set('');
    this.message.set('');
    try {
      this.paymentKey ??= this.browser.crypto.randomUUID();
      const { data } = await firstValueFrom(
        this.client.post<Data<{ status: string; checkout_url: string | null }>>(
          this.path + '/payments',
          undefined,
          { 'Idempotency-Key': this.paymentKey },
        ),
      );
      if (
        data.status === 'ready' &&
        data.checkout_url &&
        new URL(data.checkout_url).protocol === 'https:'
      ) {
        this.browser.location.assign(data.checkout_url);
        return;
      }
      this.message.set(
        'Estamos preparando el enlace de pago. Probá abrirlo de nuevo en un momento.',
      );
      this.uncertain.set(true);
    } catch (error) {
      const status = httpStatus(error);
      if (status === 409) {
        await this.load();
        this.uncertain.set(this.order()?.status === 'pending_payment');
        if (this.uncertain()) {
          this.paymentError.set(
            'La tienda no puede abrir el pago por ahora. Consultá el estado antes de volver a intentar.',
          );
        }
      } else {
        this.uncertain.set(true);
        this.paymentError.set(
          'No pudimos abrir Mercado Pago. Podés reintentar desde este pedido sin crear otro.',
        );
      }
    } finally {
      this.paying.set(false);
    }
  }
}
