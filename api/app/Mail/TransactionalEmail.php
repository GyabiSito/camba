<?php

namespace App\Mail;

use App\Models\StoreSettings;

final class TransactionalEmail
{
    public const HTML = 'mail.transactional';

    public const TEXT = 'mail.transactional-text';

    public static function adminOrderUrl(string $reference): ?string
    {
        return self::adminUrl('/pedidos/'.rawurlencode($reference));
    }

    public static function adminWithdrawalUrl(string $reference): ?string
    {
        return self::adminUrl('/pedidos/arrepentimientos?solicitud='.rawurlencode($reference));
    }

    private static function adminUrl(string $path): ?string
    {
        $origin = config('app.admin_url');
        $parts = is_string($origin) && filter_var($origin, FILTER_VALIDATE_URL) ? parse_url($origin) : false;
        if (! $parts || ! in_array($parts['scheme'], ['http', 'https'], true)
            || array_intersect_key($parts, array_flip(['user', 'pass', 'query', 'fragment']))
            || ! in_array($parts['path'] ?? '', ['', '/'], true)) {
            return null;
        }

        return rtrim($origin, '/').$path;
    }

    public static function support(): array
    {
        $settings = StoreSettings::query()->find(1)?->effective();

        return [
            'supportEmail' => $settings['support_email'] ?? null,
            'supportPhone' => $settings['support_phone'] ?? null,
        ];
    }
}
