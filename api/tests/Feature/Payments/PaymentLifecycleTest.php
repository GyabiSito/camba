<?php

namespace Tests\Feature\Payments;

use App\Models\Category;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class PaymentLifecycleTest extends TestCase
{
    use RefreshDatabase;

    private const REDIRECT = 'https://sandbox.mercadopago.com/checkout/v1/redirect?pref_id=234-example';

    protected function beforeRefreshingDatabase(): void
    {
        $connection = config('database.default');
        $database = config("database.connections.$connection.database");
        $isolatedPostgres = $connection === 'pgsql'
            && $database === 'camba_v2_demo_test'
            && $this->app->environment('testing')
            && config('database.connections.pgsql.host') === 'postgres'
            && empty(config('database.connections.pgsql.url'));
        $this->assertTrue(
            ($connection === 'sqlite' && $database === ':memory:') || ($connection === 'mysql' && $database === 'camba_v2_test') || $isolatedPostgres,
            'Payment tests may only reset in-memory SQLite or a dedicated Camba v2 test database.',
        );
    }

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'session.driver' => 'database',
            'app.url' => 'https://camba.example.test',
            'mercadopago.access_token' => 'fake-local-test',
            'mercadopago.collector_id' => '234',
            'mercadopago.webhook_secret' => 'local-signature-test',
            'mercadopago.live' => false,
        ]);
        $this->withCredentials()->withHeader('Origin', 'http://localhost');
        Http::preventStrayRequests();
    }

    public function test_webhook_dedupe_precedes_ack_and_out_of_order_events_cannot_reopen_paid_order(): void
    {
        $order = $this->reservedOrder();
        $endpoint = 'https://api.mercadopago.com/v1/payments/159';
        Http::fake([$endpoint => Http::sequence()
            ->push($this->payment($order, 159, 'approved', '2026-05-10T10:00:00Z'))
            ->push($this->payment($order, 159, 'pending', '2026-05-10T09:00:00Z'))
            ->push($this->payment($order, 159, 'refunded', '2026-05-10T11:00:00Z'))]);
        $this->webhook(159, 'bad-signature', valid: false)->assertUnauthorized();
        $this->webhook(159, 'received')->assertOk();
        $this->webhook(159, 'received')->assertOk();
        Http::assertNothingSent();
        $this->assertDatabaseCount('payment_webhook_events', 1);

        $this->artisan('camba:reconcile-payments')->assertSuccessful();
        $this->assertSame('paid', $order->fresh()->status->value);
        $this->webhook(159, 'out-of-order')->assertOk();
        $this->artisan('camba:reconcile-payments')->assertSuccessful();
        $this->assertSame('paid', $order->fresh()->status->value);
        $this->assertDatabaseHas('payments', ['provider_payment_id' => '159', 'status' => 'approved', 'amount_cents' => 2400]);
        $this->webhook(159, 'reversed')->assertOk();
        $this->artisan('camba:reconcile-payments')->assertSuccessful();
        $this->assertSame('refunded', $order->fresh()->status->value);
        $this->assertDatabaseCount('payment_observations', 3);
        $this->assertSame(1, $this->stock($order));
        Http::assertSentCount(3);
    }

    public function test_scheduler_confirms_without_browser_or_webhook_and_records_multiple_approvals_once(): void
    {
        $order = $this->reservedOrder();
        Http::fake([
            'https://api.mercadopago.com/checkout/preferences' => Http::response([
                'collector_id' => 234, 'id' => '234-example', 'sandbox_init_point' => self::REDIRECT,
            ], 201),
            'https://api.mercadopago.com/v1/payments/search*' => Http::response([
                'paging' => ['total' => 2], 'results' => [['id' => 159], ['id' => 160]],
            ]),
            'https://api.mercadopago.com/v1/payments/159' => Http::response($this->payment($order, 159, 'approved')),
            'https://api.mercadopago.com/v1/payments/160' => Http::response($this->payment($order, 160, 'approved')),
        ]);
        $key = (string) Str::uuid();
        $this->start($order, $key)->assertCreated()->assertJsonPath('data.checkout_url', self::REDIRECT)
            ->assertHeader('Cache-Control', 'no-store, private');
        $this->start($order, $key)->assertOk()->assertJsonPath('data.checkout_url', self::REDIRECT);
        $this->assertDatabaseCount('payment_attempts', 1);
        $this->assertDatabaseCount('payment_webhook_events', 0);
        $this->travel(2)->minutes();
        $this->artisan('camba:reconcile-payments')->assertSuccessful();
        $this->assertSame('paid', $order->fresh()->status->value);
        $this->assertContains('multiple_approved_payments', $order->fresh()->payment_issues);
        $this->assertDatabaseCount('payments', 2);
        $this->assertSame(1, $this->stock($order));
        $this->start($order, $key)->assertConflict()->assertJsonMissingPath('data.checkout_url');
        Http::assertSentCount(4);
        Http::assertSent(fn (Request $request) => str_contains($request->url(), '/payments/search')
            && str_contains($request->url(), 'external_reference='.$order->reference));
    }

    public function test_expiry_requires_complete_fresh_evidence_and_late_payments_never_invent_stock(): void
    {
        $order = $this->reservedOrder(expired: true);
        Http::fake([
            'https://api.mercadopago.com/v1/payments/search*' => Http::sequence()->pushStatus(503)
                ->push(['paging' => ['total' => 1], 'results' => [['id' => 159]]])
                ->push(['paging' => ['total' => 0], 'results' => []]),
            'https://api.mercadopago.com/v1/payments/159' => Http::sequence()
                ->push($this->payment($order, 159, 'pending', '2026-05-10T09:00:00Z'))
                ->push($this->payment($order, 159, 'rejected', '2026-05-10T10:00:00Z'))
                ->push($this->payment($order, 159, 'approved', '2026-05-10T11:00:00Z')),
        ]);
        $this->artisan('camba:reconcile-payments')->assertSuccessful();
        $this->assertSame('pending_payment', $order->fresh()->status->value);
        $this->assertSame(1, $this->stock($order));
        $this->travel(20)->minutes();
        $this->artisan('camba:reconcile-payments')->assertSuccessful();
        $this->assertSame('pending_payment', $order->fresh()->status->value);
        $this->assertSame(1, $this->stock($order));
        $this->travel(20)->minutes();
        $this->artisan('camba:reconcile-payments')->assertSuccessful();
        $this->assertSame('payment_expired', $order->fresh()->status->value);
        $this->assertSame(3, $this->stock($order));
        $this->assertNotNull($order->fresh()->stock_released_at);
        $this->artisan('camba:reconcile-payments')->assertSuccessful();
        $this->assertSame(3, $this->stock($order));

        Product::query()->whereKey($order->items()->firstOrFail()->product_id)->update(['stock' => 1]);
        $this->webhook(159, 'late-approval')->assertOk();
        $this->artisan('camba:reconcile-payments')->assertSuccessful();
        $this->assertSame('payment_review', $order->fresh()->status->value);
        $this->assertContains('late_approval_without_stock', $order->fresh()->payment_issues);
        $this->assertDatabaseHas('payments', ['provider_payment_id' => '159', 'status' => 'approved']);
        $this->assertSame(1, $this->stock($order));
        $this->assertNull($order->fresh()->stock_reacquired_at);
    }

    public function test_unstarted_order_with_disabled_provider_releases_stock_once_after_expiry_grace(): void
    {
        $order = $this->reservedOrder();
        config(['mercadopago.access_token' => '']);
        Http::fake([]);
        $this->start($order, (string) Str::uuid())->assertServiceUnavailable();
        $this->assertDatabaseCount('payment_attempts', 0);
        $this->travelTo($order->reservation_expires_at->copy()->addSeconds(59));
        $this->artisan('camba:reconcile-payments')->assertSuccessful();
        $this->assertSame('pending_payment', $order->fresh()->status->value);
        $this->assertNull($order->fresh()->stock_released_at);
        $this->assertSame(1, $this->stock($order));

        $this->travel(1)->seconds();
        $this->artisan('camba:reconcile-payments')->assertSuccessful();
        $released = $order->fresh();
        $this->assertSame('payment_expired', $released->status->value);
        $this->assertNotNull($released->stock_released_at);
        $this->assertSame('verified', $released->payment_reconcile_result);
        $this->assertNull($released->payment_reconcile_token);
        $this->assertNull($released->payment_reconcile_at);
        $this->assertSame(3, $this->stock($order));
        $this->travel(10)->minutes();
        $this->artisan('camba:reconcile-payments')->assertSuccessful();
        $this->assertEquals($released->stock_released_at, $order->fresh()->stock_released_at);
        $this->assertSame(3, $this->stock($order));
        $this->assertDatabaseCount('payments', 0);
        Http::assertNothingSent();
    }

    #[DataProvider('existingPaymentEvidence')]
    public function test_disabled_provider_never_releases_orders_with_payment_history(string $history): void
    {
        $order = $this->reservedOrder(expired: true);
        config(['mercadopago.access_token' => '']);
        Http::fake([]);
        if ($history === 'payment') {
            Payment::query()->forceCreate([
                'order_id' => $order->id, 'provider_payment_id' => '159', 'amount_cents' => 2400,
                'status' => 'rejected', 'provider_updated_at' => '2026-05-10T10:00:00.000Z',
            ]);
        } else {
            PaymentAttempt::query()->forceCreate([
                'order_id' => $order->id, 'idempotency_key' => (string) Str::uuid(),
                'status' => $history, 'expires_at' => $order->reservation_expires_at,
            ]);
        }
        $this->artisan('camba:reconcile-payments')->assertSuccessful();
        $this->assertSame('pending_payment', $order->fresh()->status->value);
        $this->assertSame('provider_incomplete', $order->fresh()->payment_reconcile_result);
        $this->assertNull($order->fresh()->stock_released_at);
        $this->assertSame(1, $this->stock($order));
        Http::assertNothingSent();
    }

    public static function existingPaymentEvidence(): array
    {
        return [['initiating'], ['uncertain'], ['ready'], ['payment']];
    }

    public function test_local_expiry_preserves_payment_issue_guards(): void
    {
        $order = $this->reservedOrder(expired: true);
        $order->forceFill(['payment_issues' => ['provider_evidence_mismatch']])->save();
        config(['mercadopago.access_token' => '']);
        Http::fake([]);
        $this->artisan('camba:reconcile-payments')->assertSuccessful();
        $this->assertSame('pending_payment', $order->fresh()->status->value);
        $this->assertNull($order->fresh()->stock_released_at);
        $this->assertSame(1, $this->stock($order));
        Http::assertNothingSent();
    }

    public function test_preference_timeout_is_durable_and_never_retried_or_disclosed_to_other_sessions(): void
    {
        $order = $this->reservedOrder();
        Http::fake(['https://api.mercadopago.com/checkout/preferences' => Http::failedConnection()]);
        $key = (string) Str::uuid();
        $this->start($order, $key)->assertConflict()->assertJsonPath('data.status', 'uncertain')->assertJsonPath('data.checkout_url', null);
        $this->start($order, $key)->assertConflict()->assertJsonPath('data.checkout_url', null);
        $this->start($order, (string) Str::uuid())->assertConflict()->assertJsonPath('data.checkout_url', null);
        $this->assertDatabaseCount('payment_attempts', 1);
        $this->assertDatabaseHas('payment_attempts', ['order_id' => $order->id, 'status' => 'uncertain']);
        $this->app['session']->driver()->flush();
        $this->app['auth']->forgetGuards();
        $this->withCookie(config('session.cookie'), 'start-new-session');
        $this->start($order, $key)->assertNotFound();
        Http::assertSentCount(1);
    }

    public function test_order_expiry_during_preference_creation_never_returns_the_old_redirect(): void
    {
        $order = $this->reservedOrder();
        Http::fake(['https://api.mercadopago.com/checkout/preferences' => function () {
            $this->travel(40)->minutes();

            return Http::response(['collector_id' => 234, 'id' => '234-example', 'sandbox_init_point' => self::REDIRECT], 201);
        }]);
        $key = (string) Str::uuid();
        $this->postJson("/api/v1/orders/$order->reference/payments", ['amount_cents' => 1], ['Idempotency-Key' => $key])
            ->assertUnprocessable()->assertJsonValidationErrors('amount_cents');
        Http::assertNothingSent();
        $this->start($order, $key)->assertConflict()->assertJsonMissingPath('data.checkout_url');
        $this->assertDatabaseHas('payment_attempts', ['order_id' => $order->id, 'provider_preference_id' => '234-example']);
        $this->start($order, $key)->assertConflict()->assertJsonMissingPath('data.checkout_url');
        Http::assertSentCount(1);
    }

    public function test_provider_inbox_retries_but_wrong_amount_never_authorizes_or_releases_an_order(): void
    {
        $order = $this->reservedOrder(expired: true);
        Http::fake([
            'https://api.mercadopago.com/v1/payments/search*' => Http::sequence()->pushStatus(503)->push([
                'paging' => ['total' => 0], 'results' => [],
            ]),
            'https://api.mercadopago.com/v1/payments/159' => Http::sequence()->pushStatus(503)->push([
                ...$this->payment($order, 159, 'approved'), 'transaction_amount' => '23.99',
            ]),
        ]);
        $this->webhook(159, 'verified')->assertOk();
        $this->artisan('camba:reconcile-payments')->assertSuccessful();
        $this->assertDatabaseHas('payment_webhook_events', ['attempts' => 1, 'processed_at' => null, 'result' => 'provider_unavailable']);
        $this->assertSame(1, $this->stock($order));
        $this->travel(20)->minutes();
        $this->artisan('camba:reconcile-payments')->assertSuccessful();
        $this->assertDatabaseHas('payment_webhook_events', ['attempts' => 2, 'result' => 'conflicting_evidence']);
        $this->assertContains('provider_evidence_mismatch', $order->fresh()->payment_issues);
        $this->assertSame('pending_payment', $order->fresh()->status->value);
        $this->assertNull($order->fresh()->stock_released_at);
        $this->assertDatabaseCount('payments', 0);
        $this->assertSame(1, $this->stock($order));
    }

    public function test_provider_lookup_started_before_expiry_is_not_release_evidence_and_late_approval_can_reacquire_stock(): void
    {
        $order = $this->reservedOrder();
        $search = 0;
        Http::fake([
            'https://api.mercadopago.com/checkout/preferences' => Http::response([
                'collector_id' => 234, 'id' => '234-example', 'sandbox_init_point' => self::REDIRECT,
            ], 201),
            'https://api.mercadopago.com/v1/payments/search*' => function () use (&$search) {
                if (++$search === 1) {
                    $this->travel(40)->minutes();
                }

                return Http::response($search < 3
                    ? ['paging' => ['total' => 0], 'results' => []]
                    : ['paging' => ['total' => 1], 'results' => [['id' => 159]]]);
            },
            'https://api.mercadopago.com/v1/payments/159' => Http::response($this->payment($order, 159, 'approved')),
        ]);
        $this->start($order, (string) Str::uuid())->assertCreated();
        $this->travel(2)->minutes();
        $this->artisan('camba:reconcile-payments')->assertSuccessful();
        $this->assertSame('pending_payment', $order->fresh()->status->value);
        $this->assertSame(1, $this->stock($order));
        $this->travel(42)->minutes();
        $this->artisan('camba:reconcile-payments')->assertSuccessful();
        $this->assertSame('payment_expired', $order->fresh()->status->value);
        $this->assertSame(3, $this->stock($order));
        $this->travel(58)->minutes();
        $this->artisan('camba:reconcile-payments')->assertSuccessful();
        $this->assertSame('paid', $order->fresh()->status->value);
        $this->assertNotNull($order->fresh()->stock_released_at);
        $this->assertNotNull($order->fresh()->stock_reacquired_at);
        $this->assertSame(1, $this->stock($order));
        $this->assertDatabaseCount('payment_webhook_events', 0);
    }

    public function test_refresh_only_schedules_owned_or_admin_orders_without_calling_the_provider(): void
    {
        $order = $this->reservedOrder();
        Http::fake([]);
        $orderPath = "/api/v1/orders/$order->reference/payments/refresh";
        $adminPath = "/api/v1/admin/orders/$order->reference/payments/refresh";
        $this->postJson($adminPath)->assertUnauthorized();
        $this->postJson($orderPath)->assertAccepted();
        $due = $order->fresh()->payment_reconcile_at;
        $this->assertNotNull($due);
        $this->postJson($orderPath)->assertAccepted();
        $this->assertEquals($due, $order->fresh()->payment_reconcile_at);
        $buyer = User::factory()->create();
        $this->actingAs($buyer, 'web')->postJson($orderPath)->assertNotFound();
        $this->postJson($adminPath)->assertForbidden();
        $buyer->forceFill(['role' => 'admin'])->save();
        $this->actingAs($buyer, 'web')->postJson($adminPath)->assertConflict();
        $this->recordCheckoutAttempt($order);
        $this->actingAs($buyer, 'web')->postJson($adminPath)->assertAccepted();
        Http::assertNothingSent();
    }

    public function test_admin_payment_refresh_requires_mercado_pago_to_be_configured_and_order_evidence(): void
    {
        $order = $this->reservedOrder();
        $order->forceFill(['status' => 'paid', 'paid_at' => now(), 'payment_reconcile_at' => now()->addHour()])->save();
        $scheduled = $order->payment_reconcile_at;
        $path = "/api/v1/admin/orders/$order->reference";
        $this->actingAs(User::factory()->create(['role' => 'admin']), 'web');
        Http::fake([]);

        $this->getJson($path)->assertOk()->assertJsonPath('data.status', 'paid')
            ->assertJsonPath('payment.can_request_refresh', false)->assertJsonPath('payment.next_check_at', null);
        $this->postJson("$path/payments/refresh")->assertConflict();
        $this->assertEquals($scheduled, $order->fresh()->payment_reconcile_at);

        Payment::query()->forceCreate([
            'order_id' => $order->id, 'provider_payment_id' => '234', 'status' => 'approved',
            'amount_cents' => $order->total_cents, 'provider_updated_at' => now()->utc()->format('Y-m-d\TH:i:s.v\Z'),
        ]);
        config(['mercadopago.access_token' => '']);
        $order->forceFill(['payment_reconcile_at' => null])->save();
        $this->getJson($path)->assertOk()->assertJsonPath('payment.can_request_refresh', false);
        $this->postJson("$path/payments/refresh")->assertConflict();
        $this->assertNull($order->fresh()->payment_reconcile_at);

        config(['mercadopago.access_token' => 'fake-local-test']);
        $this->getJson($path)->assertOk()->assertJsonPath('payment.can_request_refresh', true);
        $this->postJson("$path/payments/refresh")->assertAccepted();
        $this->getJson($path)->assertOk()->assertJsonPath('data.status', 'paid')
            ->assertJsonPath('payment.next_check_at', $order->fresh()->payment_reconcile_at->toISOString());
        Http::assertNothingSent();
    }

    public function test_admin_can_request_reconciliation_for_an_uncertain_checkout_attempt(): void
    {
        $order = $this->reservedOrder();
        $this->recordCheckoutAttempt($order);
        $path = "/api/v1/admin/orders/$order->reference";
        $this->actingAs(User::factory()->create(['role' => 'admin']), 'web');
        Http::fake([]);

        $this->getJson($path)->assertOk()->assertJsonPath('payment.can_request_refresh', true);
        $this->postJson("$path/payments/refresh")->assertAccepted();
        $this->assertNotNull($order->fresh()->payment_reconcile_at);
        Http::assertNothingSent();
    }

    private function recordCheckoutAttempt(Order $order): void
    {
        PaymentAttempt::query()->forceCreate([
            'order_id' => $order->id, 'idempotency_key' => (string) Str::uuid(),
            'status' => 'uncertain', 'expires_at' => $order->reservation_expires_at,
        ]);
    }

    private function reservedOrder(bool $expired = false): Order
    {
        $response = $this->getJson('/api/v1/orders')->assertOk();
        $cookie = $response->getCookie(config('session.cookie'));
        $this->assertNotNull($cookie);
        $sessionId = $cookie->getValue();
        $this->withCookie($cookie->getName(), $sessionId);
        $category = Category::query()->firstOrCreate(['slug' => 'test'], ['name' => 'Test']);
        $product = Product::query()->forceCreate([
            'sku' => 'PAYMENT-TEST', 'slug' => 'payment-test', 'name' => 'Payment test item',
            'price_cents' => 1200, 'stock' => 1, 'status' => 'published', 'category_id' => $category->id,
        ]);
        $order = Order::query()->forceCreate([
            'reference' => (string) Str::uuid(), 'owner_key' => Order::ownerKey(null, $sessionId),
            'idempotency_key' => (string) Str::uuid(), 'request_hash' => str_repeat('1', 64),
            'status' => 'pending_payment', 'currency' => 'UYU', 'subtotal_cents' => 2400,
            'shipping_cents' => 0, 'total_cents' => 2400, 'shipping_method' => 'pickup',
            'contact' => ['name' => 'Test Buyer', 'email' => 'buyer@example.test'],
            'guest_access_expires_at' => now()->addHours(24),
            'reservation_expires_at' => $expired ? now()->subMinutes(5) : now()->addMinutes(30),
        ]);
        $order->items()->forceCreate([
            'product_id' => $product->id, 'sku' => $product->sku, 'name' => $product->name, 'quantity' => 2,
            'unit_price_cents' => 1200, 'line_total_cents' => 2400,
        ]);

        return $order;
    }

    private function stock(Order $order): int
    {
        return Product::query()->findOrFail($order->items()->firstOrFail()->product_id)->stock;
    }

    private function start(Order $order, string $idempotencyKey): TestResponse
    {
        return $this->postJson("/api/v1/orders/$order->reference/payments", [], ['Idempotency-Key' => $idempotencyKey]);
    }

    private function webhook(int $id, string $requestId, bool $valid = true): TestResponse
    {
        $ts = '1742505638683';
        $signature = $valid ? hash_hmac('sha256', "id:$id;request-id:$requestId;ts:$ts;", 'local-signature-test') : str_repeat('0', 64);

        return $this->postJson("/api/v1/webhooks/mercadopago?data.id=$id&type=payment", [
            'type' => 'payment', 'data' => ['id' => (string) $id],
        ], ['x-request-id' => $requestId, 'x-signature' => "ts=$ts,v1=$signature"]);
    }

    private function payment(Order $order, int $id, string $status, string $date = '2026-05-10T10:00:00Z'): array
    {
        return [
            'id' => $id, 'collector_id' => 234, 'external_reference' => $order->reference,
            'status' => $status, 'currency_id' => 'UYU', 'live_mode' => false,
            'transaction_amount' => '24.00', 'date_last_updated' => $date,
        ];
    }
}
