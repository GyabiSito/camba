<?php

namespace App\Commerce;

class PurchaseTerms
{
    public const VERSION = '2026-11-27';

    public static function read(string $version = self::VERSION): ?array
    {
        return match ($version) {
            '2026-11-27' => require resource_path('legal/purchase-terms-2026-11-27.php'),
            default => null,
        };
    }

    public static function withdrawal(): string
    {
        return self::read()['withdrawal'];
    }
}
