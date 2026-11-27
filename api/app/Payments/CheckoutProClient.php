<?php

namespace App\Payments;

use Carbon\CarbonImmutable;
use DateInterval;
use DateTimeInterface;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use MercadoPago\Client\Common\RequestOptions;
use MercadoPago\Client\Preference\PreferenceClient;
use MercadoPago\Net\MPHttpClient;
use MercadoPago\Net\MPRequest;
use MercadoPago\Net\MPResponse;
use Ramsey\Uuid\Uuid;
use RuntimeException;
use TypeError;

class CheckoutProClient implements MPHttpClient
{
    private const API = 'https://api.mercadopago.com';

    private const CHECKOUT_HOSTS = ['www.mercadopago.com.uy', 'mercadopago.com.uy', 'www.mercadopago.com', 'mercadopago.com'];

    /** @param list<array{sku:string,name:string,quantity:int,unit_price_cents:int}> $lines */
    public function preference(string $reference, array $lines, int $shippingCents, DateTimeInterface $expires, ?int $attemptId = null): array
    {
        $origin = $this->publicOrigin();
        if ($origin === null) {
            throw new RuntimeException('Checkout Pro needs a public HTTPS storefront origin.');
        }
        $items = array_map(fn (array $line) => [
            'id' => $line['sku'],
            'title' => $line['name'],
            'currency_id' => 'UYU',
            'quantity' => $line['quantity'],
            'unit_price' => $line['unit_price_cents'] / 100,
        ], $lines);
        if ($shippingCents > 0) {
            $items[] = [
                'id' => 'shipping', 'title' => 'Entrega', 'currency_id' => 'UYU', 'quantity' => 1,
                'unit_price' => $shippingCents / 100,
            ];
        }
        $returnUrl = $origin.'/pedidos/'.rawurlencode($reference).'?retorno=mercadopago';
        $request = [
            'items' => $items,
            'external_reference' => $attemptId === null ? $reference : self::attemptReference($reference, $attemptId),
            'back_urls' => ['success' => $returnUrl, 'pending' => $returnUrl, 'failure' => $returnUrl],
            'notification_url' => $origin.'/api/v1/webhooks/mercadopago?source_news=webhooks',
            'auto_return' => 'approved',
            'binary_mode' => true,
            'payment_methods' => ['installments' => 1, 'default_installments' => 1],
            'expires' => true,
            'expiration_date_from' => now()->format('Y-m-d\TH:i:s.vP'),
            'expiration_date_to' => $expires->format('Y-m-d\TH:i:s.vP'),
        ];
        try {
            $options = new RequestOptions(access_token: (string) config('mercadopago.access_token'), connection_timeout: 3);
            $preference = (new PreferenceClient($this))->create($request, $options);
        } catch (TypeError) {
            throw new RuntimeException('Mercado Pago returned an invalid preference.');
        }
        $payload = $preference->getResponse()->getContent();
        $url = $payload['init_point'] ?? null;
        $id = $payload['id'] ?? null;
        if (! is_string($id) || ! preg_match('/\A[A-Za-z0-9-]{1,128}\z/', $id) ||
            ! $this->expectedCollector($payload) || ! self::isCheckoutUrl($url)) {
            throw new RuntimeException('Mercado Pago returned an invalid preference.');
        }

        return ['id' => $id, 'url' => $url];
    }

    public function orderPayload(string $reference, int $attemptId, array $lines, int $shipping, int $total): array
    {
        $origin = $this->publicOrigin() ?? throw new RuntimeException('Checkout Pro needs a public HTTPS storefront origin.');
        $amount = fn (int $cents): string => sprintf('%d.%02d', intdiv($cents, 100), $cents % 100);
        if ($lines === [] || $shipping < 0 || $total <= 0
            || array_sum(array_map(fn (array $line) => $line['quantity'] * $line['unit_price_cents'], $lines)) + $shipping !== $total) {
            throw new RuntimeException('Checkout total does not match the items.');
        }
        $items = array_map(fn (array $line) => [
            'title' => $line['name'], 'unit_price' => $amount($line['unit_price_cents']), 'quantity' => $line['quantity'],
        ], $lines);
        if ($shipping > 0) {
            $items[] = ['title' => 'Entrega', 'unit_price' => $amount($shipping), 'quantity' => 1];
        }
        $return = $origin.'/pedidos/'.rawurlencode($reference).'?retorno=mercadopago';

        return [
            'type' => 'online', 'processing_mode' => 'manual', 'capture_mode' => 'automatic',
            'external_reference' => self::attemptReference($reference, $attemptId),
            'total_amount' => $amount($total), 'items' => $items,
            'expiration_time' => 'PT'.(int) config('checkout.checkout_pro_reservation_minutes').'M',
            'config' => [
                'online' => ['success_url' => $return, 'failure_url' => $return, 'pending_url' => $return, 'auto_return' => 'all'],
                'payment_method' => ['max_installments' => 1],
            ],
        ];
    }

    public function createOrder(array $payload, string $key): array
    {
        $response = $this->request(fn (PendingRequest $client): Response => $client
            ->acceptJson()->withToken(config('mercadopago.access_token'))->withHeader('X-Idempotency-Key', $key)
            ->post('/v1/orders', $payload));
        $order = $this->readOrder($response->json());
        if ($order['reference'] !== $payload['external_reference']
            || $order['amount_cents'] !== self::cents($payload['total_amount']) || $order['url'] === null) {
            throw new RuntimeException('Mercado Pago returned a mismatched checkout order.');
        }

        return $order;
    }

    public function order(string $id): array
    {
        if (! self::isOrderId($id)) {
            throw new RuntimeException('Invalid Mercado Pago order ID.');
        }
        $result = $this->readOrder($this->get('/v1/orders/'.$id));
        if ($result['id'] !== $id) {
            throw new RuntimeException('Mercado Pago returned a different order ID.');
        }

        return $result;
    }

    public function searchOrderId(string $reference, DateTimeInterface $attemptCreated): ?string
    {
        $result = $this->get('/v1/orders', [
            'external_reference' => $reference, 'limit' => 2, 'offset' => 0,
            'begin_date' => CarbonImmutable::instance($attemptCreated)->utc()->subHour()->format(DATE_RFC3339),
            'end_date' => now()->utc()->addMinutes(10)->format(DATE_RFC3339),
        ]);
        $data = $result['data'] ?? null;
        $total = $result['paging']['total'] ?? null;
        if ($data === [] && in_array($total, [0, '0'], true)) {
            return null;
        }
        if (! is_array($data) || ! array_is_list($data) || count($data) !== 1 || ! in_array($total, [1, '1'], true)
            || ($data[0]['external_reference'] ?? null) !== $reference || ! self::isOrderId($data[0]['id'] ?? null)) {
            throw new RuntimeException('Mercado Pago order search was inconclusive.');
        }

        return $data[0]['id'];
    }

    public function cancelOrder(string $id, string $createKey): void
    {
        if (! self::isOrderId($id)) {
            throw new RuntimeException('Invalid Mercado Pago order ID.');
        }
        $key = Uuid::uuid5(Uuid::NAMESPACE_URL, 'camba/checkout-cancel/'.$createKey)->toString();
        $this->request(fn (PendingRequest $client): Response => $client->acceptJson()
            ->withToken(config('mercadopago.access_token'))->withHeader('X-Idempotency-Key', $key)
            ->post('/v1/orders/'.$id.'/cancel'));
    }

    private function readOrder(array $payload): array
    {
        $id = $payload['id'] ?? null;
        $seller = $payload['user_id'] ?? null;
        $reference = $payload['external_reference'] ?? null;
        $total = self::cents($payload['total_amount'] ?? null);
        $duration = $payload['expiration_time'] ?? null;
        if (! self::isOrderId($id) || str_starts_with($id, 'ORDTST') === (config('mercadopago.live') === true) ||
            ! self::isNumericId($seller) || (string) $seller !== (string) config('mercadopago.collector_id') ||
            ($payload['currency'] ?? null) !== 'UYU' || ($payload['type'] ?? null) !== 'online' ||
            ($payload['processing_mode'] ?? null) !== 'manual' || ($payload['capture_mode'] ?? null) !== 'automatic' ||
            ! is_string($reference) || ! preg_match('/\A([0-9a-f-]{36})_attempt_([1-9][0-9]{0,17})\z/', $reference, $parts) ||
            $total === null || $total <= 0 ||
            ! is_string($duration) || ! preg_match('/\APT[1-9][0-9]{0,2}M\z/', $duration)) {
            throw new RuntimeException('Mercado Pago returned an invalid checkout order.');
        }
        $created = self::orderDate($payload['created_date'] ?? null);
        $updated = self::orderDate($payload['last_updated_date'] ?? null);
        $url = $payload['checkout_url'] ?? null;

        $state = $payload['status'] ?? null;
        $detail = $payload['status_detail'] ?? ($state === 'created' ? 'created' : null);
        $paid = self::cents($payload['total_paid_amount'] ?? null);
        if (! in_array($state, ['created', 'processing', 'action_required', 'processed', 'failed', 'canceled', 'expired', 'refunded', 'charged_back'], true)
            || ! is_string($detail) || ! preg_match('/\A[a-z_]{1,64}\z/', $detail)
            || (in_array($state, ['failed', 'canceled', 'expired'], true) && $paid > 0)) {
            throw new RuntimeException('Mercado Pago returned an invalid order state.');
        }
        $payments = $payload['transactions']['payments'] ?? [];
        if (! is_array($payments) || ! array_is_list($payments) || count($payments) > 12) {
            throw new RuntimeException('Mercado Pago returned invalid order transactions.');
        }
        $chargebackDetails = ['in_process', 'settled', 'reimbursed'];
        $evidence = [];
        foreach ($payments as $payment) {
            $paymentId = $payment['id'] ?? null;
            $amount = self::cents($payment['amount'] ?? null);
            if (! is_string($paymentId) || ! preg_match('/\APAY[A-Z0-9]{8,61}\z/', $paymentId)
                || isset($evidence[$paymentId]) || $amount !== $total) {
                throw new RuntimeException('Mercado Pago returned a mismatched order transaction.');
            }
            $status = match ($payment['status'] ?? null) {
                'processed' => $state === 'processed' && $detail === 'accredited' && $paid === $total
                    && ($payment['status_detail'] ?? null) === 'accredited'
                    && self::cents($payment['paid_amount'] ?? null) === $total ? 'approved' : null,
                'failed' => $state === 'failed' ? 'rejected' : null,
                'canceled', 'expired' => 'cancelled',
                'processing', 'action_required' => 'in_process',
                'refunded' => $state === 'refunded' && $detail === 'refunded'
                    && ($payment['status_detail'] ?? null) === 'refunded'
                    && self::processedRefundCents($payload['transactions']['refunds'] ?? null, $paymentId) === $amount
                        ? 'refunded' : null,
                'charged_back' => $state === 'charged_back' && in_array($detail, $chargebackDetails, true)
                    && in_array($payment['status_detail'] ?? null, $chargebackDetails, true)
                    && $paid === $total && self::cents($payment['paid_amount'] ?? null) === $total ? 'charged_back' : null,
                default => null,
            };
            if ($status !== null) {
                $evidence[$paymentId] = [
                    'id' => $paymentId, 'reference' => $parts[1], 'attempt_id' => (int) $parts[2], 'provider_order_id' => $id,
                    'amount_cents' => $amount, 'status' => $status, 'updated_at' => $updated->format('Y-m-d\TH:i:s.v\Z'),
                    ...($status === 'refunded' ? ['refunded_cents' => $amount] : []),
                ];
            }
        }
        if ($state === 'processed' && $detail === 'accredited' && count(array_filter($evidence, fn ($row) => $row['status'] === 'approved')) !== 1) {
            throw new RuntimeException('Mercado Pago did not verify one fully accredited transaction.');
        }
        if ($state === 'refunded' && count(array_filter($evidence, fn ($row) => $row['status'] === 'refunded')) !== 1) {
            throw new RuntimeException('Mercado Pago did not verify one complete refund.');
        }
        if ($state === 'charged_back' && count(array_filter($evidence, fn ($row) => $row['status'] === 'charged_back')) !== 1) {
            throw new RuntimeException('Mercado Pago did not verify one charged-back transaction.');
        }

        return [
            'id' => $id, 'reference' => $reference, 'order_reference' => $parts[1], 'attempt_id' => (int) $parts[2],
            'amount_cents' => $total, 'state' => $state, 'detail' => $detail,
            'expires_at' => $created->add(new DateInterval($duration)), 'updated_at' => $updated->format('Y-m-d\TH:i:s.v\Z'),
            'url' => self::isCheckoutUrl($url) ? $url : null, 'payments' => array_values($evidence),
        ];
    }

    private static function processedRefundCents(mixed $refunds, string $paymentId): ?int
    {
        if (! is_array($refunds) || ! array_is_list($refunds) || count($refunds) > 100) {
            return null;
        }
        $processed = [];
        foreach ($refunds as $refund) {
            if (($refund['transaction_id'] ?? null) !== $paymentId || ($refund['status'] ?? null) !== 'processed') {
                continue;
            }
            $id = $refund['id'] ?? null;
            $amount = self::cents($refund['amount'] ?? null);
            if (! is_string($id) || $id === '' || isset($processed[$id]) || $amount === null || $amount <= 0) {
                return null;
            }
            $processed[$id] = $amount;
        }

        return array_sum($processed);
    }

    private static function orderDate(mixed $date): CarbonImmutable
    {
        if (! is_string($date) || ! preg_match('/\A\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d)\z/', $date)) {
            throw new RuntimeException('Mercado Pago returned an invalid order date.');
        }

        return CarbonImmutable::parse($date)->utc();
    }

    public static function cents(mixed $amount): ?int
    {
        if (! (is_string($amount) || is_int($amount)) || ! preg_match('/\A(0|[1-9][0-9]{0,11})(?:\.([0-9]{1,2}))?\z/', (string) $amount, $money)) {
            return null;
        }

        return (int) $money[1] * 100 + (int) str_pad($money[2] ?? '', 2, '0');
    }

    public static function isOrderId(mixed $id): bool
    {
        return is_string($id) && preg_match('/\AORD[A-Z0-9]{8,61}\z/', $id) === 1;
    }

    private static function isCheckoutUrl(mixed $url): bool
    {
        $parts = is_string($url) ? parse_url($url) : false;

        return ($parts['scheme'] ?? null) === 'https' && in_array($parts['host'] ?? null, self::CHECKOUT_HOSTS, true)
            && ! isset($parts['user']) && ! isset($parts['pass']) && (! isset($parts['port']) || $parts['port'] === 443);
    }

    /** @return array{id:string,reference:string,amount_cents:int,status:string,updated_at:string} */
    public function payment(string $id): array
    {
        if (! self::isNumericId($id)) {
            throw new RuntimeException('Invalid Mercado Pago payment ID.');
        }
        $payment = $this->get('/v1/payments/'.$id);
        $reference = $payment['external_reference'] ?? null;
        $status = $payment['status'] ?? null;
        $amount = $payment['transaction_amount'] ?? null;
        $updatedAt = $payment['date_last_updated'] ?? null;
        $statuses = ['approved', 'authorized', 'pending', 'in_process', 'in_mediation', 'rejected', 'cancelled', 'refunded', 'charged_back'];
        if (! self::isNumericId($payment['id'] ?? null) || (string) $payment['id'] !== $id ||
            ! $this->expectedCollector($payment) || ($payment['currency_id'] ?? null) !== 'UYU' ||
            ($payment['live_mode'] ?? null) !== (config('mercadopago.live') === true) ||
            ! is_string($reference) || ! preg_match('/\A[A-Za-z0-9_-]{1,128}\z/', $reference) ||
            ! in_array($status, $statuses, true) || ! (is_string($amount) || is_int($amount) || is_float($amount)) ||
            ! preg_match('/\A(0|[1-9][0-9]{0,11})(?:\.([0-9]{1,2}))?\z/', (string) $amount, $money) ||
            ! is_string($updatedAt) || ! preg_match('/\A\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)\z/', $updatedAt)) {
            throw new RuntimeException('Mercado Pago returned an invalid payment.');
        }
        $instant = CarbonImmutable::parse($updatedAt)->utc();

        $attemptId = null;
        if (preg_match('/\A([0-9a-f-]{36})_attempt_([1-9][0-9]{0,17})\z/', $reference, $parts)) {
            $reference = $parts[1];
            $attemptId = (int) $parts[2];
        }

        $amountCents = (int) $money[1] * 100 + (int) str_pad($money[2] ?? '', 2, '0');
        $refunded = $payment['transaction_amount_refunded'] ?? null;
        if ($status === 'refunded' && (self::cents(is_float($refunded) ? (string) $refunded : $refunded) !== $amountCents
            || ($payment['status_detail'] ?? null) === 'partially_refunded')) {
            throw new RuntimeException('Mercado Pago did not verify a complete payment refund.');
        }

        return [
            'id' => $id, 'reference' => $reference, 'status' => $status,
            'amount_cents' => $amountCents,
            'updated_at' => $instant->format('Y-m-d\TH:i:s.v\Z'),
            ...($status === 'refunded' ? ['refunded_cents' => $amountCents] : []),
            ...($attemptId === null ? [] : ['attempt_id' => $attemptId]),
        ];
    }

    public static function attemptReference(string $reference, int $attemptId): string
    {
        return $reference.'_attempt_'.$attemptId;
    }

    /** @return list<string> Look these IDs up individually before treating them as evidence. */
    public function searchIds(string $reference): array
    {
        $ids = [];
        // ponytail: bound upstream search to 1,000 results per order; manual review if a provider account exceeds it.
        for ($offset = 0; $offset < 1000; $offset += 50) {
            $payload = $this->get('/v1/payments/search', [
                'external_reference' => $reference, 'limit' => 50, 'offset' => $offset, 'sort' => 'id', 'criteria' => 'asc',
            ]);
            $results = $payload['results'] ?? null;
            $total = $payload['paging']['total'] ?? null;
            if (! is_array($results) || ! array_is_list($results) || count($results) > 50 ||
                ! is_int($total) || $total < 0 || $total > 1000 || count($results) !== min(50, max(0, $total - $offset))) {
                break;
            }
            foreach ($results as $result) {
                if (! is_array($result) || ! self::isNumericId($result['id'] ?? null)) {
                    throw new RuntimeException('Mercado Pago returned an invalid payment search.');
                }
                $ids[] = (string) $result['id'];
            }
            if ($offset + 50 >= $total && count(array_unique($ids)) === $total) {
                return $ids;
            }
        }
        throw new RuntimeException('Mercado Pago search could not be completed safely.');
    }

    private function expectedCollector(array $payload): bool
    {
        $collector = $payload['collector_id'] ?? null;

        return self::isNumericId($collector) && (string) $collector === (string) config('mercadopago.collector_id');
    }

    public static function isNumericId(mixed $id): bool
    {
        return (is_string($id) || is_int($id)) && preg_match('/\A[1-9][0-9]{0,19}\z/', (string) $id) === 1;
    }

    public function isConfigured(): bool
    {
        return self::credentialPresent(config('mercadopago.access_token'))
            && self::isNumericId(config('mercadopago.collector_id'));
    }

    public function checkoutAvailable(): bool
    {
        return $this->isConfigured()
            && self::credentialPresent(config('mercadopago.webhook_secret'))
            && $this->publicOrigin() !== null;
    }

    private static function credentialPresent(mixed $value): bool
    {
        return is_string($value) && ! in_array(trim($value), ['', 'X'], true);
    }

    private function publicOrigin(): ?string
    {
        $origin = rtrim((string) config('app.url'), '/');
        $parts = parse_url($origin);
        $host = strtolower(trim($parts['host'] ?? '', '[].'));
        if (($parts['scheme'] ?? null) !== 'https' || $host === '' ||
            $host === 'localhost' || str_ends_with($host, '.localhost') ||
            (filter_var($host, FILTER_VALIDATE_IP) && ! filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_GLOBAL_RANGE)) ||
            isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) ||
            isset($parts['fragment']) || ! empty($parts['path'])) {
            return null;
        }

        return $origin;
    }

    // Keep Laravel's bounded, no-retry transport and use the headers and JSON built by the SDK.
    public function send(MPRequest $request): MPResponse
    {
        if ($request->getMethod() !== 'POST' || $request->getUri() !== '/checkout/preferences') {
            throw new RuntimeException('Unexpected Mercado Pago SDK request.');
        }
        $headers = [];
        foreach ($request->getHeaders() ?? [] as $line) {
            [$name, $value] = explode(':', $line, 2);
            $headers[$name] = trim($value);
        }
        $response = $this->request(fn (PendingRequest $client): Response => $client
            ->withHeaders($headers)->withBody($request->getPayload() ?? '', 'application/json; charset=UTF-8')
            ->post($request->getUri()));

        return new MPResponse($response->status(), $response->json());
    }

    private function get(string $path, array $data = []): array
    {
        return $this->request(fn (PendingRequest $client): Response => $client
            ->acceptJson()->withToken(config('mercadopago.access_token'))->get($path, $data))->json();
    }

    private function request(callable $send): Response
    {
        if (! $this->isConfigured()) {
            throw new RuntimeException('Mercado Pago is not configured.');
        }
        try {
            $response = $send(Http::baseUrl(self::API)->withoutRedirecting()->connectTimeout(3)->timeout(8));
        } catch (ConnectionException) {
            throw new RuntimeException('Mercado Pago connection failed.');
        }
        if (! $response->successful() || ! is_array($response->json())) {
            // Do not bubble provider error bodies: they can carry payer and request metadata.
            throw new RuntimeException('Mercado Pago request failed.', $response->status());
        }

        return $response;
    }
}
