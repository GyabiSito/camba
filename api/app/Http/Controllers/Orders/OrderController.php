<?php

namespace App\Http\Controllers\Orders;

use App\Actions\Geography\ResolveAddressGeography;
use App\Actions\Orders\PlaceOrder;
use App\Actions\Orders\QuoteCheckout;
use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use App\Http\Requests\Orders\CheckoutRequest;
use App\Http\Requests\Orders\OrderSessionRequest;
use App\Http\Resources\Orders\OrderResource;
use App\Logging\PaymentLog;
use App\Models\Order;
use App\Models\Payment;
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
            if ($address = $request->validated('address')) {
                $geography->execute($address['department_id'], $address['locality_id'], 'address.locality_id');
            }
            [$data] = $quote->execute($request->validated('items'));
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
                DB::afterCommit(static fn () => PaymentLog::write(Level::Info, 'order.created', $correlation, $order->id, status: $order->status->value));
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
            ->latest('id')->paginate(20);

        return $this->uncacheable(OrderResource::collection($orders)->response());
    }

    public function show(OrderSessionRequest $request, string $reference): JsonResponse
    {
        $order = Order::query()->owned($request->user('web')?->id, $request->session()->getId())
            ->with('items')->where('reference', $reference)->firstOrFail();
        $order->payment_state = null;
        if ($order->status === OrderStatus::PendingPayment) {
            $states = Payment::query()->where('order_id', $order->id)->pluck('status');
            $order->payment_state = match (true) {
                $states->contains(fn (PaymentStatus $state): bool => $state->blocksExpiry()) => 'pending',
                $states->isNotEmpty() => 'rejected',
                default => null,
            };
        }

        return $this->uncacheable((new OrderResource($order))->response());
    }

    private function uncacheable(JsonResponse $response): JsonResponse
    {
        return $response->header('Cache-Control', 'private, no-store');
    }
}
