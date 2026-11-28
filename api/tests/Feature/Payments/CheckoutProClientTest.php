<?php

namespace Tests\Feature\Payments;

use App\Payments\CheckoutProClient;
use App\Payments\PaymentWebhookSignature;
use Illuminate\Http\Client\Request as Outgoing;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use MercadoPago\Net\MPRequest;
use PHPUnit\Framework\Attributes\BackupGlobals;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class CheckoutProClientTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config([
            'app.url' => 'https://camba.example.test',
            'mercadopago.access_token' => 'fake-local-test',
            'mercadopago.collector_id' => '234',
            'mercadopago.webhook_secret' => 'fake-webhook-secret',
            'mercadopago.live' => false,
        ]);
        Http::preventStrayRequests();
    }

    #[BackupGlobals(true)]
    public function test_configuration_reads_canonical_keys_and_keeps_the_legacy_token_when_unset(): void
    {
        $_SERVER['CAMBA_MP_ACCESS_TOKEN'] = $_ENV['CAMBA_MP_ACCESS_TOKEN'] = 'synthetic-legacy-token';
        $_SERVER['MERCADOPAGO_ACCESS_TOKEN'] = $_ENV['MERCADOPAGO_ACCESS_TOKEN'] = 'synthetic-new-token';
        $_SERVER['MERCADOPAGO_PUBLIC_KEY'] = $_ENV['MERCADOPAGO_PUBLIC_KEY'] = 'synthetic-public-key';

        $config = require config_path('mercadopago.php');
        $this->assertSame('synthetic-new-token', $config['access_token']);
        $this->assertSame('synthetic-public-key', $config['public_key']);

        $_SERVER['MERCADOPAGO_ACCESS_TOKEN'] = $_ENV['MERCADOPAGO_ACCESS_TOKEN'] = 'X';
        $_SERVER['MERCADOPAGO_PUBLIC_KEY'] = $_ENV['MERCADOPAGO_PUBLIC_KEY'] = 'X';

        $config = require config_path('mercadopago.php');
        $this->assertSame('synthetic-legacy-token', $config['access_token']);
        $this->assertNull($config['public_key']);

        $_SERVER['CAMBA_MP_ACCESS_TOKEN'] = $_ENV['CAMBA_MP_ACCESS_TOKEN'] = '';
        $_SERVER['CAMBA_MP_COLLECTOR_ID'] = $_ENV['CAMBA_MP_COLLECTOR_ID'] = '234';

        config(['mercadopago' => require config_path('mercadopago.php')]);
        $this->assertFalse(app(CheckoutProClient::class)->isConfigured());
    }

    public function test_creates_uyu_preference_from_immutable_lines_only(): void
    {
        $url = 'https://www.mercadopago.com.uy/checkout/v1/redirect?pref_id=234-example&test=one%2Ftwo';
        Http::fake(['https://api.mercadopago.com/checkout/preferences' => Http::response([
            'collector_id' => 234,
            'id' => '234-example',
            'init_point' => $url,
            'sandbox_init_point' => 'https://sandbox.mercadopago.com.uy/checkout/v1/redirect?pref_id=234-example',
        ], 201)]);

        $id = 'b3e2ef7f-59aa-4947-a92e-f594d166bcaf';
        $this->assertSame(['id' => '234-example', 'url' => $url], app(CheckoutProClient::class)->preference(
            $id, [['sku' => 'CAM-01', 'name' => 'Remera', 'quantity' => 2, 'unit_price_cents' => 89005]], 12000, now()->addMinutes(15),
        ));
        Http::assertSent(fn (Outgoing $request) => $request->hasHeader('Authorization', 'Bearer fake-local-test')
            && str_starts_with($request->header('User-Agent')[0] ?? '', 'MercadoPago DX-PHP SDK/')
            && $request['items'] === [
                ['id' => 'CAM-01', 'title' => 'Remera', 'currency_id' => 'UYU', 'quantity' => 2, 'unit_price' => 890.05],
                ['id' => 'shipping', 'title' => 'Entrega', 'currency_id' => 'UYU', 'quantity' => 1, 'unit_price' => 120],
            ]
            && $request['external_reference'] === $id
            && $request['back_urls'] === array_fill_keys(
                ['success', 'pending', 'failure'],
                "https://camba.example.test/pedidos/$id?retorno=mercadopago",
            )
            && $request['notification_url'] === 'https://camba.example.test/api/v1/webhooks/mercadopago?source_news=webhooks'
            && $request['expires'] === true
            && ! isset($request['payer']));
    }

    public static function invalidInitPoints(): array
    {
        return [
            'sandbox only' => [null],
            'insecure scheme' => ['http://www.mercadopago.com.uy/checkout'],
            'untrusted domain' => ['https://www.mercadopago.com.uy.invalid/checkout'],
            'user info' => ['https://name@www.mercadopago.com.uy/checkout'],
            'unexpected port' => ['https://www.mercadopago.com.uy:8443/checkout'],
        ];
    }

    public static function preferencePolicies(): array
    {
        return [
            'one installment' => [['payment_methods' => ['installments' => 1, 'default_installments' => 1]]],
            'explicit window' => [[
                'expires' => true,
                'expiration_date_from' => '2026-11-26T17:47:00.000+00:00',
                'expiration_date_to' => '2026-11-26T17:53:40.000+00:00',
            ]],
        ];
    }

    #[DataProvider('preferencePolicies')]
    public function test_sends_checkout_preference_policy(array $expected): void
    {
        $this->travelTo(Carbon::parse('2026-11-26T17:47:00Z'));
        Http::fake(['https://api.mercadopago.com/checkout/preferences' => Http::response([
            'collector_id' => 234,
            'id' => '234-example',
            'init_point' => 'https://www.mercadopago.com.uy/checkout/v1/redirect?pref_id=234-example',
        ], 201)]);

        app(CheckoutProClient::class)->preference('test-reference', [], 0, now()->addMinutes(6)->addSeconds(40));

        $payload = Http::recorded()->sole()[0]->data();
        foreach ($expected as $key => $value) {
            $this->assertSame($value, $payload[$key] ?? null, $key);
        }
    }

    #[DataProvider('invalidInitPoints')]
    public function test_does_not_redirect_to_invalid_init_point_or_fall_back_to_sandbox(?string $url): void
    {
        Http::fake(['https://api.mercadopago.com/checkout/preferences' => Http::response([
            'collector_id' => 234,
            'id' => '234-example',
            'init_point' => $url,
            'sandbox_init_point' => 'https://sandbox.mercadopago.com.uy/checkout/v1/redirect?pref_id=234-example',
        ], 201)]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Mercado Pago returned an invalid preference.');
        app(CheckoutProClient::class)->preference('test-reference', [], 0, now()->addMinutes(10));
    }

    public function test_server_lookup_normalizes_exact_cents_excluding_provider_pii(): void
    {
        Http::fake(['https://api.mercadopago.com/v1/payments/159' => Http::response([
            'id' => 159, 'external_reference' => 'opaque-reference', 'collector_id' => 234,
            'currency_id' => 'UYU', 'status' => 'approved', 'live_mode' => false,
            'transaction_amount' => '1780.10', 'date_last_updated' => '2026-05-01T14:04:11.012-03:00',
            'payer' => ['email' => 'synthetic@example.test'],
        ])]);
        $payment = app(CheckoutProClient::class)->payment('159');
        $this->assertSame(178010, $payment['amount_cents']);
        $this->assertSame('opaque-reference', $payment['reference']);
        $this->assertSame('approved', $payment['status']);
        $this->assertSame('2026-05-01T17:04:11.012Z', $payment['updated_at']);
        $this->assertArrayNotHasKey('payer', $payment);
    }

    public function test_unexpected_merchant_is_not_accepted(): void
    {
        Http::fake(['https://api.mercadopago.com/v1/payments/159' => Http::response([
            'id' => 159, 'collector_id' => 123, 'currency_id' => 'UYU', 'status' => 'approved',
            'transaction_amount' => 1780, 'live_mode' => false, 'external_reference' => 'ref',
            'date_last_updated' => '2026-05-01T14:04:11-03:00',
        ])]);
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Mercado Pago returned an invalid payment.');
        app(CheckoutProClient::class)->payment('159');
    }

    public function test_reconciliation_reads_each_search_page_before_returning_ids(): void
    {
        Http::fake(['https://api.mercadopago.com/v1/payments/search*' => Http::sequence()
            ->push(['paging' => ['total' => 51], 'results' => array_map(fn (int $id) => ['id' => $id], range(1, 50))])
            ->push(['paging' => ['total' => 51], 'results' => [['id' => 51]]])]);
        $this->assertSame(array_map('strval', range(1, 51)), app(CheckoutProClient::class)->searchIds('a-ref'));
        Http::assertSentCount(2);
        Http::assertSent(fn (Outgoing $request) => str_contains($request->url(), 'external_reference=a-ref')
            && str_contains($request->url(), 'offset=50'));
    }

    public function test_throttled_provider_errors_are_not_mistaken_for_an_empty_search(): void
    {
        Http::fake(['https://api.mercadopago.com/v1/payments/search*' => Http::response([
            'message' => 'private provider payload',
        ], 429)]);
        $this->expectException(RuntimeException::class);
        $this->expectExceptionCode(429);
        $this->expectExceptionMessage('Mercado Pago request failed.');
        app(CheckoutProClient::class)->searchIds('a-ref');
    }

    public function test_preference_transport_does_not_retry_or_expose_provider_error_body(): void
    {
        Http::fake(['https://api.mercadopago.com/checkout/preferences' => Http::response([
            'message' => 'private provider payload',
        ], 429)]);

        try {
            app(CheckoutProClient::class)->preference('test-reference', [], 0, now()->addMinutes(10));
            $this->fail('A throttled preference was accepted.');
        } catch (RuntimeException $exception) {
            $this->assertSame(429, $exception->getCode());
            $this->assertSame('Mercado Pago request failed.', $exception->getMessage());
        }
        Http::assertSentCount(1);
    }

    public function test_sdk_transport_only_sends_preference_creation(): void
    {
        Http::fake();
        foreach ([new MPRequest('/checkout/preferences', 'GET'), new MPRequest('https://example.test/', 'POST')] as $request) {
            try {
                app(CheckoutProClient::class)->send($request);
                $this->fail('An unexpected SDK request was accepted.');
            } catch (RuntimeException $exception) {
                $this->assertSame('Unexpected Mercado Pago SDK request.', $exception->getMessage());
            }
        }
        Http::assertNothingSent();
    }

    public function test_signed_payment_resource_is_taken_from_the_exact_query_parameter(): void
    {
        $id = '159';
        $ts = (string) now()->getTimestampMs();
        $signature = hash_hmac('sha256', "id:$id;request-id:request-abc;ts:$ts;", 'fake-webhook-secret');
        $headers = ['HTTP_X_REQUEST_ID' => 'request-abc', 'HTTP_X_SIGNATURE' => "ts=$ts,v1=$signature"];
        $valid = Request::create('/api/v1/webhooks/mercadopago?data.id=159&type=payment', 'POST', server: $headers);
        $this->assertSame($id, app(PaymentWebhookSignature::class)->paymentId($valid));
        foreach (['data.id=160', 'data.id=159&data.id=159', 'data_id=159'] as $query) {
            try {
                app(PaymentWebhookSignature::class)->paymentId(Request::create("/?$query", 'POST', server: $headers));
                $this->fail('The invalid webhook target was accepted.');
            } catch (HttpException $exception) {
                $this->assertSame(401, $exception->getStatusCode());
            }
        }
    }

    public static function signatureTimes(): array
    {
        return [
            'seconds at limit' => [300_000, false, true],
            'milliseconds at limit' => [-300_000, true, true],
            'stale seconds' => [-301_000, false, false],
            'future milliseconds outside limit' => [300_001, true, false],
        ];
    }

    #[DataProvider('signatureTimes')]
    public function test_webhook_timestamp_window_preserves_the_original_manifest(int $offsetMs, bool $milliseconds, bool $valid): void
    {
        $this->travelTo(Carbon::parse('2026-11-26T18:00:00Z'));
        $time = now()->getTimestampMs() + $offsetMs;
        $timestamp = (string) ($milliseconds ? $time : intdiv($time, 1000));
        $v1 = hash_hmac('sha256', "id:159;request-id:window-test;ts:$timestamp;", 'fake-webhook-secret');
        $request = Request::create('/?data.id=159', 'POST', server: [
            'HTTP_X_REQUEST_ID' => 'window-test',
            'HTTP_X_SIGNATURE' => "ts=$timestamp,v1=$v1",
        ]);
        if (! $valid) {
            $this->expectException(HttpException::class);
            $this->expectExceptionCode(0);
        }

        $this->assertSame('159', app(PaymentWebhookSignature::class)->paymentId($request));
    }
}
