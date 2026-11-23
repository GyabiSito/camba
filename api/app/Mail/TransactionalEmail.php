<?php

namespace App\Mail;

use App\Models\StoreSettings;

final class TransactionalEmail
{
    public const HTML = 'mail.transactional';

    public const TEXT = 'mail.transactional-text';

    public static function support(): array
    {
        $settings = StoreSettings::query()->find(1)?->effective();

        return [
            'supportEmail' => $settings['support_email'] ?? null,
            'supportPhone' => $settings['support_phone'] ?? null,
        ];
    }
}
