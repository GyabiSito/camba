<?php

namespace App\Actions\Imports;

use App\Actions\Catalog\SaveProductAction;
use App\Enums\ProductStatus;
use App\Models\Brand;
use App\Models\CatalogImport;
use App\Models\CatalogImportRow;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class ApplyCatalogImportRows
{
    public function __construct(private SaveProductAction $saveProduct, private CheckImportPhotos $photos) {}

    public function execute(int $id): void
    {
        $import = CatalogImport::query()->findOrFail($id);
        if ($import->confirmed_at === null || $import->completed_at !== null) {
            return;
        }
        foreach ($import->rows()->where('status', 'ready')->orderBy('id')->pluck('id') as $rowId) {
            try {
                DB::transaction(fn () => $this->applyRow($rowId, $import->confirmed_by), 3);
            } catch (ValidationException|ConflictHttpException $error) {
                // A row's product writes were rolled back before this independent status update.
                CatalogImportRow::query()->whereKey($rowId)->where('status', 'ready')->update([
                    'status' => 'failed',
                    'errors' => json_encode($error instanceof ValidationException ? $error->errors() : ['row' => [$error->getMessage()]], JSON_THROW_ON_ERROR),
                ]);
            }
        }
        CatalogImport::query()->whereKey($id)->whereNull('completed_at')
            ->whereDoesntHave('rows', fn ($query) => $query->where('status', 'ready'))
            ->update(['completed_at' => now()]);
    }

    private function applyRow(int $id, int $actorId): void
    {
        $row = CatalogImportRow::query()->lockForUpdate()->findOrFail($id);
        if ($row->status !== 'ready') {
            return;
        }
        $product = $row->product_id === null ? null : Product::query()->lockForUpdate()->find($row->product_id);
        if (($row->action === 'update' && (! $product || $product->sku !== $row->sku))
            || ($row->action === 'create' && Product::query()->where('sku', $row->sku)->exists())) {
            $this->changed();
        }
        foreach ($row->expected as $field => $value) {
            if ($value !== $product->$field) {
                $this->changed();
            }
        }

        $values = $row->values;
        $this->photos->execute($product, $values['photos'] ?? []);
        unset($values['photos']);
        // Published updates already check and lock both classifications in order in SaveProductAction.
        if ($product?->status !== ProductStatus::Published) {
            foreach (['category_id' => Category::class, 'brand_id' => Brand::class] as $field => $model) {
                if (isset($values[$field]) && ! $model::query()->whereKey($values[$field])->lockForUpdate()->value('active')) {
                    throw ValidationException::withMessages([$field => 'This classification is no longer active.']);
                }
            }
        }

        $changes = [];
        foreach ($values as $field => $value) {
            $before = $product?->$field;
            if ($before !== $value) {
                $changes[$field] = ['before' => $before, 'after' => $value];
            }
        }
        $result = $product
            ? $this->saveProduct->update((string) $product->id, $values, actorId: $actorId)
            : $this->saveProduct->createForImport($row->sku, $values);
        $row->update(['status' => 'applied', 'product_id' => $result->id, 'changes' => $changes]);
    }

    private function changed(): never
    {
        throw ValidationException::withMessages(['row' => 'This SKU or one of its proposed fields changed after preview. Upload a corrected file.']);
    }
}
