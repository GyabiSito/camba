<?php

namespace App\Actions\Payments;

use App\Enums\OrderStatus;
use App\Enums\PaymentAttemptStatus;
use App\Logging\PaymentLog;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\PaymentWebhookEvent;
use App\Payments\CheckoutProClient;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Monolog\Level;
use RuntimeException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class ReconcilePayments
{
    public function __construct(private readonly CheckoutProClient $client, private readonly ApplyPaymentEvidence $sync) {}

    public function execute(): void
    {
        $budget = hrtime(true) + 45_000_000_000;
        $correlation = PaymentLog::attempt();
        $orderId = null;
        try {
            $events = PaymentWebhookEvent::query()->whereNull('processed_at')->where('next_attempt_at', '<=', now())
                ->orderBy('next_attempt_at')->orderBy('id')->limit(5)->pluck('id');
            foreach ($events as $id) {
                $correlation = hash('sha256', 'webhook:'.$id);
                $this->processEvent($id, $correlation);
                if (hrtime(true) >= $budget) {
                    return;
                }
            }

            $correlation = PaymentLog::attempt();
            $orders = $this->dueOrders()->orderByRaw('COALESCE(payment_reconcile_at, reservation_expires_at)')->orderBy('id')->limit(3)->pluck('id');
            foreach ($orders as $id) {
                $orderId = $id;
                $correlation = PaymentLog::attempt();
                $this->reconcileOrder($id, $correlation);
                if (hrtime(true) >= $budget) {
                    return;
                }
            }
        } catch (Throwable $error) {
            PaymentLog::failure('payment.reconcile', $correlation, $error, $orderId);

            throw $error;
        }
    }

    private function processEvent(int $id, string $correlation): void
    {
        $token = (string) Str::uuid();
        $claimed = PaymentWebhookEvent::query()->whereKey($id)->whereNull('processed_at')
            ->where('next_attempt_at', '<=', now())->update([
                'lease_token' => $token,
                'next_attempt_at' => now()->addMinutes(5),
                'attempts' => DB::raw('attempts + 1'),
            ]);
        if ($claimed !== 1) {
            return;
        }

        $event = PaymentWebhookEvent::query()->findOrFail($id);
        $lease = PaymentWebhookEvent::query()->whereKey($id)->where('lease_token', $token);
        try {
            $snapshot = $event->provider_order_id === null ? null : $this->client->order($event->provider_order_id);
            $payment = $snapshot === null ? $this->client->payment($event->provider_payment_id) : null;
        } catch (RuntimeException|InvalidArgumentException $error) {
            PaymentLog::failure('payment.webhook.lookup', $correlation, $error, reason: 'provider_unavailable');
            $lease->update([
                'lease_token' => null,
                'result' => 'provider_unavailable',
                'next_attempt_at' => now()->addMinutes(min(60, 2 ** min(6, $event->attempts))),
            ]);

            return;
        }

        $result = match (true) {
            $snapshot !== null => $this->applyOrder($snapshot),
            isset($payment['attempt_id']) && PaymentAttempt::query()->whereKey($payment['attempt_id'])
                ->where('checkout_protocol', 'orders')->exists() => 'orders_payment_requires_order',
            default => $this->sync->execute($payment['reference'], [$payment]),
        };
        $lease->update(['lease_token' => null, 'result' => $result, 'processed_at' => now()]);
    }

    private function applyOrder(array $snapshot): string
    {
        return $this->sync->execute($snapshot['order_reference'], [], providerOrders: [$snapshot]);
    }

    public function cancel(Order $order): void
    {
        $attempt = PaymentAttempt::where('order_id', $order->id)->latest('id')->first();
        abort_unless($attempt?->usesOrders() && $attempt->provider_order_id !== null, 409, 'Este pago no se puede cancelar desde Camba.');
        if ($order->status !== OrderStatus::PendingPayment || $attempt->status->closed()) {
            return;
        }
        $correlation = PaymentLog::order($order);
        try {
            $snapshot = $this->client->order($attempt->provider_order_id);
            abort_unless($snapshot['order_reference'] === $order->reference && $snapshot['attempt_id'] === $attempt->id
                && $snapshot['amount_cents'] === $order->total_cents && $order->currency === 'UYU', 409, 'La orden de Mercado Pago no coincide.');
            if (in_array($snapshot['state'], ['created', 'action_required'], true)) {
                try {
                    $this->client->cancelOrder($attempt->provider_order_id, $attempt->provider_create_key);
                } catch (RuntimeException|InvalidArgumentException $error) {
                    PaymentLog::failure('payment.order.cancel', $correlation, $error, $order->id,
                        'cancel_result_unknown', $order->reference, $attempt->id);
                }
                // Even if the cancellation reply was lost, only the authoritative GET can release stock.
                $snapshot = $this->client->order($attempt->provider_order_id);
            }
            $this->applyOrder($snapshot);
        } catch (RuntimeException|InvalidArgumentException $error) {
            if ($error instanceof HttpExceptionInterface) {
                throw $error;
            }
            PaymentLog::failure('payment.order.cancel_lookup', $correlation, $error, $order->id,
                'provider_unavailable', $order->reference, $attempt->id);
        }
    }

    private function reconcileOrder(int $id, string &$correlation): void
    {
        $order = DB::transaction(function () use ($id, &$correlation): ?Order {
            $order = $this->dueOrders()->whereKey($id)->lockForUpdate()->first();
            if ($order === null) {
                return null;
            }
            $correlation = PaymentLog::order($order);
            $order->forceFill([
                'payment_reconcile_token' => (string) Str::uuid(),
                'payment_reconcile_at' => now()->addMinutes(5),
            ])->save();
            // StartPayment holds this order lock before persisting an attempt or calling the provider.
            if (! $this->client->isConfigured()
                && ! PaymentAttempt::query()->where('order_id', $id)->exists()
                && ! Payment::query()->where('order_id', $id)->exists()) {
                $this->sync->execute($order->reference, [], $order->payment_reconcile_token, now(), complete: true);

                return null;
            }
            // A worker can die after the provider accepted a POST. Never replay that POST.
            $interrupted = PaymentAttempt::query()->where('order_id', $id)->where('status', PaymentAttemptStatus::Initiating->value)
                ->where('updated_at', '<', now()->subSeconds(30))->first();
            if ($interrupted !== null) {
                $interrupted->forceFill(['status' => PaymentAttemptStatus::Uncertain])->save();
                PaymentLog::transition('payment.attempt.changed', $order, PaymentAttemptStatus::Initiating->value,
                    PaymentAttemptStatus::Uncertain->value, Level::Warning, 'interrupted_attempt', $interrupted->id,
                );
            }

            return $order;
        }, 3);
        if ($order === null) {
            return;
        }

        $checkedAt = now();
        $ids = Payment::query()->where('order_id', $id)->pluck('provider_payment_id')
            ->filter(CheckoutProClient::isNumericId(...))->values()->all();
        [$ordersAttempts, $preferences] = PaymentAttempt::query()->where('order_id', $id)->get()
            ->partition(fn (PaymentAttempt $attempt) => $attempt->usesOrders());
        $complete = true;
        $snapshots = [];
        foreach ($ordersAttempts as $attempt) {
            if ($attempt->status === PaymentAttemptStatus::Failed && $attempt->provider_order_id === null) {
                continue;
            }
            try {
                $providerId = $attempt->provider_order_id ?? $this->client->searchOrderId(
                    CheckoutProClient::attemptReference($order->reference, $attempt->id), $attempt->created_at,
                );
                if ($providerId !== null) {
                    $snapshots[] = $this->client->order($providerId);
                } elseif ($attempt->status === PaymentAttemptStatus::Initiating || $attempt->expires_at->copy()->addMinute()->gt($checkedAt)) {
                    $complete = false;
                }
            } catch (RuntimeException|InvalidArgumentException $error) {
                PaymentLog::failure('payment.order.lookup', $correlation, $error, $id, 'provider_unavailable', $order->reference, $attempt->id);
                $complete = false;
            }
        }
        try {
            $references = $order->checkout_managed
                ? $preferences->map(fn (PaymentAttempt $attempt) => CheckoutProClient::attemptReference($order->reference, $attempt->id))->all()
                : [$order->reference];
            foreach ($references as $reference) {
                $ids = array_values(array_unique([...$ids, ...$this->client->searchIds($reference)]));
                if (count($ids) > 12) {
                    break;
                }
            }
        } catch (RuntimeException|InvalidArgumentException $error) {
            PaymentLog::failure('payment.reconcile.lookup', $correlation, $error, $id, 'provider_unavailable');
            $complete = false;
        }
        // ponytail: A payment with more than 12 candidate IDs needs operator review; never release on incomplete evidence.
        if (count($ids) > 12) {
            PaymentLog::write(Level::Warning, 'payment.reconcile.rejected', $correlation, $id, 'provider_candidate_limit');
            $this->sync->execute($order->reference, [], $order->payment_reconcile_token, $checkedAt,
                incompleteReason: 'provider_candidate_limit', providerOrders: $snapshots);

            return;
        }
        sort($ids, SORT_STRING);
        $evidence = [];
        foreach ($ids as $paymentId) {
            try {
                $evidence[] = $this->client->payment($paymentId);
            } catch (RuntimeException|InvalidArgumentException $error) {
                if ($complete) {
                    PaymentLog::failure('payment.reconcile.lookup', $correlation, $error, $id, 'provider_unavailable');
                }
                $complete = false;
            }
        }
        $this->sync->execute($order->reference, $evidence, $order->payment_reconcile_token, $checkedAt, $complete,
            providerOrders: $snapshots);
    }

    /** @return Builder<Order> */
    private function dueOrders(): Builder
    {
        return Order::query()->where(function (Builder $due): void {
            $due->where('payment_reconcile_at', '<=', now())->orWhere(function (Builder $expired): void {
                $expired->whereNull('payment_reconcile_at')->where('status', OrderStatus::PendingPayment->value)
                    ->where('reservation_expires_at', '<=', now()->subMinute());
            });
        });
    }
}
