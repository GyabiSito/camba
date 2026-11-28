<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PaymentObservation extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['payment_id', 'status', 'provider_updated_at'];
}
