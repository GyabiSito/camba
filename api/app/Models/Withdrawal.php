<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class Withdrawal extends Model
{
    protected $guarded = ['id'];

    protected $hidden = ['request_key', 'email', 'confirmation_token', 'confirmation_owner_hash'];

    protected $casts = [
        'email' => 'encrypted', 'refund_confirmed_at' => 'datetime',
        'confirmation_token' => 'encrypted', 'confirmation_requested_at' => 'datetime',
        'confirmation_expires_at' => 'datetime', 'confirmation_confirmed_at' => 'datetime',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function requestedOrder(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'order_reference', 'reference');
    }

    public static function verifiedBuyer(?Order $order): ?User
    {
        $buyer = $order?->buyer;

        return $buyer?->role === 'buyer' && $buyer->hasVerifiedEmail() && filter_var($buyer->email, FILTER_VALIDATE_EMAIL)
            ? $buyer : null;
    }

    public static function purchaseMatches(?Order $order, string $reference, string $email): bool
    {
        if ($order === null || $order->reference !== $reference) {
            return false;
        }
        $address = match (true) {
            $order->user_id !== null => self::verifiedBuyer($order)?->email,
            str_starts_with($order->owner_key, 'guest:') => $order->contact['email'] ?? null,
            default => null,
        };

        return is_string($address) && hash_equals(Str::lower(trim($address)), Str::lower(trim($email)));
    }

    public function verifiedOrder(): ?Order
    {
        return $this->isVerifiedFor($this->order) ? $this->order : null;
    }

    public function isVerifiedFor(?Order $order): bool
    {
        return $order !== null && $this->order_id !== null
            && (int) $this->order_id === (int) $order->id && $this->order_reference === $order->reference
            && (self::purchaseMatches($order, $this->order_reference, $this->email)
                || ($this->confirmation_confirmed_at !== null && $order->user_id !== null
                    && (int) $this->confirmation_buyer_id === (int) $order->user_id));
    }

    public static function verifiedReferenceFor(Order $order): ?string
    {
        return self::where('order_id', $order->id)->oldest('id')->cursor()
            ->first(fn (self $case) => $case->isVerifiedFor($order))?->reference;
    }
}
