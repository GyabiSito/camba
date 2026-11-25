<?php

namespace App\Actions\Payments;

use App\Enums\OrderStatus;
use App\Enums\ProductStatus;
use App\Logging\PaymentLog;
use App\Models\Order;
use App\Models\PaymentAttempt;
use App\Models\Product;
use Monolog\Level;

class CheckoutReservation
{
    /** The caller holds the order lock and one transaction for both products and order. */
    public function adjust(Order $order, bool $restoring): bool
    {
        $lines = $order->items()->get()->keyBy('product_id');
        $products = Product::query()->whereKey($lines->keys()->all())->orderBy('id')->lockForUpdate()->get();
        if ($lines->isEmpty() || $products->count() !== $lines->count()) {
            return false;
        }
        foreach ($products as $product) {
            $quantity = $lines[$product->id]->quantity;
            if ($restoring ? $product->stock > 2147483647 - $quantity
                : ($product->stock < $quantity || $product->status !== ProductStatus::Published)) {
                return false;
            }
        }
        foreach ($products as $product) {
            $restoring ? $product->increment('stock', $lines[$product->id]->quantity)
                : $product->decrement('stock', $lines[$product->id]->quantity);
        }

        return true;
    }

    public function release(Order $order, string $reason, ?PaymentAttempt $attempt): void
    {
        if ($order->status !== OrderStatus::PendingPayment || $order->stock_released_at !== null
            || $order->paid_provider_payment_id !== null) {
            return;
        }
        if ($this->adjust($order, restoring: true)) {
            $order->stock_released_at = now();
            $order->status = OrderStatus::PaymentExpired;
            PaymentLog::transition('checkout.stock_released', $order, null, 'released', Level::Info, $reason, $attempt?->id);
        } else {
            $order->status = OrderStatus::PaymentReview;
            $order->payment_issues = array_values(array_unique([...($order->payment_issues ?? []), 'stock_release_conflict']));
            PaymentLog::transition('payment.evidence.flagged', $order, null, 'payment_review', Level::Warning, 'stock_release_conflict', $attempt?->id);
        }
    }
}
