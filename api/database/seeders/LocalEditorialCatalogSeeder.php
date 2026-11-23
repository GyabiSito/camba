<?php

namespace Database\Seeders;

use App\Enums\ProductStatus;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class LocalEditorialCatalogSeeder extends Seeder
{
    private const SKU = 'CAMBA-DEMO-009';

    private const SLUG = 'camisa-liviana-blanca';

    private const IMAGE = 'image-cotton.webp';

    public function run(): void
    {
        $this->guardEnvironment();

        DB::transaction(function (): void {
            $category = Category::query()->where('slug', 'camisas')->first();
            if ($category === null) {
                throw new RuntimeException('LocalEditorialCatalogSeeder requires the existing Camisas category.');
            }

            $matches = Product::query()->where('sku', self::SKU)->orWhere('slug', self::SLUG)->get();
            foreach ($matches as $match) {
                if ($match->sku !== self::SKU || $match->slug !== self::SLUG) {
                    throw new RuntimeException('LocalEditorialCatalogSeeder found a conflicting product SKU or slug.');
                }
            }

            $product = $matches->first();
            if ($product === null) {
                $product = Product::query()->forceCreate([
                    'sku' => self::SKU,
                    'slug' => self::SLUG,
                    'name' => 'Camisa liviana blanca',
                    'description' => 'Camisa blanca de algodón liviano, de líneas simples y uso diario.',
                    'price_cents' => 159000,
                    'stock' => 5,
                    'status' => ProductStatus::Published,
                    'category_id' => $category->id,
                    'brand_id' => null,
                ]);
            }

            $this->copyCover();
            $product->images()->firstOrCreate(['path' => 'demo/'.self::IMAGE], [
                'alt' => 'Camisa liviana blanca',
                'position' => 0,
            ]);
        });
    }

    private function guardEnvironment(): void
    {
        $connection = config('database.default');
        $database = config("database.connections.$connection.database");
        if (! app()->environment(['local', 'testing']) || $connection !== 'pgsql'
            || ! in_array($database, ['camba_v2_demo', 'camba_v2_demo_seed_test'], true)) {
            throw new RuntimeException('LocalEditorialCatalogSeeder is restricted to the local PostgreSQL demo database.');
        }
    }

    private function copyCover(): void
    {
        $source = is_dir('/demo-assets') ? '/demo-assets' : base_path('../web/projects/admin/public/demo');
        $bytes = is_dir($source) ? file_get_contents($source.DIRECTORY_SEPARATOR.self::IMAGE) : false;
        if ($bytes === false || ! Storage::disk('public')->put('demo/'.self::IMAGE, $bytes)) {
            throw new RuntimeException('Could not copy the local editorial cover image.');
        }
    }
}
