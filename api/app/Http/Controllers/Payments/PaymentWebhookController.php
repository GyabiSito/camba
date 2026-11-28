<?php

namespace App\Http\Controllers\Payments;

use App\Logging\PaymentLog;
use App\Payments\CheckoutProClient;
use App\Payments\PaymentWebhookSignature;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Throwable;

class PaymentWebhookController
{
    public function store(Request $request, PaymentWebhookSignature $signature): Response
    {
        try {
            return $this->accept($request, $signature);
        } catch (Throwable $error) {
            PaymentLog::failure('payment.webhook', PaymentLog::attempt(), $error);

            throw $error;
        }
    }

    private function accept(Request $request, PaymentWebhookSignature $signature): Response
    {
        $content = $request->getContent();
        abort_if(strlen($content) > 16384 || strlen((string) $request->server('QUERY_STRING')) > 2048
            || strlen((string) $request->header('x-signature')) > 512, 413);
        $id = $signature->resourceId($request);
        $body = $content === '' ? (object) [] : json_decode($content);
        abort_unless(is_object($body), 422);
        $type = $body->type ?? $request->query('type');
        abort_unless($type === null || is_string($type), 422);
        if ($type === null || in_array($type, ['payment', 'order'], true)) {
            $order = CheckoutProClient::isOrderId($id);
            abort_unless($type === null || ($order ? $type === 'order' : $type === 'payment'), 422);
            if (isset($body->data)) {
                $bodyId = is_object($body->data) ? ($body->data->id ?? null) : null;
                abort_unless((is_string($bodyId) || is_int($bodyId)) && strtoupper((string) $bodyId) === $id, 422);
            }
            DB::table('payment_webhook_events')->upsert([[
                'delivery_key' => hash('sha256', $id.'|'.$request->header('x-request-id')),
                'provider_payment_id' => $order ? null : $id,
                ...($order ? ['provider_order_id' => $id] : []),
                'next_attempt_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]], ['delivery_key'], ['delivery_key']);
        }

        return response('', 200)->header('Cache-Control', 'no-store');
    }
}
