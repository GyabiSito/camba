<?php

namespace App\Console\Commands;

use App\Logging\PaymentDailyFileHandler;
use DateTimeImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class ImportRefundLogs extends Command
{
    protected $signature = 'camba:import-refund-logs {sources?* : Offline JSONL files or directories; defaults to storage/logs/refounds}';

    protected $description = 'Validate and add legacy refund history without deleting sources or duplicating payments';

    public function handle(): int
    {
        try {
            $sources = $this->argument('sources');
            $legacy = storage_path('logs/refounds');
            if ($sources === [] && ! is_dir($legacy)) {
                $this->info('No legacy refund logs found.');

                return self::SUCCESS;
            }
            $sources = $sources ?: [$legacy];
            $directory = config('logging.channels.refunds.handler_with.directory');
            // ponytail: validate the entire offline import in memory before writing; stream via an indexed staging store if history outgrows memory.
            $existing = $this->read($this->files(is_dir($directory) ? [$directory] : []));
            $incoming = $this->read($this->files($sources));
            foreach ($incoming as $id => $entry) {
                if (isset($existing[$id]) && ! $this->same($existing[$id], $entry)) {
                    throw new RuntimeException('Conflicting refund history.');
                }
            }
            $handler = Log::channel('refunds')->getLogger()->getHandlers()[0];
            if (! $handler instanceof PaymentDailyFileHandler) {
                throw new RuntimeException('Invalid refund log handler.');
            }
            foreach ($incoming as $entry) {
                $handler->appendRefundOnce(new DateTimeImmutable($entry['verified_at']), $entry, rejectConflicts: true);
            }
            $this->info('Refund history imported; sources preserved.');

            return self::SUCCESS;
        } catch (Throwable) {
            $this->error('Refund history import failed. Check JSONL, dates, conflicting payments and filesystem access; sources were not changed. Safe to retry after correcting the cause.');

            return self::FAILURE;
        }
    }

    private function files(array $sources): array
    {
        $files = [];
        foreach ($sources as $source) {
            if (is_link($source) || (! is_file($source) && ! is_dir($source))) {
                throw new RuntimeException('Invalid refund history source.');
            }
            $found = is_dir($source) ? glob(rtrim($source, '/\\').'/*.log') : [$source];
            if ($found === false) {
                throw new RuntimeException('Could not list refund history.');
            }
            foreach ($found as $file) {
                if (is_link($file) || ! is_file($file) || ! preg_match('/\A\d{8}\.log\z/', basename($file))) {
                    throw new RuntimeException('Invalid refund history filename.');
                }
                $files[] = $file;
            }
        }
        sort($files);

        return array_unique($files);
    }

    private function read(array $files): array
    {
        $entries = [];
        foreach ($files as $file) {
            $stream = fopen($file, 'rb');
            if ($stream === false) {
                throw new RuntimeException('Could not open refund history.');
            }
            try {
                while (($line = fgets($stream)) !== false) {
                    if (! str_ends_with($line, "\n")) {
                        throw new RuntimeException('Incomplete refund history line.');
                    }
                    $entry = json_decode($line, true, flags: JSON_THROW_ON_ERROR);
                    $this->validateEntry($entry, basename($file));
                    $id = $entry['provider_payment_id'];
                    if (isset($entries[$id]) && ! $this->same($entries[$id], $entry)) {
                        throw new RuntimeException('Conflicting refund history.');
                    }
                    $entries[$id] = $entry;
                }
                if (! feof($stream)) {
                    throw new RuntimeException('Could not read refund history.');
                }
            } finally {
                fclose($stream);
            }
        }

        return $entries;
    }

    private function validateEntry(mixed $entry, string $filename): void
    {
        $required = ['verified_at', 'order_reference', 'provider_order_id', 'provider_payment_id', 'amount_cents', 'currency'];
        if (! is_array($entry) || array_diff($required, array_keys($entry))
            || array_diff(array_keys($entry), [...$required, 'withdrawal_reference'])
            || ! is_string($entry['verified_at'])
            || ! preg_match('/\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})\z/', $entry['verified_at'])
            || ! is_string($entry['order_reference']) || ! Str::isUuid($entry['order_reference'])
            || ! is_string($entry['provider_payment_id']) || trim($entry['provider_payment_id']) === ''
            || ! (is_null($entry['provider_order_id']) || (is_string($entry['provider_order_id']) && trim($entry['provider_order_id']) !== ''))
            || ! is_int($entry['amount_cents']) || $entry['amount_cents'] <= 0 || $entry['currency'] !== 'UYU'
            || (isset($entry['withdrawal_reference']) && (! is_string($entry['withdrawal_reference']) || ! Str::isUuid($entry['withdrawal_reference'])))) {
            throw new RuntimeException('Invalid refund history record.');
        }
        $date = new DateTimeImmutable($entry['verified_at']);
        if (DateTimeImmutable::getLastErrors() !== false
            || $date->setTimezone(new \DateTimeZone(config('store.timezone')))->format('dmY').'.log' !== $filename) {
            throw new RuntimeException('Invalid refund history date.');
        }
    }

    private function same(array $first, array $second): bool
    {
        ksort($first);
        ksort($second);

        return $first === $second;
    }
}
