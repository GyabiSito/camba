<?php

namespace Tests\Feature\Orders;

use App\Actions\Notices\DeliverCommerceNotice;
use App\Actions\Notices\NoticeEligibility;
use App\Actions\Payments\ApplyPaymentEvidence;
use App\Commerce\PurchaseTerms;
use App\Jobs\SendCommerceNotice;
use App\Mail\CommerceNoticeMail;
use App\Models\Category;
use App\Models\CommerceNotice;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\Product;
use App\Models\StoreSettings;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use RuntimeException;
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
        $isolatedPostgres = $connection === 'pgsql'
            && $database === 'camba_demo_test'
            && $this->app->environment('testing')
            && config('database.connections.pgsql.host') === 'postgres'
            && empty(config('database.connections.pgsql.url'));
        $this->assertTrue(
            ($connection === 'sqlite' && $database === ':memory:') || ($connection === 'mysql' && $database === 'camba_test') || $isolatedPostgres,
            'The order suite may only reset an in-memory database or a dedicated Camba v2 test database.',
        );
    }

    protected function setUp(): void
    {
        parent::setUp();
        config(['session.driver' => 'database', 'checkout.pickup_address' => 'Pickup Counter', 'checkout.delivery_cents' => 3500]);
        $this->withCredentials()->withHeader('Origin', 'http://localhost');
        $this->login(User::factory()->create());
    }

    public function test_required_online_payment_rejects_an_unavailable_gateway_before_reserving_stock(): void
    {
        config(['checkout.require_online_payment' => true, 'mercadopago.access_token' => null]);
        $product = $this->product();
        $items = $this->items($product);
        $payload = $this->payload($items, 'pickup', $this->quote($items, 'pickup'));

        $this->place($payload)->assertServiceUnavailable();
        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseCount('payment_attempts', 0);
        $this->assertDatabaseCount('commerce_notices', 0);
        $this->assertSame(10, $product->fresh()->stock);
    }

    public function test_guest_cannot_create_orders_or_start_or_resume_payments(): void
    {
        $this->useSession('anonymous-checkout');
        Http::fake();
        $product = $this->product();
        $items = $this->items($product);
        $payload = $this->payload($items, 'pickup', $this->quote($items, 'pickup'));
        $reference = (string) Str::uuid();

        $this->place($payload, (string) Str::uuid())->assertUnauthorized();
        $this->postJson(self::ORDERS.'/'.$reference.'/payments')->assertUnauthorized();
        $this->postJson('/api/v1/cart/checkout/'.$reference.'/resume')->assertUnauthorized();

        $this->login(User::factory()->create(['role' => 'admin']));
        $this->place($payload, (string) Str::uuid())->assertForbidden();
        $this->postJson(self::ORDERS.'/'.$reference.'/payments')->assertForbidden();
        $this->postJson('/api/v1/cart/checkout/'.$reference.'/resume')->assertForbidden();

        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseCount('payment_attempts', 0);
        $this->assertSame(10, $product->fresh()->stock);
        Http::assertNothingSent();
    }

    public function test_checkout_logs_rejection_and_committed_order_without_logging_input_or_replays(): void
    {
        $scratch = sys_get_temp_dir().'/camba-checkout-log-'.Str::uuid();
        config([
            'logging.channels.pagos.handler_with.directory' => $scratch.'/pagos',
            'logging.default' => 'single',
            'logging.channels.single.path' => $scratch.'/laravel.log',
        ]);

        try {
            $items = $this->items($this->product());
            $payload = $this->payload($items, 'pickup', $this->quote($items, 'pickup'));
            $key = (string) Str::uuid();
            $this->place([...$payload, 'quote_token' => str_repeat('b', 64)], $key)->assertConflict();
            $reference = $this->place($payload, $key)->assertCreated()->json('data.reference');
            $this->place($payload, $key)->assertOk();
            $order = Order::where('reference', $reference)->sole();
            $this->postJson(self::QUOTE, ['items' => []])->assertUnprocessable();
            $event = 'eloquent.creating: '.CommerceNotice::class;
            Event::listen($event, static fn () => throw new RuntimeException('secret sentinel from a failing ledger'));
            try {
                $this->place($payload)->assertServerError();
            } finally {
                Event::forget($event);
            }

            $contents = File::get($scratch.'/pagos/'.now('America/Montevideo')->format('dmY').'.log');
            $records = collect(explode("\n", trim($contents)))->map(fn (string $line) => json_decode($line, true, flags: JSON_THROW_ON_ERROR));
            $rejected = $records->firstWhere('message', 'checkout.rejected');
            $created = $records->where('message', 'order.created')->sole();
            $this->assertSame('WARNING', $rejected['level_name']);
            $this->assertSame('http_409', $rejected['context']['reason']);
            $this->assertArrayNotHasKey('order_id', $rejected['context']);
            $this->assertMatchesRegularExpression('/\A[0-9a-f]{64}\z/', $rejected['context']['correlation_id']);
            $this->assertSame($rejected['context']['correlation_id'], $created['context']['correlation_id']);
            $this->assertSame($order->id, $created['context']['order_id']);
            $this->assertSame($reference, $created['context']['reference']);
            $this->assertTrue($records->contains('message', 'checkout.quote.started'));
            $this->assertTrue($records->contains('message', 'checkout.started'));
            $validation = $records->where('message', 'checkout.quote.rejected')->sole();
            $this->assertSame('http_422', $validation['context']['reason']);
            $failure = $records->where('message', 'checkout.failed')->sole();
            $this->assertSame('ERROR', $failure['level_name']);
            $this->assertSame(RuntimeException::class, $failure['context']['exception_class']);
            $this->assertArrayNotHasKey('order_id', $failure['context']);
            foreach ([$key, $payload['quote_token'], $payload['contact']['email'], 'secret sentinel'] as $private) {
                $this->assertStringNotContainsString($private, $contents);
            }
            $this->assertFileDoesNotExist($scratch.'/laravel.log');
            Log::error('ordinary-app-event');
            $this->assertStringContainsString('ordinary-app-event', File::get($scratch.'/laravel.log'));
            $this->assertStringNotContainsString('ordinary-app-event', File::get($scratch.'/pagos/'.now('America/Montevideo')->format('dmY').'.log'));
        } finally {
            Log::forgetChannel('pagos');
            Log::forgetChannel('single');
            File::deleteDirectory($scratch);
        }
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

    public function test_free_delivery_depends_on_the_live_subtotal_and_available_delivery(): void
    {
        $settings = StoreSettings::query()->findOrFail(1);
        $settings->forceFill(['values' => ['free_delivery_enabled' => true, 'free_delivery_minimum_cents' => 250000]])->save();
        $product = $this->product(cents: 249999);
        $address = array_intersect_key($this->payload([], 'delivery', '')['address'], array_flip(['department_id', 'locality_id']));
        foreach ([[249999, 1, 3500], [250000, 1, 0], [250001, 1, 0], [125000, 1, 3500], [125000, 2, 0]] as [$price, $quantity, $fee]) {
            $product->forceFill(['price_cents' => $price])->save();
            $items = [['product_id' => $product->id, 'quantity' => $quantity]];
            $response = $this->postJson(self::QUOTE, compact('items', 'address'))->assertOk()
                ->assertJsonPath('data.subtotal_cents', $price * $quantity)
                ->assertJsonPath('data.shipping_options.0.method', 'pickup')
                ->assertJsonPath('data.shipping_options.0.shipping_cents', 0)
                ->assertJsonPath('data.shipping_options.1.method', 'delivery')
                ->assertJsonPath('data.shipping_options.1.shipping_cents', $fee)
                ->assertJsonPath('data.shipping_options.1.total_cents', $price * $quantity + $fee);
            $response->assertJsonMissingPath('data.shipping_options.0.free_delivery_applied');
            if ($fee === 0) {
                $response->assertJsonPath('data.shipping_options.1.free_delivery_applied', true);
            } else {
                $response->assertJsonMissingPath('data.shipping_options.1.free_delivery_applied');
            }
        }
        $this->postJson(self::QUOTE, ['items' => $items])->assertOk()
            ->assertJsonPath('data.shipping_options.1.shipping_cents', 3500);
        $this->postJson(self::QUOTE, ['items' => $items, 'address' => [...$address, 'department_id' => 1]])
            ->assertUnprocessable()->assertJsonValidationErrors('address.locality_id');
        $settings->forceFill(['values' => [...$settings->values, 'free_delivery_enabled' => false]])->save();
        $this->postJson(self::QUOTE, compact('items', 'address'))->assertOk()
            ->assertJsonPath('data.shipping_options.1.shipping_cents', 3500);
        $settings->forceFill(['values' => [...$settings->values, 'free_delivery_enabled' => true, 'delivery_cents' => null]])->save();
        $this->postJson(self::QUOTE, compact('items', 'address'))->assertOk()
            ->assertJsonCount(1, 'data.shipping_options')->assertJsonPath('data.shipping_options.0.method', 'pickup');
    }

    public function test_free_delivery_requotes_before_placing_an_order_and_only_charges_the_stored_total(): void
    {
        config([
            'app.url' => 'https://camba.example.test', 'mercadopago.access_token' => 'fake-local-test',
            'mercadopago.collector_id' => '234', 'mercadopago.webhook_secret' => 'local-signature-test',
            'mercadopago.live' => false, 'mercadopago.checkout_orders' => true,
            'checkout.checkout_pro_reservation_minutes' => 10,
        ]);
        Http::preventStrayRequests();
        $product = $this->product(cents: 125000);
        $items = $this->items($product);
        $settings = StoreSettings::query()->findOrFail(1);
        $threshold = ['free_delivery_enabled' => true, 'free_delivery_minimum_cents' => 250000];
        $settings->forceFill(['values' => $threshold])->save();
        $payload = $this->payload($items, 'delivery', '');
        $quote = $this->postJson(self::QUOTE, ['items' => $items, 'address' => array_intersect_key($payload['address'], array_flip(['department_id', 'locality_id']))])
            ->assertOk()->assertJsonPath('data.shipping_options.1.shipping_cents', 0);
        $this->keepSession($quote);
        $payload['quote_token'] = $quote->json('data.shipping_options.1.quote_token');

        $settings->forceFill(['values' => [...$threshold, 'free_delivery_minimum_cents' => 250001]])->save();
        $this->place($payload)->assertConflict();
        $this->assertDatabaseCount('orders', 0);
        $this->assertSame(10, $product->fresh()->stock);
        $settings->forceFill(['values' => $threshold])->save();
        $key = (string) Str::uuid();
        $reference = $this->place($payload, $key)->assertCreated()
            ->assertJsonPath('data.shipping_cents', 0)->assertJsonPath('data.total_cents', 250000)->json('data.reference');
        $settings->forceFill(['values' => [...$threshold, 'free_delivery_enabled' => false]])->save();
        $this->place($payload, $key)->assertOk()->assertJsonPath('data.total_cents', 250000);
        $this->assertDatabaseHas('orders', ['reference' => $reference, 'shipping_cents' => 0, 'total_cents' => 250000]);

        $endpoint = 'https://api.mercadopago.com/v1/orders';
        $providerId = 'ORDTST01M8CNM554AA2N9KGGJBWNM6H4';
        $checkoutUrl = 'https://www.mercadopago.com.uy/checkout/v1/redirect?order_id='.$providerId;
        Http::fake([$endpoint => fn ($request) => Http::response([
            'id' => $providerId, 'external_reference' => $request['external_reference'], 'status' => 'created',
            'user_id' => '234', 'currency' => 'UYU', 'type' => 'online', 'processing_mode' => 'manual',
            'capture_mode' => 'automatic', 'total_amount' => '2500.00', 'expiration_time' => 'PT10M',
            'created_date' => now()->toISOString(), 'last_updated_date' => now()->toISOString(), 'checkout_url' => $checkoutUrl,
        ], 201)]);
        $this->postJson(self::ORDERS."/$reference/payments", [], ['Idempotency-Key' => (string) Str::uuid()])
            ->assertCreated()->assertJsonPath('data.checkout_url', $checkoutUrl);
        Http::assertSentCount(1);
        Http::assertSent(fn ($request) => $request->url() === $endpoint && $request['total_amount'] === '2500.00'
            && count($request['items']) === 1 && $request['items'][0]['quantity'] === 2 && $request['items'][0]['unit_price'] === '1250.00');
    }

    public function test_one_admin_notice_for_new_pending_order_and_checkout_replay(): void
    {
        Queue::fake();
        config(['app.admin_url' => 'https://admin.camba.test', 'mail.default' => 'array']);
        $owner = User::factory()->create(['role' => 'admin']);
        $items = $this->items($this->product());
        $payload = $this->payload($items, 'pickup', $this->quote($items, 'pickup'));
        $key = (string) Str::uuid();
        $reference = $this->place($payload, $key)->assertCreated()->assertJsonPath('data.status', 'pending_payment')->json('data.reference');
        $this->place($payload, $key)->assertOk()->assertJsonPath('data.reference', $reference);
        $order = Order::where('reference', $reference)->sole();

        $notice = CommerceNotice::where('kind', 'admin_order_created')->where('subject_id', $order->id)->sole();
        $this->artisan('camba:notices')->assertSuccessful();
        $this->assertDatabaseHas('commerce_notices', ['channel' => 'panel', 'kind' => 'order_created', 'subject_id' => $order->id]);
        $this->app->call([new SendCommerceNotice($notice->id), 'handle']);
        $this->app->call([new SendCommerceNotice($notice->id), 'handle']);

        $messages = Mail::mailer('array')->getSymfonyTransport()->messages();
        $this->assertCount(1, $messages);
        $mail = $messages->first()->getOriginalMessage();
        $this->assertSame('Nuevo pedido en Camba', $mail->getSubject());
        $this->assertSame($owner->email, $mail->getTo()[0]->getAddress());
        foreach (['Modalidad: Retiro', 'Pago: Pendiente de pago', 'Total: UYU 246,90', 'https://admin.camba.test/pedidos/'.$reference] as $line) {
            $this->assertStringContainsString($line, $mail->getTextBody());
        }
        $this->assertStringContainsString('Ver pedido', $mail->getHtmlBody());
    }

    public function test_admin_mail_cannot_follow_an_address_change_or_an_ambiguous_admin(): void
    {
        config(['app.admin_url' => 'https://admin.camba.test', 'mail.default' => 'array']);
        $admin = User::factory()->create(['role' => 'admin']);
        $items = $this->items($this->product());
        $payload = $this->payload($items, 'pickup', $this->quote($items, 'pickup'));
        $this->place($payload)->assertCreated();
        $bound = CommerceNotice::where('kind', 'admin_order_created')->sole();
        $admin->forceFill(['email' => 'changed-admin@camba.test'])->save();
        $this->app->call([new SendCommerceNotice($bound->id), 'handle']);
        $this->assertDatabaseHas('commerce_notices', ['id' => $bound->id, 'state' => 'cancelled', 'attempts' => 0]);

        $other = User::factory()->unverified()->create(['role' => 'admin']);
        $this->place($payload)->assertCreated();
        $ambiguous = CommerceNotice::where('kind', 'admin_order_created')->latest('id')->firstOrFail();
        $this->assertDatabaseHas('commerce_notices', ['id' => $ambiguous->id, 'state' => 'cancelled', 'error_code' => 'no_eligible_admin']);
        $other->delete();
        $this->app->call([new SendCommerceNotice($ambiguous->id), 'handle']);
        $this->assertCount(0, Mail::mailer('array')->getSymfonyTransport()->messages());
    }

    public function test_checkout_does_not_commit_order_or_stock_without_its_mail_notice(): void
    {
        $product = $this->product();
        $items = $this->items($product);
        $payload = $this->payload($items, 'pickup', $this->quote($items, 'pickup'));
        $event = 'eloquent.creating: '.CommerceNotice::class;
        Event::listen($event, function (): never {
            throw new RuntimeException('Synthetic ledger write failure.');
        });
        try {
            $this->place($payload)->assertServerError();
        } finally {
            Event::forget($event);
        }

        $this->assertDatabaseCount('orders', 0);
        $this->assertDatabaseCount('commerce_notices', 0);
        $this->assertSame(10, $product->refresh()->stock);
    }

    public function test_quote_rejects_an_incoherent_geography(): void
    {
        $items = $this->items($this->product());
        $foreign = (int) DB::table('localities')->where('department_id', 1)->orderBy('id')->value('id');
        $this->postJson(self::QUOTE, ['items' => $items, 'address' => ['department_id' => 10, 'locality_id' => $foreign]])
            ->assertUnprocessable()->assertJsonValidationErrors('address.locality_id');
        $token = $this->quote($items, 'delivery');
        $payload = $this->payload($items, 'delivery', $token);
        $this->postJson(self::QUOTE, [
            'items' => $items, 'address' => array_intersect_key($payload['address'], array_flip(['department_id', 'locality_id'])),
        ])->assertOk()->assertJsonPath('data.shipping_options.1.quote_token', $token);
        $payload['address']['locality_id'] = $foreign;
        $this->place($payload)->assertUnprocessable()->assertJsonValidationErrors('address.locality_id');
        $this->assertDatabaseCount('orders', 0);
    }

    public function test_checkout_accepts_the_quoted_terms_revision_and_rejects_stale_terms(): void
    {
        $product = $this->product();
        $items = $this->items($product);
        $quote = $this->postJson(self::QUOTE, ['items' => $items])->assertOk();
        $this->keepSession($quote);
        $payload = $this->payload($items, 'pickup', $quote->json('data.shipping_options.0.quote_token'));

        $this->place([...$payload, 'terms_version' => '2026-11-27'])->assertConflict();
        $this->assertDatabaseCount('orders', 0);
        $this->assertSame(10, $product->fresh()->stock);

        $this->place([...$payload, 'terms_version' => $quote->json('data.terms_version')])
            ->assertCreated()->assertJsonPath('data.terms_version', PurchaseTerms::VERSION);
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
            ->assertJsonPath('data.address.department_id', 10)
            ->assertJsonPath('data.address.locality_id', $payload['address']['locality_id'])
            ->assertJsonPath('data.address.department', 'Montevideo')
            ->assertJsonPath('data.address.locality', 'Montevideo')
            ->assertJsonPath('data.contact.email', 'buyer@example.test')
            ->assertJsonMissingPath('data.owner_key')
            ->assertJsonMissingPath('data.idempotency_key');
        $reference = $created->json('data.reference');
        $this->assertTrue(Str::isUuid($reference));
        $this->assertNotNull($created->json('data.reservation_expires_at'));
        $created->assertJsonPath('data.guest_access_expires_at', null);
        $this->assertDatabaseHas('orders', ['reference' => $reference, 'total_cents' => 28388, 'stock_released_at' => null]);
        $stored = DB::table('orders')->where('reference', $reference)->first();
        $created->assertJsonPath('data.terms_version', PurchaseTerms::VERSION);
        $this->assertSame(PurchaseTerms::VERSION, $stored->terms_version);
        $accountEmail = User::query()->findOrFail($stored->user_id)->email;
        $this->assertNotSame($payload['contact']['email'], $accountEmail);
        $this->assertSame([$accountEmail, $reference], app(NoticeEligibility::class)->recipient(
            new CommerceNotice(['kind' => 'order_created', 'subject_id' => $stored->id]),
        ));
        $mail = new CommerceNoticeMail(1, 'order_created', $reference, Order::query()->where('reference', $reference)->firstOrFail());
        $this->assertStringContainsString(PurchaseTerms::withdrawal(), $mail->render());
        $this->assertStringContainsString('terminos-y-condiciones?version='.PurchaseTerms::VERSION, $mail->render());
        $this->assertStringNotContainsString('buyer@example.test', $stored->contact);
        $this->assertStringNotContainsString('0123B', $stored->address);
        $this->assertDatabaseCount('order_items', 2);
        $this->assertSame(8, $first->fresh()->stock);
        $this->assertSame(0, $second->fresh()->stock);

        $first->update(['name' => 'Later Name', 'price_cents' => 9999]);
        DB::table('localities')->where('id', $payload['address']['locality_id'])->update(['name' => 'Renamed later']);
        config(['checkout.delivery_cents' => 9900]);
        $this->place([...$payload, 'items' => array_reverse($items)], $key)->assertOk()
            ->assertJsonPath('data.reference', $reference)->assertJsonPath('data.total_cents', 28388)
            ->assertJsonPath('data.address.locality', 'Montevideo');
        $this->place([...$payload, 'contact' => ['name' => 'Other Buyer', 'email' => 'buyer@example.test']], $key)
            ->assertConflict();
        $this->getJson(self::ORDERS.'/'.$reference)->assertOk()->assertJsonPath('data.items.0.name', 'Test Product 1');
        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseCount('order_items', 2);
        $this->assertSame(8, $first->fresh()->stock);
        $this->assertSame(0, $second->fresh()->stock);
    }

    public function test_admin_can_record_only_the_refunded_payment_linked_to_the_purchase(): void
    {
        $product = $this->product();
        $items = $this->items($product);
        $payload = $this->payload($items, 'pickup', $this->quote($items, 'pickup'));
        $reference = $this->place($payload, (string) Str::uuid())->assertCreated()->json('data.reference');
        $order = Order::query()->where('reference', $reference)->firstOrFail();
        $receipt = $this->postJson('/api/v1/withdrawals', [
            'order_reference' => $reference, 'email' => User::findOrFail($order->user_id)->email,
        ])->assertCreated()->json('data.reference');
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        $this->getJson('/api/v1/admin/withdrawals')->assertOk()->assertJsonPath('data.0.order_matched', true);
        $path = '/api/v1/admin/withdrawals/'.$receipt;
        $this->patchJson($path, ['action' => 'confirm_refund'])->assertConflict();
        $this->patchJson($path, ['action' => 'review'])->assertOk();

        $order->forceFill(['status' => 'refunded', 'paid_provider_payment_id' => '1209876', 'paid_at' => now()])->save();
        $payment = Payment::query()->forceCreate([
            'order_id' => $order->id, 'provider_payment_id' => '1209876', 'status' => 'refunded',
            'amount_cents' => $order->total_cents - 1, 'provider_updated_at' => '2026-11-27T14:00:00.000Z',
        ]);
        $this->patchJson($path, ['action' => 'confirm_refund'])->assertConflict();
        $payment->forceFill(['amount_cents' => $order->total_cents])->save();
        $done = $this->patchJson($path, ['action' => 'confirm_refund'])->assertOk()
            ->assertJsonPath('data.refund_reference', '1209876')->assertJsonPath('data.status', 'refunded');
        $this->patchJson($path, ['action' => 'confirm_refund'])->assertExactJson($done->json());
        $this->assertSame('refunded', $payment->fresh()->status->value);
        $notice = CommerceNotice::query()->where('kind', 'buyer_withdrawal_resolved')->sole();
        $this->assertSame('withdrawal', $notice->subject_type);
        Mail::fake();
        app(DeliverCommerceNotice::class)->execute($notice->id);
        Mail::assertSent(CommerceNoticeMail::class, fn ($mail) => $mail->hasTo(User::findOrFail($order->user_id)->email)
            && $mail->envelope()->subject === 'Camba: resolvimos tu solicitud de arrepentimiento'
            && str_contains($mail->render(), $receipt));
    }

    public function test_checkout_rejects_stale_quotes_invalid_lines_and_unavailable_stock_atomically(): void
    {
        $first = $this->product();
        $second = $this->product(stock: 2);
        $items = [$this->items($first)[0], $this->items($second)[0]];
        $this->keepSession($this->getJson('/api/v1/cart')->assertOk());
        foreach ($items as $item) {
            $this->putJson('/api/v1/cart/items/'.$item['product_id'], ['quantity' => $item['quantity']])->assertOk();
        }
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
        $this->getJson('/api/v1/cart')->assertOk()->assertJsonCount(2, 'data.items')
            ->assertJsonPath('data.items.0.quantity', 2)->assertJsonPath('data.items.1.quantity', 2);
        $this->assertDatabaseCount('cart_items', 2);
    }

    public function test_single_unit_pending_checkout_keeps_both_carts_and_cannot_be_reserved_twice(): void
    {
        $product = $this->product(stock: 1);
        $items = [['product_id' => $product->id, 'quantity' => 1]];
        $this->keepSession($this->getJson('/api/v1/cart')->assertOk());
        $this->putJson('/api/v1/cart/items/'.$product->id, ['quantity' => 1])->assertOk();
        $ownerSession = $this->app['session']->driver()->getId();
        $payload = $this->payload($items, 'pickup', $this->quote($items, 'pickup'));

        $this->useSession('competing-checkout-session');
        $this->login(User::factory()->create());
        $this->keepSession($this->getJson('/api/v1/cart')->assertOk());
        $this->putJson('/api/v1/cart/items/'.$product->id, ['quantity' => 1])->assertOk();
        $otherSession = $this->app['session']->driver()->getId();
        $otherPayload = $this->payload($items, 'pickup', $this->quote($items, 'pickup'));

        $this->useSession($ownerSession);
        $key = (string) Str::uuid();
        $reference = $this->place($payload, $key)->assertCreated()
            ->assertJsonPath('data.status', 'pending_payment')->json('data.reference');
        $this->assertSame(0, $product->fresh()->stock);
        $this->assertDatabaseHas('orders', ['reference' => $reference, 'stock_released_at' => null]);
        $this->assertDatabaseCount('order_items', 1);
        $this->useSession($ownerSession);
        $this->getJson('/api/v1/cart')->assertOk()->assertJsonPath('data.items.0.quantity', 1);
        $this->place($payload, $key)->assertOk()->assertJsonPath('data.reference', $reference);
        $this->getJson('/api/v1/cart')->assertOk()->assertJsonPath('data.items.0.quantity', 1);

        $this->useSession($otherSession);
        $this->place($otherPayload)->assertUnprocessable()->assertJsonValidationErrors('items');
        $this->getJson('/api/v1/cart')->assertOk()->assertJsonPath('data.items.0.quantity', 1);
        $this->assertDatabaseCount('cart_items', 2);
        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseCount('order_items', 1);
        $this->assertSame(0, $product->fresh()->stock);
    }

    public function test_checkout_keeps_edits_until_verified_payment_consumes_only_purchased_quantities_once(): void
    {
        $this->login(User::factory()->create());
        $partial = $this->product();
        $removed = $this->product();
        $untouched = $this->product();
        $outsideCart = $this->product();
        foreach ([[$partial, 3], [$removed, 1], [$untouched, 2]] as [$product, $quantity]) {
            $this->putJson('/api/v1/cart/items/'.$product->id, ['quantity' => $quantity])->assertOk();
        }
        $items = [...$this->items($partial), ...$this->items($removed), ...$this->items($outsideCart)];
        $payload = $this->payload($items, 'pickup', $this->quote($items, 'pickup'));
        $key = (string) Str::uuid();
        $reference = $this->place($payload, $key)->assertCreated()->json('data.reference');
        $this->getJson('/api/v1/cart')->assertOk()->assertJsonCount(3, 'data.items')
            ->assertJsonPath('data.items.0.product_id', $partial->id)->assertJsonPath('data.items.0.quantity', 3)
            ->assertJsonPath('data.items.1.product_id', $removed->id)->assertJsonPath('data.items.1.quantity', 1)
            ->assertJsonPath('data.items.2.product_id', $untouched->id)->assertJsonPath('data.items.2.quantity', 2);
        $this->assertDatabaseMissing('cart_items', ['product_id' => $outsideCart->id]);
        $this->place($payload, $key)->assertOk()->assertJsonPath('data.reference', $reference);
        $this->getJson('/api/v1/cart')->assertOk()->assertJsonPath('data.items.0.quantity', 3);

        $this->putJson('/api/v1/cart/items/'.$partial->id, ['quantity' => 2])->assertOk();
        $this->putJson('/api/v1/cart/items/'.$removed->id, ['quantity' => 3])->assertOk();
        $this->place($payload, $key)->assertOk()->assertJsonPath('data.reference', $reference);
        $this->app['session']->driver()->flush();
        $this->getJson('/api/v1/cart')->assertOk()->assertJsonCount(3, 'data.items')
            ->assertJsonPath('data.items.0.quantity', 2)->assertJsonPath('data.items.1.quantity', 3)
            ->assertJsonPath('data.items.2.quantity', 2);
        $this->assertDatabaseCount('orders', 1);
        $this->assertDatabaseCount('order_items', 3);
        $this->assertSame(8, $partial->fresh()->stock);
        $this->assertSame(8, $removed->fresh()->stock);
        $this->assertSame(10, $untouched->fresh()->stock);
        $this->assertSame(8, $outsideCart->fresh()->stock);

        $order = Order::where('reference', $reference)->sole();
        $evidence = [[
            'reference' => $reference, 'status' => 'approved', 'id' => '173159',
            'updated_at' => now()->format('Y-m-d\TH:i:s.v\Z'), 'amount_cents' => $order->total_cents,
        ]];
        $apply = app(ApplyPaymentEvidence::class);
        $this->assertSame('verified', $apply->execute($reference, $evidence));
        $this->assertSame('verified', $apply->execute($reference, $evidence));
        $this->getJson(self::ORDERS.'/'.$reference)->assertOk()->assertJsonPath('data.status', 'paid');
        $this->getJson('/api/v1/cart')->assertOk()->assertJsonCount(2, 'data.items')
            ->assertJsonPath('data.items.0.product_id', $removed->id)->assertJsonPath('data.items.0.quantity', 1)
            ->assertJsonPath('data.items.1.product_id', $untouched->id)->assertJsonPath('data.items.1.quantity', 2)
            ->assertJsonPath('data.checkout', null);
    }

    public function test_history_and_references_are_scoped_to_account_or_unexpired_guest_session(): void
    {
        $product = $this->product();
        $items = $this->items($product);
        $key = (string) Str::uuid();
        $guestSession = Str::random(40);
        $token = $this->quote($items, 'pickup');
        $guestOrder = $this->place($this->payload($items, 'pickup', $token), $key)
            ->assertCreated()->json('data.reference');
        Order::where('reference', $guestOrder)->sole()->forceFill([
            'user_id' => null,
            'owner_key' => Order::ownerKey(null, $guestSession),
            'guest_access_expires_at' => now()->addDay(),
        ])->save();
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
        $this->place($this->payload($items, 'pickup', $token), $key)->assertUnauthorized();
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
                'department_id' => 10,
                'locality_id' => (int) DB::table('localities')->where(['department_id' => 10, 'name' => 'Montevideo'])->value('id'),
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
