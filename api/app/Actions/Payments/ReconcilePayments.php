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
            $payment = $this->client->payment($event->provider_payment_id);
        } catch (RuntimeException|InvalidArgumentException $error) {
            PaymentLog::failure('payment.webhook.lookup', $correlation, $error, reason: 'provider_unavailable');
            $lease->update([
                'lease_token' => null,
                'result' => 'provider_unavailable',
                'next_attempt_at' => now()->addMinutes(min(60, 2 ** min(6, $event->attempts))),
            ]);

            return;
        }

        $result = $this->sync->execute($payment['reference'], [$payment]);
        $lease->update(['lease_token' => null, 'result' => $result, 'processed_at' => now()]);
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
                ->where('updated_at', '<', now()->subSeconds(30))->update(['status' => PaymentAttemptStatus::Uncertain->value]);
            if ($interrupted) {
                PaymentLog::transition('payment.attempt.changed', $order, PaymentAttemptStatus::Initiating->value,
                    PaymentAttemptStatus::Uncertain->value, Level::Warning, 'interrupted_attempt',
                );
            }

            return $order;
        }, 3);
        if ($order === null) {
            return;
        }

        $checkedAt = now();
        $ids = Payment::query()->where('order_id', $id)->pluck('provider_payment_id')->all();
        $complete = true;
        try {
            $ids = array_values(array_unique([...$ids, ...$this->client->searchIds($order->reference)]));
        } catch (RuntimeException|InvalidArgumentException $error) {
            PaymentLog::failure('payment.reconcile.lookup', $correlation, $error, $id, 'provider_unavailable');
            $complete = false;
        }
        // ponytail: A payment with more than 12 candidate IDs needs operator review; never release on incomplete evidence.
        if (count($ids) > 12) {
            PaymentLog::write(Level::Warning, 'payment.reconcile.rejected', $correlation, $id, 'provider_candidate_limit');
            $this->sync->execute($order->reference, [], $order->payment_reconcile_token, $checkedAt, incompleteReason: 'provider_candidate_limit');

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
        $this->sync->execute($order->reference, $evidence, $order->payment_reconcile_token, $checkedAt, $complete);
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
