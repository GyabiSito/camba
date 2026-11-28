<?php

namespace Tests\Feature\Accounts;

use App\Models\Address;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdminCustomerTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/admin/users';

    protected function beforeRefreshingDatabase(): void
    {
        if (config('database.default') === 'pgsql') {
            $this->assertSame('camba_demo_test', config('database.connections.pgsql.database'));

            return;
        }

        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
    }

    public function test_directory_account_and_history_require_the_admin_guard(): void
    {
        $buyer = User::factory()->create(['role' => 'buyer']);
        $urls = [self::URL, self::URL.'/'.$buyer->id, self::URL.'/'.$buyer->id.'/orders'];
        foreach ($urls as $url) {
            $this->getJson($url)->assertUnauthorized();
        }
        $this->actingAs($buyer);
        foreach ($urls as $url) {
            $this->getJson($url)->assertUnauthorized();
        }
        $this->actingAs(User::factory()->unverified()->create(['role' => 'admin']));
        foreach ($urls as $url) {
            $this->getJson($url)->assertUnauthorized();
        }
    }

    public function test_summary_and_paginated_search_count_only_buyers_and_do_not_expose_addresses(): void
    {
        $this->actingAs($this->adminIdentity(['name' => 'Lina Staff']), 'admin');
        $this->getJson('/api/v1/admin/dashboard')->assertOk()->assertJsonPath('data.priorities.registered_buyers', 0);
        $first = User::factory()->unverified()->create([
            'role' => 'buyer', 'name' => 'Lina Older', 'email' => 'distinct@example.test', 'created_at' => '2026-11-20 12:00:00',
        ]);
        $newest = User::factory()->count(25)->create([
            'role' => 'buyer', 'name' => 'Lina Recent', 'created_at' => '2026-11-27 14:00:00',
        ])->last();
        $this->order($newest, $newest->email, '2026-11-26 05:00:00');
        $this->order($newest, 'order-address@example.test', '2026-11-27 12:00:00');
        $this->order($first, $newest->email, '2026-11-28 12:00:00');

        $this->getJson('/api/v1/admin/dashboard')->assertOk()->assertJsonPath('data.priorities.registered_buyers', 26);
        $this->getJson(self::URL)->assertOk()->assertJsonPath('data.0.id', $newest->id);
        $page = $this->getJson(self::URL.'?q=LINA')->assertOk()->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('meta.total', 26)->assertJsonCount(25, 'data')->assertJsonPath('data.0.id', $newest->id)
            ->assertJsonPath('data.0.orders_count', 2)->assertJsonPath('data.0.last_order_at', '2026-11-27T12:00:00.000000Z');
        $this->assertEqualsCanonicalizing(
            ['id', 'name', 'email', 'email_verified', 'created_at', 'orders_count', 'last_order_at'],
            array_keys($page->json('data.0')),
        );
        $this->getJson(self::URL.'?q=LINA&page=2')->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $first->id)->assertJsonPath('data.0.email_verified', false);
        $this->getJson(self::URL.'?q=DISTINCT%40example.test')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $first->id);
        $this->getJson(self::URL.'?q=%25')->assertOk()->assertJsonPath('meta.total', 0);
    }

    public function test_search_matches_accented_names_regardless_of_case_without_removing_accents(): void
    {
        $this->actingAs($this->adminIdentity(), 'admin');
        $buyer = User::factory()->create([
            'role' => 'buyer', 'name' => 'Álvaro', 'email' => 'distinct@example.test',
        ]);

        $lowercaseBuyer = User::factory()->create([
            'role' => 'buyer', 'name' => 'álvaro', 'email' => 'other@example.test',
        ]);
        $expectedIds = [$buyer->id, $lowercaseBuyer->id];

        foreach (['Álvaro', 'álvaro', 'ÁLVARO', 'álv'] as $term) {
            $results = $this->getJson(self::URL.'?q='.rawurlencode($term))->assertOk()
                ->assertJsonPath('meta.total', count($expectedIds));
            $this->assertEqualsCanonicalizing($expectedIds, array_column($results->json('data'), 'id'), $term);
        }

        $this->getJson(self::URL.'?q=Alvaro')->assertOk()->assertJsonPath('meta.total', 0);
    }

    public function test_search_treats_wildcards_and_escape_character_literally(): void
    {
        $this->actingAs($this->adminIdentity(), 'admin');
        $buyer = User::factory()->create([
            'role' => 'buyer', 'name' => 'Literal_!% customer', 'email' => 'literal@example.test',
        ]);
        User::factory()->create(['role' => 'buyer', 'name' => 'Ordinary', 'email' => 'ordinary@example.test']);

        foreach (['_', '!', '%'] as $term) {
            $this->getJson(self::URL.'?q='.rawurlencode($term))->assertOk()
                ->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $buyer->id);
        }
    }

    public function test_current_addresses_are_separate_from_order_snapshots_and_history_uses_account_id(): void
    {
        $admin = $this->adminIdentity();
        $buyer = User::factory()->create(['role' => 'buyer']);
        $other = User::factory()->create(['role' => 'buyer']);
        $base = self::URL.'/'.$buyer->id;
        $this->actingAs($admin, 'admin');
        $legacy = User::factory()->create(['role' => 'admin']);
        $this->getJson(self::URL.'/'.$legacy->id)->assertNotFound();
        $this->getJson(self::URL.'/'.$legacy->id.'/orders')->assertNotFound();
        $this->getJson($base)->assertOk()->assertJsonPath('data.addresses', []);
        $this->getJson($base.'/orders')->assertOk()->assertJsonPath('meta.total', 0);
        Address::query()->forceCreate(['user_id' => $buyer->id, 'recipient' => 'Cliente', 'department' => 'Montevideo',
            'locality' => 'Montevideo', 'street' => 'Domicilio actual', 'number' => '88', 'phone' => '099000111']);
        Address::query()->forceCreate(['user_id' => $other->id, 'recipient' => 'Otra cuenta', 'department' => 'Montevideo',
            'locality' => 'Montevideo', 'street' => 'Domicilio ajeno', 'number' => '99', 'phone' => '099000222']);
        $oldest = $this->order($buyer, 'different-at-checkout@example.test', '2026-11-25 21:00:00');
        for ($i = 0; $i < 25; $i++) {
            $this->order($buyer, $buyer->email, '2026-11-26 21:00:00');
        }
        $foreign = $this->order($other, $buyer->email, '2026-11-27 21:00:00');
        $unregistered = $this->order(null, $buyer->email, '2026-11-28 21:00:00');

        $profile = $this->getJson($base)->assertOk()->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonCount(1, 'data.addresses')->assertJsonPath('data.addresses.0.street', 'Domicilio actual')
            ->assertJsonMissingPath('data.addresses.0.phone');
        $this->assertEqualsCanonicalizing(
            ['name', 'email', 'email_verified', 'created_at', 'addresses'],
            array_keys($profile->json('data')),
        );
        $page = $this->getJson($base.'/orders')->assertOk()->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('meta.total', 26)->assertJsonCount(25, 'data')
            ->assertJsonMissing(['reference' => $foreign->reference])->assertJsonMissing(['reference' => $unregistered->reference]);
        $this->assertEqualsCanonicalizing(
            ['reference', 'created_at', 'total_cents', 'status', 'shipping_method'],
            array_keys($page->json('data.0')),
        );
        $this->getJson($base.'/orders?page=2')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.reference', $oldest->reference)->assertJsonPath('data.0.created_at', '2026-11-25T21:00:00.000000Z');
        $this->getJson('/api/v1/admin/orders/'.$oldest->reference)->assertOk()
            ->assertJsonPath('data.address.street', 'Domicilio en la compra');
    }

    private function order(?User $buyer, string $checkoutEmail, string $createdAt): Order
    {
        return Order::query()->forceCreate([
            'user_id' => $buyer?->id, 'owner_key' => Order::ownerKey($buyer?->id, 'isolated-customer-test'),
            'reference' => (string) Str::uuid(), 'idempotency_key' => (string) Str::uuid(),
            'request_hash' => hash('sha256', 'admin-customer'), 'status' => 'paid', 'currency' => 'UYU',
            'subtotal_cents' => 14900, 'shipping_cents' => 0, 'total_cents' => 14900, 'shipping_method' => 'delivery',
            'created_at' => $createdAt, 'reservation_expires_at' => now()->addHour(),
            'contact' => ['name' => 'Compra de prueba', 'email' => $checkoutEmail],
            'address' => ['recipient' => 'Compra de prueba', 'department' => 'Montevideo', 'locality' => 'Montevideo',
                'street' => 'Domicilio en la compra', 'number' => '15'],
        ]);
    }
}
