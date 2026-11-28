<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Cart extends Model
{
    /** @return array{user_id: int}|array{guest_session_hash: string} */
    public static function ownerKey(?int $userId, string $sessionId): array
    {
        return $userId === null ? ['guest_session_hash' => hash('sha256', $sessionId)] : ['user_id' => $userId];
    }

    /**
     * Find or create the owner's cart under the caller's write transaction.
     *
     * @param  array{user_id: int}|array{guest_session_hash: string}  $owner
     */
    public static function lockOwner(array $owner): self
    {
        $key = array_keys($owner);
        static::query()->upsert([$owner], $key, $key);

        return static::query()->where($owner)->lockForUpdate()->firstOrFail();
    }

    /** @return HasMany<CartItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(CartItem::class)->orderBy('product_id');
    }

    /** Set an already-validated quantity while holding the cart's write lock. */
    public function setQuantity(int $productId, int $quantity): void
    {
        $this->items()->upsert(['product_id' => $productId, 'quantity' => $quantity], ['cart_id', 'product_id'], ['quantity']);
    }

    /** @param array<int,int> $lines Purchased quantities; the caller holds the cart lock. */
    public function removePurchasedItems(array $lines): void
    {
        foreach ($this->items()->whereIn('product_id', array_keys($lines))->get() as $item) {
            $remaining = $item->quantity - $lines[$item->product_id];
            if ($remaining > 0) {
                $item->forceFill(['quantity' => $remaining])->save();
            } else {
                $item->delete();
            }
        }
    }
}
