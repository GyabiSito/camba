<?php

namespace Tests\Feature\Legacy;

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\File;
use Symfony\Component\Console\Output\BufferedOutput;
use Tests\TestCase;

class PlanLegacyCatalogTest extends TestCase
{
    private string $fixture;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fixture = sys_get_temp_dir().'/camba-legacy-'.bin2hex(random_bytes(8));
        mkdir($this->fixture.'/photos', 0700, true);
    }

    protected function tearDown(): void
    {
        File::deleteDirectory($this->fixture);

        parent::tearDown();
    }

    public function test_plans_exact_prices_identities_and_most_specific_stock_without_writing(): void
    {
        file_put_contents($this->fixture.'/photos/cover.webp', 'fixture cover');
        file_put_contents($this->fixture.'/photos/detail.webp', 'fixture detail');
        $simple = $this->product();
        $nested = $this->product([
            'id' => 20, 'sku' => 'LAMP', 'slug' => 'lamp', 'title' => 'Lamp', 'price_uyu' => '21474836.47',
            'brand_slug' => 'rayo', 'stock' => 11, 'cover' => 'cover.webp', 'gallery' => ['detail.webp'],
            'variations' => [
                ['id' => 22, 'label' => 'Green', 'stock' => 2, 'subvariations' => []],
                ['id' => 21, 'label' => 'Blue', 'stock' => 7, 'subvariations' => [
                    ['id' => 31, 'label' => 'Tall', 'stock' => 5],
                ]],
            ],
        ]);
        $map = $this->mapping([
            ['unit' => 'variation:21', 'stock' => 2, 'label' => 'Standard'],
            ['unit' => 'product:20', 'stock' => 2, 'label' => 'Original'],
        ]);

        [$status, $raw] = $this->plan([$nested, $simple], $map);
        $report = json_decode($raw, true, flags: JSON_THROW_ON_ERROR);
        $nested['variations'] = array_reverse($nested['variations']);
        $this->assertSame([$status, $raw], $this->plan([$simple, $nested], $map));
        $this->assertSame(0, $status);
        $this->assertSame([], $report['errors']);
        $this->assertSame(['source_products' => 2, 'candidate_products' => 5, 'stock' => 15, 'unique_photos' => 2], $report['counts']);

        $rows = array_column($report['rows'], null, 'source_unit');
        $this->assertSame('MiXeD-1', $rows['product:10']['sku']);
        $this->assertSame('original-detail', $rows['product:10']['slug']);
        $this->assertNull($rows['product:10']['brand_slug']);
        $this->assertSame(1001, $rows['product:10']['price_cents']);
        $this->assertSame('lighting', $rows['product:10']['category_slug']);
        $this->assertSame('LEGACY-S-31', $rows['subvariation:31']['sku']);
        $this->assertSame('lamp-legacy-s-31', $rows['subvariation:31']['slug']);
        $this->assertSame('Lamp / Blue / Tall', $rows['subvariation:31']['name']);
        $this->assertSame(2147483647, $rows['subvariation:31']['price_cents']);
        $this->assertSame('rayo', $rows['subvariation:31']['brand_slug']);
        $this->assertSame(['product_id' => 20, 'variation_id' => 21, 'subvariation_id' => 31], $rows['subvariation:31']['source']);
        $this->assertSame(5, $rows['subvariation:31']['stock']);
        $this->assertSame(2, $rows['variation:22']['stock']);
        $this->assertSame(2, $rows['variation:21']['stock']);
        $this->assertSame(2, $rows['product:20']['stock']);
        $this->assertSame(hash('sha256', 'fixture cover'), $rows['subvariation:31']['cover']['sha256']);
        $this->assertSame('detail.webp', $rows['subvariation:31']['gallery'][0]['path']);
        $this->assertSame(['cover.webp', 'detail.webp'], array_values(array_diff(scandir($this->fixture.'/photos'), ['.', '..'])));
        $this->assertSame(['export.json', 'mapping.json', 'photos'], array_values(array_diff(scandir($this->fixture), ['.', '..'])));
    }

    public function test_rejects_collisions_unmapped_or_inconsistent_stock_unsafe_photos_and_inexact_money(): void
    {
        file_put_contents($this->fixture.'/escape.webp', 'outside the asset root');
        $products = [
            $this->product(['price_uyu' => '21474836.48', 'stock' => 7, 'cover' => '../escape.webp', 'gallery' => ['absent.webp'], 'variations' => [
                ['id' => 1, 'label' => 'Blue', 'stock' => 3, 'subvariations' => [
                    ['id' => 2, 'label' => 'Tall', 'stock' => 4],
                ]],
            ]]),
            $this->product(['id' => 20, 'sku' => 'mixed-1', 'category_id' => 42, 'price_uyu' => 10.01]),
            $this->product(['id' => 30, 'sku' => 'OTHER', 'slug' => 'another', 'price_uyu' => '10.001']),
        ];

        [$status, $raw] = $this->plan($products, $this->mapping([
            ['unit' => 'product:10', 'stock' => 99, 'label' => 'Base'],
            ['unit' => 'variation:555', 'stock' => 2, 'label' => 'Now stale'],
        ]));
        $report = json_decode($raw, true, flags: JSON_THROW_ON_ERROR);

        $this->assertSame(1, $status);
        $this->assertSame([], $report['rows']);
        foreach ([
            'product:10.price_uyu', 'product:10.cover', 'product:10.gallery.0',
            'product:10.stock', 'variation:1.stock', 'product:20.sku', 'product:20.slug',
            'product:20.category', 'product:20.price_uyu', 'product:30.price_uyu', 'mapping.residuals.variation:555',
        ] as $key) {
            $this->assertArrayHasKey($key, $report['errors']);
        }
    }

    public function test_refuses_an_asset_link_that_points_outside_the_isolated_photo_root(): void
    {
        $outside = str_replace('/', DIRECTORY_SEPARATOR, $this->fixture.'/outside');
        $link = str_replace('/', DIRECTORY_SEPARATOR, $this->fixture.'/photos/link');
        mkdir($outside);
        file_put_contents($outside.'/file.webp', 'outside the asset root');
        @File::link($outside, $link);
        if (! is_dir($link)) {
            $this->markTestSkipped('This environment cannot create a directory link.');
        }

        try {
            [$status, $raw] = $this->plan([$this->product(['cover' => 'link/file.webp'])], $this->mapping());
        } finally {
            windows_os() ? rmdir($link) : unlink($link);
        }
        $report = json_decode($raw, true, flags: JSON_THROW_ON_ERROR);

        $this->assertSame(1, $status);
        $this->assertArrayHasKey('product:10.cover', $report['errors']);
        $this->assertSame([], $report['rows']);
        $this->assertSame('outside the asset root', file_get_contents($outside.'/file.webp'));
    }

    public function test_detects_generated_identifier_collisions_with_preserved_products(): void
    {
        $simple = $this->product(['sku' => 'legacy-v-21', 'slug' => 'LAMP-LEGACY-V-21']);
        $variant = $this->product([
            'id' => 20, 'sku' => 'LAMP', 'slug' => 'lamp', 'stock' => 4,
            'variations' => [['id' => 21, 'label' => 'Blue', 'stock' => 4, 'subvariations' => []]],
        ]);

        [$status, $raw] = $this->plan([$simple, $variant], $this->mapping());
        $report = json_decode($raw, true, flags: JSON_THROW_ON_ERROR);

        $this->assertSame(1, $status);
        $this->assertArrayHasKey('variation:21.sku', $report['errors']);
        $this->assertArrayHasKey('variation:21.slug', $report['errors']);
        $this->assertSame([], $report['rows']);
    }

    public function test_rejects_an_omitted_branch_instead_of_treating_it_as_empty(): void
    {
        $product = $this->product();
        unset($product['variations']);

        [$status, $raw] = $this->plan([$product], $this->mapping());
        $report = json_decode($raw, true, flags: JSON_THROW_ON_ERROR);

        $this->assertSame(1, $status);
        $this->assertArrayHasKey('export.products.0.variations', $report['errors']);
        $this->assertSame([], $report['rows']);
    }

    private function product(array $overrides = []): array
    {
        return $overrides + [
            'id' => 10, 'title' => 'Original detail', 'sku' => 'MiXeD-1', 'slug' => 'original-detail',
            'price_uyu' => '10.01', 'stock' => 4, 'description' => 'Plain description', 'published' => true,
            'department_id' => 1, 'category_id' => null, 'subcategory_id' => null, 'brand_slug' => null,
            'cover' => null, 'gallery' => [], 'variations' => [],
        ];
    }

    private function mapping(array $residuals = []): array
    {
        return ['version' => 1, 'categories' => [
            ['department_id' => 1, 'category_id' => null, 'subcategory_id' => null, 'slug' => 'lighting'],
        ], 'residuals' => $residuals];
    }

    private function plan(array $products, array $mapping): array
    {
        file_put_contents($this->fixture.'/export.json', json_encode(['version' => 1, 'products' => $products], JSON_THROW_ON_ERROR));
        file_put_contents($this->fixture.'/mapping.json', json_encode($mapping, JSON_THROW_ON_ERROR));
        $output = new BufferedOutput;
        $status = $this->app->make(Kernel::class)->call('camba:plan-legacy-catalog', [
            'export' => $this->fixture.'/export.json',
            'mapping' => $this->fixture.'/mapping.json',
            '--photos' => $this->fixture.'/photos',
        ], $output);

        return [$status, $output->fetch()];
    }
}
