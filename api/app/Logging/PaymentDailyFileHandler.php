<?php

namespace App\Logging;

use DateTimeImmutable;
use DateTimeZone;
use Monolog\Handler\StreamHandler;
use Monolog\Level;
use Monolog\LogRecord;
use RuntimeException;

final class PaymentDailyFileHandler extends StreamHandler
{
    private readonly DateTimeZone $timezone;

    public function __construct(private readonly string $directory, Level $level)
    {
        $this->timezone = new DateTimeZone(config('store.timezone'));
        parent::__construct($this->pathFor(new DateTimeImmutable('now', $this->timezone)), $level, filePermission: 0660, useLocking: true);
    }

    public function handle(LogRecord $record): bool
    {
        return parent::handle($record->with(datetime: $record->datetime->setTimezone($this->timezone), extra: []));
    }

    protected function write(LogRecord $record): void
    {
        $path = $this->pathFor($record->datetime);
        if ($path !== $this->url) {
            $this->close();
            $this->url = $path;
        }

        parent::write($record);
    }

    public function appendRefundOnce(DateTimeImmutable $verifiedAt, array $entry): void
    {
        $path = $this->pathFor($verifiedAt->setTimezone($this->timezone));
        if (! is_dir($this->directory) && ! @mkdir($this->directory, 0770, true) && ! is_dir($this->directory)) {
            throw new RuntimeException('Could not open the refund log directory.');
        }
        $stream = @fopen($path, 'c+b');
        if ($stream === false) {
            throw new RuntimeException('Could not open the refund log.');
        }
        try {
            if (! flock($stream, LOCK_EX)) {
                throw new RuntimeException('Could not lock the refund log.');
            }
            @chmod($path, 0660);
            // ponytail: scan one daily file under lock; use an indexed audit store if refund volume outgrows this.
            $offset = 0;
            $recoveredTail = false;
            while (($line = fgets($stream)) !== false) {
                if (! str_ends_with($line, "\n")) {
                    // An interrupted writer may have left an incomplete last record.
                    if (! ftruncate($stream, $offset) || fseek($stream, $offset) !== 0) {
                        throw new RuntimeException('Could not recover the refund log tail.');
                    }
                    $recoveredTail = true;
                    break;
                }
                $record = json_decode($line, true, flags: JSON_THROW_ON_ERROR);
                if (($record['provider_payment_id'] ?? null) === $entry['provider_payment_id']) {
                    if (! fsync($stream)) {
                        throw new RuntimeException('Could not sync the existing refund log entry.');
                    }

                    return;
                }
                $offset += strlen($line);
            }
            if (! feof($stream) && ! $recoveredTail) {
                throw new RuntimeException('Could not read the refund log.');
            }
            $line = json_encode($entry, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES)."\n";
            if (fwrite($stream, $line) !== strlen($line) || ! fflush($stream) || ! fsync($stream)) {
                ftruncate($stream, $offset);
                throw new RuntimeException('Could not persist the refund log entry.');
            }
        } finally {
            fclose($stream);
        }
    }

    private function pathFor(DateTimeImmutable $date): string
    {
        return $this->directory.DIRECTORY_SEPARATOR.$date->format('dmY').'.log';
    }
}
