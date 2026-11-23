<?php

namespace App\Payments;

use Carbon\CarbonImmutable;
use DateTimeInterface;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class CheckoutProClient
{
    private const API = 'https://api.mercadopago.com';

    /** @param list<array{sku:string,name:string,quantity:int,unit_price_cents:int}> $lines */
    public function preference(string $reference, array $lines, int $shippingCents, DateTimeInterface $expires): array
    {
        $origin = rtrim((string) config('app.url'), '/');
        $originParts = parse_url($origin);
        if (($originParts['scheme'] ?? null) !== 'https' || empty($originParts['host']) ||
            isset($originParts['user']) || isset($originParts['pass']) || isset($originParts['query']) ||
            isset($originParts['fragment']) || ! empty($originParts['path'])) {
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
        $returnUrl = $origin.'/pedidos/'.rawurlencode($reference);
        $payload = $this->request('POST', '/checkout/preferences', [
            'items' => $items,
            'external_reference' => $reference,
            'back_urls' => ['success' => $returnUrl, 'pending' => $returnUrl, 'failure' => $returnUrl],
            'notification_url' => $origin.'/api/v1/webhooks/mercadopago?source_news=webhooks',
            'auto_return' => 'approved',
            'expires' => true,
            'expiration_date_to' => $expires->format('Y-m-d\TH:i:s.vP'),
        ]);
        $live = config('mercadopago.live') === true;
        $url = $payload[$live ? 'init_point' : 'sandbox_init_point'] ?? null;
        $parts = is_string($url) ? parse_url($url) : false;
        $hosts = $live
            ? ['www.mercadopago.com.uy', 'mercadopago.com.uy', 'www.mercadopago.com', 'mercadopago.com']
            : ['sandbox.mercadopago.com.uy', 'sandbox.mercadopago.com'];
        $id = $payload['id'] ?? null;
        if (! is_string($id) || ! preg_match('/\A[A-Za-z0-9-]{1,128}\z/', $id) ||
            ! $this->expectedCollector($payload) || ($parts['scheme'] ?? null) !== 'https' ||
            ! in_array($parts['host'] ?? null, $hosts, true) || isset($parts['user']) || isset($parts['pass']) ||
            (isset($parts['port']) && $parts['port'] !== 443)) {
            throw new RuntimeException('Mercado Pago returned an invalid preference.');
        }

        return ['id' => $id, 'url' => $url];
    }

    /** @return array{id:string,reference:string,amount_cents:int,status:string,updated_at:string} */
    public function payment(string $id): array
    {
        if (! self::isNumericId($id)) {
            throw new RuntimeException('Invalid Mercado Pago payment ID.');
        }
        $payment = $this->request('GET', '/v1/payments/'.$id);
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

        return [
            'id' => $id, 'reference' => $reference, 'status' => $status,
            'amount_cents' => (int) $money[1] * 100 + (int) str_pad($money[2] ?? '', 2, '0'),
            'updated_at' => $instant->format('Y-m-d\TH:i:s.v\Z'),
        ];
    }

    /** @return list<string> Look these IDs up individually before treating them as evidence. */
    public function searchIds(string $reference): array
    {
        $ids = [];
        // ponytail: bound upstream search to 1,000 results per order; manual review if a provider account exceeds it.
        for ($offset = 0; $offset < 1000; $offset += 50) {
            $payload = $this->request('GET', '/v1/payments/search', [
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
        $token = config('mercadopago.access_token');

        return is_string($token) && trim($token) !== '' && self::isNumericId(config('mercadopago.collector_id'));
    }

    private function request(string $method, string $path, array $data = []): array
    {
        $token = config('mercadopago.access_token');
        if (! $this->isConfigured()) {
            throw new RuntimeException('Mercado Pago is not configured.');
        }
        try {
            $client = Http::baseUrl(self::API)->acceptJson()->withToken($token)->withoutRedirecting()->connectTimeout(3)->timeout(8);
            $response = $method === 'POST' ? $client->post($path, $data) : $client->get($path, $data);
        } catch (ConnectionException) {
            throw new RuntimeException('Mercado Pago connection failed.');
        }
        if (! $response->successful() || ! is_array($payload = $response->json())) {
            // Do not bubble provider error bodies: they can carry payer and request metadata.
            throw new RuntimeException('Mercado Pago request failed.', $response->status());
        }

        return $payload;
    }
}
