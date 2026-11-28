<?php

namespace App\Actions\Legacy;

use App\Actions\Catalog\SaveProductImagesAction;
use App\Enums\ProductStatus;
use App\Http\Requests\Catalog\UploadProductImagesRequest;
use App\Models\Brand;
use App\Models\Category;
use App\Models\LegacyCatalogReceipt;
use App\Models\Product;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use RuntimeException;

class StageLegacyCatalogAction
{
    public function __construct(private LegacyCatalogFiles $files, private SaveProductImagesAction $saveImages) {}

    public function execute(array $report, array $mapping, string $sourcePhotos): array
    {
        $memory = $this->assertDatabase();
        $rows = $report['rows'];
        $redirects = $this->redirects($rows, $mapping['redirects'] ?? []);
        [$photos, $mediaRoot] = $this->photos($rows, $sourcePhotos, $memory);
        $staged = DB::transaction(function () use ($rows, $redirects, $photos): array {
            $staged = [];
            foreach ($rows as $row) {
                $source = $row['source_unit'];
                $redirect = $redirects[$source]['to'] ?? null;
                $hash = hash('sha256', json_encode([$row, $redirect], JSON_THROW_ON_ERROR));
                $receipt = LegacyCatalogReceipt::query()->lockForUpdate()->find($source);
                if ($receipt) {
                    $product = Product::query()->lockForUpdate()->find($receipt->product_id);
                    if (! hash_equals($receipt->candidate_hash, $hash) || $product?->sku !== $row['sku'] || $product?->slug !== $row['slug']) {
                        throw new RuntimeException("$source is already staged with a different plan or SKU/slug. Use a fresh staging database to rehearse a changed plan.");
                    }
                } else {
                    $receipt = $this->createDraft($row, $redirect, $hash, $photos[$source] === []);
                }
                $staged[] = [
                    'source_unit' => $source, 'source' => $receipt->source, 'product_id' => (int) $receipt->product_id,
                    'sku' => $row['sku'], 'slug' => $row['slug'],
                    'legacy_sku' => $receipt->legacy_sku, 'legacy_slug' => $receipt->legacy_slug,
                    'created' => $receipt->wasRecentlyCreated,
                ];
            }

            return $staged;
        });

        foreach ($photos as $source => $batch) {
            if ($batch !== []) {
                $this->applyPhotos($source, $batch, $sourcePhotos, $mediaRoot);
            }
        }
        $created = count(array_filter(array_column($staged, 'created')));

        return ['created' => $created, 'reused' => count($staged) - $created, 'products' => $staged, 'redirects' => array_values($redirects)];
    }

    private function assertDatabase(): bool
    {
        if (! app()->environment('local', 'testing')) {
            throw new RuntimeException('Staging is available only in a local or testing environment.');
        }
        $connection = DB::connection();
        $name = (string) $connection->getDatabaseName();
        $driver = $connection->getDriverName();
        if ($connection->getConfig('url')) {
            throw new RuntimeException('Unset DB_URL for a disposable catalog rehearsal target.');
        }
        if ($driver === 'sqlite' && $name === ':memory:' && app()->environment('testing')) {
            return true;
        }
        if ($driver === 'sqlite' && ($path = $this->files->localPath($name)) && is_file($path) && basename($path) === 'camba_migration.sqlite') {
            return false;
        }
        $host = $connection->getConfig('host');
        $port = (string) $connection->getConfig('port');
        if ($driver === 'pgsql' && $name === 'camba_migration'
            && (in_array($host, ['127.0.0.1', '::1', 'localhost'], true)
                || ($host === 'postgres' && $port === '5432'))) {
            return false;
        }

        throw new RuntimeException('Use a dedicated local PostgreSQL database camba_migration on loopback or the internal postgres:5432 host, or a local camba_migration.sqlite file; unset DB_URL.');
    }

    private function redirects(array $rows, mixed $selections): array
    {
        $validator = Validator::make(['redirects' => $selections], [
            'redirects' => 'present|array|list',
            'redirects.*.legacy_slug' => 'required|string|distinct:strict',
            'redirects.*.source_unit' => 'required|string',
        ]);
        if ($validator->fails()) {
            throw new RuntimeException('Use a redirects list containing one legacy_slug and source_unit per reviewed selection.');
        }
        $selections = array_column($selections, 'source_unit', 'legacy_slug');
        $published = [];
        foreach ($rows as $row) {
            if ($row['legacy_published']) {
                $published[$row['legacy_slug']][$row['source_unit']] = $row['slug'];
            }
        }
        $redirects = [];
        foreach ($published as $legacySlug => $candidates) {
            $unit = $selections[$legacySlug] ?? (count($candidates) === 1 ? array_key_first($candidates) : null);
            if (! isset($candidates[$unit])) {
                throw new RuntimeException("Choose one valid redirect source_unit for legacy slug $legacySlug in the mapping.");
            }
            $redirects[$unit] = ['status' => 301, 'from' => '/product/'.$legacySlug, 'to' => '/producto/'.$candidates[$unit]];
            unset($selections[$legacySlug]);
        }
        if ($selections !== []) {
            throw new RuntimeException('The mapping includes a redirect for a slug that is not in the reviewed published export.');
        }

        return $redirects;
    }

    private function photos(array $rows, string $root, bool $memory): array
    {
        $photos = [];
        $checked = [];
        $media = null;
        foreach ($rows as $row) {
            $batch = array_column(array_filter([$row['cover'], ...$row['gallery']]), 'sha256', 'path');
            $photos[$row['source_unit']] = $batch;
            if ($batch === []) {
                continue;
            }
            $media ??= $this->mediaRoot($root, $memory);
            $files = [];
            foreach ($batch as $path => $hash) {
                $files[] = $checked[$path] ??= $this->verifiedPhoto((string) $path, $hash, $root);
            }
            $rules = (new UploadProductImagesRequest)->rules();
            if (Validator::make(['photos' => $files], $rules)->fails()) {
                throw new RuntimeException('Invalid staging photos for '.$row['source_unit'].': use up to 12 JPEG, PNG or WebP files, each up to 10 MiB and 4096 pixels per side.');
            }
        }

        return [$photos, $media];
    }

    private function mediaRoot(string $source, bool $memory): string
    {
        $root = $this->files->localPath((string) config('filesystems.disks.public.root'));
        if (config('filesystems.disks.public.driver') !== 'local' || $root === null || ! is_dir($root)
            || (! $memory && basename(dirname($root, 2)) !== 'camba_migration_media')) {
            throw new RuntimeException('Configure a dedicated local public disk under camba_migration_media/app/public.');
        }
        $paths = array_map(fn ($path) => rtrim(str_replace('\\', '/', $path), '/').'/', [$root, $source]);
        [$destination, $origin] = windows_os() ? array_map('strtolower', $paths) : $paths;
        if (str_starts_with($destination, $origin) || str_starts_with($origin, $destination)) {
            throw new RuntimeException('The source photos and staging media must use separate directories.');
        }

        return $root;
    }

    private function verifiedPhoto(string $path, string $hash, string $root): UploadedFile
    {
        $source = $this->files->resolvePhoto($path, $root);
        if ($source === null || ($actual = @hash_file('sha256', $source)) === false || ! hash_equals($hash, $actual)) {
            throw new RuntimeException('A source photo changed or became unreadable after review; no unverified bytes were used.');
        }

        return new UploadedFile($source, basename($path), test: true);
    }

    private function createDraft(array $row, ?string $redirect, string $hash, bool $photosApplied): LegacyCatalogReceipt
    {
        // ponytail: case-folded checks scan the small, isolated staging catalog; index normalized keys for larger catalogs.
        if (Product::query()->whereRaw('LOWER(sku) = ? OR LOWER(slug) = ?', [strtolower($row['sku']), strtolower($row['slug'])])->exists()) {
            throw new RuntimeException($row['source_unit'].' overlaps an existing SKU or slug without a matching staging receipt.');
        }
        $category = Category::query()->where('slug', $row['category_slug'])->where('active', true)->first();
        $brand = $row['brand_slug'] === null ? null : Brand::query()->where('slug', $row['brand_slug'])->where('active', true)->first();
        if ($category?->slug !== $row['category_slug'] || $brand?->slug !== $row['brand_slug']) {
            throw new RuntimeException($row['source_unit'].' requires matching active classifications in staging.');
        }
        $product = new Product([
            'name' => $row['name'], 'description' => $row['description'], 'price_cents' => $row['price_cents'],
            'stock' => $row['stock'], 'category_id' => $category->id, 'brand_id' => $brand?->id,
        ]);
        $product->forceFill(['sku' => $row['sku'], 'slug' => $row['slug']])->save();

        return LegacyCatalogReceipt::query()->create([
            'source_unit' => $row['source_unit'], 'product_id' => $product->id, 'candidate_hash' => $hash,
            'source' => $row['source'], 'legacy_sku' => $row['legacy_sku'], 'legacy_slug' => $row['legacy_slug'],
            'redirect_to' => $redirect, 'photos_applied' => $photosApplied,
        ]);
    }

    private function applyPhotos(string $source, array $batch, string $root, string $mediaRoot): void
    {
        DB::transaction(function () use ($source, $batch, $root, $mediaRoot): void {
            $receipt = LegacyCatalogReceipt::query()->lockForUpdate()->findOrFail($source);
            if ($receipt->photos_applied) {
                return;
            }
            $product = Product::query()->lockForUpdate()->findOrFail($receipt->product_id);
            if ($product->status !== ProductStatus::Draft || $product->images()->exists()) {
                throw new RuntimeException("$source was edited before its staging gallery completed; do not overwrite its photos.");
            }
            if (! $this->files->allowsGalleryPath($mediaRoot, $product->id)) {
                throw new RuntimeException("$source has a linked or invalid staging gallery directory.");
            }
            $files = [];
            foreach ($batch as $path => $hash) {
                $files[] = $this->verifiedPhoto((string) $path, $hash, $root);
            }
            $receipt->update(['photos_applied' => true]);
            $this->saveImages->preserveHistoricalGallery($product->id, $files);
        });
    }
}
