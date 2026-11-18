<?php

namespace App\Payments;

use Illuminate\Http\Request;

class PaymentWebhookSignature
{
    public function paymentId(Request $request): string
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
        abort_unless(count($ids) === 1 && CheckoutProClient::isNumericId($ids[0]), 401);
        $id = $ids[0];
        $requestId = (string) $request->header('x-request-id');
        abort_unless(preg_match('/\A[A-Za-z0-9_.-]{1,128}\z/', $requestId), 401);

        $fields = [];
        foreach (explode(',', (string) $request->header('x-signature')) as $part) {
            [$key, $value] = array_pad(explode('=', trim($part), 2), 2, '');
            abort_if(isset($fields[$key]), 401);
            $fields[$key] = $value;
        }
        $ts = $fields['ts'] ?? '';
        $received = $fields['v1'] ?? '';
        abort_unless(preg_match('/\A(?:[0-9]{10}|[0-9]{13})\z/', $ts) && preg_match('/\A[a-f0-9]{64}\z/', $received), 401);
        $expected = hash_hmac('sha256', "id:$id;request-id:$requestId;ts:$ts;", $secret);
        abort_unless(hash_equals($expected, $received), 401);

        return $id;
    }
}
