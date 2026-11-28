<?php

namespace App\Http\Controllers\Orders;

use App\Actions\Geography\ResolveAddressGeography;
use App\Actions\Orders\PlaceOrder;
use App\Actions\Orders\QuoteCheckout;
use App\Enums\OrderStatus;
use App\Enums\PaymentAttemptStatus;
use App\Http\Requests\Orders\CheckoutRequest;
use App\Http\Requests\Orders\OrderSessionRequest;
use App\Http\Resources\Orders\OrderResource;
use App\Logging\PaymentLog;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Monolog\Level;
use Throwable;

class OrderController
{
    public function quote(CheckoutRequest $request, QuoteCheckout $quote, ResolveAddressGeography $geography): JsonResponse
    {
        $correlation = PaymentLog::attempt();
        PaymentLog::write(Level::Info, 'checkout.quote.started', $correlation);
        try {
            $address = $request->validated('address');
            if ($address !== null) {
                $geography->execute($address['department_id'], $address['locality_id'], 'address.locality_id');
            }
            [$data] = $quote->execute($request->validated('items'), deliveryAddressValidated: $address !== null);
        } catch (Throwable $error) {
            PaymentLog::failure('checkout.quote', $correlation, $error);

            throw $error;
        }

        return $this->uncacheable(response()->json(['data' => $data]));
    }

    public function store(CheckoutRequest $request, PlaceOrder $place): JsonResponse
    {
        $userId = $request->user('web')?->id;
        $sessionId = $request->session()->getId();
        $input = $request->validated();
        $correlation = PaymentLog::checkout(Order::ownerKey($userId, $sessionId), $input['idempotency_key']);
        PaymentLog::write(Level::Info, 'checkout.started', $correlation);

        $order = null;
        try {
            $order = $place->execute($userId, $sessionId, $input);
            if ($order->wasRecentlyCreated) {
                DB::afterCommit(static fn () => PaymentLog::write(Level::Info, 'order.created', $correlation, $order->id,
                    status: $order->status->value, reference: $order->reference));
                if ($order->checkout_managed) {
                    PaymentLog::transition('checkout.stock_reserved', $order, null, 'reserved');
                }
            }

            return $this->uncacheable((new OrderResource($order->load('items')))->response());
        } catch (Throwable $error) {
            PaymentLog::failure('checkout', $correlation, $error, $order?->id);

            throw $error;
        }
    }

    public function index(OrderSessionRequest $request): JsonResponse
    {
        $orders = Order::query()->owned($request->user('web')?->id, $request->session()->getId())
            ->commercial()->latest('id')->paginate(20);

        return $this->uncacheable(OrderResource::collection($orders)->response());
    }

    public function show(OrderSessionRequest $request, string $reference): JsonResponse
    {
        $order = Order::query()->owned($request->user('web')?->id, $request->session()->getId())
            ->with('items')->where('reference', $reference)->firstOrFail();
        $order->payment_state = null;
        if ($order->status === OrderStatus::PendingPayment || ($order->checkout_managed && $order->status === OrderStatus::PaymentExpired)) {
            $attempt = $order->checkout_managed && $order->status === OrderStatus::PendingPayment
                ? PaymentAttempt::query()->where('order_id', $order->id)->latest('id')->first(['checkout_protocol', 'provider_order_id', 'status'])
                : null;
            $payments = Payment::query()->where('order_id', $order->id)->orderBy('id')->get(['id', 'status']);
            $order->payment_state = match (true) {
                $attempt?->usesOrders() && $attempt->provider_order_id !== null
                    && $attempt->status === PaymentAttemptStatus::Uncertain => 'pending',
                $payments->contains(fn (Payment $payment): bool => $payment->status->blocksExpiry()) => 'pending',
                $payments->isNotEmpty() => 'rejected',
                default => null,
            };
            if ($order->payment_state === 'rejected') {
                $order->payment_rejection = hash_hmac('sha256', implode(',', $payments->modelKeys()), (string) config('app.key'));
            }
        }

        return $this->uncacheable((new OrderResource($order))->response());
    }

    private function uncacheable(JsonResponse $response): JsonResponse
    {
        return $response->header('Cache-Control', 'private, no-store');
    }
}
