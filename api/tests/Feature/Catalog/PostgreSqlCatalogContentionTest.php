<?php

namespace Tests\Feature\Catalog;

use App\Models\Brand;
use App\Models\Cart;
use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class PostgreSqlCatalogContentionTest extends TestCase
{
    use DatabaseMigrations;

    private string $media;

    private User $admin;

    protected function beforeRefreshingDatabase(): void
    {
        $db = DB::connection();
        $this->assertTrue($this->app->environment('testing'));
        $this->assertFalse($this->app->configurationIsCached());
        $this->assertSame('pgsql', $db->getDriverName());
        $this->assertSame('camba_v2_demo_test', $db->getDatabaseName());
        $this->assertSame('postgres', $db->getConfig('host'));
        $this->assertEmpty($db->getConfig('url'));
        DB::selectOne("SELECT set_config('application_name', ?, false)", ['camba_catalog_contention_owner']);
    }

    protected function afterRefreshingDatabase(): void
    {
        $this->media = sys_get_temp_dir().DIRECTORY_SEPARATOR.'camba-catalog-race-'.Str::uuid();
        $this->beforeApplicationDestroyed(fn () => File::deleteDirectory($this->media));
        $this->admin = User::factory()->create(['role' => 'admin']);
    }

    public function test_category_deactivation_cannot_race_a_publication_into_inconsistency(): void
    {
        $this->assertClassificationRace('categories', $this->draft()->category);
    }

    public function test_brand_deactivation_cannot_race_a_publication_into_inconsistency(): void
    {
        $brand = Brand::query()->create(['name' => 'Brand for race', 'slug' => 'brand-for-race', 'active' => true]);
        $this->assertClassificationRace('brands', $this->draft(['brand_id' => $brand->id])->brand);
    }

    public function test_publication_and_archive_serialize_and_preserve_the_product_identity(): void
    {
        $product = $this->draft();
        $path = "/api/v1/admin/products/$product->id";
        foreach (['publish' => 'published', 'archive' => 'archived'] as $verb => $state) {
            $request = ['POST', "$path/$verb"];
            $results = $this->race('products', $product->id, $request, $request);
            $this->assertEqualsCanonicalizing([200, 409], array_column($results, 'status'));
            foreach ($results as $response) {
                if ($response['status'] === 200) {
                    $this->assertSame($state, $response['body']['data']['status']);
                    $this->assertSame($product->sku, $response['body']['data']['sku']);
                }
            }
            $this->assertSame($state, $product->fresh()->status->value);
            $this->getJson("/api/v1/products/$product->slug")->assertStatus($state === 'published' ? 200 : 404);
        }

        [$published, $archived] = $this->race('products', $product->id, ['POST', "$path/publish"], ['POST', "$path/archive"]);
        $this->assertSame(200, $published['status']);
        $this->assertContains($archived['status'], [200, 409]);
        $this->assertSame($archived['status'] === 200 ? 'archived' : 'published', $product->fresh()->status->value);
        $this->assertSame($product->sku, $product->fresh()->sku);
    }

    public function test_concurrent_appends_and_stale_reorder_preserve_rows_derivatives_and_cover(): void
    {
        $product = $this->draft();
        $url = "/api/v1/admin/products/$product->id/images";
        $cover = $product->images()->firstOrFail()->id;
        $append = ['POST', $url, ['photo' => true]];
        $results = $this->race('products', $product->id, $append, $append);
        $this->assertSame([201, 201], array_column($results, 'status'));
        $ids = $product->images()->pluck('id')->all();
        $this->assertCount(3, $ids);
        $this->assertSame($cover, $ids[0]);
        $newOrder = array_reverse($ids);
        [$uploaded, $reordered] = $this->race('products', $product->id, $append, ['PUT', "$url/order", ['ids' => $newOrder]]);
        $this->assertSame(201, $uploaded['status']);
        $final = $product->images()->get();
        $this->assertCount(4, $final);
        $this->assertSame([0, 1, 2, 3], $final->pluck('position')->all());
        $this->assertCount(4, $final->pluck('path')->unique());
        // Either the reorder runs first, or the newly appended row makes its old list invalid.
        $this->assertContains($reordered['status'], [200, 422]);
        if ($reordered['status'] === 422) {
            $this->assertArrayHasKey('ids', $reordered['body']['errors']);
        }
        $this->assertSame($reordered['status'] === 200 ? $newOrder : $ids, $final->pluck('id')->slice(0, 3)->all());
        $this->assertSame($final->pluck('id')->all(), array_column($uploaded['body']['data']['images'], 'id'));

        $disk = $this->disk();
        $expected = [];
        foreach ($final->where('id', '!=', $cover) as $image) {
            foreach ([$image->path, str_replace('.webp', '-thumb.webp', $image->path)] as $path) {
                $expected[] = $path;
                $this->assertSame('image/webp', getimagesizefromstring($disk->get($path))['mime']);
            }
        }
        $this->assertEqualsCanonicalizing($expected, $disk->allFiles());
    }

    public function test_simultaneous_upload_recovery_appends_one_batch_and_preserves_the_cover(): void
    {
        $product = $this->draft();
        $cover = $product->images()->sole();
        $key = (string) Str::uuid();
        $append = ['POST', "/api/v1/admin/products/$product->id/images/uploads", ['photo' => true], ['Idempotency-Key' => $key]];

        // Both independent requests have staged files and are waiting on the same product lock.
        $results = $this->race('products', $product->id, $append, $append);
        $this->assertSame([201, 201], array_column($results, 'status'));
        $this->assertSame($results[0]['body'], $results[1]['body']);
        $images = $product->images()->get();
        $this->assertCount(2, $images);
        $this->assertSame([$cover->id, $images[1]->id], array_column($results[0]['body']['data']['images'], 'id'));
        $this->assertSame([0, 1], $images->pluck('position')->all());
        $this->assertDatabaseCount('product_image_uploads', 1);
        $this->assertDatabaseHas('product_image_uploads', ['product_id' => $product->id, 'upload_key' => $key]);

        $disk = $this->disk();
        $paths = [$images[1]->path, str_replace('.webp', '-thumb.webp', $images[1]->path)];
        $this->assertEqualsCanonicalizing($paths, $disk->allFiles());
        foreach ($paths as $path) {
            $this->assertSame('image/webp', getimagesizefromstring($disk->get($path))['mime']);
        }

        $late = ['Idempotency-Key' => (string) Str::uuid()];
        $close = ['POST', $append[1].'/close', [], $late];
        $append[3] = $late;
        $results = $this->race('products', $product->id, $close, $append);
        $this->assertSame([200, 409], array_column($results, 'status'));
        $this->assertSame($images->pluck('id')->all(), $product->images()->pluck('id')->all());
        $this->assertEqualsCanonicalizing($paths, $disk->allFiles());
    }

    public function test_simultaneous_cart_adds_persist_both_units_but_cannot_exceed_stock(): void
    {
        $buyer = User::factory()->create(['role' => 'buyer']);
        $product = $this->draft(['status' => 'published', 'stock' => 4]);
        $cart = Cart::query()->forceCreate(['user_id' => $buyer->id]);
        $cart->setQuantity($product->id, 1);
        $this->assertSame('heap', DB::selectOne("SELECT amname FROM pg_class c JOIN pg_am a ON a.oid = c.relam WHERE c.relname = 'cart_items'")->amname);
        $add = ['POST', "/api/v1/cart/items/$product->id"];

        foreach ([[[200, 200], [2, 3], 3], [[200, 422], [4], 4]] as [$statuses, $quantities, $stored]) {
            $results = $this->race('carts', $cart->id, $add, $add, $buyer);
            $this->assertEqualsCanonicalizing($statuses, array_column($results, 'status'));
            $returned = [];
            foreach ($results as $response) {
                if ($response['status'] === 422) {
                    $this->assertArrayHasKey('quantity', $response['body']['errors']);

                    continue;
                }
                $item = $response['body']['data']['items'][0];
                $this->assertSame($product->id, $item['product_id']);
                $this->assertSame(75000, $item['product']['price_cents']);
                $returned[] = $item['quantity'];
            }
            $this->assertEqualsCanonicalizing($quantities, $returned);
            $this->assertSame([$stored], $cart->items()->pluck('quantity')->all());
        }
    }

    private function assertClassificationRace(string $table, Category|Brand $classification): void
    {
        $product = $classification->products()->firstOrFail();
        [$published, $deactivated] = $this->race(
            $table,
            $classification->id,
            ['POST', "/api/v1/admin/products/$product->id/publish"],
            ['PATCH', "/api/v1/admin/$table/$classification->id", ['active' => false]],
        );

        if ($published['status'] === 200) {
            $this->assertSame(409, $deactivated['status']);
            $this->assertSame('published', $product->fresh()->status->value);
            $this->assertTrue($classification->fresh()->active);
            $this->getJson("/api/v1/products/$product->slug")->assertOk();
        } else {
            $this->assertSame(422, $published['status']);
            $this->assertArrayHasKey($table === 'brands' ? 'brand_id' : 'category_id', $published['body']['errors']);
            $this->assertSame(200, $deactivated['status']);
            $this->assertSame('draft', $product->fresh()->status->value);
            $this->assertFalse($classification->fresh()->active);
            $this->getJson("/api/v1/products/$product->slug")->assertNotFound();
        }
    }

    private function draft(array $fields = []): Product
    {
        $category = Category::query()->create(['name' => 'Category for race', 'slug' => 'category-for-race', 'active' => true]);
        $product = Product::forceCreate([
            'name' => 'Catalog contention garment', 'sku' => 'RACE-GARMENT', 'slug' => 'race-garment',
            'price_cents' => 75000, 'category_id' => $category->id, ...$fields,
        ]);
        $product->images()->create(['path' => 'fixture-cover.webp', 'position' => 0]);

        return $product;
    }

    private function race(string $table, int $id, array $a, array $b, ?User $actor = null): array
    {
        $gate = $this->media.DIRECTORY_SEPARATOR.Str::uuid();
        File::ensureDirectoryExists($this->media);
        File::makeDirectory($gate);
        $workers = [];
        try {
            foreach ([$a, $b] as $request) {
                $worker = $workers[] = $this->worker($request, $actor ?? $this->admin, $gate);
                $worker->start();
            }
            $this->waitForWorkersReady($gate, $workers);

            DB::beginTransaction();
            DB::table($table)->where('id', $id)->lockForUpdate()->first();
            File::put($gate.DIRECTORY_SEPARATOR.'go', 'go');
            $blocked = $this->waitForRowLocks($table, $workers);
            DB::commit();

            $responses = array_map(function (Process $worker): array {
                $this->assertSame(0, $worker->wait(), $worker->getErrorOutput().$worker->getOutput());

                return json_decode($worker->getOutput(), true, flags: JSON_THROW_ON_ERROR);
            }, $workers);
            $this->assertEqualsCanonicalizing($blocked, array_column($responses, 'connection'));

            return $responses;
        } finally {
            File::put($gate.DIRECTORY_SEPARATOR.'go', 'go');
            if (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
            foreach ($workers as $worker) {
                $worker->stop(0);
            }
            File::deleteDirectory($gate);
        }
    }

    private function waitForWorkersReady(string $gate, array $workers): void
    {
        $deadline = microtime(true) + 30;
        do {
            foreach ($workers as $worker) {
                if (! $worker->isRunning()) {
                    $this->fail($worker->getErrorOutput().$worker->getOutput());
                }
            }
            if (count(glob($gate.DIRECTORY_SEPARATOR.'ready-*') ?: []) === count($workers)) {
                return;
            }
            usleep(20000);
        } while (microtime(true) < $deadline);

        $this->fail('Timed out waiting for independent PostgreSQL worker startup.');
    }

    private function waitForRowLocks(string $table, array $workers): array
    {
        $deadline = microtime(true) + 8;
        do {
            foreach ($workers as $worker) {
                if (! $worker->isRunning()) {
                    $this->fail($worker->getErrorOutput().$worker->getOutput());
                }
            }
            DB::selectOne('SELECT pg_stat_clear_snapshot()');
            $owner = (int) DB::selectOne('SELECT pg_backend_pid() AS id')->id;
            $locks = DB::select("WITH RECURSIVE blocked(pid, blocker) AS (
                SELECT pid, unnest(pg_blocking_pids(pid)) FROM pg_stat_activity
                WHERE datname = current_database() AND application_name LIKE 'camba_catalog_contention_worker_%' AND wait_event_type = 'Lock'
                UNION
                SELECT blocked.pid, unnest(pg_blocking_pids(blocked.blocker)) FROM blocked WHERE blocked.blocker <> ?
            ) SELECT DISTINCT pid FROM blocked WHERE blocker = ?", [$owner, $owner]);
            if (count($locks) === count($workers)) {
                return array_map('intval', array_column($locks, 'pid'));
            }
            usleep(20000);
        } while (microtime(true) < $deadline);

        $this->fail('Timed out observing '.count($workers)." independent PostgreSQL $table row-lock waits.");
    }

    private function worker(array $request, User $actor, string $gate): Process
    {
        $db = DB::connection();

        return new Process([PHP_BINARY, __DIR__.'/postgres-race-request.php', json_encode($request, JSON_THROW_ON_ERROR), $gate], base_path(), [
            'APP_ENV' => 'testing', 'APP_KEY' => config('app.key'), 'APP_DEBUG' => 'false',
            'CACHE_STORE' => 'array', 'SESSION_DRIVER' => 'array', 'QUEUE_CONNECTION' => 'sync', 'MAIL_MAILER' => 'array',
            'DB_CONNECTION' => 'pgsql', 'DB_URL' => '', 'DB_HOST' => $db->getConfig('host'), 'DB_DATABASE' => 'camba_v2_demo_test',
            'DB_PORT' => (string) $db->getConfig('port'), 'DB_USERNAME' => $db->getConfig('username'),
            'DB_PASSWORD' => (string) $db->getConfig('password'),
            'DB_SSLMODE' => $db->getConfig('sslmode'),
            'CAMBA_CATALOG_TEST_ACTOR' => (string) $actor->id, 'CAMBA_CATALOG_TEST_MEDIA' => $this->media,
        ], timeout: 60);
    }

    private function disk(): FilesystemAdapter
    {
        return Storage::build(['driver' => 'local', 'root' => $this->media]);
    }
}
