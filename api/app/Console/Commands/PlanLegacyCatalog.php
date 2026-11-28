<?php

namespace App\Console\Commands;

use App\Actions\Legacy\LegacyCatalogFiles;
use App\Actions\Legacy\PlanLegacyCatalogAction;
use Illuminate\Console\Command;
use InvalidArgumentException;
use Symfony\Component\Console\Output\OutputInterface;

class PlanLegacyCatalog extends Command
{
    protected $signature = 'camba:plan-legacy-catalog
        {export : Isolated JSON catalog export}
        {mapping : Reviewed JSON category and residual-stock mapping}
        {--photos= : Local root of the isolated photo copy}';

    protected $description = 'Dry-run legacy catalog migration using local files only, without applying changes';

    public function handle(PlanLegacyCatalogAction $plan, LegacyCatalogFiles $files): int
    {
        try {
            $export = $files->readJson((string) $this->argument('export'), 'export');
            $mapping = $files->readJson((string) $this->argument('mapping'), 'mapping');
            $photoRoot = $files->photoRoot((string) $this->option('photos'));
        } catch (InvalidArgumentException $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }

        $report = $plan->execute($export, $mapping, $photoRoot);
        $this->output->writeln(json_encode($report, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), OutputInterface::OUTPUT_RAW);

        return $report['errors'] === [] ? self::SUCCESS : self::FAILURE;
    }
}
