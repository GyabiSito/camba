<?php

namespace App\Http\Controllers\Payments;

use App\Payments\CheckoutProClient;
use App\Payments\PaymentWebhookSignature;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class PaymentWebhookController
{
    public function store(Request $request, PaymentWebhookSignature $signature): Response
    {
        $content = $request->getContent();
        abort_if(strlen($content) > 16384 || strlen((string) $request->server('QUERY_STRING')) > 2048
            || strlen((string) $request->header('x-signature')) > 512, 413);
        $id = $signature->paymentId($request);
        $body = $content === '' ? (object) [] : json_decode($content);
        abort_unless(is_object($body), 422);
        $type = $body->type ?? $request->query('type');
        abort_unless($type === null || is_string($type), 422);
        if ($type === null || $type === 'payment') {
            if (isset($body->data)) {
                abort_unless(is_object($body->data) && CheckoutProClient::isNumericId($body->data->id ?? null)
                    && (string) $body->data->id === $id, 422);
            }
            DB::table('payment_webhook_events')->upsert([[
                'delivery_key' => hash('sha256', $id.'|'.$request->header('x-request-id')),
                'provider_payment_id' => $id,
                'next_attempt_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]], ['delivery_key'], ['delivery_key']);
        }

        return response('', 200)->header('Cache-Control', 'no-store');
    }
}
