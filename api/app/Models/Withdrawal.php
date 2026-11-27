<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class Withdrawal extends Model
{
    protected $guarded = ['id'];

    protected $hidden = ['request_key', 'email'];

    protected $casts = ['email' => 'encrypted', 'refund_confirmed_at' => 'datetime'];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public static function purchaseMatches(?Order $order, string $reference, string $email): bool
    {
        $address = $order?->contact['email'] ?? null;

        return $order !== null && $order->reference === $reference
            && is_string($address) && hash_equals(Str::lower(trim($address)), Str::lower(trim($email)));
    }

    public function verifiedOrder(): ?Order
    {
        return self::purchaseMatches($this->order, $this->order_reference, $this->email) ? $this->order : null;
    }

    public static function verifiedReferenceFor(Order $order): ?string
    {
        return self::where('order_id', $order->id)->oldest('id')->cursor()
            ->first(fn (self $case) => self::purchaseMatches($order, $case->order_reference, $case->email))?->reference;
    }
}
