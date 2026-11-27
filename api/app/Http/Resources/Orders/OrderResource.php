<?php

namespace App\Http\Resources\Orders;

use App\Enums\OrderStatus;
use App\Models\OrderItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrderResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $summary = [
            'reference' => $this->reference,
            'status' => $this->status->value,
            'currency' => $this->currency,
            'subtotal_cents' => $this->subtotal_cents,
            'shipping_cents' => $this->shipping_cents,
            'total_cents' => $this->total_cents,
            'shipping_method' => $this->shipping_method,
            'fulfilment_status' => $this->fulfilment_status ?? 'unstarted',
            'reservation_expires_at' => $this->reservation_expires_at->toISOString(),
            'created_at' => $this->created_at->toISOString(),
        ];

        return $this->relationLoaded('items') ? [
            ...$summary,
            'checkout_retryable' => $this->when($this->checkout_managed && $this->status === OrderStatus::PaymentExpired
                && $this->paid_at === null && $this->stock_released_at !== null,
                fn () => $this->canReplaceCheckoutAttempt($this->payment?->attempts()->latest('id')->first())),
            'checkout_cancelable' => $this->when($this->checkout_managed && $this->status === OrderStatus::PendingPayment,
                function (): bool {
                    $attempt = $this->payment?->attempts()->latest('id')->first();

                    return $attempt?->usesOrders() && $attempt->provider_order_id !== null && ! $attempt->status->closed();
                }),
            'payment_state' => $this->whenHas('payment_state'),
            'payment_rejection' => $this->whenHas('payment_rejection'),
            'contact' => $this->contact,
            'address' => $this->address,
            'pickup_address' => $this->pickup_address,
            'tracking' => $this->tracking,
            'guest_access_expires_at' => $this->guest_access_expires_at?->toISOString(),
            'items' => $this->items->map(fn (OrderItem $item): array => $item->only([
                'product_id', 'sku', 'name', 'quantity', 'unit_price_cents', 'line_total_cents',
            ])),
        ] : $summary;
    }
}
