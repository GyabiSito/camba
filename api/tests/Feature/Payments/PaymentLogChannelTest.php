<?php

namespace Tests\Feature\Payments;

use DateTimeZone;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Monolog\JsonSerializableDateTimeImmutable;
use Monolog\Level;
use Tests\TestCase;

class PaymentLogChannelTest extends TestCase
{
    public function test_one_logger_rolls_over_at_uruguayan_midnight_without_touching_the_default_log(): void
    {
        $this->assertSame('monolog', config('logging.channels.pagos.driver'));
        $scratch = sys_get_temp_dir().'/camba-pagos-'.Str::uuid();
        config([
            'logging.channels.pagos.handler_with.directory' => $scratch.'/pagos',
            'logging.default' => 'single',
            'logging.channels.single.path' => $scratch.'/laravel.log',
        ]);

        $logger = Log::channel('pagos')->getLogger();
        $before = (new JsonSerializableDateTimeImmutable(false, new DateTimeZone('UTC')))->modify('2026-11-26 02:59:59');
        $after = $before->modify('+1 second');

        try {
            $logger->addRecord(Level::Info, 'checkout.started', [], $before);
            $logger->addRecord(Level::Error, 'payment.failed', [], $after);

            $first = json_decode(File::get($scratch.'/pagos/25112026.log'), true, flags: JSON_THROW_ON_ERROR);
            $second = json_decode(File::get($scratch.'/pagos/26112026.log'), true, flags: JSON_THROW_ON_ERROR);
            $this->assertSame('checkout.started', $first['message']);
            $this->assertSame('payment.failed', $second['message']);
            $this->assertSame('2026-11-25T23:59:59-03:00', $first['datetime']);
            $this->assertSame('2026-11-26T00:00:00-03:00', $second['datetime']);
            $this->assertCount(2, File::files($scratch.'/pagos'));
            $this->assertFileDoesNotExist($scratch.'/laravel.log');
        } finally {
            $logger->close();
            File::deleteDirectory($scratch);
        }
    }
}
