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
    public function test_refund_channel_and_legacy_import_are_additive_and_idempotent(): void
    {
        $scratch = sys_get_temp_dir().'/camba-refund-import-'.Str::uuid();
        File::makeDirectory($scratch.'/legacy', 0770, true);
        config(['logging.channels.refunds.handler_with.directory' => $scratch.'/refunds']);
        $entry = $this->legacyRefund();
        $source = $scratch.'/legacy/25112026.log';
        File::put($source, json_encode($entry)."\n");
        $before = hash_file('sha256', $source);
        try {
            $this->assertSame('refunds', config('logging.channels.refunds.name'));
            $this->assertNull(config('logging.channels.refounds'));
            foreach ([1, 2] as $run) {
                $this->artisan('camba:import-refund-logs', ['sources' => [$scratch.'/legacy']])->assertSuccessful();
            }
            $lines = file($scratch.'/refunds/25112026.log');
            $this->assertCount(1, $lines);
            $this->assertSame($entry, json_decode($lines[0], true, flags: JSON_THROW_ON_ERROR));
            $this->assertSame($before, hash_file('sha256', $source));
            $this->assertFileDoesNotExist($scratch.'/refunds/26112026.log');
        } finally {
            File::deleteDirectory($scratch);
        }
    }

    public function test_legacy_import_rejects_conflicts_and_invalid_input_before_appending(): void
    {
        $scratch = sys_get_temp_dir().'/camba-refund-import-'.Str::uuid();
        File::makeDirectory($scratch.'/legacy', 0770, true);
        config(['logging.channels.refunds.handler_with.directory' => $scratch.'/refunds']);
        $entry = $this->legacyRefund();
        $source = $scratch.'/legacy/25112026.log';
        try {
            foreach ([
                json_encode($entry)."\n".json_encode([...$entry, 'amount_cents' => 2])."\n",
                json_encode($entry)."\n".'{"incomplete":',
                json_encode([...$entry, 'verified_at' => '2026-02-30T00:00:00Z'])."\n",
                json_encode([...$entry, 'secret' => 'not-permitted'])."\n",
            ] as $contents) {
                File::put($source, $contents);
                $this->artisan('camba:import-refund-logs', ['sources' => [$scratch.'/legacy']])->assertFailed();
                $this->assertDirectoryDoesNotExist($scratch.'/refunds');
                $this->assertSame($contents, File::get($source));
            }
            File::put($source, json_encode($entry)."\n");
            $this->artisan('camba:import-refund-logs', ['sources' => [$source]])->assertSuccessful();
            $target = $scratch.'/refunds/25112026.log';
            $before = File::get($target);
            File::put($source, json_encode([...$entry, 'amount_cents' => 2])."\n");
            $this->artisan('camba:import-refund-logs', ['sources' => [$source]])->assertFailed();
            $this->assertSame($before, File::get($target));
        } finally {
            File::deleteDirectory($scratch);
        }
    }

    private function legacyRefund(): array
    {
        return [
            'verified_at' => '2026-11-25T23:59:59-03:00',
            'order_reference' => '1f7bdd41-401e-4d41-89e2-eaa3a9c7886d',
            'provider_order_id' => null, 'provider_payment_id' => '123456789',
            'amount_cents' => 12500, 'currency' => 'UYU',
        ];
    }

    public function test_import_defaults_to_old_storage_directory_and_preserves_other_daily_entries(): void
    {
        $scratch = sys_get_temp_dir().'/camba-refund-import-'.Str::uuid();
        $previous = storage_path();
        $this->app->useStoragePath($scratch);
        File::makeDirectory($scratch.'/logs/refounds', 0770, true);
        config(['logging.channels.refunds.handler_with.directory' => $scratch.'/logs/refunds']);
        $first = $this->legacyRefund();
        $second = [...$first, 'provider_payment_id' => '987654321', 'verified_at' => '2026-11-26T00:00:00-03:00'];
        $handler = new PaymentDailyFileHandler($scratch.'/logs/refunds', Level::Info);
        try {
            $handler->appendRefundOnce(new DateTimeImmutable($second['verified_at']), $second);
            $original = File::get($scratch.'/logs/refunds/26112026.log');
            File::put($scratch.'/logs/refounds/25112026.log', json_encode($first)."\n");
            $this->artisan('camba:import-refund-logs')->assertSuccessful();
            $this->assertSame($original, File::get($scratch.'/logs/refunds/26112026.log'));
            $this->assertFileExists($scratch.'/logs/refounds/25112026.log');
            $this->assertCount(1, file($scratch.'/logs/refunds/25112026.log'));
        } finally {
            $this->app->useStoragePath($previous);
            File::deleteDirectory($scratch);
        }
    }

    public function test_strict_import_append_cannot_overwrite_a_concurrent_conflicting_payment(): void
    {
        $scratch = sys_get_temp_dir().'/camba-refund-import-'.Str::uuid();
        $handler = new PaymentDailyFileHandler($scratch, Level::Info);
        $entry = $this->legacyRefund();
        $instant = new DateTimeImmutable($entry['verified_at']);
        try {
            $handler->appendRefundOnce($instant, $entry);
            $before = File::get($scratch.'/25112026.log');
            try {
                $handler->appendRefundOnce($instant, [...$entry, 'amount_cents' => 2], rejectConflicts: true);
                $this->fail('A conflicting payment must be rejected.');
            } catch (\RuntimeException $error) {
                $this->assertSame('Conflicting refund log entry.', $error->getMessage());
            }
            $this->assertSame($before, File::get($scratch.'/25112026.log'));
        } finally {
            File::deleteDirectory($scratch);
        }
    }

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
