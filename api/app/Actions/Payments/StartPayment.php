<?php

namespace App\Actions\Payments;

use App\Enums\OrderStatus;
use App\Enums\PaymentAttemptStatus;
use App\Enums\PaymentStatus;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Payments\CheckoutProClient;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use RuntimeException;

class StartPayment
{
    public function __construct(private readonly CheckoutProClient $client) {}

    /** @return array{PaymentAttempt, int} */
    public function execute(?int $userId, string $sessionId, string $reference, string $idempotencyKey): array
    {
        [$order, $attempt] = DB::transaction(function () use ($userId, $sessionId, $reference, $idempotencyKey): array {
            $order = Order::query()->owned($userId, $sessionId)->where('reference', $reference)->lockForUpdate()->firstOrFail();
            abort_unless($this->canStart($order), 409, 'This order is not available for payment.');

            $existing = PaymentAttempt::query()->where('order_id', $order->id)->lockForUpdate()->first();
            if ($existing !== null) {
                return [null, $existing];
            }
            abort_unless(
                is_string(config('mercadopago.access_token')) && trim(config('mercadopago.access_token')) !== ''
                    && CheckoutProClient::isNumericId(config('mercadopago.collector_id')),
                503,
                'Payment checkout is unavailable.',
            );
            $attempt = PaymentAttempt::query()->forceCreate([
                'order_id' => $order->id,
                'idempotency_key' => $idempotencyKey,
                'status' => PaymentAttemptStatus::Initiating,
                'expires_at' => $order->reservation_expires_at,
            ]);
            $order->payment_reconcile_at = now()->addMinute();
            $order->save();

            return [$order, $attempt];
        }, 3);
        if ($order === null) {
            return [$attempt, match ($attempt->status) {
                PaymentAttemptStatus::Ready => 200,
                PaymentAttemptStatus::Initiating => 202,
                PaymentAttemptStatus::Uncertain => 409,
            }];
        }

        $lines = $order->items()->get(['sku', 'name', 'quantity', 'unit_price_cents'])->toArray();
        try {
            $preference = $this->client->preference($order->reference, $lines, $order->shipping_cents, $attempt->expires_at);
        } catch (RuntimeException|InvalidArgumentException) {
            $preference = null;
        }

        $open = DB::transaction(function () use ($order, $attempt, $preference): bool {
            $current = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            $attempt->forceFill([
                'status' => $preference === null ? PaymentAttemptStatus::Uncertain : PaymentAttemptStatus::Ready,
                'provider_preference_id' => $preference['id'] ?? null,
                'checkout_url' => $preference['url'] ?? null,
            ])->save();

            return $this->canStart($current);
        }, 3);
        abort_unless($open, 409, 'This order is not available for payment.');

        return [$attempt, $preference === null ? 409 : 201];
    }

    private function canStart(Order $order): bool
    {
        return $order->status === OrderStatus::PendingPayment && $order->paid_provider_payment_id === null
            && $order->stock_released_at === null && $order->reservation_expires_at->isFuture()
            && ($order->user_id !== null || $order->guest_access_expires_at?->isFuture())
            && ! Payment::query()->where('order_id', $order->id)
                ->whereNotIn('status', [PaymentStatus::Rejected->value, PaymentStatus::Cancelled->value])->exists();
    }
}
