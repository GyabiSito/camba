<?php

namespace Tests\Feature\Dashboard;

use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class DashboardFiltersTest extends TestCase
{
    use RefreshDatabase;

    protected function beforeRefreshingDatabase(): void
    {
        $connection = config('database.default');
        $this->assertTrue(
            ($connection === 'sqlite' && config('database.connections.sqlite.database') === ':memory:')
            || ($connection === 'pgsql' && config('database.connections.pgsql.database') === 'camba_v2_demo_test'
                && config('database.connections.pgsql.host') === 'postgres' && empty(config('database.connections.pgsql.url'))
                && $this->app->environment('testing')),
            'Only disposable dashboard test databases may be reset.',
        );
    }

    public function test_out_of_stock_filters_before_pagination_and_keeps_status_independent(): void
    {
        $this->admin();
        $expected = [];
        for ($i = 0; $i < 13; $i++) {
            $expected[] = $this->product('published', 0)->id;
        }
        $draft = $this->product('draft', 0);
        $this->product('archived', 0);
        $available = $this->product('published', 2);
        $url = '/api/v1/admin/products?status=published&availability=out_of_stock&per_page=12';
        $first = $this->getJson($url)->assertOk()->assertJsonCount(12, 'data')
            ->assertJsonPath('meta.total', 13)->assertJsonPath('meta.last_page', 2);
        $this->assertSame(array_slice(array_reverse($expected), 0, 12), array_column($first->json('data'), 'id'));
        $next = $first->json('links.next');
        $this->assertStringContainsString('availability=out_of_stock', $next);
        $this->assertStringContainsString('status=published', $next);
        $this->getJson($next)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $expected[0]);
        $this->getJson('/api/v1/admin/products?status=draft&availability=out_of_stock')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $draft->id);
        $this->getJson('/api/v1/admin/products?status=published')->assertOk()->assertJsonPath('meta.total', 14)
            ->assertJsonPath('data.0.id', $available->id);
        $this->getJson('/api/v1/admin/products?availability=unknown')->assertUnprocessable()
            ->assertJsonValidationErrors('availability');
    }

    public function test_availability_is_not_a_public_catalog_filter(): void
    {
        $this->product('published', 0);
        $this->product('draft', 0);
        $this->getJson('/api/v1/products?availability=out_of_stock')->assertUnprocessable()
            ->assertJsonValidationErrors('availability');
        $this->getJson('/api/v1/products')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/products?status=draft')->assertUnprocessable()->assertJsonValidationErrors('status');
    }

    public function test_preparation_union_is_paginated_and_does_not_replace_exact_filters(): void
    {
        $this->admin();
        $expected = [];
        for ($i = 0; $i < 26; $i++) {
            $expected[] = $this->order('paid', $i % 2 === 0 ? 'unstarted' : 'preparing')->reference;
        }
        $pending = $this->order('pending_payment', 'unstarted');
        $ready = $this->order('paid', 'ready_for_pickup');
        $this->order('paid', 'completed');
        $url = '/api/v1/admin/orders?status=paid&fulfilment_status=needs_preparation';
        $first = $this->getJson($url)->assertOk()->assertJsonCount(25, 'data')->assertJsonPath('meta.total', 26);
        $this->assertSame(array_slice(array_reverse($expected), 0, 25), array_column($first->json('data'), 'reference'));
        $this->assertStringContainsString('fulfilment_status=needs_preparation', $first->json('links.next'));
        $this->getJson($first->json('links.next'))->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.reference', $expected[0]);
        $this->getJson('/api/v1/admin/orders?fulfilment_status=needs_preparation')->assertOk()->assertJsonPath('meta.total', 27);
        $this->getJson('/api/v1/admin/orders?status=pending_payment')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.reference', $pending->reference);
        $this->getJson('/api/v1/admin/orders?status=paid&fulfilment_status=preparing')->assertOk()->assertJsonPath('meta.total', 13);
        $this->getJson('/api/v1/admin/orders?status=paid&fulfilment_status=unstarted')->assertOk()->assertJsonPath('meta.total', 13);
        $this->getJson('/api/v1/admin/orders?status=paid&fulfilment_status=ready_for_pickup')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.reference', $ready->reference);
        $this->getJson('/api/v1/admin/orders?fulfilment_status=unknown')->assertUnprocessable()->assertJsonValidationErrors('fulfilment_status');
        $this->patchJson("/api/v1/admin/orders/{$expected[0]}/fulfilment", ['status' => 'needs_preparation'])
            ->assertUnprocessable()->assertJsonValidationErrors('status');
        $this->assertDatabaseMissing('orders', ['fulfilment_status' => 'needs_preparation']);
    }

    private function admin(): void
    {
        $this->withHeader('Origin', 'http://localhost')->actingAs(User::factory()->create(['role' => 'admin']), 'web');
    }

    private function product(string $status, int $stock): Product
    {
        $id = (string) Str::ulid();

        return Product::forceCreate(['sku' => $id, 'slug' => strtolower($id), 'name' => 'Filter product',
            'status' => $status, 'stock' => $stock, 'price_cents' => 12500,
            'category_id' => Category::firstOrCreate(['slug' => 'filter-category'], ['name' => 'Filter category', 'active' => true])->id]);
    }

    private function order(string $status, string $stage): Order
    {
        return Order::forceCreate([
            'reference' => (string) Str::uuid(), 'owner_key' => 'test-filter', 'idempotency_key' => (string) Str::uuid(),
            'request_hash' => str_repeat('a', 64), 'status' => $status, 'currency' => 'UYU',
            'subtotal_cents' => 12500, 'shipping_cents' => 0, 'total_cents' => 12500,
            'shipping_method' => 'pickup', 'fulfilment_status' => $stage,
            'contact' => ['name' => 'Filter test', 'email' => 'filters@example.test'],
            'reservation_expires_at' => now()->addHour(),
        ]);
    }
}
