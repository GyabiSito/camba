<?php

namespace App\Http\Resources\Cart;

use App\Enums\ProductStatus;
use App\Models\CartItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CartResource extends JsonResource
{
    public function withResponse(Request $request, JsonResponse $response): void
    {
        $response->headers->set('Cache-Control', 'private, no-store');
    }

    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'currency' => 'UYU',
            'items' => $this->resource?->items->map(function (CartItem $item): array {
                $product = $item->product;
                $published = $product?->status === ProductStatus::Published;

                return [
                    'product_id' => $item->product_id,
                    'quantity' => $item->quantity,
                    'available' => $published && $product->stock >= $item->quantity,
                    'product' => $published ? [
                        'name' => $product->name,
                        'slug' => $product->slug,
                        'price_cents' => $product->price_cents,
                        'stock' => $product->stock,
                    ] : null,
                ];
            }) ?? [],
        ];
    }
}
