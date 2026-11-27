<?php

namespace Tests\Feature\Catalog;

use App\Actions\Catalog\SaveProductAction;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\User;
use Illuminate\Database\Events\TransactionCommitted;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Mockery;
use Tests\TestCase;

class ProductImagesTest extends TestCase
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
            'The image suite may only reset an in-memory database or a dedicated Camba v2 test database.',
        );
    }

    public function test_admin_upload_optimizes_photos_and_can_choose_cover_by_order(): void
    {
        Storage::fake('public');
        $this->admin();
        $id = $this->postJson('/api/v1/admin/products', ['name' => 'Test Clothing'])->assertCreated()->json('data.id');
        $url = "/api/v1/admin/products/{$id}/images";

        $this->post($url, ['photos' => [UploadedFile::fake()->create('unreadable.jpg', 2, 'image/jpeg')]])
            ->assertUnprocessable()->assertJsonValidationErrors('photos.0');
        $this->assertDatabaseCount('product_images', 0);

        $images = $this->post($url, ['photos' => [
            UploadedFile::fake()->image('first.png', 1900, 950),
            UploadedFile::fake()->image('second.jpg', 600, 900),
        ]])->assertCreated()->json('data.images');
        $this->assertCount(2, $images);
        $first = ProductImage::findOrFail($images[0]['id']);
        $full = getimagesizefromstring(Storage::disk('public')->get($first->path));
        $small = getimagesizefromstring(Storage::disk('public')->get(str_replace('.webp', '-thumb.webp', $first->path)));
        $this->assertSame([1600, 800, 'image/webp'], [$full[0], $full[1], $full['mime']]);
        $this->assertSame([400, 200], [$small[0], $small[1]]);

        $ids = [$images[0]['id'], $images[1]['id']];
        $this->putJson("{$url}/order", ['ids' => [$ids[1]]])->assertUnprocessable();
        $this->assertSame(0, $first->fresh()->position);
        $this->putJson("{$url}/order", ['ids' => array_reverse($ids)])->assertOk()->assertJsonPath('data.images.0.id', $ids[1]);
        $this->assertSame(1, $first->fresh()->position);
    }

    public function test_real_files_are_reencoded_oriented_and_names_are_not_paths(): void
    {
        Storage::fake('public');
        $disk = Storage::disk('public');
        $this->admin();
        $p = $this->product();
        $url = "/api/v1/admin/products/$p->id/images";
        $jpeg = $this->photo('../../camera.php.jpg', 120, 60, 'jpeg')->getContent();
        $exif = "Exif\0\0II*\0\x08\0\0\0\x01\0\x12\x01\x03\0\x01\0\0\0\x06\0\0\0\0\0\0\0";
        $oriented = "\xFF\xD8\xFF\xE1".pack('n', strlen($exif) + 2).$exif.substr($jpeg, 2);
        $result = $this->post($url, ['photos' => [UploadedFile::fake()->createWithContent('../../camera.php.jpg', $oriented), $this->photo('other.webp', 1700, 850, 'webp'), $this->photo('third.png')]])->assertStatus(201);
        $this->assertCount(3, $result->json('data.images'));
        $rows = $p->images()->get();
        $this->assertCount(6, $disk->allFiles());
        foreach ($rows as $index => $row) {
            $this->assertMatchesRegularExpression('~^products/optimized/'.$p->id.'/[a-f0-9-]+\.webp$~', $row->path);
            $full = $disk->get($row->path);
            $thumb = $disk->get(preg_replace('/\.webp$/', '-thumb.webp', $row->path));
            $f = getimagesizefromstring($full);
            $t = getimagesizefromstring($thumb);
            $this->assertSame('image/webp', $f['mime']);
            $this->assertSame('image/webp', $t['mime']);
            $this->assertStringNotContainsString('Exif', $full);
            $this->assertSame($index, $row->position);
            $this->assertStringEndsWith('-thumb.webp', $result->json("data.images.$index.thumbnail_url"));
            if ($index === 0) {
                $this->assertSame([60, 120], [$f[0], $f[1]]);
                $this->assertSame([60, 120], [$t[0], $t[1]]);
            }
            if ($index === 1) {
                $this->assertSame([1600, 800], [$f[0], $f[1]]);
                $this->assertSame([400, 200], [$t[0], $t[1]]);
            }
        }
    }

    public function test_recovery_endpoint_requires_a_key_and_only_appends_once(): void
    {
        Storage::fake('public');
        $this->admin();
        $p = $this->product();
        $url = "/api/v1/admin/products/$p->id/images/uploads";
        $this->post($url, ['photos' => [$this->photo()]])
            ->assertUnprocessable()->assertJsonValidationErrors('idempotency_key');
        $this->assertDatabaseCount('product_images', 0);

        $headers = ['Idempotency-Key' => (string) Str::uuid()];
        $created = $this->post($url, ['photos' => [$this->photo()]], $headers)->assertCreated();
        $this->post($url, ['photos' => [$this->photo()]], $headers)
            ->assertCreated()->assertExactJson($created->json());

        $late = ['Idempotency-Key' => (string) Str::uuid()];
        $this->post("$url/close")->assertUnprocessable()->assertJsonValidationErrors('idempotency_key');
        $this->post("$url/close", [], $headers)->assertOk()->assertJsonCount(1, 'data.images');
        $this->post($url, ['photos' => [$this->photo()]], $headers)->assertCreated()->assertExactJson($created->json());
        $this->post("$url/close", [], $late)->assertOk()->assertJsonCount(1, 'data.images');
        $this->post($url, ['photos' => [$this->photo()]], $late)->assertConflict();
        $this->assertCount(2, Storage::disk('public')->allFiles());
        $this->assertDatabaseCount('product_images', 1);
    }

    public function test_upload_key_replays_only_the_same_ordered_bytes_for_this_product(): void
    {
        $disk = Storage::fake('public');
        $this->admin();
        $p = $this->product();
        $url = "/api/v1/admin/products/$p->id/images";
        $key = (string) Str::uuid();
        $headers = ['Idempotency-Key' => $key];

        $created = $this->post($url, ['photos' => [$this->photo(), $this->photo(width: 90)]], $headers)->assertCreated();
        $this->assertCount(2, $created->json('data.images'));
        $this->assertCount(4, $disk->allFiles());
        $before = $this->snapshot($disk);
        $this->post($url, ['photos' => [$this->photo('renamed.png'), $this->photo(width: 90)]], ['Idempotency-Key' => strtoupper($key)])
            ->assertCreated()->assertExactJson($created->json());
        $this->post($url, ['photos' => [$this->photo(width: 90), $this->photo()]], $headers)->assertConflict();
        $this->post($url, ['photos' => [$this->photo(), $this->photo(width: 91)]], $headers)->assertConflict();
        $this->assertSame($before, $this->snapshot($disk));
        $this->assertDatabaseCount('product_image_uploads', 1);

        $other = app(SaveProductAction::class)->create(['name' => 'Another garment']);
        $this->post("/api/v1/admin/products/$other->id/images", ['photos' => [$this->photo()]], $headers)
            ->assertCreated()->assertJsonCount(1, 'data.images');
        $this->post($url, ['photos' => [$this->photo()]], ['Idempotency-Key' => (string) Str::uuid()])
            ->assertCreated()->assertJsonCount(3, 'data.images');
        foreach ([4, 5] as $count) {
            $this->post($url, ['photos' => [$this->photo()], 'idempotency_key' => $key])
                ->assertCreated()->assertJsonCount($count, 'data.images');
        }
        $this->assertDatabaseCount('product_image_uploads', 3);
        $this->assertCount(12, $disk->allFiles());
    }

    public function test_invalid_upload_key_returns_validation_error_without_writing(): void
    {
        $disk = Storage::fake('public');
        $this->admin();
        $p = $this->product();
        $before = $this->snapshot($disk);

        foreach (['', 'not-a-uuid'] as $key) {
            $this->post("/api/v1/admin/products/$p->id/images", ['photos' => [$this->photo()]], ['Idempotency-Key' => $key])
                ->assertUnprocessable()->assertJsonValidationErrors('idempotency_key');
        }
        $this->assertSame($before, $this->snapshot($disk));
        $this->assertDatabaseCount('product_image_uploads', 0);
    }

    public function test_failure_after_database_commit_does_not_delete_referenced_derivatives(): void
    {
        $disk = Storage::fake('public');
        $this->admin();
        $p = $this->product();
        $url = "/api/v1/admin/products/$p->id/images";
        $headers = ['Idempotency-Key' => (string) Str::uuid()];
        Event::listen(TransactionCommitted::class, fn () => throw new \RuntimeException('Commit response lost'));

        $this->post($url, ['photos' => [$this->photo()]], $headers)->assertInternalServerError();
        $image = $p->images()->sole();
        $disk->assertExists([$image->path, str_replace('.webp', '-thumb.webp', $image->path)]);
        $this->post($url, ['photos' => [$this->photo()]], $headers)
            ->assertCreated()->assertJsonCount(1, 'data.images')->assertJsonPath('data.images.0.id', $image->id);
        $this->assertCount(2, $disk->allFiles());
        $this->assertDatabaseCount('product_image_uploads', 1);
    }

    public function test_invalid_batch_and_boundaries_create_no_files_or_rows(): void
    {
        Storage::fake('public');
        $disk = Storage::disk('public');
        $this->admin();
        $p = $this->product();
        $url = "/api/v1/admin/products/$p->id/images";
        $disk->put('existing/sentinel', 'existing bytes');
        $before = $this->snapshot($disk);
        $this->post($url, ['photos' => [$this->photo(), UploadedFile::fake()->createWithContent('fake.jpg', 'Not an image')]])->assertStatus(422)->assertJsonValidationErrors('photos.1');
        $this->assertSame($before, $this->snapshot($disk));
        $this->post($url, ['photos' => [$this->photo('too-wide.png', 4097, 1)]])->assertStatus(422)->assertJsonValidationErrors('photos.0');
        $this->assertSame($before, $this->snapshot($disk));
        $this->post($url, ['photos' => array_map(fn () => $this->photo(), range(1, 13))])->assertStatus(422)->assertJsonValidationErrors('photos');
        $this->assertSame($before, $this->snapshot($disk));
        $this->post($url, ['photos' => [UploadedFile::fake()->create('oversized.jpg', 10241, 'image/jpeg')]])->assertStatus(422);
        $this->assertSame($before, $this->snapshot($disk));
    }

    public function test_storage_failure_cleans_only_newly_staged_files(): void
    {
        Storage::fake('public');
        $disk = Storage::disk('public');
        $this->admin();
        $p = $this->product();
        $disk->put('old/original.webp', 'existing full');
        $disk->put('old/original-thumb.webp', 'existing thumbnail');
        $p->images()->create(['path' => 'old/original.webp', 'position' => 0]);
        $before = $this->snapshot($disk);
        $count = 0;
        $proxy = Mockery::mock($disk);
        $proxy->shouldReceive('put')->andReturnUsing(function ($path, $bytes) use ($disk, &$count) {
            return ++$count === 2 ? false : $disk->put($path, $bytes);
        });
        $proxy->shouldReceive('delete')->andReturnUsing(fn ($paths) => $disk->delete($paths));
        Storage::shouldReceive('disk')->with('public')->andReturn($proxy);
        $this->post("/api/v1/admin/products/$p->id/images", ['photos' => [$this->photo()]])->assertStatus(503);
        $this->assertSame(2, $count);
        $this->assertSame($before, $this->snapshot($disk));
    }

    public function test_db_failure_rolls_back_gallery_and_cleans_new_derivatives(): void
    {
        Storage::fake('public');
        $disk = Storage::disk('public');
        $this->admin();
        $p = $this->product();
        $disk->put('old/sentinel', 'old');
        $p->images()->create(['path' => 'old/sentinel', 'position' => 0]);
        $before = $this->snapshot($disk);
        $count = 0;
        ProductImage::creating(function () use (&$count) {
            if (++$count === 2) {
                throw new \RuntimeException('isolated insert failure');
            }
        });
        $this->post("/api/v1/admin/products/$p->id/images", ['photos' => [$this->photo(), $this->photo('second.png')]])->assertStatus(500);
        $this->assertSame($before, $this->snapshot($disk));
    }

    private function admin(): void
    {
        $user = User::factory()->create(['role' => 'admin']);
        $this->actingAs($user, 'web')->withHeaders(['Origin' => 'http://localhost', 'Accept' => 'application/json']);
    }

    private function product(): Product
    {
        return app(SaveProductAction::class)->create(['name' => 'Independent garment']);
    }

    private function snapshot($disk): string
    {
        $files = [];
        foreach ($disk->allFiles() as $path) {
            $files[$path] = hash('sha256', $disk->get($path));
        }
        ksort($files);

        return hash('sha256', json_encode([DB::table('product_images')->orderBy('id')->get(), DB::table('products')->orderBy('id')->get(), $files]));
    }

    private function photo(string $name = 'phone.png', int $width = 80, int $height = 40, string $type = 'png'): UploadedFile
    {
        $i = imagecreatetruecolor($width, $height);
        imagefill($i, 0, 0, imagecolorallocate($i, 10, 90, 160));
        ob_start();
        match ($type) {
            'jpeg' => imagejpeg($i),
            'webp' => imagewebp($i),
            default => imagepng($i),
        };
        $bytes = ob_get_clean();

        return UploadedFile::fake()->createWithContent($name, $bytes);
    }
}
