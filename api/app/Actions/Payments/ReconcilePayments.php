<?php

namespace App\Actions\Payments;

use App\Enums\OrderStatus;
use App\Enums\PaymentAttemptStatus;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\PaymentWebhookEvent;
use App\Payments\CheckoutProClient;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;
use RuntimeException;

class ReconcilePayments
{
    public function __construct(private readonly CheckoutProClient $client, private readonly ApplyPaymentEvidence $sync) {}

    public function execute(): void
    {
        $budget = hrtime(true) + 45_000_000_000;
        $events = PaymentWebhookEvent::query()->whereNull('processed_at')->where('next_attempt_at', '<=', now())
            ->orderBy('next_attempt_at')->orderBy('id')->limit(5)->pluck('id');
        foreach ($events as $id) {
            $this->processEvent($id);
            if (hrtime(true) >= $budget) {
                return;
            }
        }

        $orders = $this->dueOrders()->orderByRaw('COALESCE(payment_reconcile_at, reservation_expires_at)')->orderBy('id')->limit(3)->pluck('id');
        foreach ($orders as $id) {
            $this->reconcileOrder($id);
            if (hrtime(true) >= $budget) {
                return;
            }
        }
    }

    private function processEvent(int $id): void
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
        } catch (RuntimeException|InvalidArgumentException) {
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

    private function reconcileOrder(int $id): void
    {
        $order = DB::transaction(function () use ($id): ?Order {
            $order = $this->dueOrders()->whereKey($id)->lockForUpdate()->first();
            if ($order === null) {
                return null;
            }
            $order->forceFill([
                'payment_reconcile_token' => (string) Str::uuid(),
                'payment_reconcile_at' => now()->addMinutes(5),
            ])->save();
            // A worker can die after the provider accepted a POST. Never replay that POST.
            PaymentAttempt::query()->where('order_id', $id)->where('status', PaymentAttemptStatus::Initiating->value)
                ->where('updated_at', '<', now()->subSeconds(30))->update(['status' => PaymentAttemptStatus::Uncertain->value]);

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
        } catch (RuntimeException|InvalidArgumentException) {
            $complete = false;
        }
        // ponytail: A payment with more than 12 candidate IDs needs operator review; never release on incomplete evidence.
        if (count($ids) > 12) {
            $this->sync->execute($order->reference, [], $order->payment_reconcile_token, $checkedAt, incompleteReason: 'provider_candidate_limit');

            return;
        }
        sort($ids, SORT_STRING);
        $evidence = [];
        foreach ($ids as $paymentId) {
            try {
                $evidence[] = $this->client->payment($paymentId);
            } catch (RuntimeException|InvalidArgumentException) {
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
