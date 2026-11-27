<?php

namespace Tests\Feature\Payments;

use App\Logging\PaymentDailyFileHandler;
use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Monolog\JsonSerializableDateTimeImmutable;
use Monolog\Level;
use Tests\TestCase;

class PaymentLogChannelTest extends TestCase
{
    public function test_refund_file_replay_repairs_an_interrupted_tail_and_keeps_uruguay_date(): void
    {
        $scratch = sys_get_temp_dir().'/camba-refund-'.Str::uuid();
        $handler = new PaymentDailyFileHandler($scratch, Level::Info);
        $instant = new DateTimeImmutable('2026-11-26T02:59:59Z');
        $path = $scratch.'/25112026.log';
        try {
            $first = ['provider_payment_id' => 'PAY-FIRST'];
            $second = ['provider_payment_id' => 'PAY-SECOND'];
            $handler->appendRefundOnce($instant, $first);
            File::append($path, '{"provider_payment_i');
            $handler->appendRefundOnce($instant, $second);
            $handler->appendRefundOnce($instant, $first);
            $handler->appendRefundOnce($instant, $second);
            $this->assertSame([$first, $second], array_map(fn ($line) => json_decode($line, true, flags: JSON_THROW_ON_ERROR), file($path)));
        } finally {
            File::deleteDirectory($scratch);
        }
    }

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
        $before = (new JsonSerializableDateTimeImmutable(false, new DateTimeZone('UTC')))->modify('2026-12-01 02:59:59');
        $after = $before->modify('+1 second');

        try {
            $logger->addRecord(Level::Info, 'checkout.started', [], $before);
            $logger->addRecord(Level::Error, 'payment.failed', [], $after);

            $first = json_decode(File::get($scratch.'/pagos/30112026.log'), true, flags: JSON_THROW_ON_ERROR);
            $second = json_decode(File::get($scratch.'/pagos/01122026.log'), true, flags: JSON_THROW_ON_ERROR);
            $this->assertSame('checkout.started', $first['message']);
            $this->assertSame('payment.failed', $second['message']);
            $this->assertSame('2026-11-30T23:59:59-03:00', $first['datetime']);
            $this->assertSame('2026-12-01T00:00:00-03:00', $second['datetime']);
            $this->assertCount(2, File::files($scratch.'/pagos'));
            $this->assertFileDoesNotExist($scratch.'/laravel.log');
        } finally {
            $logger->close();
            File::deleteDirectory($scratch);
        }
    }

    public function test_operational_file_date_and_offset_use_the_configured_store_timezone(): void
    {
        $scratch = sys_get_temp_dir().'/camba-pagos-'.Str::uuid();
        config(['store.timezone' => 'UTC', 'logging.channels.pagos.handler_with.directory' => $scratch]);
        $logger = Log::channel('pagos')->getLogger();
        $instant = (new JsonSerializableDateTimeImmutable(false, new DateTimeZone('UTC')))->modify('2026-12-01 02:59:59');
        try {
            $logger->addRecord(Level::Info, 'checkout.started', [], $instant);
            $record = json_decode(File::get($scratch.'/01122026.log'), true, flags: JSON_THROW_ON_ERROR);
            $this->assertSame('2026-12-01T02:59:59+00:00', $record['datetime']);
        } finally {
            $logger->close();
            File::deleteDirectory($scratch);
        }
    }
}
