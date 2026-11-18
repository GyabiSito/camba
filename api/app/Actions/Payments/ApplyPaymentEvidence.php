<?php

namespace App\Actions\Payments;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Enums\ProductStatus;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\PaymentObservation;
use App\Models\Product;
use DateTimeInterface;
use Illuminate\Support\Facades\DB;

class ApplyPaymentEvidence
{
    /**
     * The caller has fetched and authenticated every supplied payment with CheckoutProClient.
     *
     * @param  list<array{id:string,reference:string,amount_cents:int,status:string,updated_at:string}>  $evidence
     */
    public function execute(
        string $reference, array $evidence, ?string $lease = null, ?DateTimeInterface $checkedAt = null, bool $complete = false,
        string $incompleteReason = 'provider_incomplete',
    ): string {
        return DB::transaction(function () use ($reference, $evidence, $lease, $checkedAt, $complete, $incompleteReason): string {
            $order = Order::query()->where('reference', $reference)->lockForUpdate()->first();
            if ($order === null) {
                return 'unknown_order';
            }
            if ($lease !== null && $order->payment_reconcile_token !== $lease) {
                return 'lease_lost';
            }

            $matched = true;
            foreach ($evidence as $payment) {
                if (! $this->observe($order, $payment)) {
                    $matched = false;
                }
            }

            $result = ! $matched ? 'conflicting_evidence' : ($complete || $lease === null ? 'verified' : $incompleteReason);
            if ($lease !== null) {
                if ($complete && $matched && $checkedAt !== null && $this->canRelease($order, $checkedAt)) {
                    if ($this->adjustStock($order, restoring: true)) {
                        $order->stock_released_at = now();
                        $order->status = OrderStatus::PaymentExpired;
                    } else {
                        $this->flag($order, 'stock_release_conflict');
                        $order->status = OrderStatus::PaymentReview;
                    }
                }
                $failures = $complete ? 0 : min(16, $order->payment_reconcile_failures + 1);
                $order->forceFill([
                    'payment_reconcile_token' => null,
                    'payment_reconcile_failures' => $failures,
                    'payment_reconcile_result' => $result,
                    'payment_reconcile_at' => $this->nextCheck($order, $complete, $failures),
                    'payment_reconciled_at' => now(),
                ]);
            }

            $order->save();

            return $result;
        }, 3);
    }

    private function observe(Order $order, array $evidence): bool
    {
        if ($evidence['reference'] !== $order->reference || $evidence['amount_cents'] !== $order->total_cents || $order->currency !== 'UYU') {
            $this->flag($order, 'provider_evidence_mismatch');

            return false;
        }

        $id = $evidence['id'];
        $date = $evidence['updated_at'];
        $state = PaymentStatus::from($evidence['status']);
        $payment = Payment::query()->where('provider_payment_id', $id)->lockForUpdate()->first();
        if ($payment !== null && (int) $payment->order_id !== (int) $order->id) {
            $this->flag($order, 'provider_evidence_mismatch');

            return false;
        }
        $comparison = $payment === null ? 1 : strcmp($date, $payment->provider_updated_at);
        if ($payment === null) {
            $payment = Payment::query()->forceCreate([
                'order_id' => $order->id,
                'provider_payment_id' => $id,
                'amount_cents' => $evidence['amount_cents'],
                'provider_updated_at' => $date,
                'status' => $state,
            ]);
        }
        PaymentObservation::query()->firstOrCreate([
            'payment_id' => $payment->id,
            'status' => $state->value,
            'provider_updated_at' => $date,
        ]);

        if ($comparison === 0 && $payment->status !== $state) {
            $this->flag($order, 'conflicting_provider_timestamp');

            return false;
        }
        if ($comparison <= 0) {
            return true;
        }
        $payment->forceFill(['status' => $state, 'provider_updated_at' => $date])->save();
        if ($state === PaymentStatus::Approved) {
            $this->applyApproval($order, $id);
        } elseif (in_array($state, [PaymentStatus::Refunded, PaymentStatus::ChargedBack], true)) {
            if ($order->paid_provider_payment_id === null || $order->paid_provider_payment_id === $id) {
                $order->status = $state === PaymentStatus::Refunded ? OrderStatus::Refunded : OrderStatus::ChargedBack;
            }
            $this->flag($order, 'payment_reversed');
        }

        return true;
    }

    private function applyApproval(Order $order, string $id): void
    {
        if ($order->paid_provider_payment_id !== null) {
            if ($order->paid_provider_payment_id !== $id) {
                $this->flag($order, 'multiple_approved_payments');
            }

            return;
        }

        if (! in_array($order->status, [OrderStatus::PendingPayment, OrderStatus::PaymentExpired], true)) {
            $this->flag($order, 'approval_after_order_closed');

            return;
        }

        $order->paid_provider_payment_id = $id;
        $order->paid_at = now();
        if ($order->stock_released_at !== null) {
            if (! $this->adjustStock($order, restoring: false)) {
                $order->status = OrderStatus::PaymentReview;
                $this->flag($order, 'late_approval_without_stock');

                return;
            }
            $order->stock_reacquired_at = now();
        }
        $order->status = OrderStatus::Paid;
    }

    private function canRelease(Order $order, DateTimeInterface $checkedAt): bool
    {
        if ($order->status !== OrderStatus::PendingPayment || $order->paid_provider_payment_id !== null
            || $order->stock_released_at !== null || $order->reservation_expires_at->copy()->addMinute()->gt($checkedAt)
            || array_intersect($order->payment_issues ?? [], ['provider_evidence_mismatch', 'conflicting_provider_timestamp'])) {
            return false;
        }

        return ! Payment::query()->where('order_id', $order->id)->lockForUpdate()->get(['status'])
            ->contains(fn (Payment $payment) => $payment->status->blocksExpiry());
    }

    private function nextCheck(Order $order, bool $complete, int $failures): ?DateTimeInterface
    {
        if ($order->status === OrderStatus::PendingPayment || ! $complete) {
            return now()->addMinutes(min(30, 2 ** $failures));
        }
        if ($order->status === OrderStatus::PaymentExpired && $order->reservation_expires_at->copy()->addDay()->isFuture()
            && (PaymentAttempt::query()->where('order_id', $order->id)->exists() || Payment::query()->where('order_id', $order->id)->exists())) {
            return now()->addMinutes(15);
        }

        return null;
    }

    private function adjustStock(Order $order, bool $restoring): bool
    {
        $lines = $order->items()->get()->keyBy('product_id');
        $products = Product::query()->whereKey($lines->keys()->all())->orderBy('id')->lockForUpdate()->get();
        if ($lines->isEmpty() || $products->count() !== $lines->count()) {
            return false;
        }
        foreach ($products as $product) {
            $quantity = $lines[$product->id]->quantity;
            if ($restoring ? $product->stock > 2147483647 - $quantity
                : ($product->stock < $quantity || $product->status !== ProductStatus::Published)) {
                return false;
            }
        }
        foreach ($products as $product) {
            $quantity = $lines[$product->id]->quantity;
            $restoring ? $product->increment('stock', $quantity) : $product->decrement('stock', $quantity);
        }

        return true;
    }

    private function flag(Order $order, string $issue): void
    {
        $order->payment_issues = array_values(array_unique([...($order->payment_issues ?? []), $issue]));
    }
}
