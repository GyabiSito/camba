<?php

namespace Tests\Feature\Imports;

use App\Jobs\ApplyCatalogImport;
use App\Models\Admin;
use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Tests\Feature\TestDatabase;
use Tests\TestCase;
use ZipArchive;

class CatalogImportTest extends TestCase
{
    use RefreshDatabase;

    private const BASE = '/api/v1/admin/catalog-imports';

    private const HEADER = "codigo,nombre,precio_uyu,stock,categoria,marca,descripcion,fotos\n";

    protected function beforeRefreshingDatabase(): void
    {
        TestDatabase::assertIsolated($this);
    }

    public function test_template_and_imports_require_the_admin_guard(): void
    {
        $this->get(self::BASE.'/template')->assertUnauthorized();
        $this->signIn(User::factory()->create());
        $this->getJson(self::BASE.'/123')->assertUnauthorized();
        $this->signIn(User::factory()->unverified()->create(['role' => 'admin']));
        $this->postJson(self::BASE.'/123/confirm')->assertUnauthorized();
        $this->signIn($this->adminIdentity());

        $response = $this->getJson(self::BASE.'/template')->assertOk()->assertDownload('catalog-import.csv');
        $this->assertStringContainsString(self::HEADER, $response->streamedContent());
    }

    public function test_preview_deduplicates_files_reports_invalid_rows_and_applies_only_valid_skus(): void
    {
        Queue::fake();
        $admin = $this->adminIdentity();
        $this->signIn($admin);
        $category = Category::create(['name' => 'Home', 'slug' => 'home', 'active' => true]);
        $product = Product::forceCreate([
            'sku' => 'EXISTING', 'slug' => 'existing', 'name' => 'Keep',
            'description' => 'Do not clear', 'price_cents' => 100, 'stock' => 3,
        ]);
        $csv = self::HEADER."existing,,12.34,0,home,,,\nNEW,New mug,23.99,1,home,,,\nBAD,Another,3.00,0,unknown,,,\nDUP,First,1,2,home,,,\ndup,Second,1,2,home,,,\n";
        $preview = $this->preview($csv)->assertCreated()->assertJsonPath('data.status', 'preview')
            ->assertJsonPath('data.rows.0.action', 'update')->assertJsonPath('data.rows.1.action', 'create')
            ->assertJsonPath('data.rows.2.status', 'invalid')->assertJsonPath('data.rows.3.status', 'invalid')
            ->assertJsonPath('data.rows.4.status', 'invalid')->json('data');
        $path = self::BASE.'/'.$preview['id'];
        $this->preview($csv)->assertOk()->assertJsonPath('data.id', $preview['id']);
        $this->assertDatabaseCount('catalog_imports', 1);
        $this->assertDatabaseCount('products', 1);
        $this->assertSame(100, $product->fresh()->price_cents);

        $this->postJson("$path/confirm")->assertAccepted()->assertJsonPath('data.status', 'queued')->assertJsonPath('data.confirmed_by_admin_id', $admin->id);
        $this->signIn($this->adminIdentity());
        $this->postJson("$path/confirm")->assertAccepted()->assertJsonPath('data.confirmed_by_admin_id', $admin->id);
        Queue::assertPushed(ApplyCatalogImport::class);
        $this->runJob($preview['id']);
        $this->runJob($preview['id']);

        $this->getJson($path)->assertOk()->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.counts.applied', 2)->assertJsonPath('data.counts.invalid', 3)
            ->assertJsonPath('data.rows.0.changes.price_cents.before', 100)
            ->assertJsonPath('data.rows.0.changes.price_cents.after', 1234);
        $this->assertDatabaseHas('products', ['sku' => 'EXISTING', 'category_id' => $category->id, 'description' => 'Do not clear', 'price_cents' => 1234, 'stock' => 0]);
        $this->assertDatabaseHas('products', ['sku' => 'NEW', 'price_cents' => 2399, 'status' => 'draft']);
        $this->assertDatabaseCount('products', 2);
        $this->assertDatabaseCount('product_adjustments', 1);
        $this->assertDatabaseHas('product_adjustments', ['product_id' => $product->id, 'actor_admin_id' => $admin->id, 'price_cents' => 1234]);
    }

    public function test_interrupted_worker_resumes_preexisting_progress_and_reports_changes_after_preview(): void
    {
        Queue::fake();
        $this->signIn($this->adminIdentity());
        Category::create(['name' => 'Home', 'slug' => 'home', 'active' => true]);
        $product = Product::forceCreate(['sku' => 'OLD', 'slug' => 'old', 'name' => 'Previous']);
        $preview = $this->preview(self::HEADER."ONE,Mug,1,1,home,,,\nTWO,Cup,2,1,home,,,\nOLD,Preview name,,,,,,\n")
            ->assertCreated()->json('data');
        $path = self::BASE.'/'.$preview['id'];
        $this->postJson("$path/confirm")->assertAccepted();
        $product->update(['name' => 'Edited in admin']);
        $failOnce = true;
        Product::creating(function (Product $product) use (&$failOnce): void {
            if ($product->sku === 'TWO' && $failOnce) {
                $failOnce = false;
                throw new RuntimeException('Synthetic job interruption');
            }
        });

        try {
            $this->runJob($preview['id']);
            $this->fail('Expected a retryable interruption.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Synthetic job interruption', $exception->getMessage());
        }

        $this->getJson($path)->assertOk()->assertJsonPath('data.counts.applied', 1)->assertJsonPath('data.counts.ready', 2);
        $this->postJson("$path/confirm")->assertAccepted();
        $this->runJob($preview['id']);
        $this->getJson($path)->assertOk()->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.counts.applied', 2)->assertJsonPath('data.counts.failed', 1)
            ->assertJsonPath('data.rows.2.status', 'failed');
        $this->assertDatabaseHas('products', ['sku' => 'OLD', 'name' => 'Edited in admin']);
        $this->assertDatabaseCount('products', 3);
    }

    public function test_confirmation_survives_a_queue_outage_and_can_be_dispatched_again(): void
    {
        $admin = $this->adminIdentity();
        $this->signIn($admin);
        Category::create(['name' => 'Home', 'slug' => 'home', 'active' => true]);
        $row = $this->preview(self::HEADER."NEW,Mug,1,1,home,,,\n")->assertCreated()->json('data');
        $path = self::BASE.'/'.$row['id'];
        $originalBus = Bus::getFacadeRoot();
        Bus::shouldReceive('dispatch')->once()->andThrow(new RuntimeException('Synthetic queue outage'));

        try {
            $this->postJson("$path/confirm")->assertServiceUnavailable();
        } finally {
            Bus::swap($originalBus);
        }

        $this->getJson($path)->assertJsonPath('data.status', 'queued')->assertJsonPath('data.confirmed_by_admin_id', $admin->id);
        Queue::fake();
        $this->postJson("$path/confirm")->assertAccepted()->assertJsonPath('data.confirmed_by_admin_id', $admin->id);
        Queue::assertPushed(ApplyCatalogImport::class, 1);
    }

    public function test_xlsx_accepts_values_but_never_consumes_cached_formula_results(): void
    {
        $this->signIn($this->adminIdentity());
        Category::create(['name' => 'Home', 'slug' => 'home', 'active' => true]);
        $namespace = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
        $header = '<row r="1">'.implode('', array_map(fn ($col, $name) => "<c r=\"{$col}1\" t=\"inlineStr\"><is><t>$name</t></is></c>", range('A', 'H'), explode(',', trim(self::HEADER)))).'</row>';
        $row = fn ($r, $sku, $cell) => "<row r=\"$r\"><c r=\"A$r\" t=\"inlineStr\"><is><t>$sku</t></is></c><c r=\"B$r\" t=\"inlineStr\"><is><t>Mug</t></is></c><c r=\"C$r\">$cell</c><c r=\"D$r\"><v>1</v></c><c r=\"E$r\" t=\"inlineStr\"><is><t>home</t></is></c></row>";
        $xml = "<worksheet xmlns=\"$namespace\"><sheetData>".$header.$row(2, 'FORMULA', '<f>1+2</f><v>3</v>').$row(3, 'PLAIN', '<v>12.34</v>').'</sheetData></worksheet>';
        $upload = UploadedFile::fake()->createWithContent('example.xlsx', $this->xlsx($xml));

        $this->postJson(self::BASE, ['file' => $upload])->assertCreated()
            ->assertJsonPath('data.rows.0.status', 'invalid')->assertJsonPath('data.rows.1.status', 'ready')
            ->assertJsonPath('data.rows.1.values.price_cents', 1234);
        $this->assertDatabaseCount('products', 0);
    }

    public function test_unsafe_zip_entries_and_excessive_csv_rows_never_create_a_preview(): void
    {
        $this->signIn($this->adminIdentity());
        $archive = $this->xlsx('<worksheet/>', ['../outside.xml' => '<outside/>']);

        $this->postJson(self::BASE, ['file' => UploadedFile::fake()->createWithContent('bad.xlsx', $archive)])
            ->assertUnprocessable()->assertJsonValidationErrors('file');
        $this->preview(self::HEADER.str_repeat("EXAMPLE,Mug,1,1,home,,,\n", 501))
            ->assertUnprocessable()->assertJsonValidationErrors('file');
        $this->assertDatabaseCount('catalog_imports', 0);
    }

    public function test_photo_references_must_belong_to_the_sku_and_still_exist_when_applied(): void
    {
        Queue::fake();
        $this->signIn($this->adminIdentity());
        $category = Category::create(['name' => 'Home', 'slug' => 'home', 'active' => true]);
        $owner = Product::forceCreate(['sku' => 'OWNER', 'slug' => 'owner', 'name' => 'Before']);
        Product::forceCreate(['sku' => 'OTHER', 'slug' => 'other', 'name' => 'Other']);
        $base = 'products/optimized/'.$owner->id.'/'.Str::uuid();
        $owner->images()->create(['path' => $base.'.webp', 'position' => 0]);
        $root = sys_get_temp_dir().DIRECTORY_SEPARATOR.'camba-import-media-'.Str::uuid();
        Storage::set('public', $disk = Storage::build(['driver' => 'local', 'root' => $root]));

        try {
            $disk->put($base.'.webp', 'synthetic existing image asset');
            $disk->put($base.'-thumb.webp', 'synthetic existing thumbnail asset');
            $preview = $this->preview("\xEF\xBB\xBF\"codigo\",".substr(self::HEADER, strlen('codigo,'))
                ."OWNER,After,,,,,,$base.webp\nOTHER,Other change,,,,,,$base.webp\nEXTERNAL,Invalid,,,,,,https://example.test/photo.webp\n")
                ->assertCreated()->assertJsonPath('data.rows.0.status', 'ready')
                ->assertJsonPath('data.rows.1.status', 'invalid')->assertJsonPath('data.rows.2.status', 'invalid')->json('data');
            $path = self::BASE.'/'.$preview['id'];
            $this->postJson("$path/confirm")->assertAccepted();
            $disk->delete($base.'-thumb.webp');
            $this->runJob($preview['id']);
            $this->getJson($path)->assertJsonPath('data.rows.0.status', 'failed');
            $this->assertDatabaseHas('products', ['sku' => 'OWNER', 'name' => 'Before']);
            $this->assertDatabaseCount('products', 2);
        } finally {
            File::deleteDirectory($root);
        }
    }

    private function preview(string $csv)
    {
        return $this->postJson(self::BASE, ['file' => UploadedFile::fake()->createWithContent('example.csv', $csv)]);
    }

    private function signIn(User|Admin $user): void
    {
        $this->app['auth']->forgetGuards();
        $this->withHeader('Origin', 'http://localhost')->actingAs($user, $user instanceof Admin ? 'admin' : 'web');
    }

    private function runJob(int $id): void
    {
        $this->app->call([new ApplyCatalogImport($id), 'handle']);
    }

    private function xlsx(string $worksheet, array $extra = []): string
    {
        $name = tempnam(sys_get_temp_dir(), 'camba-xlsx-');
        $zip = new ZipArchive;
        $zip->open($name, ZipArchive::OVERWRITE);
        $zip->addFromString('xl/workbook.xml', '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Catalog" r:id="rId1"/></sheets></workbook>');
        $zip->addFromString('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
        $zip->addFromString('xl/worksheets/sheet1.xml', $worksheet);
        foreach ($extra as $entry => $value) {
            $zip->addFromString($entry, $value);
        }
        $zip->close();
        try {
            return file_get_contents($name);
        } finally {
            unlink($name);
        }
    }
}
