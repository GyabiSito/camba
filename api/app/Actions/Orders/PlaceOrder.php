<?php

namespace App\Actions\Orders;

use App\Actions\Geography\ResolveAddressGeography;
use App\Actions\Notices\RecordOrderMail;
use App\Commerce\PurchaseTerms;
use App\Enums\OrderStatus;
use App\Models\Cart;
use App\Models\Order;
use App\Models\OrderPayment;
use App\Payments\CheckoutProClient;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PlaceOrder
{
    public function __construct(
        private readonly QuoteCheckout $quote,
        private readonly ResolveAddressGeography $geography,
        private readonly RecordOrderMail $notices,
        private readonly CheckoutProClient $payments,
    ) {}

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
            'department_id' => $input['address']['department_id'],
            'locality_id' => $input['address']['locality_id'],
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
                abort_if(isset($input['terms_version']) && $existing->terms_version !== null
                    && $input['terms_version'] !== $existing->terms_version, 409, 'Esta compra ya tiene otra versión de las condiciones.');

                return $existing;
            }
            abort_if(isset($input['terms_version']) && $input['terms_version'] !== PurchaseTerms::VERSION, 409, 'Las condiciones cambiaron. Volvé a revisarlas antes de confirmar.');
            $managed = $this->payments->checkoutAvailable();
            abort_if(! $managed && config('checkout.require_online_payment'), 503, 'El pago en línea no está disponible. Tu carrito no cambió.');
            if ($managed && ($pending = Order::query()->owned($userId, $sessionId)->where('checkout_managed', true)
                ->where('request_hash', $fingerprint)->whereNull('paid_at')
                ->whereIn('status', [OrderStatus::PendingPayment, OrderStatus::PaymentExpired])
                ->latest('id')->lockForUpdate()->first())) {
                return $pending;
            }

            if ($address !== null) {
                $locality = $this->geography->execute($address['department_id'], $address['locality_id'], 'address.locality_id');
                $address['department'] = $locality->department->name;
                $address['locality'] = $locality->name;
            }

            [$quote, $products] = $this->quote->execute($input['items'], lock: true, deliveryAddressValidated: $address !== null);
            $shipping = collect($quote['shipping_options'])->firstWhere('method', $input['shipping_method']);
            if ($shipping === null) {
                throw ValidationException::withMessages(['shipping_method' => 'The selected shipping method is unavailable.']);
            }
            abort_unless(hash_equals($shipping['quote_token'], $input['quote_token']), 409, 'Checkout details changed. Request a new quote before confirming.');

            // Existing loopback demo volumes are not migrated as part of host-code verification.
            $retainsTerms = ! app()->isLocal() || Schema::hasColumn('orders', 'terms_version');
            abort_if(! $retainsTerms && isset($input['terms_version']), 503, 'No podemos guardar las condiciones de esta compra. Probá más tarde.');
            $order = Order::query()->forceCreate([
                'reference' => (string) Str::uuid(),
                'user_id' => $userId,
                'owner_key' => $owner,
                'idempotency_key' => $input['idempotency_key'],
                'request_hash' => $fingerprint,
                'status' => OrderStatus::PendingPayment,
                'checkout_managed' => $managed,
                'checkout_cart_id' => $cart->id,
                'payment_id' => $managed ? OrderPayment::query()->create()->id : null,
                'currency' => $quote['currency'],
                'subtotal_cents' => $quote['subtotal_cents'],
                'shipping_cents' => $shipping['shipping_cents'],
                'total_cents' => $shipping['total_cents'],
                ...($retainsTerms ? ['terms_version' => PurchaseTerms::VERSION, 'terms_snapshot' => PurchaseTerms::read()] : []),
                'shipping_method' => $shipping['method'],
                'pickup_address' => $shipping['pickup_address'],
                'contact' => $contact,
                'address' => $address,
                'guest_access_expires_at' => $userId === null ? now()->addHours(config('checkout.guest_access_hours')) : null,
                'reservation_expires_at' => now()->addMinutes(config($managed
                    ? 'checkout.checkout_pro_reservation_minutes' : 'checkout.reservation_minutes')),
            ]);
            $order->items()->forceCreateMany($quote['items']);
            foreach ($quote['items'] as $index => $line) {
                $products[$index]->decrement('stock', $line['quantity']);
            }
            if (! $managed) {
                $this->notices->created($order);
            }

            return $order;
        }, 3);
    }
}
