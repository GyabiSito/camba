<?php

namespace App\Actions\Imports;

use App\Jobs\ApplyCatalogImport;
use App\Models\CatalogImport;
use Illuminate\Support\Facades\DB;
use Throwable;

class ConfirmCatalogImport
{
    public function execute(string $id, int $adminId): CatalogImport
    {
        $import = DB::transaction(function () use ($id, $adminId): CatalogImport {
            $import = CatalogImport::query()->lockForUpdate()->findOrFail($id);
            if ($import->confirmed_at === null) {
                abort_unless($import->rows()->where('status', 'ready')->exists(), 409, 'There are no valid rows to confirm.');
                $import->update(['confirmed_by_admin_id' => $adminId, 'confirmed_at' => now()]);
            }

            return $import;
        }, 3);

        if ($import->completed_at === null) {
            try {
                ApplyCatalogImport::dispatch($import->id);
            } catch (Throwable) {
                abort(503, 'Confirmation was saved, but the job could not start. Confirm again to resume.');
            }
        }

        return $import->refresh();
    }
}
