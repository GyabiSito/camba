<?php

namespace App\Actions\Payments;

use App\Logging\PaymentLog;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Payments\CheckoutProClient;
use Illuminate\Database\Eloquent\Builder;
use Monolog\Level;
use Throwable;

class RequestPaymentRefresh
{
    public function __construct(private readonly CheckoutProClient $client) {}

    public function isEligible(Order $order): bool
    {
        return $this->client->isConfigured()
            && (PaymentAttempt::query()->where('order_id', $order->id)->exists()
                || Payment::query()->where('order_id', $order->id)->exists());
    }

    public function executeAsAdmin(Order $order): void
    {
        try {
            abort_unless($this->isEligible($order), 409, 'Payment reconciliation is unavailable for this order.');
            $this->execute($order);
        } catch (Throwable $error) {
            PaymentLog::failure('payment.refresh', PaymentLog::order($order), $error, $order->id);

            throw $error;
        }
    }

    public function execute(Order $order): void
    {
        try {
            $scheduled = Order::query()->whereKey($order->id)->whereNull('payment_reconcile_at')
                ->where(function (Builder $available): void {
                    $available->whereNull('payment_reconciled_at')->orWhere('payment_reconciled_at', '<=', now()->subMinute());
                })->update(['payment_reconcile_at' => now()]);
            if ($scheduled) {
                PaymentLog::write(Level::Info, 'payment.refresh.scheduled', PaymentLog::order($order), $order->id);
            }
        } catch (Throwable $error) {
            PaymentLog::failure('payment.refresh', PaymentLog::order($order), $error, $order->id);

            throw $error;
        }
    }
}
