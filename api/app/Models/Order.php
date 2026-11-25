<?php

namespace App\Models;

use App\Enums\OrderStatus;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    public const PREPARATION_STAGES = ['unstarted', 'preparing'];

    protected $hidden = ['owner_key', 'idempotency_key', 'request_hash', 'payment_reconcile_token'];

    protected $casts = [
        'status' => OrderStatus::class,
        'checkout_managed' => 'boolean',
        'contact' => 'encrypted:array',
        'address' => 'encrypted:array',
        'subtotal_cents' => 'integer',
        'shipping_cents' => 'integer',
        'total_cents' => 'integer',
        'reservation_expires_at' => 'datetime',
        'guest_access_expires_at' => 'datetime',
        'stock_released_at' => 'datetime',
        'stock_reacquired_at' => 'datetime',
        'paid_at' => 'datetime',
        'payment_reconcile_at' => 'datetime',
        'payment_reconciled_at' => 'datetime',
        'payment_issues' => 'array',
    ];

    public static function ownerKey(?int $userId, string $sessionId): string
    {
        return $userId === null
            ? 'guest:'.Cart::ownerKey(null, $sessionId)['guest_session_hash']
            : 'buyer:'.$userId;
    }

    #[Scope]
    protected function owned(Builder $query, ?int $userId, string $sessionId): void
    {
        $query->where('owner_key', static::ownerKey($userId, $sessionId))->where('user_id', $userId);
        if ($userId === null) {
            $query->where('guest_access_expires_at', '>', now());
        }
    }

    #[Scope]
    protected function commercial(Builder $query): void
    {
        $query->where(fn (Builder $visible) => $visible->where('checkout_managed', false)->orWhereNotNull('paid_at'));
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(OrderPayment::class);
    }

    /** @return HasMany<OrderItem, $this> */
    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class)->orderBy('product_id');
    }
}
