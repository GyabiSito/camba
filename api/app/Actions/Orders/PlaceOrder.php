<?php

namespace App\Actions\Orders;

use App\Enums\OrderStatus;
use App\Models\Cart;
use App\Models\Order;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PlaceOrder
{
    public function __construct(private readonly QuoteCheckout $quote) {}

    public function execute(?int $userId, string $sessionId, array $input): Order
    {
        $lines = array_column($input['items'], 'quantity', 'product_id');
        ksort($lines, SORT_NUMERIC);
        $contact = [
            'name' => $input['contact']['name'],
            'email' => Str::lower($input['contact']['email']),
            'phone' => $input['contact']['phone'] ?? null,
        ];
        $address = $input['shipping_method'] === 'delivery' ? [
            'recipient' => $input['address']['recipient'],
            'department' => $input['address']['department'],
            'locality' => $input['address']['locality'],
            'street' => $input['address']['street'],
            'number' => $input['address']['number'],
            'details' => $input['address']['details'] ?? null,
            'postal_code' => $input['address']['postal_code'] ?? null,
        ] : null;
        $fingerprint = QuoteCheckout::fingerprint('order', [$lines, $input['shipping_method'], $input['quote_token'], $contact, $address]);

        return DB::transaction(function () use ($userId, $sessionId, $input, $contact, $address, $fingerprint): Order {
            // The existing cart lock serializes orders for an owner before any product is locked.
            $cart = Cart::lockOwner(Cart::ownerKey($userId, $sessionId));
            abort_if($cart->claimed_at !== null, 409, 'The guest session has changed. Refresh checkout.');
            $owner = Order::ownerKey($userId, $sessionId);
            $existing = Order::query()->where('owner_key', $owner)->where('user_id', $userId)
                ->where('idempotency_key', $input['idempotency_key'])->lockForUpdate()->first();
            if ($existing !== null) {
                abort_if($userId === null && ! $existing->guest_access_expires_at?->isFuture(), 409, 'This idempotency key cannot be reused. Refresh checkout.');
                abort_unless(hash_equals($existing->request_hash, $fingerprint), 409, 'This idempotency key was already used for a different checkout.');

                return $existing;
            }

            [$quote, $products] = $this->quote->execute($input['items'], lock: true);
            $shipping = collect($quote['shipping_options'])->firstWhere('method', $input['shipping_method']);
            if ($shipping === null) {
                throw ValidationException::withMessages(['shipping_method' => 'The selected shipping method is unavailable.']);
            }
            abort_unless(hash_equals($shipping['quote_token'], $input['quote_token']), 409, 'Checkout details changed. Request a new quote before confirming.');

            $order = Order::query()->forceCreate([
                'reference' => (string) Str::uuid(),
                'user_id' => $userId,
                'owner_key' => $owner,
                'idempotency_key' => $input['idempotency_key'],
                'request_hash' => $fingerprint,
                'status' => OrderStatus::PendingPayment,
                'currency' => $quote['currency'],
                'subtotal_cents' => $quote['subtotal_cents'],
                'shipping_cents' => $shipping['shipping_cents'],
                'total_cents' => $shipping['total_cents'],
                'shipping_method' => $shipping['method'],
                'pickup_address' => $shipping['pickup_address'],
                'contact' => $contact,
                'address' => $address,
                'guest_access_expires_at' => $userId === null ? now()->addHours(config('checkout.guest_access_hours')) : null,
                'reservation_expires_at' => now()->addMinutes(config('checkout.reservation_minutes')),
            ]);
            $order->items()->forceCreateMany($quote['items']);
            foreach ($quote['items'] as $index => $line) {
                $products[$index]->decrement('stock', $line['quantity']);
            }

            return $order;
        }, 3);
    }
}
