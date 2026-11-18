<?php

namespace App\Models;

use App\Enums\PaymentAttemptStatus;
use Illuminate\Database\Eloquent\Model;

class PaymentAttempt extends Model
{
    protected $hidden = ['idempotency_key', 'checkout_url'];

    protected $casts = [
        'status' => PaymentAttemptStatus::class,
        'checkout_url' => 'encrypted',
        'expires_at' => 'datetime',
    ];
}
