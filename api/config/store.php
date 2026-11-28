<?php

return [
    'fiscal_name' => env('CAMBA_FISCAL_NAME'),
    'timezone' => env('CAMBA_STORE_TIMEZONE', 'America/Montevideo'),
    'public_contact' => [
        'email' => env('CAMBA_PUBLIC_CONTACT_EMAIL'),
        'phone' => env('CAMBA_PUBLIC_CONTACT_PHONE'),
    ],
];
