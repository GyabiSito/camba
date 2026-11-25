<?php

namespace Tests\Feature\Payments;

use App\Actions\Notices\ProjectCommerceNotices;
use App\Models\Category;
use App\Models\CommerceNotice;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\Product;
use App\Models\User;
use App\Payments\CheckoutProClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
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

    public function test_new_mercado_pago_checkout_publishes_purchase_and_notices_only_after_approval(): void
    {
        config(['checkout.pickup_address' => 'QA pickup point']);
        $order = $this->submitLoggedCheckout('binary', keepCart: true);
        $this->getJson('/api/v1/orders')->assertOk()->assertJsonMissing(['reference' => $order->reference]);
        app(ProjectCommerceNotices::class)->execute();
        $this->assertDatabaseMissing('commerce_notices', ['subject_type' => 'order', 'subject_id' => $order->id]);
        Http::fake([
            'https://api.mercadopago.com/checkout/preferences' => Http::response([
                'collector_id' => 234, 'id' => '234-example', 'sandbox_init_point' => self::REDIRECT,
            ], 201),
            'https://api.mercadopago.com/v1/payments/159' => fn () => Http::response($this->managedPayment($order, 159, 'approved')),
        ]);
        $this->start($order, (string) Str::uuid())->assertCreated();
        $attempt = PaymentAttempt::query()->where('order_id', $order->id)->sole();
        Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/checkout/preferences')
            && $request['binary_mode'] === true
            && $request['external_reference'] === CheckoutProClient::attemptReference($order->reference, $attempt->id));
        $this->getJson('/api/v1/cart')->assertOk()->assertJsonCount(1, 'data.items');
        $this->webhook(159, 'approved-checkout-first')->assertOk();
        $this->webhook(159, 'approved-checkout-first')->assertOk();
        $this->artisan('camba:reconcile-payments')->assertSuccessful();
        $this->getJson('/api/v1/orders')->assertOk()->assertJsonFragment(['reference' => $order->reference, 'status' => 'paid']);
        $this->getJson('/api/v1/cart')->assertOk()->assertJsonCount(0, 'data.items');
        $this->assertSame(3, $this->stock($order));
        $this->assertSame('preparing', $order->fresh()->fulfilment_status);
        $this->assertDatabaseHas('payment_attempts', ['order_id' => $order->id, 'payment_id' => $order->fresh()->payment_id]);
        app(ProjectCommerceNotices::class)->execute();
        $this->assertSame(1, CommerceNotice::query()->where('subject_id', $order->id)->where('channel', 'panel')
            ->where('kind', 'order_created')->count());
    }

    #[DataProvider('closedPaymentStates')]
    public function test_checked_rejection_or_cancellation_releases_once_and_allows_new_attempt_on_same_payment(string $state): void
    {
        config(['checkout.pickup_address' => 'QA pickup point']);
        $order = $this->submitLoggedCheckout($state, keepCart: true);
        Http::fake([
            'https://api.mercadopago.com/checkout/preferences' => Http::sequence()
                ->push(['collector_id' => 234, 'id' => '234-example', 'sandbox_init_point' => self::REDIRECT], 201)
                ->push(['collector_id' => 234, 'id' => '234-retry', 'sandbox_init_point' => self::REDIRECT], 201),
            'https://api.mercadopago.com/v1/payments/159' => fn () => Http::response($this->managedPayment($order, 159, $state)),
            'https://api.mercadopago.com/v1/payments/search*' => Http::response(['paging' => ['total' => 0], 'results' => []]),
        ]);
        $firstKey = (string) Str::uuid();
        $this->start($order, $firstKey)->assertCreated();
        $first = PaymentAttempt::query()->where('order_id', $order->id)->sole();
        $this->webhook(159, 'terminal-first')->assertOk();
        $this->artisan('camba:reconcile-payments')->assertSuccessful();
        $this->assertSame($state, $first->fresh()->status->value);
        $this->assertSame(5, $this->stock($order));
        $this->getJson('/api/v1/cart')->assertOk()->assertJsonCount(1, 'data.items');
        $this->getJson('/api/v1/orders')->assertOk()->assertJsonMissing(['reference' => $order->reference]);
        $this->start($order, $firstKey)->assertConflict();

        $secondKey = (string) Str::uuid();
        $this->getJson("/api/v1/orders/$order->reference")->assertOk()->assertJsonPath('data.checkout_retryable', false);
        $this->start($order, $secondKey)->assertConflict();
        Http::assertSentCount(2);
        $this->travel(12)->minutes();
        $this->start($order, $secondKey)->assertConflict();
        $this->artisan('camba:reconcile-payments')->assertSuccessful();
        $this->getJson("/api/v1/orders/$order->reference")->assertOk()->assertJsonPath('data.checkout_retryable', true);
        $this->start($order, $secondKey)->assertCreated();
        $this->start($order, $secondKey)->assertOk();
        $this->webhook(159, 'terminal-repeated')->assertOk();
        $this->artisan('camba:reconcile-payments')->assertSuccessful();
        $this->assertSame(3, $this->stock($order));
        $this->assertSame([$state, 'ready'], $order->payment->attempts()->orderBy('id')->pluck('status')
            ->map(fn ($status) => $status->value)->all());
        $this->assertDatabaseCount('orders', 1);
    }

    public static function closedPaymentStates(): array
    {
        return [['rejected'], ['cancelled']];
    }

    public function test_definite_preference_denial_releases_but_does_not_fabricate_a_rejected_payment(): void
    {
        config(['checkout.pickup_address' => 'QA pickup point']);
        $order = $this->submitLoggedCheckout('preference-denial', keepCart: true);
        Http::fake(['https://api.mercadopago.com/checkout/preferences' => Http::response([], 422)]);
        $key = (string) Str::uuid();
        $this->start($order, $key)->assertConflict()->assertJsonPath('data.status', 'failed');
        $this->start($order, $key)->assertConflict();
        Http::assertSentCount(1);
        $this->assertDatabaseCount('payments', 0);
        $this->assertSame(5, $this->stock($order));
        $this->getJson('/api/v1/cart')->assertOk()->assertJsonCount(1, 'data.items');
    }

    public function test_payment_group_migration_preserves_the_legacy_order_and_attempt(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            $this->markTestSkipped('Legacy upgrade runs on PostgreSQL; SQLite cannot rebuild FK tables inside this test transaction.');
        }
        $migration = require database_path('migrations/2026_11_25_210000_group_checkout_payment_attempts.php');
        $migration->down();
        $order = $this->reservedOrder(sessionId: 'legacy-fixture-session');
        $attempt = PaymentAttempt::query()->forceCreate([
            'order_id' => $order->id, 'idempotency_key' => (string) Str::uuid(),
            'status' => 'ready', 'provider_preference_id' => '234-legacy',
            'checkout_url' => self::REDIRECT, 'expires_at' => $order->reservation_expires_at,
        ]);
        $payment = Payment::query()->forceCreate([
            'order_id' => $order->id, 'provider_payment_id' => '159', 'amount_cents' => 2400,
            'status' => 'rejected', 'provider_updated_at' => '2026-05-10T10:00:00.000Z',
        ]);
        $before = $this->stock($order);

        $migration->up();

        $migrated = $order->fresh();
        $this->assertFalse($migrated->checkout_managed);
        $this->assertSame($order->reference, $migrated->reference);
        $this->assertSame($attempt->id, $migrated->payment->attempts()->sole()->id);
        $this->assertSame(self::REDIRECT, $attempt->fresh()->checkout_url);
        $this->assertSame($attempt->id, $payment->fresh()->payment_attempt_id);
        $this->assertSame($before, $this->stock($migrated));
    }

    public function test_abandoned_binary_checkout_releases_after_a_complete_search_and_tracks_late_approval_without_stock(): void
    {
        config(['checkout.pickup_address' => 'QA pickup point']);
        $order = $this->submitLoggedCheckout('late');
        Http::fake(['https://api.mercadopago.com/checkout/preferences' => Http::response([
            'collector_id' => 234, 'id' => '234-example', 'sandbox_init_point' => self::REDIRECT,
        ], 201)]);
        $this->start($order, (string) Str::uuid())->assertCreated();
        $attempt = $order->payment->attempts()->sole();
        $providerReference = CheckoutProClient::attemptReference($order->reference, $attempt->id);
        Http::fake([
            'https://api.mercadopago.com/v1/payments/search*' => Http::response(['paging' => ['total' => 0], 'results' => []]),
            'https://api.mercadopago.com/v1/payments/159' => Http::response([
                ...$this->payment($order, 159, 'approved'), 'external_reference' => $providerReference,
            ]),
        ]);
        $this->travel(12)->minutes();
        $this->artisan('camba:reconcile-payments')->assertSuccessful();
        Http::assertSent(fn (Request $request) => str_contains($request->url(), '/payments/search')
            && str_contains($request->url(), $providerReference));
        $this->assertSame('expired', $attempt->fresh()->status->value);
        $this->assertSame(5, $this->stock($order));
        Product::query()->whereKey($order->items()->firstOrFail()->product_id)->update(['stock' => 0]);
        $this->webhook(159, 'late-no-stock')->assertOk();
        $this->artisan('camba:reconcile-payments')->assertSuccessful();
        $this->assertSame(0, $this->stock($order));
        $this->assertSame('payment_review', $order->fresh()->status->value);
        $this->assertContains('late_approval_without_stock', $order->fresh()->payment_issues);
        $this->assertDatabaseHas('payments', ['order_id' => $order->id, 'payment_attempt_id' => $attempt->id, 'status' => 'approved']);
        app(ProjectCommerceNotices::class)->execute();
        $this->assertDatabaseHas('commerce_notices', ['subject_type' => 'order', 'subject_id' => $order->id,
            'kind' => 'payment_issue', 'issue' => 'late_approval_without_stock']);
    }

    public function test_binary_checkout_reconciliation_finds_approved_provider_attempt_without_webhook_or_return(): void
    {
        config(['checkout.pickup_address' => 'QA pickup point']);
        $this->actingAs(User::factory()->create(['role' => 'buyer']));
        $order = $this->submitLoggedCheckout('no-webhook');
        Http::fake(['https://api.mercadopago.com/checkout/preferences' => Http::response([
            'collector_id' => 234, 'id' => '234-example', 'sandbox_init_point' => self::REDIRECT,
        ], 201)]);
        $this->start($order, (string) Str::uuid())->assertCreated();
        $attempt = $order->payment->attempts()->sole();
        $reference = CheckoutProClient::attemptReference($order->reference, $attempt->id);
        Http::fake([
            'https://api.mercadopago.com/v1/payments/search*' => fn (Request $request) => Http::response(
                str_contains($request->url(), $reference)
                    ? ['results' => [['id' => 159]], 'paging' => ['total' => 1]]
                    : ['results' => [], 'paging' => ['total' => 0]]),
            'https://api.mercadopago.com/v1/payments/159' => Http::response([
                ...$this->payment($order, 159, 'approved'), 'external_reference' => $reference,
            ]),
        ]);
        $this->travel(2)->days();
        $this->artisan('camba:reconcile-payments')->assertSuccessful();
        $this->assertDatabaseCount('payment_webhook_events', 0);
        $this->assertSame('approved', $attempt->fresh()->status->value);
        $this->getJson('/api/v1/orders')->assertOk()->assertJsonFragment(['reference' => $order->reference, 'status' => 'paid']);
        $this->assertSame(3, $this->stock($order));
    }

    public function test_managed_checkout_does_not_apply_approval_with_only_the_order_reference(): void
    {
        config(['checkout.pickup_address' => 'QA pickup point']);
        $order = $this->submitLoggedCheckout('missing-attempt', keepCart: true);
        Http::fake([
            'https://api.mercadopago.com/checkout/preferences' => Http::response([
                'collector_id' => 234, 'id' => '234-example', 'sandbox_init_point' => self::REDIRECT,
            ], 201),
            'https://api.mercadopago.com/v1/payments/159' => Http::response($this->payment($order, 159, 'approved')),
        ]);
        $this->start($order, (string) Str::uuid())->assertCreated();
        $this->webhook(159, 'without-attempt-reference')->assertOk();
        $this->artisan('camba:reconcile-payments')->assertSuccessful();
        $this->assertNull($order->fresh()->paid_at);
        $this->assertContains('provider_evidence_mismatch', $order->fresh()->payment_issues);
        $this->assertDatabaseCount('payments', 0);
        $this->getJson('/api/v1/orders')->assertOk()->assertJsonMissing(['reference' => $order->reference]);
        $this->getJson('/api/v1/cart')->assertOk()->assertJsonCount(1, 'data.items');
    }

    public function test_real_checkout_logs_simulated_payment_and_one_provider_failure_with_no_private_fields(): void
    {
        $keep = getenv('CAMBA_PAGOS_DOCKER_PROOF') === '1';
        if ($keep) {
            $this->assertSame('sqlite', DB::getDriverName());
            $this->assertSame(':memory:', DB::getDatabaseName());
        }
        $directory = $keep ? storage_path('logs') : sys_get_temp_dir().'/camba-provider-log-'.Str::uuid();
        config([
            'logging.channels.pagos.handler_with.directory' => $directory.'/pagos',
            'logging.default' => 'single',
            'logging.channels.single.path' => $directory.'/laravel.log',
            'checkout.pickup_address' => 'QA pickup point',
        ]);

        try {
            $success = $this->submitLoggedCheckout('success');
            $failed = $this->submitLoggedCheckout('failure');
            Http::fake([
                'https://api.mercadopago.com/checkout/preferences' => Http::sequence()
                    ->push(['collector_id' => 234, 'id' => '234-example', 'sandbox_init_point' => self::REDIRECT], 201)
                    ->push(['message' => 'PROVIDER_PRIVATE_SENTINEL'], 502),
                'https://api.mercadopago.com/v1/payments/159' => fn () => Http::response($this->managedPayment($success, 159, 'approved')),
            ]);
            $this->start($success, (string) Str::uuid())->assertCreated()->assertJsonPath('data.status', 'ready');
            $retryKey = (string) Str::uuid();
            $this->start($failed, $retryKey)->assertConflict()->assertJsonPath('data.status', 'uncertain');
            $this->start($failed, $retryKey)->assertConflict()->assertJsonPath('data.status', 'uncertain');
            foreach (['payment-log-first-observation', 'payment-log-replayed-observation'] as $delivery) {
                $this->webhook(159, $delivery)->assertOk();
                $this->artisan('camba:reconcile-payments')->assertSuccessful();
            }
            $this->assertSame('paid', $success->fresh()->status->value);
            $this->assertSame('pending_payment', $failed->fresh()->status->value);
            $this->assertSame(3, $this->stock($success));
            Http::assertSentCount(4);

            $path = $directory.'/pagos/'.now('America/Montevideo')->format('dmY').'.log';
            $for = static fn (Order $order): string => hash_hmac('sha256', 'checkout:'.$order->owner_key.':'.$order->idempotency_key, (string) config('app.key'));
            $ids = [$for($success), $for($failed)];
            $contents = File::get($path);
            $records = collect(explode("\n", trim($contents)))->map(fn (string $line) => json_decode($line, true, flags: JSON_THROW_ON_ERROR))
                ->filter(fn (array $entry) => in_array($entry['context']['correlation_id'] ?? null, $ids, true));
            $this->assertCount(2, $records->where('message', 'order.created'));
            $this->assertCount(2, $records->where('message', 'payment.started'));
            $paid = $records->where('message', 'order.status_changed')->sole();
            $this->assertSame('paid', $paid['context']['status']);
            $this->assertSame($success->id, $paid['context']['order_id']);
            $this->assertSame($success->reference, $paid['context']['reference']);
            $this->assertSame('INFO', $paid['level_name']);
            $this->assertSame('approved', $records->where('message', 'payment.status_changed')->sole()['context']['status']);
            $error = $records->where('message', 'payment.preference.failed')->sole();
            $this->assertSame($failed->id, $error['context']['order_id']);
            $this->assertSame($failed->reference, $error['context']['reference']);
            $this->assertSame($failed->payment->attempts()->value('id'), $error['context']['attempt_id']);
            $this->assertSame('ERROR', $error['level_name']);
            $this->assertSame('provider_unavailable', $error['context']['reason']);
            $this->assertNotEmpty($error['context']['exception_class']);

            $logged = $records->toJson();
            foreach (['buyer-log@example.test', 'PROVIDER_PRIVATE_SENTINEL', 'fake-local-test', 'local-signature-test', $retryKey, '234-example'] as $sensitive) {
                $this->assertStringNotContainsString($sensitive, $logged);
            }
            $default = File::exists($directory.'/laravel.log') ? File::get($directory.'/laravel.log') : '';
            foreach ([...$ids, 'PROVIDER_PRIVATE_SENTINEL'] as $marker) {
                $this->assertStringNotContainsString($marker, $default);
            }
            if ($keep) {
                fwrite(STDOUT, "\n$path\n".json_encode($paid, JSON_THROW_ON_ERROR)."\n".json_encode($error, JSON_THROW_ON_ERROR)."\n");
            }
        } finally {
            Log::forgetChannel('pagos');
            Log::forgetChannel('single');
            if (! $keep) {
                File::deleteDirectory($directory);
            }
        }
    }

    private function submitLoggedCheckout(string $variant, bool $keepCart = false): Order
    {
        $category = Category::query()->firstOrCreate(['slug' => 'test'], ['name' => 'Test']);
        $product = Product::query()->forceCreate([
            'sku' => 'LOG-'.$variant, 'slug' => 'payment-log-'.$variant, 'name' => 'Payment log fixture',
            'price_cents' => 1200, 'stock' => 5, 'status' => 'published', 'category_id' => $category->id,
        ]);
        $items = [['product_id' => $product->id, 'quantity' => 2]];
        $quote = $this->postJson('/api/v1/checkout/quote', ['items' => $items])->assertOk();
        $cookie = $quote->getCookie(config('session.cookie'));
        $this->withCookie($cookie->getName(), $cookie->getValue());
        if ($keepCart) {
            $this->putJson('/api/v1/cart/items/'.$product->id, ['quantity' => 2])->assertOk();
        }
        $reference = $this->postJson('/api/v1/orders', [
            'items' => $items, 'shipping_method' => 'pickup', 'quote_token' => $quote->json('data.shipping_options.0.quote_token'),
            'contact' => ['name' => 'QA checkout', 'email' => 'buyer-log@example.test'],
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertCreated()->json('data.reference');

        return Order::where('reference', $reference)->sole();
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
        $this->assertDatabaseCount('payment_webhook_events', 0);
        $this->getJson('/api/v1/orders/'.$order->reference)->assertOk()->assertJsonPath('data.status', 'paid');
        $paidNotices = fn () => CommerceNotice::query()->where('subject_type', 'order')
            ->where('subject_id', $order->id)->where('kind', 'order_paid')->orderBy('channel')->pluck('channel')->all();
        $this->artisan('camba:notices')->assertSuccessful();
        $this->assertSame(['mail', 'panel'], $paidNotices());
        $this->assertContains('multiple_approved_payments', $order->fresh()->payment_issues);
        $this->assertDatabaseCount('payments', 2);
        $this->assertSame(1, $this->stock($order));
        $this->start($order, $key)->assertConflict()->assertJsonMissingPath('data.checkout_url');
        Http::assertSentCount(4);
        Http::assertSent(fn (Request $request) => str_contains($request->url(), '/payments/search')
            && str_contains($request->url(), 'external_reference='.$order->reference));
        $this->webhook(159, 'late-after-scheduler')->assertOk();
        $this->webhook(159, 'late-after-scheduler')->assertOk();
        $this->artisan('camba:reconcile-payments')->assertSuccessful();
        $this->assertDatabaseCount('payment_webhook_events', 1);
        $this->assertDatabaseCount('payments', 2);
        $this->assertDatabaseCount('payment_observations', 2);
        $this->artisan('camba:notices')->assertSuccessful();
        $this->assertSame(['mail', 'panel'], $paidNotices());
        $this->assertSame(1, $this->stock($order));
        $this->actingAs(User::factory()->create(['role' => 'admin']), 'web')
            ->getJson('/api/v1/admin/orders/'.$order->reference)->assertOk()
            ->assertJsonPath('data.status', 'paid');
    }

    public function test_invalid_checkout_configuration_does_not_poison_the_same_order(): void
    {
        $order = $this->reservedOrder();
        $key = (string) Str::uuid();
        Http::fake(['https://api.mercadopago.com/checkout/preferences' => Http::response([
            'collector_id' => 234, 'id' => '234-example', 'sandbox_init_point' => self::REDIRECT,
        ], 201)]);

        config(['app.url' => 'http://127.0.0.1:4200']);
        $this->start($order, $key)->assertServiceUnavailable()->assertJsonMissingPath('data.checkout_url');
        $this->assertDatabaseCount('payment_attempts', 0);
        Http::assertNothingSent();

        config(['app.url' => 'https://camba.example.test']);
        $this->start($order, $key)->assertCreated()->assertJsonPath('data.checkout_url', self::REDIRECT);
        $this->assertDatabaseCount('payment_attempts', 1);
        Http::assertSentCount(1);
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

    private function reservedOrder(bool $expired = false, ?string $sessionId = null): Order
    {
        if ($sessionId === null) {
            $response = $this->getJson('/api/v1/orders')->assertOk();
            $cookie = $response->getCookie(config('session.cookie'));
            $this->assertNotNull($cookie);
            $sessionId = $cookie->getValue();
            $this->withCookie($cookie->getName(), $sessionId);
        }
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

    private function managedPayment(Order $order, int $id, string $status): array
    {
        $firstAttempt = $order->payment->attempts()->orderBy('id')->firstOrFail()->id;

        return [
            ...$this->payment($order, $id, $status),
            'external_reference' => CheckoutProClient::attemptReference($order->reference, $firstAttempt),
        ];
    }
}
