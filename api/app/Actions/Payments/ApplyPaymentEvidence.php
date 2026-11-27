<?php

namespace App\Actions\Payments;

use App\Actions\Notices\RecordOrderMail;
use App\Actions\Notices\RecordRefundEffects;
use App\Enums\OrderStatus;
use App\Enums\PaymentAttemptStatus;
use App\Enums\PaymentStatus;
use App\Logging\PaymentLog;
use App\Models\Cart;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\PaymentObservation;
use DateTimeInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Monolog\Level;

class ApplyPaymentEvidence
{
    public function __construct(
        private readonly CheckoutReservation $reservation,
        private readonly RecordOrderMail $notices,
        private readonly RecordRefundEffects $refunds,
    ) {}

    /**
     * The caller has fetched and authenticated every supplied payment with CheckoutProClient.
     *
     * @param  list<array{id:string,reference:string,amount_cents:int,status:string,updated_at:string,attempt_id?:int}>  $evidence
     */
    public function execute(
        string $reference, array $evidence, ?string $lease = null, ?DateTimeInterface $checkedAt = null, bool $complete = false,
        string $incompleteReason = 'provider_incomplete',
        array $providerOrders = [],
    ): string {
        if (! Str::isUuid($reference)) {
            return 'unknown_order';
        }

        return DB::transaction(function () use ($reference, $evidence, $lease, $checkedAt, $complete, $incompleteReason, $providerOrders): string {
            // Keep PlaceOrder's lock order: cart, order, then products.
            $cart = null;
            $paymentsForLock = array_merge($evidence, ...array_column($providerOrders, 'payments'));
            if (in_array(PaymentStatus::Approved->value, array_column($paymentsForLock, 'status'), true)) {
                $cartId = Order::query()->where('reference', $reference)->value('checkout_cart_id');
                $cart = $cartId === null ? null : Cart::query()->whereKey($cartId)->lockForUpdate()->first();
            }
            $order = Order::query()->where('reference', $reference)->lockForUpdate()->first();
            if ($order === null) {
                return 'unknown_order';
            }
            if ($lease !== null && $order->payment_reconcile_token !== $lease) {
                return 'lease_lost';
            }

            $previous = $order->status;

            $matched = true;
            foreach ($providerOrders as $providerOrder) {
                $matched = $this->observeOrder($order, $providerOrder) && $matched;
            }
            foreach ($evidence as $payment) {
                if (! $this->observe($order, $payment)) {
                    $matched = false;
                }
            }

            $latest = $order->checkout_managed
                ? PaymentAttempt::query()->where('order_id', $order->id)->latest('id')->first()
                : null;
            if ($matched && ! $order->hasPaymentEvidenceConflict()
                && (in_array($latest?->status, [PaymentAttemptStatus::Rejected, PaymentAttemptStatus::Cancelled], true)
                    || ($latest?->usesOrders() && $latest->status === PaymentAttemptStatus::Expired))
                && ! $this->hasBlockingEvidence($order)) {
                $this->reservation->release($order, 'provider_'.$latest->status->value, $latest);
            }

            $result = ! $matched ? 'conflicting_evidence' : ($complete || $lease === null ? 'verified' : $incompleteReason);
            if ($lease !== null) {
                if ($complete && $matched && $checkedAt !== null && $this->canRelease($order, $latest, $checkedAt)) {
                    if ($latest && ! $latest->status->closed()) {
                        $this->closeAttempt($order, $latest, PaymentAttemptStatus::Expired, 'reservation_expired');
                    }
                    $this->reservation->release($order, 'reservation_expired', $latest);
                }
                $failures = $complete ? 0 : min(16, $order->payment_reconcile_failures + 1);
                $order->forceFill([
                    'payment_reconcile_token' => null,
                    'payment_reconcile_failures' => $failures,
                    'payment_reconcile_result' => $result,
                    'payment_reconcile_at' => $this->nextCheck($order, $complete, $failures),
                    'payment_reconciled_at' => $checkedAt ?? now(),
                ]);
            }

            $order->save();
            if ($matched && $order->status === OrderStatus::Refunded && $order->paid_at !== null
                && $order->paid_provider_payment_id !== null && ! $order->hasPaymentEvidenceConflict()) {
                $payment = Payment::query()->where('order_id', $order->id)
                    ->where('provider_payment_id', $order->paid_provider_payment_id)
                    ->where('status', PaymentStatus::Refunded)->where('amount_cents', $order->total_cents)->first();
                if ($payment && collect($paymentsForLock)->contains(fn (array $observed) => $observed['id'] === $payment->provider_payment_id && $observed['status'] === PaymentStatus::Refunded->value
                    && ($observed['refunded_cents'] ?? null) === $payment->amount_cents
                    && $observed['updated_at'] === $payment->provider_updated_at)) {
                    $this->refunds->verified($order, $payment);
                }
            }
            if ($previous !== OrderStatus::Paid && $order->status === OrderStatus::Paid) {
                if ($cart && $cart->claimed_at === null) {
                    $cart->removePurchasedItems($order->items()->pluck('quantity', 'product_id')->all());
                }
                if ($order->checkout_managed) {
                    $this->notices->created($order);
                }
            }
            PaymentLog::transition('order.status_changed', $order, $previous->value, $order->status->value, attemptId: $latest?->id);

            return $result;
        }, 3);
    }

    private function observeOrder(Order $order, array $snapshot): bool
    {
        $attempt = PaymentAttempt::query()->where('order_id', $order->id)->whereKey($snapshot['attempt_id'])->first();
        if ($snapshot['order_reference'] !== $order->reference || $snapshot['amount_cents'] !== $order->total_cents
            || $order->currency !== 'UYU' || ! $attempt?->usesOrders()
            || ($attempt->provider_order_id !== null && $attempt->provider_order_id !== $snapshot['id'])) {
            $this->flag($order, 'provider_evidence_mismatch');

            return false;
        }
        if ($attempt->provider_order_updated_at !== null && strcmp($snapshot['updated_at'], $attempt->provider_order_updated_at) < 0) {
            return true;
        }
        // Evidence about another payment must not advance the original attempt's watermark.
        if ($snapshot['state'] === 'charged_back' && ($order->paid_at === null || ! collect($snapshot['payments'])->contains(
            fn (array $payment) => $payment['status'] === PaymentStatus::ChargedBack->value
                && $payment['id'] === $order->paid_provider_payment_id,
        ))) {
            $this->flag($order, 'provider_evidence_mismatch');

            return false;
        }

        $unbound = $attempt->provider_order_id === null;
        $attempt->forceFill([
            'provider_order_id' => $snapshot['id'], 'provider_order_updated_at' => $snapshot['updated_at'],
            'expires_at' => $snapshot['expires_at'],
        ])->save();
        if (! $attempt->status->closed() && $order->status === OrderStatus::PendingPayment
            && $order->stock_released_at === null && PaymentAttempt::where('order_id', $order->id)->max('id') === $attempt->id) {
            $order->reservation_expires_at = $attempt->expires_at;
            if ($attempt->status !== PaymentAttemptStatus::Ready && $snapshot['state'] === 'created'
                && $attempt->expires_at->isFuture() && $snapshot['url'] !== null) {
                $attempt->forceFill(['checkout_url' => $snapshot['url']])->save();
                $this->closeAttempt($order, $attempt, PaymentAttemptStatus::Ready, 'provider_order_recovered');
            }
        }
        if ($unbound) {
            PaymentLog::transition('payment.order.recovered', $order, null, $snapshot['state'], attemptId: $attempt->id);
        }
        foreach ($snapshot['payments'] as $payment) {
            if (! $this->observe($order, $payment)) {
                return false;
            }
        }
        $terminal = match ($snapshot['state']) {
            'failed' => PaymentAttemptStatus::Rejected,
            'canceled' => $snapshot['detail'] === 'expired' ? PaymentAttemptStatus::Expired : PaymentAttemptStatus::Cancelled,
            'expired' => PaymentAttemptStatus::Expired,
            default => null,
        };
        $attempt->refresh();
        if ($terminal !== null && ! $attempt->status->closed()) {
            $this->closeAttempt($order, $attempt, $terminal, 'provider_order_'.$terminal->value);
        } elseif ($snapshot['state'] !== 'created' && $attempt->status === PaymentAttemptStatus::Ready) {
            $this->closeAttempt($order, $attempt, PaymentAttemptStatus::Uncertain, 'provider_order_awaiting_result');
        }

        return true;
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
        $attemptId = $evidence['attempt_id'] ?? $payment?->payment_attempt_id;
        $attempts = PaymentAttempt::query()->where('order_id', $order->id);
        $attempt = $attemptId === null
            ? ((clone $attempts)->count() === 1 ? $attempts->first() : null)
            : $attempts->whereKey($attemptId)->first();
        if (($order->checkout_managed && ! isset($evidence['attempt_id']))
            || ($attemptId !== null && ($attempt === null || ($payment?->payment_attempt_id && $payment->payment_attempt_id !== $attempt->id)))
            || ($attempt?->usesOrders() && ($evidence['provider_order_id'] ?? null) !== $attempt->provider_order_id)) {
            $this->flag($order, 'provider_evidence_mismatch');

            return false;
        }
        $comparison = $payment === null ? 1 : strcmp($date, $payment->provider_updated_at);
        $previous = $payment?->status;
        if ($payment === null) {
            $payment = Payment::query()->forceCreate([
                'order_id' => $order->id,
                'payment_attempt_id' => $attempt?->id,
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
        $payment->forceFill(['status' => $state, 'provider_updated_at' => $date, 'payment_attempt_id' => $attempt?->id])->save();
        $rejected = in_array($state, [PaymentStatus::Rejected, PaymentStatus::Cancelled], true);
        PaymentLog::transition('payment.status_changed', $order, $previous?->value, $state->value,
            $rejected ? Level::Warning : Level::Info, $rejected ? 'provider_'.$state->value : null, $attempt?->id,
        );
        if ($order->checkout_managed && $attempt) {
            $closed = match ($state) {
                PaymentStatus::Approved => PaymentAttemptStatus::Approved,
                PaymentStatus::Rejected => PaymentAttemptStatus::Rejected,
                PaymentStatus::Cancelled => PaymentAttemptStatus::Cancelled,
                default => null,
            };
            if ($closed && ($closed === PaymentAttemptStatus::Approved || ! $attempt->status->closed())) {
                $this->closeAttempt($order, $attempt, $closed, 'provider_'.$state->value);
            }
        }
        if ($state === PaymentStatus::Approved) {
            $this->applyApproval($order, $id);
        } elseif ($state === PaymentStatus::Refunded) {
            if ($order->paid_at !== null && $order->paid_provider_payment_id === $id
                && ($evidence['refunded_cents'] ?? null) === $payment->amount_cents) {
                $order->status = OrderStatus::Refunded;
                $this->flag($order, 'payment_reversed');
            }
        } elseif ($state === PaymentStatus::ChargedBack) {
            if ($order->paid_provider_payment_id === null || $order->paid_provider_payment_id === $id) {
                $order->status = OrderStatus::ChargedBack;
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
            if (! $this->reservation->adjust($order, restoring: false)) {
                $order->status = OrderStatus::PaymentReview;
                $this->flag($order, 'late_approval_without_stock');

                return;
            }
            $order->stock_reacquired_at = now();
            PaymentLog::transition('checkout.stock_reserved', $order, null, 'reacquired', reason: 'late_approval');
        }
        $order->status = OrderStatus::Paid;
        if ($order->checkout_managed && $order->fulfilment_status === 'unstarted') {
            $order->fulfilment_status = 'preparing';
        }
    }

    private function canRelease(Order $order, ?PaymentAttempt $latest, DateTimeInterface $checkedAt): bool
    {
        if ($order->status !== OrderStatus::PendingPayment || $order->paid_provider_payment_id !== null
            || $order->stock_released_at !== null || $order->reservation_expires_at->copy()->addMinute()->gt($checkedAt)
            || $order->hasPaymentEvidenceConflict()) {
            return false;
        }

        return ! ($latest?->usesOrders() && $latest->provider_order_id !== null && ! $latest->status->closed())
            && ! $this->hasBlockingEvidence($order);
    }

    private function hasBlockingEvidence(Order $order): bool
    {
        return Payment::query()->where('order_id', $order->id)->lockForUpdate()->get(['status'])
            ->contains(fn (Payment $payment) => $payment->status->blocksExpiry());
    }

    private function nextCheck(Order $order, bool $complete, int $failures): ?DateTimeInterface
    {
        if ($order->status === OrderStatus::PendingPayment || ! $complete) {
            return now()->addMinutes(min(30, 2 ** $failures));
        }
        if ($order->status === OrderStatus::PaymentExpired && $order->reservation_expires_at->copy()->addDay()->isFuture()
            && (PaymentAttempt::query()->where('order_id', $order->id)->exists() || Payment::query()->where('order_id', $order->id)->exists())) {
            $safeRetryCheck = $order->reservation_expires_at->copy()->addMinute();
            if ($order->checkout_managed && $safeRetryCheck->isFuture()) {
                return $safeRetryCheck;
            }

            return now()->addMinutes(15);
        }

        return null;
    }

    private function closeAttempt(Order $order, PaymentAttempt $attempt, PaymentAttemptStatus $status, string $reason): void
    {
        if ($attempt->status !== $status) {
            $previous = $attempt->status;
            $attempt->forceFill(['status' => $status])->save();
            PaymentLog::transition('payment.attempt.changed', $order, $previous->value, $status->value, Level::Info, $reason, $attempt->id);
        }
    }

    private function flag(Order $order, string $issue): void
    {
        $issues = $order->payment_issues ?? [];
        $order->payment_issues = array_values(array_unique([...$issues, $issue]));
        if (! in_array($issue, $issues, true)) {
            $id = $order->id;
            $correlation = PaymentLog::order($order);
            DB::afterCommit(static fn () => PaymentLog::write(Level::Warning, 'payment.evidence.flagged', $correlation, $id, $issue));
        }
    }
}
