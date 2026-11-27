<?php

namespace Tests\Feature\Catalog;

use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class CatalogTest extends TestCase
{
    use RefreshDatabase;

    protected function beforeRefreshingDatabase(): void
    {
        $connection = config('database.default');
        $database = config("database.connections.$connection.database");
        $isolatedPostgres = $connection === 'pgsql'
            && $database === 'camba_demo_test'
            && $this->app->environment('testing')
            && config('database.connections.pgsql.host') === 'postgres'
            && empty(config('database.connections.pgsql.url'));

        $this->assertTrue(
            ($connection === 'sqlite' && $database === ':memory:') || ($connection === 'mysql' && $database === 'camba_test') || $isolatedPostgres,
            'The catalog suite may only reset an in-memory database or a dedicated Camba v2 test database.',
        );
    }

    public function test_public_catalog_searches_filters_sorts_and_paginates_only_published_products(): void
    {
        $this->getJson('/api/v1/products')->assertOk()->assertJsonCount(0, 'data');

        $this->signIn(User::factory()->create(['role' => 'admin']));
        $category = $this->classification('categories', 'Home');
        $otherCategory = $this->classification('categories', 'Outdoor');
        $brand = $this->classification('brands', 'Senda');
        $common = ['category_id' => $category['id'], 'brand_id' => $brand['id'], 'stock' => 2];

        $cheap = $this->draft(['name' => 'Glass 50% blue', 'description' => 'Blue finish', 'price_cents' => 12050, ...$common]);
        $expensive = $this->draft(['name' => 'Glass 500 green', 'price_cents' => 22000, ...$common, 'stock' => 0]);
        $outside = $this->draft(['name' => 'Glass 50% outdoor', 'price_cents' => 9900, ...$common, 'category_id' => $otherCategory['id'], 'brand_id' => null]);
        $draft = $this->draft(['name' => 'Glass 50% draft', 'price_cents' => 5700, ...$common]);
        $archive = $this->draft(['name' => 'Glass 50% archive', 'price_cents' => 6700, ...$common]);
        foreach ([$cheap, $expensive, $outside, $archive] as $product) {
            $this->addImage($product['id']);
            $this->postJson("/api/v1/admin/products/{$product['id']}/publish")->assertOk();
        }
        $this->postJson("/api/v1/admin/products/{$archive['id']}/archive")->assertOk();
        $this->getJson('/api/v1/admin/products?status=draft')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $draft['id']);
        $this->app['auth']->forgetGuards();

        $this->getJson('/api/v1/products?q=gLaSs&category=home&brand=senda&sort=price_desc&per_page=1')
            ->assertOk()->assertJsonPath('meta.total', 2)->assertJsonPath('data.0.slug', $expensive['slug'])
            ->assertJsonPath('data.0.in_stock', false)->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/products?q=glass&category=home&brand=senda&sort=price_desc&per_page=1&page=2')
            ->assertOk()->assertJsonPath('data.0.slug', $cheap['slug'])
            ->assertJsonPath('data.0.price_cents', 12050)->assertJsonPath('data.0.currency', 'UYU')
            ->assertJsonPath('data.0.in_stock', true)->assertJsonMissingPath('data.0.status');
        $this->getJson('/api/v1/products?q=glass%2050%25&brand=senda')
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.slug', $cheap['slug']);
        $this->getJson('/api/v1/products?q='.$outside['sku'])
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.slug', $outside['slug']);
        $this->getJson('/api/v1/products?sort=other&per_page=101')
            ->assertUnprocessable()->assertJsonValidationErrors(['sort', 'per_page']);
        $this->getJson('/api/v1/categories')->assertOk()->assertJsonCount(2, 'data');
        $this->getJson('/api/v1/brands')->assertOk()->assertJsonCount(1, 'data');

        $this->getJson("/api/v1/products/{$cheap['slug']}")
            ->assertOk()->assertJsonPath('data.description', 'Blue finish')
            ->assertJsonPath('data.category.slug', 'home')->assertJsonPath('data.brand.slug', 'senda')
            ->assertJsonPath('data.images.0.alt', 'Test photo');
        foreach ([$draft['slug'], $archive['slug'], 'missing-product'] as $slug) {
            $this->getJson("/api/v1/products/$slug")->assertNotFound();
        }
    }

    public function test_admin_catalog_reuses_the_verified_admin_gate(): void
    {
        $productPath = '/api/v1/admin/products';
        $categoryPath = '/api/v1/admin/categories';
        $brandPath = '/api/v1/admin/brands';

        $this->getJson($productPath)->assertUnauthorized();
        $this->postJson($categoryPath, ['name' => 'Hidden'])->assertUnauthorized();
        $this->signIn(User::factory()->create());
        $this->getJson($productPath)->assertForbidden();
        $this->getJson("$productPath/999999")->assertForbidden();
        $this->postJson("$productPath/999999/publish")->assertForbidden();
        $this->postJson($brandPath, ['name' => 'Hidden'])->assertForbidden();
        $this->signIn(User::factory()->unverified()->create(['role' => 'admin']));
        $this->getJson($brandPath)->assertForbidden();
        $this->postJson($productPath, ['name' => 'Hidden'])->assertForbidden();
        $this->signIn(User::factory()->create(['role' => 'admin']));
        $this->getJson($productPath)->assertOk()->assertJsonCount(0, 'data');
        $this->getJson("$productPath/999999")->assertNotFound();
        $this->assertDatabaseCount('categories', 0);
        $this->assertDatabaseCount('brands', 0);
        $this->assertDatabaseCount('products', 0);
    }

    public function test_product_lifecycle_keeps_an_exact_price_and_stable_identifiers(): void
    {
        config(['app.url' => 'https://tienda.example.test']);
        $this->signIn(User::factory()->create(['role' => 'admin']));
        $category = $this->classification('categories', 'Home');
        $brand = $this->classification('brands', 'Senda');
        $product = $this->draft(['name' => 'Mug']);
        $other = $this->draft(['name' => 'Mug']);
        $path = "/api/v1/admin/products/{$product['id']}";

        $this->assertNotSame($product['sku'], $other['sku']);
        $this->assertNotSame($product['slug'], $other['slug']);
        $this->postJson("$path/publish")->assertUnprocessable()->assertJsonValidationErrors(['price_cents', 'category_id', 'images']);
        $this->patchJson($path, ['price_cents' => 12.50, 'stock' => -1, 'status' => 'published', 'sku' => 'FORGED', 'slug' => 'forged', 'images' => []])
            ->assertUnprocessable()->assertJsonValidationErrors(['price_cents', 'stock', 'status', 'sku', 'slug', 'images']);
        $this->patchJson($path, ['price_cents' => 0])->assertUnprocessable()->assertJsonValidationErrors('price_cents');
        $this->patchJson($path, ['price_cents' => '12050'])->assertUnprocessable()->assertJsonValidationErrors('price_cents');
        $this->getJson($path)->assertOk()->assertJsonPath('store_url', 'https://tienda.example.test')
            ->assertJsonPath('data.stock', 0)->assertJsonPath('data.price_cents', null);

        $this->patchJson($path, ['name' => 'Cobalt mug', 'price_cents' => 12050, 'stock' => 2, 'category_id' => $category['id'], 'brand_id' => $brand['id']])
            ->assertOk()->assertJsonPath('data.status', 'draft')->assertJsonPath('data.price_cents', 12050)
            ->assertJsonPath('data.sku', $product['sku'])->assertJsonPath('data.slug', $product['slug']);
        $this->postJson("$path/publish")->assertUnprocessable()->assertJsonValidationErrors('images');
        $this->addImage($product['id']);

        $this->postJson("$path/publish")->assertOk()->assertJsonPath('data.status', 'published');
        $this->getJson("/api/v1/products/{$product['slug']}")->assertOk()->assertJsonMissingPath('store_url');
        $this->postJson("$path/publish")->assertConflict();
        $this->patchJson($path, ['price_cents' => null])->assertUnprocessable()->assertJsonValidationErrors('price_cents');
        $this->patchJson($path, ['category_id' => null])->assertUnprocessable()->assertJsonValidationErrors('category_id');
        $this->patchJson($path, ['brand_id' => null, 'stock' => 0])
            ->assertOk()->assertJsonPath('data.brand', null)->assertJsonPath('data.in_stock', false);
        $this->assertDatabaseHas('products', ['id' => $product['id'], 'price_cents' => 12050, 'status' => 'published']);

        $this->postJson("$path/archive")->assertOk()->assertJsonPath('data.status', 'archived');
        $this->postJson("$path/archive")->assertConflict();
        $this->getJson("/api/v1/products/{$product['slug']}")->assertNotFound();
        $this->postJson("$path/publish")->assertOk()->assertJsonPath('data.status', 'published')->assertJsonPath('data.slug', $product['slug']);
    }

    public function test_classifications_are_flat_and_cannot_hide_existing_published_products(): void
    {
        $this->signIn(User::factory()->create(['role' => 'admin']));
        $category = $this->classification('categories', 'Home');
        $brand = $this->classification('brands', 'Senda');
        $categoryPath = "/api/v1/admin/categories/{$category['id']}";
        $brandPath = "/api/v1/admin/brands/{$brand['id']}";
        $product = $this->draft(['name' => 'Mug', 'price_cents' => 12050, 'category_id' => $category['id'], 'brand_id' => $brand['id']]);
        $path = "/api/v1/admin/products/{$product['id']}";
        $this->addImage($product['id']);

        $this->postJson('/api/v1/admin/categories', ['name' => 'Kitchen', 'parent_id' => $category['id']])
            ->assertUnprocessable()->assertJsonValidationErrors('parent_id');
        $this->postJson('/api/v1/admin/categories', ['name' => 'home'])->assertUnprocessable()->assertJsonValidationErrors('name');
        $this->postJson("$path/publish")->assertOk();
        $this->patchJson($categoryPath, ['name' => 'House'])->assertOk()->assertJsonPath('data.slug', 'home');
        $this->patchJson($categoryPath, ['active' => false])->assertConflict();
        $this->patchJson($brandPath, ['active' => false])->assertConflict();
        $this->getJson("/api/v1/products/{$product['slug']}")->assertOk()->assertJsonPath('data.category.name', 'House');
        $this->postJson("$path/archive")->assertOk();

        $this->patchJson($categoryPath, ['active' => false])->assertOk()->assertJsonPath('data.active', false);
        $this->patchJson($brandPath, ['active' => false])->assertOk()->assertJsonPath('data.active', false);
        $this->getJson('/api/v1/categories')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/brands')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/admin/categories')->assertOk()->assertJsonPath('data.0.active', false);
        $this->postJson("$path/publish")->assertUnprocessable()->assertJsonValidationErrors(['category_id', 'brand_id']);
        $this->assertDatabaseHas('products', ['id' => $product['id'], 'status' => 'archived', 'category_id' => $category['id'], 'brand_id' => $brand['id']]);
    }

    public function test_classification_slugs_fit_the_url_and_database_after_transliteration(): void
    {
        $this->signIn(User::factory()->create(['role' => 'admin']));
        $category = $this->classification('categories', str_repeat('@', 120));

        $this->assertLessThanOrEqual(160, strlen($category['slug']));
        $this->getJson('/api/v1/products?category='.$category['slug'])->assertOk();
    }

    public function test_product_identifier_collision_does_not_replace_the_existing_product(): void
    {
        $this->signIn(User::factory()->create(['role' => 'admin']));
        $ulid = Str::ulid();
        Str::createUlidsUsing(fn () => $ulid);

        try {
            $product = $this->draft(['name' => 'Original']);
            $this->postJson('/api/v1/admin/products', ['name' => 'Different'])->assertConflict();
        } finally {
            Str::createUlidsNormally();
        }

        $this->assertDatabaseCount('products', 1);
        $this->assertDatabaseHas('products', ['id' => $product['id'], 'name' => 'Original']);
    }

    #[DataProvider('invalidDatabaseValues')]
    public function test_database_rejects_invalid_price_stock_and_states(string $field, mixed $value): void
    {
        $this->signIn(User::factory()->create(['role' => 'admin']));
        $product = $this->draft(['name' => 'Mug']);

        $this->expectException(QueryException::class);
        DB::table('products')->where('id', $product['id'])->update([$field => $value]);
    }

    public static function invalidDatabaseValues(): array
    {
        return [
            'zero price' => ['price_cents', 0],
            'negative stock' => ['stock', -1],
            'stock over upper bound' => ['stock', 2147483648],
            'unknown state' => ['status', 'inactive'],
            'incorrect state casing' => ['status', 'DRAFT'],
            'incomplete published product' => ['status', 'published'],
        ];
    }

    public function test_product_lists_load_only_covers_and_detail_keeps_the_full_gallery(): void
    {
        $this->signIn(User::factory()->create(['role' => 'admin']));
        $category = $this->classification('categories', 'Clothing');
        $products = [];
        foreach (['Shirt', 'Trousers'] as $name) {
            $product = $this->draft(['name' => $name, 'price_cents' => 10000, 'category_id' => $category['id']]);
            $this->addImage($product['id']);
            DB::table('product_images')->insert([
                'product_id' => $product['id'], 'path' => "catalog/{$product['id']}/second.webp", 'position' => 1,
            ]);
            $this->postJson("/api/v1/admin/products/{$product['id']}/publish")->assertOk();
            $products[] = $product;
        }

        DB::enableQueryLog();
        $result = $this->getJson('/api/v1/products')->assertOk()->assertJsonCount(2, 'data');
        $queries = DB::getQueryLog();
        DB::disableQueryLog();
        $this->assertCount(1, array_filter($queries, fn (array $query) => str_contains($query['query'], 'product_images')));
        $result->assertJsonCount(1, 'data.0.images')->assertJsonCount(1, 'data.1.images');
        $this->getJson("/api/v1/products/{$products[0]['slug']}")->assertOk()->assertJsonCount(2, 'data.images');
        $this->getJson('/api/v1/admin/products')->assertOk()->assertJsonCount(1, 'data.0.images');
        $this->getJson("/api/v1/admin/products/{$products[0]['id']}")->assertOk()->assertJsonCount(2, 'data.images');
    }

    public function test_price_and_stock_audit_records_only_committed_changes_and_the_actor(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $this->signIn($admin);
        $product = $this->draft(['price_cents' => 12000, 'stock' => 7]);
        $url = '/api/v1/admin/products/'.$product['id'];
        $this->patchJson($url, ['price_cents' => 12450, 'stock' => 4])->assertOk();
        $this->patchJson($url, ['price_cents' => 12450, 'stock' => 4])->assertOk();
        $this->patchJson($url, ['stock' => -1])->assertUnprocessable();

        $this->getJson("$url/history")->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.actor_id', $admin->id)
            ->assertJsonPath('data.0.old_price_cents', 12000)
            ->assertJsonPath('data.0.price_cents', 12450)
            ->assertJsonPath('data.0.old_stock', 7)
            ->assertJsonPath('data.0.stock', 4);
        $this->assertDatabaseCount('product_adjustments', 1);

        $this->signIn(User::factory()->create());
        $this->getJson("$url/history")->assertForbidden();
    }

    private function signIn(User $user): void
    {
        $this->app['auth']->forgetGuards();
        $this->withHeader('Origin', 'http://localhost')->actingAs($user, 'web');
    }

    private function classification(string $route, string $name): array
    {
        return $this->postJson("/api/v1/admin/$route", ['name' => $name])->assertCreated()->json('data');
    }

    private function draft(array $input): array
    {
        return $this->postJson('/api/v1/admin/products', $input)->assertCreated()->assertJsonPath('data.status', 'draft')->json('data');
    }

    private function addImage(int $productId): void
    {
        DB::table('product_images')->insert([
            'product_id' => $productId,
            'path' => "catalog/$productId/photo.webp",
            'alt' => 'Test photo',
        ]);
    }
}
