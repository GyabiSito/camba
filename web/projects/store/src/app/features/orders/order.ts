import { DOCUMENT, Location } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { apiMessage, formatDate, formatMoney } from '@camba/shared';
import { firstValueFrom, timer } from 'rxjs';
import { httpStatus } from '../../shared/data-access/api-contracts';
import { fulfilmentStatus, Order, orderStatus } from './data-access/order.models';
import { OrdersApi } from './data-access/orders.api';
import { checkoutProAvailability, paymentsEnabled } from '../../shared/payment-availability';

@Component({
  imports: [RouterLink],
  templateUrl: './order.html',
  styleUrls: ['../../shared/shopper.css', '../../shared/members-design.css'],
})
export class OrderPage {
  protected readonly checkoutAvailable = checkoutProAvailability();
  private readonly route = inject(ActivatedRoute);
  private readonly client = inject(OrdersApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly browser = inject(DOCUMENT).defaultView;
  private readonly reference = this.route.snapshot.paramMap.get('reference') ?? '';
  private readonly uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
  private readonly rejectionAtDeparture = signal<string | undefined>(undefined);
  private readonly returnCheckFinished = signal(false);
  private readonly returnMentionsPayment: boolean;
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
  protected readonly returned = signal(false);
  protected readonly rejectionConfirmed = computed(() => {
    const order = this.order();
    const previous = this.rejectionAtDeparture();
    return order?.payment_state === 'rejected' && (!this.returned()
      || (previous !== undefined && !!order.payment_rejection && order.payment_rejection !== previous));
  });
  protected readonly canAttemptPayment = computed(() => this.checkoutAvailable() === true || this.checkoutAvailable() === null);
  protected readonly canResumePayment = computed(() => this.canAttemptPayment() && this.returned()
    && this.returnCheckFinished() && !this.returnMentionsPayment && !this.rejectionConfirmed()
    && this.order()?.payment_state !== 'pending');
  protected readonly mayOpenPayment = computed(() => {
    const order = this.order();
    return this.canAttemptPayment() && order?.status === 'pending_payment' && order.payment_state !== 'pending'
      && (!this.returned() || this.rejectionConfirmed() || this.canResumePayment());
  });
  protected readonly money = formatMoney;
  protected readonly date = formatDate;
  protected readonly states = orderStatus;
  protected readonly fulfilment = fulfilmentStatus;

  constructor() {
    // A browser hint can only keep reopening unavailable; it never confirms a payment.
    const query = this.route.snapshot.queryParamMap;
    const location = inject(Location);
    const state = location.getState() as { mpReturn?: 'check' | 'resume' } | null;
    const returned = !!state?.mpReturn || query.get('retorno') === 'mercadopago' || [
      'payment_id',
      'collection_id',
      'status',
      'collection_status',
      'external_reference',
      'preference_id',
      'merchant_order_id',
      'payment_type',
      'processing_mode',
      'merchant_account_id',
      'site_id',
    ].some((parameter) => query.has(parameter));
    this.returnMentionsPayment = state?.mpReturn === 'check'
      || ['payment_id', 'collection_id'].some((key) => /^\d+$/.test(query.get(key) ?? ''))
      || ['status', 'collection_status'].some((key) => /^(approved|authorized|pending|in_process|in_mediation|rejected|cancelled|refunded|charged_back)$/i.test(query.get(key) ?? ''));
    this.returned.set(returned);
    if (returned) {
      location.replaceState('/pedidos/' + encodeURIComponent(this.reference), '', {
        ...state, mpReturn: this.returnMentionsPayment ? 'check' : 'resume',
      });
    }
    if (inject(Router).currentNavigation()?.extras.state?.['paymentOpeningFailed'] === true) {
      this.paymentError.set('No pudimos abrir Mercado Pago. Podés reintentar desde este pedido sin crear otro.');
    }
    void this.initialize();
  }

  protected async initialize() {
    this.loading.set(true);
    await this.load();
    if (this.returned()) {
      this.rejectionAtDeparture.set(this.client.rejectionAtDeparture(this.reference, this.browser)
        ?? this.order()?.payment_rejection ?? '');
    }
    this.loading.set(false);
    const status = this.order()?.status;
    if (this.returned() && (status === 'pending_payment' || status === 'payment_review') && !this.destroyRef.destroyed)
      await this.refreshPayment();
  }

  private async load() {
    this.error.set('');
    if (!this.uuid.test(this.reference)) {
      this.notFound.set(true);
      return false;
    }
    try {
      const { data } = await firstValueFrom(this.client.get(this.reference));
      this.order.set(data);
      this.notFound.set(false);
      return true;
    } catch (error) {
      const status = httpStatus(error);
      if (status === 404 || status === 401 || status === 403) {
        this.order.set(null);
        this.notFound.set(true);
      } else {
        this.error.set(apiMessage(error, 'No pudimos cargar el pedido. Probá de nuevo.'));
      }
      return false;
    }
  }

  protected async refreshPayment() {
    if (this.busy() || this.paying()) return;
    this.busy.set(true);
    this.returnCheckFinished.set(false);
    this.paymentError.set('');
    this.message.set('Estamos consultando el estado del pedido.');
    try {
      if (paymentsEnabled)
        await firstValueFrom(this.client.refreshPayment(this.reference));
      if (!(await this.load())) {
        this.message.set('');
        return;
      }
      for (let attempt = 0; attempt < 10; attempt++) {
        if (!paymentsEnabled || !this.awaitingPayment() || this.destroyRef.destroyed) break;
        await firstValueFrom(timer(2500));
        if (this.destroyRef.destroyed) return;
        if (!(await this.load())) {
          this.message.set('');
          return;
        }
      }
      this.returnCheckFinished.set(true);
      this.message.set(
        this.awaitingPayment() && this.order()?.payment_state !== 'pending' && !this.canResumePayment()
          ? 'Todavía no pudimos confirmar el pago. Podés volver a consultar en unos minutos.'
          : '',
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
    const order = this.order();
    return order?.status === 'payment_review'
      || (order?.status === 'pending_payment' && !this.rejectionConfirmed());
  }

  protected async openPayment() {
    if (
      !this.mayOpenPayment() ||
      this.paying() ||
      this.busy() ||
      !this.browser
    )
      return;
    this.paying.set(true);
    this.paymentError.set('');
    this.message.set('');
    try {
      this.paymentKey ??= this.browser.crypto.randomUUID();
      if (await this.client.redirectToPayment(
        this.reference, this.paymentKey, this.browser, this.order()?.payment_rejection,
      )) return;
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
