<?php

namespace App\Console\Commands;

use App\Actions\Legacy\PlanLegacyCatalogAction;
use Illuminate\Console\Command;
use InvalidArgumentException;
use JsonException;
use Symfony\Component\Console\Output\OutputInterface;

class PlanLegacyCatalog extends Command
{
    protected $signature = 'camba:plan-legacy-catalog
        {export : Isolated JSON catalog export}
        {mapping : Reviewed JSON category and residual-stock mapping}
        {--photos= : Local root of the isolated photo copy}';

    protected $description = 'Dry-run legacy catalog migration using local files only, without applying changes';

    public function handle(PlanLegacyCatalogAction $plan): int
    {
        try {
            $export = $this->readJson((string) $this->argument('export'), 'export');
            $mapping = $this->readJson((string) $this->argument('mapping'), 'mapping');
            $photoRoot = $this->localPath((string) $this->option('photos'));
            if (! $photoRoot || ! is_dir($photoRoot)) {
                throw new InvalidArgumentException('Set --photos to an existing local photo directory.');
            }
        } catch (InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $report = $plan->execute($export, $mapping, $photoRoot);
        $this->output->writeln(json_encode($report, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), OutputInterface::OUTPUT_RAW);

        return $report['errors'] === [] ? self::SUCCESS : self::FAILURE;
    }

    private function readJson(string $path, string $label): array
    {
        $resolved = $this->localPath($path);
        $json = $resolved && is_file($resolved) ? @file_get_contents($resolved) : false;
        if ($json === false) {
            throw new InvalidArgumentException("Use a readable local $label JSON file.");
        }

        try {
            $data = json_decode($json, true, flags: JSON_THROW_ON_ERROR | JSON_BIGINT_AS_STRING);
        } catch (JsonException $e) {
            throw new InvalidArgumentException("Invalid $label JSON: ".$e->getMessage(), previous: $e);
        }

        if (! is_array($data) || array_is_list($data)) {
            throw new InvalidArgumentException("The $label JSON must be an object.");
        }

        return $data;
    }

    private function localPath(string $value): ?string
    {
        $portable = str_replace('\\', '/', $value);
        $withoutDrive = preg_replace('~^[A-Za-z]:(?=/)~', '', $portable);
        if ($portable === '' || str_starts_with($portable, '//') || str_contains($withoutDrive, ':') || str_contains($value, "\0")) {
            return null;
        }

        $resolved = realpath($value);

        return $resolved !== false && ! str_starts_with(str_replace('\\', '/', $resolved), '//') ? $resolved : null;
    }
}
