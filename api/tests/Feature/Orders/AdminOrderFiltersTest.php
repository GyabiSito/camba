<?php

namespace Tests\Feature\Orders;

use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdminOrderFiltersTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/admin/orders';

    protected function beforeRefreshingDatabase(): void
    {
        $connection = config('database.default');
        $this->assertTrue(
            ($connection === 'sqlite' && config('database.connections.sqlite.database') === ':memory:')
            || ($connection === 'pgsql' && config('database.connections.pgsql.database') === 'camba_v2_demo_test'
                && config('database.connections.pgsql.host') === 'postgres' && empty(config('database.connections.pgsql.url'))
                && $this->app->environment('testing')),
            'Only disposable order test databases may be reset.',
        );
    }

    public function test_filters_combine_before_pagination_with_inclusive_store_dates(): void
    {
        $this->admin();
        config(['store.timezone' => 'America/Montevideo']);
        $first = $this->order(['created_at' => '2026-10-21 03:00:00']);
        for ($i = 0; $i < 25; $i++) {
            $last = $this->order(['created_at' => '2026-10-22 02:59:59']);
        }
        $this->order(['created_at' => '2026-10-21 02:59:59']);
        $this->order(['created_at' => '2026-10-22 03:00:00']);
        $this->order(['shipping_method' => 'delivery']);
        $this->order(['fulfilment_status' => 'preparing']);
        $this->order(['status' => 'pending_payment']);

        $url = self::URL.'?status=paid&fulfilment_status=unstarted&shipping_method=pickup&date_from=2026-10-21&date_to=2026-10-21';
        $page = $this->getJson($url)->assertOk()->assertJsonCount(25, 'data')
            ->assertJsonPath('data.0.reference', $last->reference)
            ->assertJsonPath('meta.current_page', 1)->assertJsonPath('meta.total', 26)->assertJsonPath('meta.last_page', 2);
        $this->getJson($page->json('links.next'))->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.current_page', 2)->assertJsonPath('meta.total', 26)->assertJsonPath('data.0.reference', $first->reference);
        $this->getJson($url.'&q=Checkout%20snapshot&page=2')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('meta.current_page', 2)->assertJsonPath('meta.total', 26)->assertJsonPath('data.0.reference', $first->reference);
        $this->getJson(self::URL.'?date_to=2026-10-20')->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson(self::URL.'?date_from=2026-10-22')->assertOk()->assertJsonPath('meta.total', 1);
        $this->getJson(self::URL)->assertOk()->assertJsonPath('meta.total', 31);
    }

    public function test_2330_montevideo_belongs_to_the_27th_and_is_serialized_in_utc(): void
    {
        $this->admin();
        config(['store.timezone' => 'America/Montevideo']);
        $order = $this->order(['created_at' => '2026-11-28 02:30:00']);
        $this->order(['created_at' => '2026-11-28 03:00:00']);

        $row = $this->getJson(self::URL.'?date_from=2026-11-27&date_to=2026-11-27')->assertOk()
            ->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.reference', $order->reference)
            ->json('data.0');
        $this->assertMatchesRegularExpression('/^2026-11-28T02:30:00(?:\.0+)?Z$/', $row['created_at']);
    }

    public function test_search_matches_references_and_order_contacts_without_returning_contact(): void
    {
        $this->admin();
        $buyer = User::factory()->create(['name' => 'Perfil actual', 'email' => 'nuevo@filters.test']);
        $accountOrder = $this->order(['user_id' => $buyer->id,
            'contact' => ['name' => 'Persona Filtro', 'email' => 'orden@filters.test']]);
        $guest = $this->order();

        foreach ([$guest->reference, strtoupper(substr($guest->reference, 0, 8))] as $query) {
            $this->getJson(self::URL.'?q='.rawurlencode($query))->assertOk()
                ->assertJsonCount(1, 'data')->assertJsonPath('data.0.reference', $guest->reference);
        }
        foreach (['persona filtro', 'ORDEN@FILTERS'] as $query) {
            $this->getJson(self::URL.'?q='.rawurlencode($query).'&shipping_method=pickup')->assertOk()
                ->assertJsonCount(1, 'data')->assertJsonPath('data.0.reference', $accountOrder->reference)
                ->assertJsonMissingPath('data.0.contact');
        }
        $this->getJson(self::URL.'?q=guest%40example.test')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.reference', $guest->reference);
        $this->getJson(self::URL.'?q=nuevo%40filters.test')->assertOk()->assertJsonPath('meta.total', 0);
        $this->getJson(self::URL.'?q=%25_')->assertOk()->assertJsonPath('meta.total', 0);
    }

    public function test_bad_filter_values_are_rejected(): void
    {
        $this->admin();
        $this->getJson(self::URL.'?shipping_method=other&date_from=2026-02-30')->assertUnprocessable()
            ->assertJsonValidationErrors(['shipping_method', 'date_from']);
        $this->getJson(self::URL.'?date_from=2026-10-23&date_to=2026-10-21')->assertUnprocessable()
            ->assertJsonValidationErrors('date_to');
    }

    public function test_contact_search_requires_admin_access(): void
    {
        $this->order();
        $url = self::URL.'?q=guest%40example.test';
        $this->getJson($url)->assertUnauthorized()->assertJsonMissingPath('data');
        $this->withHeader('Origin', 'http://localhost')->actingAs(User::factory()->create(['role' => 'buyer']), 'web');
        $this->getJson($url)->assertForbidden()->assertJsonMissingPath('data');
    }

    private function admin(): void
    {
        $this->withHeader('Origin', 'http://localhost')->actingAs(User::factory()->create(['role' => 'admin']), 'web');
    }

    private function order(array $attributes = []): Order
    {
        return Order::forceCreate(array_replace([
            'reference' => (string) Str::uuid(), 'owner_key' => 'test-order-filter', 'idempotency_key' => (string) Str::uuid(),
            'request_hash' => str_repeat('a', 64), 'status' => 'paid', 'currency' => 'UYU',
            'subtotal_cents' => 12500, 'shipping_cents' => 0, 'total_cents' => 12500,
            'shipping_method' => 'pickup', 'fulfilment_status' => 'unstarted',
            'contact' => ['name' => 'Checkout snapshot', 'email' => 'guest@example.test'],
            'created_at' => '2026-10-21 12:00:00', 'reservation_expires_at' => now()->addHour(),
        ], $attributes));
    }
}
