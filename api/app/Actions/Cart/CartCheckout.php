<?php

namespace App\Actions\Cart;

use App\Enums\OrderStatus;
use App\Enums\PaymentAttemptStatus;
use App\Logging\PaymentLog;
use App\Models\Cart;
use App\Models\Order;
use App\Models\PaymentAttempt;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Monolog\Level;

class CartCheckout
{
    public function view(?Cart $cart, ?int $userId, string $sessionId): ?array
    {
        if ($cart === null || $cart->claimed_at !== null || $cart->items->isEmpty()) {
            return null;
        }
        $order = $this->orders($cart, $userId, $sessionId)
            ->whereIn('status', [OrderStatus::PendingPayment, OrderStatus::PaymentExpired, OrderStatus::PaymentReview])
            ->orderByRaw("CASE WHEN status = 'payment_expired' THEN 1 ELSE 0 END")->latest('id')
            ->with('items')->lazy(20)->first(fn (Order $order) => $this->sameLines($cart, $order));

        if ($order === null) {
            return null;
        }
        $state = $this->state($order, $this->lastAttempt($order));
        if ($userId === null && $state === 'ready') {
            $state = 'checking';
        }

        return $state === null ? null : ['state' => $state, 'reference' => $order->reference];
    }

    public function resume(?int $userId, string $sessionId, string $reference): array
    {
        return DB::transaction(function () use ($userId, $sessionId, $reference): array {
            // Use the same cart → order lock order as checkout and payment confirmation.
            $cart = Cart::query()->where(Cart::ownerKey($userId, $sessionId))->lockForUpdate()->firstOrFail();
            abort_if($cart->claimed_at !== null, 404);
            $order = $this->orders($cart, $userId, $sessionId)->where('reference', $reference)->lockForUpdate()->firstOrFail();
            if ($order->status === OrderStatus::Paid) {
                return ['state' => 'paid', 'reference' => $order->reference, 'checkout_url' => null];
            }
            abort_unless($this->sameLines($cart, $order), 409, 'El carrito cambió. Revisalo antes de continuar.');
            $attempt = $this->lastAttempt($order);
            $state = $this->state($order, $attempt);
            abort_if($state === null, 409, 'La reserva ya finalizó. Volvé a revisar tu carrito.');
            if ($state === 'ready') {
                PaymentLog::write(Level::Info, 'payment.resumed', PaymentLog::order($order), $order->id,
                    reference: $order->reference, attemptId: $attempt->id, status: 'ready');
            }

            return ['state' => $state, 'reference' => $order->reference,
                'checkout_url' => $state === 'ready' ? $attempt->checkout_url : null];
        }, 3);
    }

    private function orders(Cart $cart, ?int $userId, string $sessionId): Builder
    {
        return Order::query()->owned($userId, $sessionId)->where('checkout_managed', true)
            ->where('checkout_cart_id', $cart->id);
    }

    private function sameLines(Cart $cart, Order $order): bool
    {
        return $cart->items->isNotEmpty()
            && $cart->items->pluck('quantity', 'product_id')->all() === $order->items->pluck('quantity', 'product_id')->all();
    }

    private function lastAttempt(Order $order): ?PaymentAttempt
    {
        return $order->payment?->attempts()->where('order_id', $order->id)->latest('id')->first();
    }

    private function state(Order $order, ?PaymentAttempt $attempt): ?string
    {
        if ($order->status === OrderStatus::PaymentReview) {
            return 'checking';
        }
        if ($order->status === OrderStatus::PaymentExpired) {
            return $order->stock_released_at !== null && $order->canReplaceCheckoutAttempt($attempt)
                && ! $order->hasBlockingCheckoutPayment() ? null : 'checking';
        }
        if ($order->status !== OrderStatus::PendingPayment) {
            return null;
        }
        if ($order->stock_released_at === null && $order->reservation_expires_at->isFuture()
            && $attempt?->status === PaymentAttemptStatus::Ready && $attempt->expires_at->isFuture()
            && $attempt->checkout_url !== null
            && ! $order->hasPaymentEvidenceConflict() && ! $order->hasBlockingCheckoutPayment()) {
            return 'ready';
        }

        return 'checking';
    }
}
