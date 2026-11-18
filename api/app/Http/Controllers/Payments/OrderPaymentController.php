<?php

namespace App\Http\Controllers\Payments;

use App\Actions\Payments\RequestPaymentRefresh;
use App\Actions\Payments\StartPayment;
use App\Enums\PaymentAttemptStatus;
use App\Http\Requests\Orders\OrderSessionRequest;
use App\Http\Requests\Payments\StartPaymentRequest;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

class OrderPaymentController
{
    public function store(StartPaymentRequest $request, string $reference, StartPayment $start): JsonResponse
    {
        [$attempt, $status] = $start->execute(
            $request->user('web')?->id, $request->session()->getId(), $reference, $request->validated('idempotency_key'),
        );

        return response()->json(['data' => [
            'status' => $attempt->status->value,
            'checkout_url' => $attempt->status === PaymentAttemptStatus::Ready ? $attempt->checkout_url : null,
            'expires_at' => $attempt->expires_at->toISOString(),
        ]], $status)->header('Cache-Control', 'private, no-store');
    }

    public function refresh(OrderSessionRequest $request, string $reference, RequestPaymentRefresh $refresh): Response
    {
        $order = Order::query()->owned($request->user('web')?->id, $request->session()->getId())
            ->where('reference', $reference)->firstOrFail();
        $refresh->execute($order);

        return response('', 202)->header('Cache-Control', 'private, no-store');
    }

    public function refreshAsAdmin(OrderSessionRequest $request, string $reference, RequestPaymentRefresh $refresh): Response
    {
        $refresh->execute(Order::query()->where('reference', $reference)->firstOrFail());

        return response('', 202)->header('Cache-Control', 'private, no-store');
    }
}
