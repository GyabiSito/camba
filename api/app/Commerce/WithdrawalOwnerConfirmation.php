<?php

namespace App\Commerce;

use App\Models\CommerceNotice;
use App\Models\Order;
use App\Models\User;
use App\Models\Withdrawal;
use Illuminate\Support\Facades\DB;

class WithdrawalOwnerConfirmation
{
    public static function fingerprint(Order $order, User $buyer): string
    {
        return hash('sha256', $order->id.'|'.$buyer->id.'|'.$buyer->email);
    }

    public static function activeRecipient(Withdrawal $case, ?Order $order): ?User
    {
        $buyer = Withdrawal::verifiedBuyer($order);

        return $buyer && $case->status === 'reviewing' && $case->confirmation_confirmed_at === null
            && $case->confirmation_expires_at?->isFuture() && $case->confirmation_token !== null
            && hash_equals($case->confirmation_owner_hash ?? '', self::fingerprint($order, $buyer))
            ? $buyer : null;
    }

    public static function noticeKey(Withdrawal $case): string
    {
        return 'mail:withdrawal_owner_confirmation:'.$case->id.':'.hash('sha256', $case->confirmation_token ?? '');
    }

    /** The caller holds the case lock. */
    public function request(Withdrawal $case, int $administratorId): void
    {
        $order = $this->lockRequestedOrder($case);
        $buyer = Withdrawal::verifiedBuyer($order);
        abort_unless($case->status === 'reviewing' && $buyer && ! $case->verifiedOrder(), 409,
            'No se puede solicitar confirmación de este caso.');

        if (self::activeRecipient($case, $order) !== null) {
            return;
        }

        $now = now();
        $case->forceFill([
            'confirmation_token' => bin2hex(random_bytes(32)),
            'confirmation_owner_hash' => self::fingerprint($order, $buyer),
            'confirmation_buyer_id' => $buyer->id,
            'confirmation_requested_by' => $administratorId, 'confirmation_requested_at' => $now,
            'confirmation_expires_at' => $now->copy()->addMinutes(30), 'confirmation_confirmed_at' => null,
        ])->save();
        CommerceNotice::query()->createOrFirst(['dedup_key' => self::noticeKey($case)], [
            'channel' => 'mail', 'kind' => CommerceNotice::WITHDRAWAL_OWNER_CONFIRMATION,
            'subject_type' => 'withdrawal', 'subject_id' => $case->id,
            'source_at' => $now, 'available_at' => $now, 'state' => 'pending',
        ]);
    }

    public function confirm(string $reference, string $token): Withdrawal
    {
        return DB::transaction(function () use ($reference, $token): Withdrawal {
            $case = Withdrawal::query()->where('reference', $reference)->lockForUpdate()->first();
            abort_unless($case && $case->confirmation_token !== null && hash_equals($case->confirmation_token, $token), 410,
                'Este enlace ya no está disponible.');
            $order = $this->lockRequestedOrder($case);
            abort_unless(self::activeRecipient($case, $order) && ! $case->verifiedOrder(), 410,
                'Este enlace ya no está disponible.');
            $case->forceFill([
                'order_id' => $order->id, 'confirmation_confirmed_at' => now(), 'confirmation_token' => null,
            ])->save();

            return $case;
        }, 3);
    }

    private function lockRequestedOrder(Withdrawal $case): ?Order
    {
        $order = $case->requestedOrder()->lockForUpdate()->first();
        if ($order?->user_id !== null) {
            $order->setRelation('buyer', User::query()->lockForUpdate()->find($order->user_id));
        }

        return $order;
    }
}
