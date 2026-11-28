<?php

namespace App\Actions\Payments;

use App\Enums\OrderStatus;
use App\Enums\PaymentAttemptStatus;
use App\Logging\PaymentLog;
use App\Models\Order;
use App\Models\OrderPayment;
use App\Models\PaymentAttempt;
use App\Payments\CheckoutProClient;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
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
        [$order, $attempt, $replayCreate] = DB::transaction(function () use ($userId, $sessionId, $reference, $idempotencyKey, &$knownOrder): array {
            $order = Order::query()->owned($userId, $sessionId)->where('reference', $reference)->lockForUpdate()->firstOrFail();
            $knownOrder = $order;
            $attempts = PaymentAttempt::query()->where('order_id', $order->id);
            if ($order->checkout_managed) {
                $replay = (clone $attempts)->where('idempotency_key', $idempotencyKey)->first();
                if ($replay?->status->closed()) {
                    return [null, $replay, false];
                }
            }
            abort_unless($this->canStart($order), 409, 'This order is not available for payment.');
            $existing = $attempts->latest('id')->lockForUpdate()->first();
            if ($existing !== null && (! $order->checkout_managed || ! $existing->status->closed())) {
                if ($existing->usesOrders() && $existing->status === PaymentAttemptStatus::Uncertain
                    && $existing->provider_order_id === null && $existing->expires_at->isFuture()) {
                    $existing->forceFill(['status' => PaymentAttemptStatus::Initiating])->save();

                    return [$order, $existing, true];
                }

                return [null, $existing, false];
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
            $useOrders = $order->checkout_managed && config('mercadopago.checkout_orders') === true;
            $attempt = PaymentAttempt::query()->forceCreate([
                'order_id' => $order->id,
                'payment_id' => $order->payment_id,
                'idempotency_key' => $idempotencyKey,
                'status' => PaymentAttemptStatus::Initiating,
                'expires_at' => $order->reservation_expires_at,
                'checkout_protocol' => $useOrders ? 'orders' : 'preferences',
                'provider_create_key' => $useOrders ? (string) Str::uuid() : null,
            ]);
            if ($useOrders) {
                $attempt->forceFill(['provider_create_payload' => $this->client->orderPayload(
                    $order->reference, $attempt->id, $order->items()->get(['name', 'quantity', 'unit_price_cents'])->toArray(),
                    $order->shipping_cents, $order->total_cents,
                )])->save();
            }
            $order->payment_reconcile_at = now()->addMinute();
            $order->save();
            PaymentLog::transition('payment.started', $order, null, PaymentAttemptStatus::Initiating->value, attemptId: $attempt->id);
            if ($existing !== null) {
                PaymentLog::transition('checkout.stock_reserved', $order, null, 'reserved', attemptId: $attempt->id);
            }

            return [$order, $attempt, false];
        }, 3);
        if ($order === null) {
            return [$attempt, match ($attempt->status) {
                PaymentAttemptStatus::Ready => 200,
                PaymentAttemptStatus::Initiating => 202,
                default => 409,
            }];
        }

        $usesOrders = $attempt->usesOrders();
        $stage = $usesOrders ? 'order' : 'preference';
        $failed = false;
        try {
            $response = $usesOrders
                ? $this->client->createOrder($attempt->provider_create_payload, $attempt->provider_create_key)
                : $this->client->preference($order->reference,
                    $order->items()->get(['sku', 'name', 'quantity', 'unit_price_cents'])->toArray(),
                    $order->shipping_cents, $attempt->expires_at, $order->checkout_managed ? $attempt->id : null);
        } catch (RuntimeException|InvalidArgumentException $error) {
            $failed = ! $replayCreate && $order->checkout_managed && in_array($error->getCode(), [400, 401, 403, 404, 422], true);
            PaymentLog::failure('payment.'.$stage, PaymentLog::order($order), $error, $order->id,
                $failed ? $stage.'_denied' : 'provider_unavailable', $order->reference, $attempt->id);
            $response = null;
        }

        $open = DB::transaction(function () use ($order, $attempt, $response, $failed, $usesOrders, $stage): bool {
            $current = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            $previous = $attempt->refresh()->status;
            if ($usesOrders && ($previous->closed() || $attempt->provider_order_id !== null)) {
                return $current->status === OrderStatus::PendingPayment && $previous === PaymentAttemptStatus::Ready;
            }
            $ready = $response !== null && (! $usesOrders || ($response['state'] === 'created' && $response['expires_at']->isFuture()));
            $attempt->forceFill([
                'status' => $previous->closed() ? $previous : match (true) {
                    $failed => PaymentAttemptStatus::Failed,
                    ! $ready => PaymentAttemptStatus::Uncertain,
                    default => PaymentAttemptStatus::Ready,
                },
                ($usesOrders ? 'provider_order_id' : 'provider_preference_id') => $response['id'] ?? null,
                'checkout_url' => $ready ? $response['url'] : null,
                ...($usesOrders && $response !== null ? ['provider_order_updated_at' => $response['updated_at']] : []),
                'expires_at' => $usesOrders && $response !== null ? $response['expires_at'] : $attempt->expires_at,
            ])->save();
            if ($response !== null) {
                DB::afterCommit(static fn () => PaymentLog::write(Level::Info, 'payment.'.$stage.'.created',
                    PaymentLog::order($order), $order->id, status: 'created', reference: $order->reference, attemptId: $attempt->id));
                if ($usesOrders && $current->status === OrderStatus::PendingPayment) {
                    $current->forceFill(['reservation_expires_at' => $attempt->expires_at, 'payment_reconcile_at' => now()->addMinute()])->save();
                }
            }
            PaymentLog::transition('payment.attempt.changed', $order, $previous->value, $attempt->status->value,
                $failed ? Level::Warning : Level::Info, $failed ? $stage.'_denied' : null, $attempt->id);
            if ($attempt->status === PaymentAttemptStatus::Failed) {
                $this->reservation->release($current, $stage.'_denied', $attempt);
                $current->save();

                return true;
            }

            return $current->status === OrderStatus::PendingPayment && $this->canStart($current) && ! $attempt->status->closed();
        }, 3);
        abort_unless($open, 409, 'This order is not available for payment.');

        return [$attempt, $attempt->status === PaymentAttemptStatus::Ready ? 201 : 409];
    }

    private function canStart(Order $order): bool
    {
        $reservable = $order->status === OrderStatus::PendingPayment
            ? $order->stock_released_at === null && $order->reservation_expires_at->isFuture()
            : $order->checkout_managed && $order->status === OrderStatus::PaymentExpired && $order->stock_released_at !== null;

        return $reservable && ($order->user_id !== null || $order->guest_access_expires_at?->isFuture())
            && ! $order->hasBlockingCheckoutPayment();
    }
}
