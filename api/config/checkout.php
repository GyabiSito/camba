<?php

return [
    'require_online_payment' => env('CAMBA_CHECKOUT_REQUIRE_ONLINE_PAYMENT', false),
    'delivery_cents' => env('CAMBA_DELIVERY_CENTS'),
    'pickup_address' => env('CAMBA_PICKUP_ADDRESS'),
    'reservation_minutes' => 30,
    'checkout_pro_reservation_minutes' => 10,
    'guest_access_hours' => 24,
];
