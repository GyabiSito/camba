<?php

namespace App\Actions\Cart;

use App\Models\Cart;
use App\Models\Product;
use Illuminate\Support\Facades\DB;

class MergeGuestCart
{
    public function execute(string $guestSessionId, int $userId): void
    {
        DB::transaction(function () use ($guestSessionId, $userId): void {
            $guest = Cart::lockOwner(Cart::ownerKey(null, $guestSessionId));
            if ($guest->claimed_at !== null) {
                return;
            }

            $items = $guest->items()->lockForUpdate()->get();
            if ($items->isNotEmpty()) {
                $account = Cart::lockOwner(Cart::ownerKey($userId, $guestSessionId));
                $existing = $account->items()->lockForUpdate()->get()->keyBy('product_id');
                $products = Product::query()->published()
                    ->whereIn('id', $items->pluck('product_id'))->orderBy('id')->lockForUpdate()->get()->keyBy('id');

                foreach ($items as $item) {
                    $current = $existing->get($item->product_id)?->quantity ?? 0;
                    $stock = $products->get($item->product_id)?->stock ?? 0;
                    if ($stock > $current) {
                        $account->setQuantity($item->product_id, min($stock, $current + $item->quantity));
                    }
                }

                $guest->items()->delete();
            }

            // ponytail: Retain claimed hashes to reject stale writes; prune after the session lifetime if these grow.
            $guest->claimed_at = now();
            $guest->save();
        }, 3);
    }
}
