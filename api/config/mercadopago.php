<?php

return [
    'access_token' => env('CAMBA_MP_ACCESS_TOKEN'),
    'collector_id' => env('CAMBA_MP_COLLECTOR_ID'),
    'webhook_secret' => env('CAMBA_MP_WEBHOOK_SECRET'),
    'live' => env('CAMBA_MP_LIVE', false),
];
