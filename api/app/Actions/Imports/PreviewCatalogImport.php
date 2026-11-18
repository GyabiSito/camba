<?php

namespace App\Actions\Imports;

use App\Models\Brand;
use App\Models\CatalogImport;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PreviewCatalogImport
{
    public function __construct(private ReadCatalogSpreadsheet $reader, private CheckImportPhotos $photos) {}

    public function execute(UploadedFile $file, int $actorId): CatalogImport
    {
        $hash = hash_file('sha256', $file->getRealPath());
        if ($existing = CatalogImport::query()->where('sha256', $hash)->first()) {
            return $existing;
        }

        $rows = $this->reader->execute($file);
        $skus = array_map(fn ($row) => $this->sku($row[0]['codigo']), $rows);
        $duplicates = array_count_values(array_filter($skus, fn ($sku) => $sku !== null));
        $products = Product::query()->whereIn('sku', array_map('strval', array_keys($duplicates)))->get()->keyBy('sku');
        $ledger = [];
        foreach ($rows as $line => [$data, $parseError]) {
            $sku = $skus[$line];
            $duplicate = $sku !== null && $duplicates[$sku] > 1;
            $product = $sku === null ? null : $products->get($sku);
            [$values, $errors] = $this->validateRow($data, $product);
            if ($parseError !== null) {
                $errors['row'] = $parseError;
            }
            if ($sku === null || $duplicate) {
                $errors['codigo'] = $sku === null ? 'Use an SKU of up to 64 letters, digits, dots, hyphens or underscores.' : "SKU $sku occurs more than once in this file.";
            }

            $ledger[] = [
                'line' => $line,
                'sku' => $duplicate ? null : $sku,
                'status' => $errors === [] ? 'ready' : 'invalid',
                'action' => $sku === null || $duplicate ? null : ($product ? 'update' : 'create'),
                'product_id' => $product?->id,
                'values' => $values,
                'expected' => $product ? $product->only(array_diff(array_keys($values), ['photos'])) : [],
                'errors' => array_map(fn ($message) => [$message], $errors),
                'changes' => [],
            ];
        }

        return DB::transaction(function () use ($hash, $actorId, $ledger): CatalogImport {
            $import = CatalogImport::query()->createOrFirst(['sha256' => $hash], ['uploaded_by' => $actorId]);
            if ($import->wasRecentlyCreated) {
                $import->rows()->createMany($ledger);
            }

            return $import;
        }, 3);
    }

    private function sku(string $raw): ?string
    {
        $sku = strtoupper(trim($raw));

        return preg_match('/\A[A-Z0-9][A-Z0-9._-]{0,63}\z/', $sku) ? $sku : null;
    }

    private function validateRow(array $data, ?Product $product): array
    {
        $data = array_map('trim', $data);
        $values = $errors = [];
        foreach (['nombre' => ['name', 120], 'descripcion' => ['description', 4000]] as $column => [$key, $limit]) {
            if (mb_strlen($data[$column]) > $limit) {
                $errors[$column] = "Use at most $limit characters.";
            } elseif ($data[$column] !== '') {
                $values[$key] = $data[$column];
            }
        }
        if ($data['precio_uyu'] !== '') {
            $price = preg_match('/\A([0-9]{1,8})(?:[.,]([0-9]{1,2}))?\z/', $data['precio_uyu'], $parts) ?
                (int) $parts[1] * 100 + (int) str_pad($parts[2] ?? '', 2, '0') : 0;
            if ($price < 1 || $price > 2147483647) {
                $errors['precio_uyu'] = 'Use a positive UYU price with at most two decimal places and no thousands separators.';
            } else {
                $values['price_cents'] = $price;
            }
        }
        if ($data['stock'] !== '') {
            if (! preg_match('/\A[0-9]{1,10}\z/', $data['stock']) || (int) $data['stock'] > 2147483647) {
                $errors['stock'] = 'Use a whole stock count from 0 to 2147483647.';
            } else {
                $values['stock'] = (int) $data['stock'];
            }
        }
        foreach (['categoria' => [Category::class, 'category_id'], 'marca' => [Brand::class, 'brand_id']] as $column => [$model, $key]) {
            if ($data[$column] !== '') {
                $id = $model::query()->where('active', true)->where('slug', $data[$column])->value('id');
                if ($id === null) {
                    $errors[$column] = 'Use the slug of an existing active classification.';
                } else {
                    $values[$key] = (int) $id;
                }
            }
        }
        if (! $product) {
            foreach (['nombre', 'precio_uyu', 'stock', 'categoria'] as $column) {
                if ($data[$column] === '') {
                    $errors[$column] = 'This value is required to create a draft.';
                }
            }
        }
        if ($data['fotos'] !== '') {
            $paths = array_map('trim', explode('|', $data['fotos'], 13));
            try {
                $this->photos->execute($product, $paths);
                $values['photos'] = $paths;
            } catch (ValidationException $exception) {
                $errors['fotos'] = $exception->errors()['fotos'][0];
            }
        }

        return [$values, $errors];
    }
}
