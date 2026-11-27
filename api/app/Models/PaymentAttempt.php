<?php

namespace App\Models;

use App\Enums\PaymentAttemptStatus;
use Illuminate\Database\Eloquent\Model;

class PaymentAttempt extends Model
{
    protected $hidden = ['idempotency_key', 'checkout_url', 'provider_create_key', 'provider_create_payload'];

    protected $casts = [
        'status' => PaymentAttemptStatus::class,
        'checkout_url' => 'encrypted',
        'provider_create_payload' => 'encrypted:array',
        'expires_at' => 'datetime',
    ];

    public function usesOrders(): bool
    {
        return $this->checkout_protocol === 'orders';
    }
}
