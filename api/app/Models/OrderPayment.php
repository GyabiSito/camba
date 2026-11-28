<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrderPayment extends Model
{
    public $timestamps = false;

    public function attempts(): HasMany
    {
        return $this->hasMany(PaymentAttempt::class, 'payment_id');
    }
}
