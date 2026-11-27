<?php

namespace App\Payments;

use Illuminate\Http\Request;

class PaymentWebhookSignature
{
    private const MAX_TIMESTAMP_DRIFT_MS = 300_000;

    public function paymentId(Request $request): string
    {
        $id = $this->resourceId($request);
        abort_unless(CheckoutProClient::isNumericId($id), 401);

        return $id;
    }

    public function resourceId(Request $request): string
    {
        $secret = config('mercadopago.webhook_secret');
        abort_unless(is_string($secret) && $secret !== '', 503);
        $ids = [];
        foreach (explode('&', (string) $request->server('QUERY_STRING')) as $part) {
            [$key, $value] = array_pad(explode('=', $part, 2), 2, '');
            if (urldecode($key) === 'data.id') {
                $ids[] = urldecode($value);
            }
        }
        abort_unless(count($ids) === 1, 401);
        $id = strtoupper($ids[0]);
        abort_unless(CheckoutProClient::isNumericId($id) || CheckoutProClient::isOrderId($id), 401);
        $requestId = (string) $request->header('x-request-id');
        abort_unless(preg_match('/\A[A-Za-z0-9_.-]{1,128}\z/', $requestId), 401);

        $fields = [];
        foreach (explode(',', (string) $request->header('x-signature')) as $part) {
            [$key, $value] = array_map('trim', array_pad(explode('=', $part, 2), 2, ''));
            $key = strtolower($key);
            abort_if(isset($fields[$key]), 401);
            $fields[$key] = $value;
        }
        $ts = $fields['ts'] ?? '';
        $received = $fields['v1'] ?? '';
        abort_unless(preg_match('/\A(?:[0-9]{10}|[0-9]{13})\z/', $ts) && preg_match('/\A[a-f0-9]{64}\z/', $received), 401);
        $timestampMs = (int) $ts * (strlen($ts) === 10 ? 1000 : 1);
        abort_if(abs(now()->getTimestampMs() - $timestampMs) > self::MAX_TIMESTAMP_DRIFT_MS, 401);

        // The original timestamp token is signed, not its normalized value.
        $signedId = strtolower($id);
        $expected = hash_hmac('sha256', "id:$signedId;request-id:$requestId;ts:$ts;", $secret);
        abort_unless(hash_equals($expected, $received), 401);

        return $id;
    }
}
