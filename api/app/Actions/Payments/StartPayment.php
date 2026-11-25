<?php

namespace App\Actions\Payments;

use App\Enums\OrderStatus;
use App\Enums\PaymentAttemptStatus;
use App\Enums\PaymentStatus;
use App\Logging\PaymentLog;
use App\Models\Order;
use App\Models\OrderPayment;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Payments\CheckoutProClient;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use Monolog\Level;
use RuntimeException;
use Throwable;

class StartPayment
{
    public function __construct(private readonly CheckoutProClient $client, private readonly CheckoutReservation $reservation) {}

    /** @return array{PaymentAttempt, int} */
    public function execute(?int $userId, string $sessionId, string $reference, string $idempotencyKey): array
    {
        $knownOrder = null;
        try {
            return $this->start($userId, $sessionId, $reference, $idempotencyKey, $knownOrder);
        } catch (Throwable $error) {
            PaymentLog::failure('payment.start', $knownOrder === null ? PaymentLog::attempt() : PaymentLog::order($knownOrder),
                $error, $knownOrder?->id, reference: $knownOrder?->reference);

            throw $error;
        }
    }

    /** @return array{PaymentAttempt, int} */
    private function start(?int $userId, string $sessionId, string $reference, string $idempotencyKey, ?Order &$knownOrder): array
    {
        [$order, $attempt] = DB::transaction(function () use ($userId, $sessionId, $reference, $idempotencyKey, &$knownOrder): array {
            $order = Order::query()->owned($userId, $sessionId)->where('reference', $reference)->lockForUpdate()->firstOrFail();
            $knownOrder = $order;
            $attempts = PaymentAttempt::query()->where('order_id', $order->id);
            if ($order->checkout_managed) {
                $replay = (clone $attempts)->where('idempotency_key', $idempotencyKey)->first();
                if ($replay?->status->closed()) {
                    return [null, $replay];
                }
            }
            abort_unless($this->canStart($order), 409, 'This order is not available for payment.');
            $existing = $attempts->latest('id')->lockForUpdate()->first();
            if ($existing !== null && (! $order->checkout_managed || ! $existing->status->closed())) {
                return [null, $existing];
            }
            abort_if($order->checkout_managed && ! $order->canReplaceCheckoutAttempt($existing), 409,
                'The previous Checkout Pro attempt is still being verified.');

            abort_unless($this->client->checkoutAvailable(), 503, 'Payment checkout is unavailable.');
            if ($order->status === OrderStatus::PaymentExpired) {
                abort_unless($this->reservation->adjust($order, restoring: false), 409, 'Stock is unavailable for this checkout.');
                $order->forceFill([
                    'status' => OrderStatus::PendingPayment,
                    'stock_released_at' => null,
                    'reservation_expires_at' => now()->addMinutes(config('checkout.checkout_pro_reservation_minutes')),
                ]);
            }
            $order->payment_id ??= OrderPayment::query()->create()->id;
            $attempt = PaymentAttempt::query()->forceCreate([
                'order_id' => $order->id,
                'payment_id' => $order->payment_id,
                'idempotency_key' => $idempotencyKey,
                'status' => PaymentAttemptStatus::Initiating,
                'expires_at' => $order->reservation_expires_at,
            ]);
            $order->payment_reconcile_at = now()->addMinute();
            $order->save();
            PaymentLog::transition('payment.started', $order, null, PaymentAttemptStatus::Initiating->value, attemptId: $attempt->id);
            if ($existing !== null) {
                PaymentLog::transition('checkout.stock_reserved', $order, null, 'reserved', attemptId: $attempt->id);
            }

            return [$order, $attempt];
        }, 3);
        if ($order === null) {
            return [$attempt, match ($attempt->status) {
                PaymentAttemptStatus::Ready => 200,
                PaymentAttemptStatus::Initiating => 202,
                default => 409,
            }];
        }

        $lines = $order->items()->get(['sku', 'name', 'quantity', 'unit_price_cents'])->toArray();
        $failed = false;
        try {
            $preference = $this->client->preference($order->reference, $lines, $order->shipping_cents, $attempt->expires_at,
                $order->checkout_managed ? $attempt->id : null);
        } catch (RuntimeException|InvalidArgumentException $error) {
            $failed = $order->checkout_managed && in_array($error->getCode(), [400, 401, 403, 404, 422], true);
            PaymentLog::failure('payment.preference', PaymentLog::order($order), $error, $order->id,
                $failed ? 'preference_denied' : 'provider_unavailable', $order->reference, $attempt->id);
            $preference = null;
        }

        $open = DB::transaction(function () use ($order, $attempt, $preference, $failed): bool {
            $current = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            $previous = $attempt->refresh()->status;
            $attempt->forceFill([
                'status' => $previous->closed() ? $previous : match (true) {
                    $failed => PaymentAttemptStatus::Failed,
                    $preference === null => PaymentAttemptStatus::Uncertain,
                    default => PaymentAttemptStatus::Ready,
                },
                'provider_preference_id' => $preference['id'] ?? null,
                'checkout_url' => $preference['url'] ?? null,
            ])->save();
            PaymentLog::transition('payment.attempt.changed', $order, $previous->value, $attempt->status->value,
                $failed ? Level::Warning : Level::Info, $failed ? 'preference_denied' : null, $attempt->id);
            if ($attempt->status === PaymentAttemptStatus::Failed) {
                $this->reservation->release($current, 'preference_denied', $attempt);
                $current->save();

                return true;
            }

            return $current->status === OrderStatus::PendingPayment && $this->canStart($current) && ! $attempt->status->closed();
        }, 3);
        abort_unless($open, 409, 'This order is not available for payment.');

        return [$attempt, $preference === null ? 409 : 201];
    }

    private function canStart(Order $order): bool
    {
        $reservable = $order->status === OrderStatus::PendingPayment
            ? $order->stock_released_at === null && $order->reservation_expires_at->isFuture()
            : $order->checkout_managed && $order->status === OrderStatus::PaymentExpired && $order->stock_released_at !== null;

        return $reservable && $order->paid_provider_payment_id === null
            && ($order->user_id !== null || $order->guest_access_expires_at?->isFuture())
            && ! Payment::query()->where('order_id', $order->id)
                ->whereNotIn('status', [PaymentStatus::Rejected->value, PaymentStatus::Cancelled->value])->exists();
    }
}
