<?php

namespace Tests\Feature\Catalog;

use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\BackupGlobals;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class PublicMediaUrlTest extends TestCase
{
    public static function mediaOrigins(): array
    {
        return [
            'local storefront proxy' => ['local', '/storage'],
            'deployed absolute URLs' => ['production', 'https://shop.example.test/storage'],
        ];
    }

    #[BackupGlobals(true)]
    #[DataProvider('mediaOrigins')]
    public function test_public_disk_urls_use_the_expected_media_origin(string $environment, string $baseUrl): void
    {
        $_SERVER['APP_ENV'] = $_ENV['APP_ENV'] = $environment;
        $_SERVER['APP_URL'] = $_ENV['APP_URL'] = 'https://shop.example.test';
        config(['filesystems' => require config_path('filesystems.php')]);

        $this->assertSame("$baseUrl/products/photo.webp", Storage::disk('public')->url('products/photo.webp'));
    }
}
