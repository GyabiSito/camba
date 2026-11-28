<?php

namespace App\Actions\Notices;

use App\Models\CommerceNotice;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Withdrawal;
use DateTimeInterface;
use Illuminate\Support\Facades\DB;

class RecordRefundEffects
{
    public function __construct(
        private readonly NoticeEligibility $eligibility,
        private readonly DeliverRefundLog $log,
    ) {}

    public function verified(Order $order, Payment $payment): void
    {
        $verifiedAt = now();
        $key = 'payment:'.$payment->id;
        $log = $this->record('log', CommerceNotice::TOTAL_REFUND_LOG, $key, 'payment', $payment->id, $verifiedAt);
        if ($log->wasRecentlyCreated) {
            $this->record('mail', CommerceNotice::BUYER_TOTAL_REFUND, $key, 'order', $order->id, $verifiedAt);
            $this->record('mail', CommerceNotice::ADMIN_TOTAL_REFUND, $key, 'order', $order->id, $verifiedAt, $this->eligibility->administratorBinding());
        }
        if ($log->state === 'pending') {
            DB::afterCommit(fn () => $this->log->execute($log->id));
        }
    }

    public function withdrawalClosed(Withdrawal $case): void
    {
        $this->record('mail', CommerceNotice::BUYER_WITHDRAWAL_RESOLVED, 'withdrawal:'.$case->id,
            'withdrawal', $case->id, $case->refund_confirmed_at);
    }

    private function record(string $channel, string $kind, string $key, string $type, int $id, DateTimeInterface $at, array $attributes = []): CommerceNotice
    {
        return CommerceNotice::query()->createOrFirst(['dedup_key' => "$channel:$kind:$key"], [
            'channel' => $channel, 'kind' => $kind, 'subject_type' => $type, 'subject_id' => $id,
            'source_at' => $at, 'available_at' => $at, 'state' => 'pending', ...$attributes,
        ]);
    }
}
