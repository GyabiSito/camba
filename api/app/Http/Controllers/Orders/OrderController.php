<?php

namespace App\Http\Controllers\Orders;

use App\Actions\Orders\PlaceOrder;
use App\Actions\Orders\QuoteCheckout;
use App\Http\Requests\Orders\CheckoutRequest;
use App\Http\Requests\Orders\OrderSessionRequest;
use App\Http\Resources\Orders\OrderResource;
use App\Models\Order;
use Illuminate\Http\JsonResponse;

class OrderController
{
    public function quote(CheckoutRequest $request, QuoteCheckout $quote): JsonResponse
    {
        [$data] = $quote->execute($request->validated('items'));

        return $this->uncacheable(response()->json(['data' => $data]));
    }

    public function store(CheckoutRequest $request, PlaceOrder $place): JsonResponse
    {
        $order = $place->execute($request->user('web')?->id, $request->session()->getId(), $request->validated());

        return $this->uncacheable((new OrderResource($order->load('items')))->response());
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

        return $this->uncacheable((new OrderResource($order))->response());
    }

    private function uncacheable(JsonResponse $response): JsonResponse
    {
        return $response->header('Cache-Control', 'private, no-store');
    }
}
