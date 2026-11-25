<?php

$publicKey = env('MERCADOPAGO_PUBLIC_KEY');
$accessToken = env('MERCADOPAGO_ACCESS_TOKEN');

return [
    'public_key' => $publicKey === 'X' ? null : $publicKey,
    'access_token' => filled($accessToken) && $accessToken !== 'X' ? $accessToken : env('CAMBA_MP_ACCESS_TOKEN'),
    'collector_id' => env('CAMBA_MP_COLLECTOR_ID'),
    'webhook_secret' => env('CAMBA_MP_WEBHOOK_SECRET'),
    'live' => env('CAMBA_MP_LIVE', false),
];
