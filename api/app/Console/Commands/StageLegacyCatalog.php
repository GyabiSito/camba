<?php

namespace App\Console\Commands;

use App\Actions\Legacy\LegacyCatalogFiles;
use App\Actions\Legacy\PlanLegacyCatalogAction;
use App\Actions\Legacy\StageLegacyCatalogAction;
use Illuminate\Console\Command;
use Illuminate\Database\QueryException;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;
use RuntimeException;
use Symfony\Component\Console\Formatter\OutputFormatter;
use Symfony\Component\Console\Output\OutputInterface;

class StageLegacyCatalog extends Command
{
    protected $signature = 'camba:stage-legacy-catalog
        {export : Isolated JSON catalog export}
        {mapping : Reviewed JSON category, stock, and optional redirect mapping}
        {plan : Saved clean JSON dry-run report}
        {--photos= : Local root of the isolated photo copy}
        {--mapping-sha256= : SHA-256 of the reviewed mapping file}
        {--apply : Write drafts to a dedicated local staging database}';

    protected $description = 'Rehearse applying a reviewed legacy catalog plan in a disposable local environment';

    public function handle(LegacyCatalogFiles $files, PlanLegacyCatalogAction $plan, StageLegacyCatalogAction $stage): int
    {
        try {
            if (! $this->option('apply')) {
                throw new InvalidArgumentException('Explicit --apply is required. Run camba:plan-legacy-catalog to preview changes.');
            }
            $hash = (string) $this->option('mapping-sha256');
            if (! preg_match('/\A[a-fA-F0-9]{64}\z/', $hash)) {
                throw new InvalidArgumentException('Supply the reviewed mapping checksum with --mapping-sha256.');
            }
            $mapping = $files->readJson((string) $this->argument('mapping'), 'mapping', $hash);
            $export = $files->readJson((string) $this->argument('export'), 'export');
            $reviewed = $files->readJson((string) $this->argument('plan'), 'reviewed plan');
            $root = $files->photoRoot((string) $this->option('photos'));
            $report = $plan->execute($export, $mapping, $root);
            if ($report['errors'] !== [] || $report !== $reviewed) {
                throw new InvalidArgumentException('The reviewed plan is invalid or no longer matches the export, mapping, and photo hashes. Run and review a fresh dry-run.');
            }
            $applied = $stage->execute($report, $mapping, $root);
        } catch (QueryException) {
            $this->error('Staging database operation failed. Verify the dedicated target schema and rerun with the same reviewed plan.');

            return self::FAILURE;
        } catch (InvalidArgumentException|RuntimeException|ValidationException $e) {
            $this->error(OutputFormatter::escape($e->getMessage()));

            return self::FAILURE;
        }

        $this->output->writeln(json_encode($applied, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), OutputInterface::OUTPUT_RAW);

        return self::SUCCESS;
    }
}
