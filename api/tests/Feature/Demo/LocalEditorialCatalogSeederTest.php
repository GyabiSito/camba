<?php

namespace Tests\Feature\Demo;

use App\Enums\ProductStatus;
use App\Models\Category;
use App\Models\Product;
use Database\Seeders\LocalEditorialCatalogSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Tests\TestCase;

class LocalEditorialCatalogSeederTest extends TestCase
{
    use RefreshDatabase;

    protected function beforeRefreshingDatabase(): void
    {
        $this->assertSame('pgsql', config('database.default'));
        $this->assertSame('camba_demo_seed_test', config('database.connections.pgsql.database'));
    }

    public function test_conflicting_sku_fails_closed_without_changing_the_product(): void
    {
        $category = Category::query()->create(['name' => 'Camisas', 'slug' => 'camisas']);
        $product = Product::query()->forceCreate([
            'sku' => 'CAMBA-DEMO-009',
            'slug' => 'different-product',
            'name' => 'Existing product',
            'description' => 'Keep this record untouched.',
            'price_cents' => 10000,
            'stock' => 4,
            'status' => ProductStatus::Draft,
            'category_id' => $category->id,
        ]);

        try {
            (new LocalEditorialCatalogSeeder)->run();
            $this->fail('Expected a SKU collision to stop the seeder.');
        } catch (RuntimeException $exception) {
            $this->assertSame('LocalEditorialCatalogSeeder found a conflicting product SKU or slug.', $exception->getMessage());
        }

        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'sku' => 'CAMBA-DEMO-009',
            'slug' => 'different-product',
            'name' => 'Existing product',
            'stock' => 4,
            'status' => 'draft',
        ]);
        $this->assertDatabaseCount('product_images', 0);
    }

    public function test_conflicting_slug_fails_closed_without_changing_the_product(): void
    {
        $category = Category::query()->create(['name' => 'Camisas', 'slug' => 'camisas']);
        $product = Product::query()->forceCreate([
            'sku' => 'OTHER-SKU',
            'slug' => 'camisa-liviana-blanca',
            'name' => 'Existing product',
            'description' => 'Keep this record untouched.',
            'price_cents' => 10000,
            'stock' => 4,
            'status' => ProductStatus::Draft,
            'category_id' => $category->id,
        ]);

        try {
            (new LocalEditorialCatalogSeeder)->run();
            $this->fail('Expected a slug collision to stop the seeder.');
        } catch (RuntimeException $exception) {
            $this->assertSame('LocalEditorialCatalogSeeder found a conflicting product SKU or slug.', $exception->getMessage());
        }

        $this->assertDatabaseHas('products', [
            'id' => $product->id,
            'sku' => 'OTHER-SKU',
            'slug' => 'camisa-liviana-blanca',
            'name' => 'Existing product',
            'stock' => 4,
            'status' => 'draft',
        ]);
        $this->assertDatabaseCount('product_images', 0);
    }
}
