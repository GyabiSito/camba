<?php

namespace App\Actions\Notices;

use App\Logging\PaymentDailyFileHandler;
use App\Models\CommerceNotice;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\Withdrawal;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Throwable;

class DeliverRefundLog
{
    public function execute(int $id): void
    {
        try {
            DB::transaction(function () use ($id): void {
                $entry = CommerceNotice::query()->where('channel', 'log')->where('kind', CommerceNotice::TOTAL_REFUND_LOG)
                    ->where('state', 'pending')->where('available_at', '<=', now())->lockForUpdate()->find($id);
                if (! $entry) {
                    return;
                }
                $payment = Payment::query()->findOrFail($entry->subject_id);
                $order = Order::query()->findOrFail($payment->order_id);
                $attempt = PaymentAttempt::query()->find($payment->payment_attempt_id);
                $receipt = Withdrawal::verifiedReferenceFor($order);
                $at = $entry->source_at->toImmutable()->tz(config('store.timezone'));
                $handler = Log::channel('refunds')->getLogger()->getHandlers()[0];
                if (! $handler instanceof PaymentDailyFileHandler) {
                    throw new RuntimeException('The refund channel is not backed by the payment daily file handler.');
                }
                $handler->appendRefundOnce($at, [
                    'verified_at' => $at->toIso8601String(),
                    'order_reference' => $order->reference,
                    'provider_order_id' => $attempt?->provider_order_id,
                    'provider_payment_id' => $payment->provider_payment_id,
                    'amount_cents' => $payment->amount_cents,
                    'currency' => $order->currency,
                    ...($receipt === null ? [] : ['withdrawal_reference' => $receipt]),
                ]);
                $entry->update(['state' => 'sent', 'sent_at' => now(), 'error_code' => null]);
            }, 3);
        } catch (Throwable) {
            CommerceNotice::query()->whereKey($id)->where('state', 'pending')->update([
                'available_at' => now()->addMinute(), 'error_code' => 'refund_log_write_failed',
            ]);
        }
    }
}
