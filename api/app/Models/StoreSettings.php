<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class StoreSettings extends Model
{
    public $timestamps = false;

    protected $table = 'store_settings';

    protected $casts = ['values' => 'array'];

    public static function loadValues(): array
    {
        return self::query()->findOrFail(1)->effective();
    }

    public function effective(): array
    {
        $pickup = config('checkout.pickup_address');
        $delivery = config('checkout.delivery_cents');
        $validPickup = is_string($pickup) && trim($pickup) !== '' && mb_strlen(trim($pickup)) <= 255;
        $validDelivery = (is_int($delivery) || is_string($delivery))
            ? filter_var($delivery, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 2147483647]])
            : false;

        return array_replace([
            'business_name' => 'Camba',
            'support_email' => null,
            'support_phone' => null,
            'pickup_address' => $validPickup ? trim($pickup) : null,
            'delivery_cents' => $validDelivery === false ? null : $validDelivery,
            'remind_payment' => false,
            'payment_lead_minutes' => 10,
            'remind_cart' => false,
            'cart_delay_hours' => 24,
            'low_stock_threshold' => 3,
            'pending_fulfilment_hours' => 24,
        ], $this->values);
    }
}
