<?php

namespace Tests\Feature\Orders;

use App\Models\Category;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class OrderCheckoutTest extends TestCase
{
    use RefreshDatabase;

    private const QUOTE = '/api/v1/checkout/quote';

    private const ORDERS = '/api/v1/orders';

    protected function beforeRefreshingDatabase(): void
    {
        $connection = config('database.default');
        $database = config("database.connections.$connection.database");
        $this->assertTrue(
            ($connection === 'sqlite' && $database === ':memory:') || ($connection === 'mysql' && $database === 'camba_v2_test'),
            'The order suite may only reset an in-memory database or the dedicated Camba v2 test database.',
        );
    }

    protected function setUp(): void
    {
        parent::setUp();
        config(['session.driver' => 'database', 'checkout.pickup_address' => 'Pickup Counter', 'checkout.delivery_cents' => 3500]);
        $this->withCredentials()->withHeader('Origin', 'http://localhost');
    }

    public function test_quote_uses_live_prices_and_only_configured_shipping_options(): void
    {
        $product = $this->product();
        $items = $this->items($product);
        $response = $this->postJson(self::QUOTE, ['items' => $items])->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.currency', 'UYU')
            ->assertJsonPath('data.subtotal_cents', 24690)
            ->assertJsonPath('data.items.0.line_total_cents', 24690)
            ->assertJsonPath('data.shipping_options.0.method', 'pickup')
            ->assertJsonPath('data.shipping_options.0.pickup_address', 'Pickup Counter')
            ->assertJsonPath('data.shipping_options.0.total_cents', 24690)
            ->assertJsonPath('data.shipping_options.1.method', 'delivery')
            ->assertJsonPath('data.shipping_options.1.shipping_cents', 3500)
            ->assertJsonPath('data.shipping_options.1.total_cents', 28190);
        $this->keepSession($response);
        $delivery = $response->json('data.shipping_options.1.quote_token');

        config(['checkout.delivery_cents' => 5000]);
        $this->place($this->payload($items, 'delivery', $delivery))->assertConflict();
        config(['checkout.pickup_address' => '', 'checkout.delivery_cents' => 'invalid']);
        $this->postJson(self::QUOTE, ['items' => $items])->assertOk()->assertJsonPath('data.shipping_options', []);
        $this->place($this->payload($items, 'delivery', $delivery))->assertUnprocessable()
            ->assertJsonValidationErrors('shipping_method');
        $this->assertSame(10, $product->fresh()->stock);
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_order_snapshots_price_delivery_address_and_contact_without_repeated_reservation(): void
    {
        $first = $this->product();
        $second = $this->product(stock: 2, cents: 99);
        $items = [$this->items($second)[0], $this->items($first)[0]];
        $payload = $this->payload($items, 'delivery', $this->quote($items, 'delivery'));
        $key = (string) Str::uuid();
        $created = $this->place($payload, $key)->assertCreated()
            ->assertJsonPath('data.status', 'pending_payment')
            ->assertJsonPath('data.items.0.product_id', $first->id)
            ->assertJsonPath('data.items.1.product_id', $second->id)
            ->assertJsonPath('data.items.0.unit_price_cents', 12345)
            ->assertJsonPath('data.subtotal_cents', 24888)
            ->assertJsonPath('data.shipping_cents', 3500)
            ->assertJsonPath('data.total_cents', 28388)
            ->assertJsonPath('data.address.number', '0123B')
            ->assertJsonPath('data.contact.email', 'buyer@example.test')
            ->assertJsonMissingPath('data.owner_key')
            ->assertJsonMissingPath('data.idempotency_key');
        $reference = $created->json('data.reference');
        $this->assertTrue(Str::isUuid($reference));
        $this->assertNotNull($created->json('data.reservation_expires_at'));
        $this->assertNotNull($created->json('data.guest_access_expires_at'));
        $this->assertDatabaseHas('orders', ['reference' => $reference, 'total_cents' => 28388, 'stock_released_at' => null]);
        $stored = DB::table('orders')->where('reference', $reference)->first();
        $this->assertStringNotContainsString('buyer@example.test', $stored->contact);
        $this->assertStringNotContainsString('0123B', $stored->address);
        $this->assertDatabaseCount('order_items', 2);
        $this->assertSame(8, $first->fresh()->stock);
        $this->assertSame(0, $second->fresh()->stock);

        $first->update(['name' => 'Later Name', 'price_cents' => 9999]);
        config(['checkout.delivery_cents' => 9900]);
        $this->place([...$payload, 'items' => array_reverse($items)], $key)->assertOk()
            ->assertJsonPath('data.reference', $reference)->assertJsonPath('data.total_cents', 28388);
        $this->place([...$payload, 'contact' => ['name' => 'Other Buyer', 'email' => 'buyer@example.test']], $key)
            ->assertConflict();
        $this->getJson(self::ORDERS.'/'.$reference)->assertOk()->assertJsonPath('data.items.0.name', 'Test Product 1');
        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseCount('order_items', 2);
        $this->assertSame(8, $first->fresh()->stock);
        $this->assertSame(0, $second->fresh()->stock);
    }

    public function test_checkout_rejects_stale_quotes_invalid_lines_and_unavailable_stock_atomically(): void
    {
        $first = $this->product();
        $second = $this->product(stock: 2);
        $items = [$this->items($first)[0], $this->items($second)[0]];
        $token = $this->quote($items, 'pickup');
        $payload = $this->payload($items, 'pickup', $token);

        $this->postJson(self::QUOTE, ['items' => [$items[0], $items[0]]])->assertUnprocessable()
            ->assertJsonValidationErrors(['items.0.product_id', 'items.1.product_id']);
        $this->postJson(self::ORDERS, $payload)->assertUnprocessable()->assertJsonValidationErrors('idempotency_key');
        $this->place([...$payload, 'total_cents' => 1, 'user_id' => 100])
            ->assertUnprocessable()->assertJsonValidationErrors(['total_cents', 'user_id']);
        $first->update(['price_cents' => 17777]);
        $this->place($payload)->assertConflict();
        $payload['quote_token'] = $this->quote($items, 'pickup');
        $second->update(['stock' => 1]);
        $this->place($payload)->assertUnprocessable()->assertJsonValidationErrors('items');
        $second->status = 'archived';
        $second->save();
        $this->postJson(self::QUOTE, ['items' => $items])->assertUnprocessable()->assertJsonValidationErrors('items');

        $this->assertSame(10, $first->fresh()->stock);
        $this->assertSame(1, $second->fresh()->stock);
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_history_and_references_are_scoped_to_account_or_unexpired_guest_session(): void
    {
        $product = $this->product();
        $items = $this->items($product);
        $key = (string) Str::uuid();
        $guestQuote = $this->quote($items, 'pickup');
        $guestSession = $this->app['session']->driver()->getId();
        $guestOrder = $this->place($this->payload($items, 'pickup', $guestQuote), $key)
            ->assertCreated()->json('data.reference');
        $this->useSession($guestSession);
        $this->getJson(self::ORDERS.'/'.$guestOrder)->assertOk();
        $this->getJson(self::ORDERS)->assertOk()->assertJsonCount(1, 'data')->assertJsonMissingPath('data.0.contact');

        $this->useSession('start-new-session');
        $this->getJson(self::ORDERS.'/'.$guestOrder)->assertNotFound();
        $this->login(User::factory()->create());
        $buyerQuote = $this->quote($items, 'pickup');
        $buyerOrder = $this->place($this->payload($items, 'pickup', $buyerQuote), $key)
            ->assertCreated()->assertJsonPath('data.guest_access_expires_at', null)->json('data.reference');
        $this->getJson(self::ORDERS)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.reference', $buyerOrder);
        $this->getJson(self::ORDERS.'/'.$guestOrder)->assertNotFound();

        $this->login(User::factory()->create());
        $this->getJson(self::ORDERS.'/'.$buyerOrder)->assertNotFound();
        $this->getJson(self::ORDERS)->assertOk()->assertJsonPath('data', []);
        $this->useSession($guestSession);
        $this->getJson(self::ORDERS.'/'.$buyerOrder)->assertNotFound();
        $this->getJson(self::ORDERS.'/'.$guestOrder)->assertOk();
        $this->travel(25)->hours();
        $this->getJson(self::ORDERS.'/'.$guestOrder)->assertNotFound();
        $this->getJson(self::ORDERS)->assertOk()->assertJsonPath('data', []);
        $this->place($this->payload($items, 'pickup', $guestQuote), $key)->assertConflict();
        $this->assertDatabaseCount('orders', 2);
        $this->assertSame(6, $product->fresh()->stock, 'Guest access expiry does not release stock.');
    }

    public function test_mutations_require_first_party_session_and_csrf(): void
    {
        $product = $this->product();
        $this->withHeader('Origin', 'https://unrelated.example.test')
            ->postJson(self::QUOTE, ['items' => $this->items($product)])->assertBadRequest();
        $this->app->instance('env', 'local');
        $this->withHeader('Origin', 'http://localhost')->postJson(self::ORDERS, [])->assertStatus(419);
        $this->assertDatabaseCount('orders', 0);
        $this->assertSame(10, $product->fresh()->stock);
    }

    public function test_verified_admin_can_prepare_and_hand_over_paid_pickup_without_exposing_notes(): void
    {
        $items = $this->items($this->product());
        $buyer = User::factory()->create();
        $this->login($buyer);
        $ref = $this->place($this->payload($items, 'pickup', $this->quote($items, 'pickup')))
            ->assertCreated()->json('data.reference');
        $base = '/api/v1/admin/orders/'.$ref;
        $this->getJson($base)->assertForbidden();

        $admin = User::factory()->create(['role' => 'admin']);
        $this->login($admin);
        $this->getJson('/api/v1/admin/orders')->assertOk()->assertJsonPath('data.0.reference', $ref);
        $this->patchJson("$base/fulfilment", ['status' => 'preparing'])->assertConflict();
        $this->assertDatabaseEmpty('order_fulfilment_events');
        Order::query()->where('reference', $ref)->update(['status' => 'paid']);
        $this->patchJson("$base/fulfilment", ['status' => 'completed'])->assertConflict();
        $this->patchJson("$base/fulfilment", ['status' => 'preparing', 'note' => 'Package inspected'])
            ->assertOk()->assertJsonPath('data.fulfilment_status', 'preparing');
        $this->patchJson("$base/fulfilment", ['status' => 'shipped', 'tracking' => 'carrier-123'])->assertConflict();
        $this->patchJson("$base/fulfilment", ['status' => 'ready_for_pickup'])->assertOk();
        $this->patchJson("$base/fulfilment", ['status' => 'completed'])->assertOk();
        $this->getJson($base)->assertOk()->assertJsonPath('data.status', 'paid')
            ->assertJsonPath('data.fulfilment_status', 'completed')
            ->assertJsonPath('events.2.note', 'Package inspected')
            ->assertJsonPath('events.2.actor_id', $admin->id);
        $this->assertDatabaseCount('order_fulfilment_events', 3);

        $this->login($buyer);
        $this->getJson(self::ORDERS.'/'.$ref)->assertOk()->assertJsonPath('data.fulfilment_status', 'completed')
            ->assertJsonMissing(['note' => 'Package inspected']);
    }

    public function test_admin_order_detail_reports_empty_evidence_before_the_first_payment_attempt(): void
    {
        $items = $this->items($this->product());
        $ref = $this->place($this->payload($items, 'pickup', $this->quote($items, 'pickup')))
            ->assertCreated()->json('data.reference');

        $this->login(User::factory()->create(['role' => 'admin']));
        $this->getJson('/api/v1/admin/orders/'.$ref)->assertOk()
            ->assertJsonStructure(['payment' => ['attempt', 'observations']])
            ->assertJsonPath('payment.attempt', null)
            ->assertJsonPath('payment.observations', []);
    }

    public function test_admin_order_detail_exposes_only_operational_payment_evidence(): void
    {
        $items = $this->items($this->product());
        $buyer = User::factory()->create();
        $this->login($buyer);
        $ref = $this->place($this->payload($items, 'pickup', $this->quote($items, 'pickup')))
            ->assertCreated()->json('data.reference');
        $adminUrl = '/api/v1/admin/orders/'.$ref;
        $order = Order::query()->where('reference', $ref)->firstOrFail();
        $order->forceFill([
            'payment_issues' => ['multiple_approved_payments', 'unrecognized_value'],
            'payment_reconciled_at' => now(),
            'payment_reconcile_result' => 'verified',
            'payment_reconcile_token' => Str::uuid()->toString(),
        ])->save();
        PaymentAttempt::query()->forceCreate([
            'order_id' => $order->id, 'idempotency_key' => Str::uuid()->toString(), 'status' => 'ready',
            'provider_preference_id' => 'hidden-preference', 'checkout_url' => 'https://payment.example.test/private',
            'expires_at' => now()->addMinutes(10),
        ]);
        foreach (['approved', 'refunded'] as $index => $state) {
            Payment::query()->forceCreate([
                'order_id' => $order->id, 'provider_payment_id' => (string) (982367111 + $index), 'status' => $state,
                'amount_cents' => $order->total_cents, 'provider_updated_at' => "2026-09-22T14:00:0$index.000Z",
            ]);
        }

        $this->getJson($adminUrl)->assertForbidden();
        $this->getJson(self::ORDERS.'/'.$ref)->assertOk()->assertJsonMissingPath('payment');
        $this->login(User::factory()->create(['role' => 'admin']));
        $this->getJson('/api/v1/admin/orders')->assertOk()->assertJsonMissingPath('data.0.payment');
        $this->getJson($adminUrl)->assertOk()
            ->assertJsonPath('payment.attempt.status', 'ready')
            ->assertJsonPath('payment.issues', ['multiple_approved_payments'])
            ->assertJsonPath('payment.last_result', 'verified')
            ->assertJsonPath('payment.observations.0.status', 'refunded')
            ->assertJsonPath('payment.observations.0.amount_cents', $order->total_cents)
            ->assertJsonPath('payment.observations.1.updated_at', '2026-09-22T14:00:00.000Z')
            ->assertDontSee('hidden-preference')->assertDontSee('payment.example.test')
            ->assertDontSee($order->payment_reconcile_token)->assertDontSee('982367111');
    }

    private function quote(array $items, string $method): string
    {
        $response = $this->postJson(self::QUOTE, ['items' => $items])->assertOk();
        $this->keepSession($response);

        return collect($response->json('data.shipping_options'))->firstWhere('method', $method)['quote_token'];
    }

    private function place(array $payload, ?string $key = null): TestResponse
    {
        return $this->postJson(self::ORDERS, $payload, ['Idempotency-Key' => $key ?? (string) Str::uuid()]);
    }

    private function payload(array $items, string $method, string $token): array
    {
        $payload = [
            'items' => $items,
            'shipping_method' => $method,
            'quote_token' => $token,
            'contact' => ['name' => 'Test Buyer', 'email' => 'buyer@example.test'],
        ];
        if ($method === 'delivery') {
            $payload['address'] = [
                'recipient' => 'Test Buyer',
                'department' => 'Montevideo',
                'locality' => 'Montevideo',
                'street' => 'Test Street',
                'number' => '0123B',
            ];
        }

        return $payload;
    }

    private function login(User $user): void
    {
        $this->keepSession($this->postJson('/api/v1/auth/login', [
            'email' => $user->email, 'password' => 'password',
        ])->assertNoContent());
    }

    private function keepSession(TestResponse $response): void
    {
        $cookie = $response->getCookie(config('session.cookie'));
        $this->assertNotNull($cookie);
        $this->useSession($cookie->getValue());
    }

    private function useSession(string $id): void
    {
        $this->app['session']->driver()->flush();
        $this->app['auth']->forgetGuards();
        $this->withCookie(config('session.cookie'), $id);
    }

    private function items(Product $product): array
    {
        return [['product_id' => $product->id, 'quantity' => 2]];
    }

    private function product(int $stock = 10, int $cents = 12345): Product
    {
        $number = Product::query()->count() + 1;
        $category = Category::query()->firstOrCreate(['slug' => 'test'], ['name' => 'Test']);

        return Product::query()->forceCreate([
            'sku' => 'ORDER-'.$number,
            'slug' => 'order-'.$number,
            'name' => 'Test Product '.$number,
            'price_cents' => $cents,
            'stock' => $stock,
            'status' => 'published',
            'category_id' => $category->id,
        ]);
    }
}
