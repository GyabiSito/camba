<?php

namespace App\Jobs;

use App\Actions\Imports\ApplyCatalogImportRows;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class ApplyCatalogImport implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 80;

    public function __construct(public int $importId) {}

    public function handle(ApplyCatalogImportRows $rows): void
    {
        $rows->execute($this->importId);
    }
}
