<?php

namespace App\Actions\Orders;

use App\Commerce\PurchaseTerms;
use App\Models\Product;
use App\Models\StoreSettings;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Validation\ValidationException;

class QuoteCheckout
{
    /**
     * Call with a transaction when locking products for reservation.
     *
     * @param  list<array{product_id: int, quantity: int}>  $items
     * @return array{array, Collection<int, Product>}
     */
    public function execute(array $items, bool $lock = false): array
    {
        $quantities = array_column($items, 'quantity', 'product_id');
        $query = Product::query()->published()->whereKey(array_keys($quantities))->orderBy('id');
        $products = ($lock ? $query->lockForUpdate() : $query)->get();
        if (count($items) < 1 || count($items) > 50 || $products->count() !== count($items)) {
            throw ValidationException::withMessages(['items' => 'One or more selected products are unavailable.']);
        }

        $lines = [];
        $subtotal = 0;
        foreach ($products as $product) {
            $quantity = $quantities[$product->id];
            if ($quantity < 1 || $quantity > 1000 || $quantity > $product->stock) {
                throw ValidationException::withMessages(['items' => 'One or more quantities exceed the available stock or checkout limits.']);
            }

            $lineTotal = $product->price_cents * $quantity;
            $subtotal += $lineTotal;
            $lines[] = [
                'product_id' => $product->id,
                'sku' => $product->sku,
                'name' => $product->name,
                'quantity' => $quantity,
                'unit_price_cents' => $product->price_cents,
                'line_total_cents' => $lineTotal,
            ];
        }

        $shipping = [];
        $settings = StoreSettings::loadValues();
        if ($settings['pickup_address'] !== null) {
            $shipping[] = $this->option('pickup', 0, $settings['pickup_address'], $subtotal, $lines);
        }
        if ($settings['delivery_cents'] !== null) {
            $shipping[] = $this->option('delivery', $settings['delivery_cents'], null, $subtotal, $lines);
        }

        return [[
            'currency' => 'UYU',
            'terms_version' => PurchaseTerms::VERSION,
            'withdrawal_period' => PurchaseTerms::read()['withdrawal_period'],
            'items' => $lines,
            'subtotal_cents' => $subtotal,
            'shipping_options' => $shipping,
        ], $products];
    }

    public static function fingerprint(string $purpose, array $values): string
    {
        return hash_hmac('sha256', json_encode([$purpose, $values], JSON_THROW_ON_ERROR), config('app.key'));
    }

    private function option(string $method, int $shippingCents, ?string $pickup, int $subtotal, array $lines): array
    {
        $option = [
            'method' => $method,
            'shipping_cents' => $shippingCents,
            'total_cents' => $subtotal + $shippingCents,
            'pickup_address' => $pickup,
        ];

        return [...$option, 'quote_token' => self::fingerprint('quote', ['UYU', $option, $lines])];
    }
}
