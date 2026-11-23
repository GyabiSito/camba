<?php

namespace Tests\Feature\Homepage;

use App\Models\Category;
use App\Models\HomepagePublication;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Mockery;
use Tests\TestCase;

class HomepageTest extends TestCase
{
    use RefreshDatabase;

    protected function beforeRefreshingDatabase(): void
    {
        $this->assertSame('testing', $this->app->environment());
        $connection = config('database.default');
        $this->assertTrue(($connection === 'sqlite' && config('database.connections.sqlite.database') === ':memory:')
            || ($connection === 'pgsql' && config('database.connections.pgsql.database') === 'camba_v2_demo_test'
                && config('database.connections.pgsql.host') === 'postgres' && empty(config('database.connections.pgsql.url'))));
    }

    public function test_first_publication_is_complete_and_admin_boundary_is_preserved(): void
    {
        $home = $this->getJson('/api/v1/homepage')->assertOk()->json('data');
        $this->assertSame('Vestite distinto.', $home['document']['hero']['title']);
        $this->assertSame(1, $home['version']);
        $this->assertCount(6, $home['document']['mosaic']['tiles']);
        $this->assertCount(12, $home['assets']);
        foreach (['get', 'put', 'post'] as $verb) {
            $path = '/api/v1/admin/homepage'.($verb === 'post' ? '/publish' : '');
            $this->{$verb.'Json'}($path)->assertUnauthorized();
        }
        $this->getJson('/api/v1/admin/homepage/preview')->assertUnauthorized();
        $this->postJson('/api/v1/admin/homepage/discard')->assertUnauthorized();
        $this->postJson('/api/v1/admin/homepage/media')->assertUnauthorized();
        $this->actingAs(User::factory()->create(['role' => 'buyer']), 'web');
        foreach (['', '/preview', '/media/00000000-0000-4000-8000-000000000000/display'] as $suffix) {
            $this->getJson('/api/v1/admin/homepage'.$suffix)->assertForbidden();
        }
        foreach (['/publish', '/discard', '/media'] as $suffix) {
            $this->postJson('/api/v1/admin/homepage'.$suffix)->assertForbidden();
        }
        $this->putJson('/api/v1/admin/homepage')->assertForbidden();
    }

    public function test_draft_publish_revision_conflict_preview_and_discard(): void
    {
        $state = $this->adminState();
        $document = $state['published'];
        $document['hero']['title'] = 'New homepage';
        $this->putJson('/api/v1/admin/homepage', ['document' => $document, 'revision' => $state['revision']])
            ->assertOk()->assertJsonPath('data.revision', 2)->assertJsonPath('data.draft.hero.title', 'New homepage');
        $this->getJson('/api/v1/homepage')->assertJsonPath('data.document.hero.title', 'Vestite distinto.');
        $this->getJson('/api/v1/admin/homepage/preview')->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')->assertJsonPath('data.document.hero.title', 'New homepage');
        $this->postJson('/api/v1/admin/homepage/publish', ['revision' => 1])->assertConflict();
        $this->putJson('/api/v1/admin/homepage', ['document' => $document, 'revision' => 1])->assertConflict();
        $this->postJson('/api/v1/admin/homepage/discard', ['revision' => 1])->assertConflict();
        $this->postJson('/api/v1/admin/homepage/publish', ['revision' => 2])->assertOk()
            ->assertJsonPath('data.published_version', 2)->assertJsonPath('data.revision', 3)->assertJsonPath('data.draft', null);
        $this->getJson('/api/v1/homepage')->assertJsonPath('data.document.hero.title', 'New homepage');
        $document['hero']['title'] = 'Discard me';
        $this->putJson('/api/v1/admin/homepage', ['document' => $document, 'revision' => 3])->assertOk();
        $this->postJson('/api/v1/admin/homepage/discard', ['revision' => 4])->assertOk()
            ->assertJsonPath('data.draft', null)->assertJsonPath('data.published.hero.title', 'New homepage');
    }

    public function test_migration_preserves_known_category_order_images_and_look_references(): void
    {
        $categories = [];
        foreach (['pantalones', 'camisas', 'remeras'] as $slug) {
            $categories[$slug] = Category::create(['name' => ucfirst($slug), 'slug' => $slug, 'active' => true]);
        }
        $ids = [];
        foreach (['camisa-liviana-blanca', 'pantalon-pinzas-arena'] as $index => $slug) {
            $product = new Product(['name' => $slug, 'price_cents' => 100, 'stock' => 1, 'category_id' => $categories[$index === 0 ? 'camisas' : 'pantalones']->id]);
            $product->forceFill(['slug' => $slug, 'sku' => $slug, 'status' => 'published'])->save();
            $ids[] = $product->id;
        }
        $migration = require database_path('migrations/0001_01_01_000016_create_homepage_tables.php');
        $migration->down();
        $migration->up();
        $document = $this->getJson('/api/v1/homepage')->assertOk()->json('data.document');
        $this->assertSame(['remeras', 'camisas', 'pantalones'], array_column(array_column($document['categories']['cards'], 'image'), 'key'));
        $this->assertSame([$categories['remeras']->id, $categories['camisas']->id, $categories['pantalones']->id], array_column($document['categories']['cards'], 'categoryId'));
        $this->assertSame($ids, $document['look']['productIds']);
        $this->assertSame(['type' => 'category', 'id' => $categories['camisas']->id, 'label' => 'Ver camisas'], $document['story']['action']);
        $this->assertNull($document['hero']['desktop']['x']);
        $this->assertSame('section', $document['mosaic']['tiles'][5]['action']['type']);
    }

    public function test_document_is_bounded_and_rejects_external_links_and_unknown_media(): void
    {
        $state = $this->adminState();
        foreach ([
            ['hero.primary', ['type' => 'url', 'label' => 'Unsafe', 'url' => 'https://example.com']],
            ['hero.desktop.key', 'unregistered'],
            ['order', ['hero', 'hero']],
            ['hero.title', str_repeat('x', 161)],
            ['selection.productIds', [999999]],
            ['mosaic.tiles.0.image', null],
        ] as [$path, $value]) {
            $document = $state['published'];
            data_set($document, $path, $value);
            $this->putJson('/api/v1/admin/homepage', ['document' => $document, 'revision' => 1])->assertUnprocessable();
        }
        $this->getJson('/api/v1/admin/homepage')->assertJsonPath('data.revision', 1)->assertJsonPath('data.draft', null);
    }

    public function test_upload_is_private_until_published_and_old_public_media_is_retained(): void
    {
        Storage::fake('local');
        $state = $this->adminState();
        $this->post('/api/v1/admin/homepage/media', ['photo' => UploadedFile::fake()->createWithContent('invalid.jpg', 'not a photo')], ['Accept' => 'application/json'])
            ->assertUnprocessable();
        $media = $this->post('/api/v1/admin/homepage/media', ['photo' => UploadedFile::fake()->image('photo.png', 1900, 950)], ['Accept' => 'application/json'])
            ->assertCreated()->json('data');
        $key = $media['key'];
        $this->assertSame([1800, 900, 400], [$media['asset']['width'], $media['asset']['height'], $media['asset']['small_width']]);
        $private = "/api/v1/admin/homepage/media/$key/display";
        $public = "/api/v1/homepage/media/$key/display";
        $this->get($private)->assertOk()->assertHeader('Content-Type', 'image/webp');
        $this->get($public)->assertNotFound();
        $document = $state['published'];
        $document['hero']['desktop'] = ['key' => $key, 'alt' => 'Uploaded photo'];
        $this->putJson('/api/v1/admin/homepage', ['document' => $document, 'revision' => 1])->assertOk();
        $this->postJson('/api/v1/admin/homepage/publish', ['revision' => 2])->assertOk();
        $this->get($public)->assertOk();
        $this->putJson('/api/v1/admin/homepage', ['document' => $state['published'], 'revision' => 3])->assertOk();
        $this->postJson('/api/v1/admin/homepage/publish', ['revision' => 4])->assertOk();
        $this->get($public)->assertOk();
        $this->assertCount(2, Storage::disk('local')->allFiles());
    }

    public function test_public_payload_resolves_current_catalog_and_omits_unavailable_references(): void
    {
        $category = Category::create(['name' => 'Shirts', 'slug' => 'shirts', 'active' => true]);
        $product = new Product(['name' => 'Live shirt', 'price_cents' => 123456, 'stock' => 3, 'category_id' => $category->id]);
        $product->forceFill(['slug' => 'live-shirt', 'sku' => 'LIVE', 'status' => 'published'])->save();
        $state = $this->adminState();
        $document = $state['published'];
        $document['selection']['mode'] = 'manual';
        $document['selection']['productIds'] = [$product->id];
        $document['categories'] = ['mode' => 'manual', 'cards' => [['categoryId' => $category->id, 'image' => null, 'label' => '']]];
        $this->putJson('/api/v1/admin/homepage', ['document' => $document, 'revision' => 1])->assertOk();
        $this->postJson('/api/v1/admin/homepage/publish', ['revision' => 2])->assertOk();
        $this->getJson('/api/v1/homepage')->assertJsonPath('data.products.0.name', 'Live shirt')
            ->assertJsonPath('data.products.0.price_cents', 123456)->assertJsonPath('data.products.0.in_stock', true);
        $product->forceFill(['status' => 'draft'])->save();
        $category->update(['active' => false]);
        $this->getJson('/api/v1/homepage')->assertJsonCount(0, 'data.products')->assertJsonCount(0, 'data.categories');
        $this->putJson('/api/v1/admin/homepage', ['document' => $document, 'revision' => 3])->assertOk();
    }

    public function test_failed_publication_preserves_previous_publication_and_private_image(): void
    {
        Storage::fake('local');
        $state = $this->adminState();
        $media = $this->post('/api/v1/admin/homepage/media', ['photo' => UploadedFile::fake()->image('draft.png')], ['Accept' => 'application/json'])
            ->assertCreated()->json('data');
        $document = $state['published'];
        $document['hero']['desktop'] = ['key' => $media['key'], 'alt' => 'Draft'];
        $document['hero']['title'] = 'Must remain private';
        $this->putJson('/api/v1/admin/homepage', ['document' => $document, 'revision' => 1])->assertOk();
        HomepagePublication::updating(function (HomepagePublication $home): void {
            if ($home->isDirty('published_version')) {
                throw new \RuntimeException('Simulated failed publication');
            }
        });
        $this->postJson('/api/v1/admin/homepage/publish', ['revision' => 2])->assertInternalServerError();
        $this->getJson('/api/v1/homepage')->assertJsonPath('data.document.hero.title', 'Vestite distinto.')->assertJsonPath('data.version', 1);
        $this->getJson('/api/v1/admin/homepage')->assertJsonPath('data.revision', 2)->assertJsonPath('data.draft.hero.title', 'Must remain private');
        $this->get('/api/v1/homepage/media/'.$media['key'].'/display')->assertNotFound();
    }

    public function test_upload_size_dimensions_svg_and_storage_failure_are_rejected_without_orphans(): void
    {
        $disk = Storage::fake('local');
        $this->adminState();
        foreach ([
            UploadedFile::fake()->image('wide.png', 4097, 1),
            UploadedFile::fake()->create('big.jpg', 10241, 'image/jpeg'),
            UploadedFile::fake()->createWithContent('vector.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>'),
        ] as $file) {
            $this->post('/api/v1/admin/homepage/media', ['photo' => $file], ['Accept' => 'application/json'])->assertUnprocessable();
        }
        $this->assertDatabaseCount('homepage_images', 0);
        $this->assertCount(0, $disk->allFiles());
        $disk->put('sentinel', 'preserve');
        $count = 0;
        $proxy = Mockery::mock($disk);
        $proxy->shouldReceive('put')->andReturnUsing(function ($path, $bytes) use ($disk, &$count) {
            return ++$count === 2 ? false : $disk->put($path, $bytes);
        });
        $proxy->shouldReceive('delete')->andReturnUsing(fn ($paths) => $disk->delete($paths));
        Storage::shouldReceive('disk')->with('local')->andReturn($proxy);
        $this->post('/api/v1/admin/homepage/media', ['photo' => UploadedFile::fake()->image('valid.png')], ['Accept' => 'application/json'])->assertStatus(503);
        $this->assertSame(['sentinel'], $disk->allFiles());
        $this->assertDatabaseCount('homepage_images', 0);
    }

    public function test_automatic_category_selection_uses_live_published_products_only(): void
    {
        $state = $this->adminState();
        $selected = Category::create(['name' => 'Selected', 'slug' => 'selected', 'active' => true]);
        $other = Category::create(['name' => 'Other', 'slug' => 'other', 'active' => true]);
        foreach (range(1, 12) as $index) {
            $product = new Product(['name' => 'Product '.$index, 'price_cents' => 100, 'stock' => 0,
                'category_id' => $index === 12 ? $other->id : $selected->id]);
            $product->forceFill(['slug' => 'product-'.$index, 'sku' => 'AUTO-'.$index, 'status' => $index === 11 ? 'draft' : 'published'])->save();
        }
        $document = $state['published'];
        $document['selection']['categoryId'] = $selected->id;
        $document['categories']['mode'] = 'manual';
        $document['look']['mode'] = 'manual';
        $this->putJson('/api/v1/admin/homepage', ['document' => $document, 'revision' => 1])->assertOk();
        $this->postJson('/api/v1/admin/homepage/publish', ['revision' => 2])->assertOk();
        $products = $this->getJson('/api/v1/homepage')->assertOk()->assertJsonCount(8, 'data.products')->json('data.products');
        $this->assertSame(['Product 10', 'Product 9', 'Product 8', 'Product 7', 'Product 6', 'Product 5', 'Product 4', 'Product 3'], array_column($products, 'name'));
        $this->assertSame([$selected->id], array_values(array_unique(array_column(array_column($products, 'category'), 'id'))));
    }

    private function adminState(): array
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']), 'web')->withHeaders(['Accept' => 'application/json']);

        return $this->getJson('/api/v1/admin/homepage')->assertOk()->json('data');
    }
}
