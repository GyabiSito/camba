<?php

namespace App\Logging;

use DateTimeImmutable;
use DateTimeZone;
use Monolog\Handler\StreamHandler;
use Monolog\Level;
use Monolog\LogRecord;

final class PaymentDailyFileHandler extends StreamHandler
{
    private readonly DateTimeZone $timezone;

    public function __construct(private readonly string $directory, Level $level)
    {
        $this->timezone = new DateTimeZone('America/Montevideo');
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

    private function pathFor(DateTimeImmutable $date): string
    {
        return $this->directory.DIRECTORY_SEPARATOR.$date->format('dmY').'.log';
    }
}
