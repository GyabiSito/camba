<?php

namespace Tests\Feature\Catalog;

use App\Actions\Catalog\SaveProductAction;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Mockery;
use Tests\TestCase;

class ProductImagesTest extends TestCase
{
    use RefreshDatabase;

    protected function beforeRefreshingDatabase(): void
    {
        $this->assertContains(config('database.connections.'.config('database.default').'.database'), [':memory:', 'camba_v2_test']);
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
            }if ($index === 1) {
                $this->assertSame([1600, 800], [$f[0], $f[1]]);
                $this->assertSame([400, 200], [$t[0], $t[1]]);
            }
        }
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
        }ksort($files);

        return hash('sha256', json_encode([DB::table('product_images')->orderBy('id')->get(), DB::table('products')->orderBy('id')->get(), $files]));
    }

    private function photo(string $name = 'phone.png', int $width = 80, int $height = 40, string $type = 'png'): UploadedFile
    {
        $i = imagecreatetruecolor($width, $height);
        imagefill($i, 0, 0, imagecolorallocate($i, 10, 90, 160));
        ob_start();
        match ($type) {
            'jpeg' => imagejpeg($i),'webp' => imagewebp($i),default => imagepng($i)
        };
        $bytes = ob_get_clean();

        return UploadedFile::fake()->createWithContent($name,$bytes);
    }
}
