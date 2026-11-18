<?php

namespace App\Actions\Cart;

use App\Models\Cart;
use App\Models\Product;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SetCartItem
{
    public function execute(?int $userId, string $sessionId, string $productId, ?int $quantity): ?Cart
    {
        $owner = Cart::ownerKey($userId, $sessionId);

        return DB::transaction(function () use ($owner, $productId, $quantity): ?Cart {
            $cart = $quantity === null
                ? Cart::query()->where($owner)->lockForUpdate()->first()
                : Cart::lockOwner($owner);

            if ($cart === null) {
                return null;
            }

            abort_if($cart->claimed_at !== null, 409, 'This guest cart has already been associated with an account.');

            if ($quantity === null) {
                if ($cart->items()->where('product_id', $productId)->delete() > 0) {
                    $cart->touch();
                }

                return $cart;
            }

            $product = Product::query()->published()->lockForUpdate()->findOrFail($productId);
            if ($quantity < 1 || $quantity > $product->stock) {
                throw ValidationException::withMessages(['quantity' => 'Choose a quantity within the current stock.']);
            }

            $cart->setQuantity($product->id, $quantity);

            return $cart;
        }, 3);
    }
}
