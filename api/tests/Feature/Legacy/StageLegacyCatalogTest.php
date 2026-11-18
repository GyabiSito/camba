<?php

namespace Tests\Feature\Legacy;

use App\Actions\Catalog\SaveProductImagesAction;
use App\Enums\ProductStatus;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Symfony\Component\Console\Output\BufferedOutput;
use Tests\TestCase;

class StageLegacyCatalogTest extends TestCase
{
    private string $fixture;

    protected function setUp(): void
    {
        parent::setUp();
        // The command intentionally refuses the shared MySQL test schema.
        config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:']);
        $this->artisan('migrate')->assertSuccessful();
        $this->fixture = sys_get_temp_dir().'/camba-legacy-stage-'.bin2hex(random_bytes(8));
        mkdir($this->fixture.'/photos', 0700, true);
        mkdir($this->fixture.'/storage', 0700);
        config(['filesystems.disks.public' => ['driver' => 'local', 'root' => $this->fixture.'/storage']]);
        Storage::forgetDisk('public');
        Category::query()->create(['name' => 'Lighting', 'slug' => 'lighting']);
    }

    protected function tearDown(): void
    {
        if (isset($this->fixture)) {
            File::deleteDirectory($this->fixture);
        }
        parent::tearDown();
    }

    public function test_explicit_apply_preserves_exact_identity_lineage_and_photos_and_repeats_without_duplication(): void
    {
        $source = $this->photo('cover.png');
        $this->photo('detail.png', 1);
        $this->review([$this->product(['cover' => 'cover.png', 'gallery' => ['cover.png', 'detail.png']])]);

        [$status, $raw] = $this->stage();
        $this->assertSame(0, $status, $raw);
        $report = json_decode($raw, true, flags: JSON_THROW_ON_ERROR);
        $product = Product::query()->with('images')->sole();
        $this->assertSame('MiXeD-7', $product->sku);
        $this->assertSame('Original-Detail', $product->slug);
        $this->assertSame(ProductStatus::Draft, $product->status);
        $this->assertSame([1001, 4, null], [$product->price_cents, $product->stock, $product->brand_id]);
        $this->assertSame(['product_id' => 7, 'variation_id' => null, 'subvariation_id' => null], $report['products'][0]['source']);
        $this->assertSame([['status' => 301, 'from' => '/product/Original-Detail', 'to' => '/producto/Original-Detail']], $report['redirects']);
        $this->assertSame(1, $report['created']);
        $this->assertSame([0, 1], $product->images->pluck('position')->all());
        $paths = Storage::disk('public')->allFiles();
        $this->assertCount(4, $paths);

        [$status, $raw] = $this->stage();
        $this->assertSame(0, $status, $raw);
        $this->assertSame(1, json_decode($raw, true, flags: JSON_THROW_ON_ERROR)['reused']);
        $this->assertSame(1, Product::query()->count());
        $this->assertSame(1, DB::table('legacy_catalog_receipts')->count());
        $this->assertSame($paths, Storage::disk('public')->allFiles());
        $this->assertSame($source, hash_file('sha256', $this->fixture.'/photos/cover.png'));
    }

    public function test_guards_the_environment_destination_and_explicit_apply_before_writes(): void
    {
        $this->review([$this->product()]);
        [$status, $raw] = $this->stage(['--apply' => false]);
        $this->assertSame(1, $status);
        $this->assertStringContainsString('--apply', $raw);

        $this->app->detectEnvironment(fn () => 'production');
        [$status, $raw] = $this->stage();
        $this->assertSame(1, $status);
        $this->assertStringContainsString('local or testing', $raw);

        $this->app->detectEnvironment(fn () => 'testing');
        $connection = DB::connection();
        $connection->setDatabaseName('camba_v2');
        try {
            [$status, $raw] = $this->stage();
            $this->assertSame(1, $status);
            $this->assertStringContainsString('dedicated', $raw);
        } finally {
            $connection->setDatabaseName(':memory:');
        }
        $this->assertSame(0, Product::query()->count());
        $this->assertSame(0, DB::table('legacy_catalog_receipts')->count());
    }

    public function test_refuses_changed_mapping_photos_or_reviewed_report_before_drafts(): void
    {
        $this->photo('cover.png');
        $this->review([$this->product(['cover' => 'cover.png'])]);

        [$status, $raw] = $this->stage(['--mapping-sha256' => str_repeat('0', 64)]);
        $this->assertSame(1, $status);
        $this->assertStringContainsString('mapping checksum', $raw);

        $plan = File::get($this->fixture.'/plan.json');
        File::put($this->fixture.'/plan.json', str_replace('1001', '9999', $plan));
        [$status, $raw] = $this->stage();
        $this->assertSame(1, $status);
        $this->assertStringContainsString('reviewed plan', $raw);

        File::put($this->fixture.'/plan.json', $plan);
        $this->photo('cover.png', 1);
        [$status, $raw] = $this->stage();
        $this->assertSame(1, $status);
        $this->assertStringContainsString('reviewed plan', $raw);
        $this->assertSame(0, Product::query()->count());
        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    public function test_rejects_a_non_image_or_a_shared_media_root_before_writing(): void
    {
        File::put($this->fixture.'/photos/cover.png', 'not image bytes');
        $this->review([$this->product(['cover' => 'cover.png'])]);
        [$status, $raw] = $this->stage();
        $this->assertSame(1, $status);
        $this->assertStringContainsString('Invalid staging photos', $raw);

        $this->photo('cover.png');
        $this->review([$this->product(['cover' => 'cover.png'])]);
        config(['filesystems.disks.public.root' => $this->fixture.'/photos']);
        Storage::forgetDisk('public');

        [$status, $raw] = $this->stage();
        $this->assertSame(1, $status);
        $this->assertStringContainsString('separate directories', $raw);
        $this->assertSame(0, Product::query()->count());
        $this->assertSame(0, DB::table('legacy_catalog_receipts')->count());
        $this->assertSame(['cover.png'], Storage::disk('public')->allFiles());
    }

    public function test_does_not_write_through_a_staging_gallery_link(): void
    {
        $this->photo('cover.png');
        $this->review([$this->product(['cover' => 'cover.png'])]);
        $outside = str_replace('/', DIRECTORY_SEPARATOR, $this->fixture.'/outside-storage');
        $link = str_replace('/', DIRECTORY_SEPARATOR, $this->fixture.'/storage/products');
        mkdir($outside);
        @File::link($outside, $link);
        if (! is_dir($link)) {
            $this->markTestSkipped('This environment cannot create a directory link.');
        }

        try {
            [$status, $raw] = $this->stage();
        } finally {
            windows_os() ? rmdir($link) : unlink($link);
        }
        $this->assertSame(1, $status);
        $this->assertStringContainsString('linked or invalid staging gallery', $raw);
        $this->assertSame([], File::allFiles($outside));
        $this->assertSame(0, DB::table('product_images')->count());
    }

    public function test_refuses_unrelated_identity_collisions_or_changed_rows_without_modifying_drafts(): void
    {
        $this->review([$this->product(), $this->product(['id' => 8, 'sku' => 'EXISTING', 'slug' => 'other'])]);
        $existing = (new Product(['name' => 'Independent']))->forceFill(['sku' => 'existing', 'slug' => 'Elsewhere']);
        $existing->save();

        [$status, $raw] = $this->stage();
        $this->assertSame(1, $status);
        $this->assertStringContainsString('SKU or slug', $raw);
        $this->assertSame('Independent', Product::query()->sole()->name);
        $this->assertSame(0, DB::table('legacy_catalog_receipts')->count());

        $this->review([$this->product()]);
        $this->assertSame(0, $this->stage()[0]);
        $this->review([$this->product(['stock' => 44])]);
        [$status, $raw] = $this->stage();
        $this->assertSame(1, $status);
        $this->assertStringContainsString('already staged', $raw);
        $this->assertSame(4, Product::query()->where('sku', 'MiXeD-7')->sole()->stock);
    }

    public function test_requires_one_reviewed_destination_for_a_published_legacy_slug_that_fans_out(): void
    {
        $product = $this->product(['stock' => 4, 'variations' => [
            ['id' => 9, 'label' => 'Blue', 'stock' => 2, 'subvariations' => []],
            ['id' => 10, 'label' => 'Green', 'stock' => 2, 'subvariations' => []],
        ]]);
        $this->review([$product]);
        [$status, $raw] = $this->stage();
        $this->assertSame(1, $status);
        $this->assertStringContainsString('redirect', $raw);
        $this->assertSame(0, Product::query()->count());

        $this->review([$product], [['legacy_slug' => 'Original-Detail', 'source_unit' => 'variation:10']]);
        [$status, $raw] = $this->stage();
        $this->assertSame(0, $status, $raw);
        $this->assertSame([['status' => 301, 'from' => '/product/Original-Detail', 'to' => '/producto/Original-Detail-legacy-v-10']],
            json_decode($raw, true, flags: JSON_THROW_ON_ERROR)['redirects']);
    }

    public function test_replays_only_unfinished_photos_after_partial_failure(): void
    {
        $this->photo('cover.png');
        $this->review([
            $this->product(['cover' => 'cover.png']),
            $this->product(['id' => 8, 'sku' => 'SECOND', 'slug' => 'second', 'cover' => 'cover.png']),
        ]);
        $real = app(SaveProductImagesAction::class);
        $this->app->instance(SaveProductImagesAction::class, new class($real) extends SaveProductImagesAction
        {
            private int $calls = 0;

            public function __construct(private SaveProductImagesAction $real) {}

            public function execute(int $id, array $photos): Product
            {
                if (++$this->calls === 2) {
                    throw new RuntimeException('Test storage interruption.');
                }

                return $this->real->execute($id, $photos);
            }
        });

        [$status, $raw] = $this->stage();
        $this->assertSame(1, $status);
        $this->assertStringContainsString('Test storage interruption', $raw);
        $this->assertSame(2, Product::query()->count());
        $this->assertSame(1, DB::table('product_images')->count());
        $this->assertCount(2, Storage::disk('public')->allFiles());

        [$status, $raw] = $this->stage();
        $this->assertSame(0, $status, $raw);
        $this->assertSame(2, json_decode($raw, true, flags: JSON_THROW_ON_ERROR)['reused']);
        $this->assertSame(2, DB::table('product_images')->count());
        $this->assertCount(4, Storage::disk('public')->allFiles());
    }

    private function product(array $overrides = []): array
    {
        return $overrides + [
            'id' => 7, 'title' => 'Original detail', 'sku' => 'MiXeD-7', 'slug' => 'Original-Detail',
            'price_uyu' => '10.01', 'stock' => 4, 'description' => null, 'published' => true,
            'department_id' => 1, 'category_id' => null, 'subcategory_id' => null, 'brand_slug' => null,
            'cover' => null, 'gallery' => [], 'variations' => [],
        ];
    }

    private function photo(string $name, int $color = 0): string
    {
        $path = $this->fixture.'/photos/'.$name;
        $image = imagecreatetruecolor(10, 10);
        imagefill($image, 0, 0, imagecolorallocate($image, $color, 0, 0));
        imagepng($image, $path);

        return hash_file('sha256', $path);
    }

    private function review(array $products, array $redirects = []): void
    {
        File::put($this->fixture.'/export.json', json_encode(['version' => 1, 'products' => $products], JSON_THROW_ON_ERROR));
        File::put($this->fixture.'/mapping.json', json_encode([
            'version' => 1, 'categories' => [['department_id' => 1, 'category_id' => null, 'subcategory_id' => null, 'slug' => 'lighting']],
            'residuals' => [], 'redirects' => $redirects,
        ], JSON_THROW_ON_ERROR));
        [$status, $raw] = $this->command('camba:plan-legacy-catalog');
        $this->assertSame(0, $status, $raw);
        File::put($this->fixture.'/plan.json', $raw);
    }

    private function stage(array $options = []): array
    {
        return $this->command('camba:stage-legacy-catalog', $options + [
            'plan' => $this->fixture.'/plan.json', '--apply' => true,
            '--mapping-sha256' => hash_file('sha256', $this->fixture.'/mapping.json'),
        ]);
    }

    private function command(string $command, array $options = []): array
    {
        $output = new BufferedOutput;
        $status = $this->app->make(Kernel::class)->call($command, $options + [
            'export' => $this->fixture.'/export.json',
            'mapping' => $this->fixture.'/mapping.json',
            '--photos' => $this->fixture.'/photos',
        ], $output);

        return [$status, $output->fetch()];
    }
}
