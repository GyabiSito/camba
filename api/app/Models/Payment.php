<?php

namespace App\Models;

use App\Enums\PaymentStatus;
use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    protected $casts = ['status' => PaymentStatus::class, 'amount_cents' => 'integer'];
}
