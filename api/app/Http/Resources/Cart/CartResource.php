<?php

namespace App\Http\Resources\Cart;

use App\Actions\Cart\CartCheckout;
use App\Enums\OrderStatus;
use App\Enums\ProductStatus;
use App\Models\CartItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\DB;

class CartResource extends JsonResource
{
    public function withResponse(Request $request, JsonResponse $response): void
    {
        $response->headers->set('Cache-Control', 'private, no-store');
    }

    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $items = $this->resource?->items ?? collect();
        $short = $items->filter(fn (CartItem $item): bool => $item->product?->status === ProductStatus::Published
            && $item->product->stock < $item->quantity)->pluck('product_id');
        $reserved = $short->isEmpty() ? collect() : DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->whereIn('order_items.product_id', $short)
            ->where('orders.status', OrderStatus::PendingPayment->value)->whereNull('orders.stock_released_at')
            ->distinct()->pluck('order_items.product_id')->flip();

        return [
            'currency' => 'UYU',
            'checkout' => app(CartCheckout::class)->view($this->resource, $request->user('web')?->id, $request->session()->getId()),
            'items' => $items->map(function (CartItem $item) use ($reserved): array {
                $product = $item->product;
                $published = $product?->status === ProductStatus::Published;

                return [
                    'product_id' => $item->product_id,
                    'quantity' => $item->quantity,
                    'available' => $published && $product->stock >= $item->quantity,
                    'reserved' => $reserved->has($item->product_id),
                    'product' => $published ? [
                        'name' => $product->name,
                        'slug' => $product->slug,
                        'price_cents' => $product->price_cents,
                        'stock' => $product->stock,
                    ] : null,
                ];
            }),
        ];
    }
}
