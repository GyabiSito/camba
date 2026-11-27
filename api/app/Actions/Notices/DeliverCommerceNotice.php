<?php

namespace App\Actions\Notices;

use App\Mail\CommerceNoticeMail;
use App\Mail\TransactionalEmail;
use App\Models\CommerceNotice;
use App\Models\Order;
use App\Models\User;
use App\Models\Withdrawal;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use RuntimeException;
use Throwable;

class DeliverCommerceNotice
{
    public function __construct(private readonly NoticeEligibility $eligibility) {}

    public function execute(int $id): void
    {
        $claim = DB::transaction(function () use ($id): ?array {
            $notice = CommerceNotice::query()->where('channel', 'mail')->where('state', 'pending')
                ->where('available_at', '<=', now())->lockForUpdate()->find($id);
            if (! $notice) {
                return null;
            }
            $recipient = $this->eligibility->recipient($notice);
            if ($recipient === null) {
                $notice->update(['state' => 'cancelled', 'error_code' => 'no_longer_eligible']);

                return null;
            }
            $notice->attempts++;
            try {
                $transport = config('mail.mailers.'.config('mail.default').'.transport');
                if (in_array($transport, ['failover', 'roundrobin'], true)
                    || (app()->isProduction() && in_array($transport, ['array', 'log'], true))) {
                    throw new RuntimeException('Commerce notices require a single delivery transport.');
                }
                $pendingMail = Mail::mailer()->to($recipient[0]);
                $order = $recipient[1] === null ? null : Order::query()->where('reference', $recipient[1])->first();
                $buyerName = $notice->kind === CommerceNotice::BUYER_WELCOME
                    ? User::query()->whereKey($notice->subject_id)->value('name')
                    : null;
                $receipt = isset($recipient[2]) ? [
                    'Constancia' => $recipient[2],
                    ($notice->kind === CommerceNotice::BUYER_WITHDRAWAL_RESOLVED ? 'Fecha de cierre' : 'Fecha de recepción') => $notice->source_at->toImmutable()->tz(config('store.timezone'))->format('d/m/Y, H:i').' (Uruguay)',
                ] : [];
                $reference = $recipient[1];
                if ($notice->kind === CommerceNotice::ADMIN_TOTAL_REFUND && $order) {
                    $case = Withdrawal::verifiedReferenceFor($order);
                    if ($case !== null) {
                        $receipt['Constancia'] = $case;
                    }
                }
                if ($notice->kind === CommerceNotice::ADMIN_WITHDRAWAL_RECEIVED) {
                    $reference = $recipient[2];
                    $receipt['Pedido'] = Withdrawal::query()->find($notice->subject_id)?->verifiedOrder()?->reference
                        ?? 'Todavía no está vinculado';
                }
                $confirmationUrl = $recipient['confirmation_url'] ?? null;
                $message = new CommerceNoticeMail($notice->id, $notice->kind, $reference, $order, TransactionalEmail::support(), $buyerName, $receipt, $confirmationUrl);
            } catch (Throwable) {
                $notice->forceFill($this->preparationFailure($notice->attempts))->save();

                return null;
            }
            $notice->forceFill(['state' => 'sending', 'started_at' => now(), 'error_code' => null])->save();

            return [$notice, $recipient, $pendingMail, $message];
        }, 3);
        if ($claim === null) {
            return;
        }
        [$notice, $recipient, $pendingMail, $message] = $claim;

        try {
            $currentRecipient = $this->eligibility->recipient($notice);
        } catch (Throwable) {
            $this->finish($notice, $this->preparationFailure($notice->attempts));

            return;
        }
        if ($currentRecipient !== $recipient) {
            $this->finish($notice, ['state' => 'cancelled', 'error_code' => 'no_longer_eligible']);

            return;
        }
        try {
            $pendingMail->send($message);
        } catch (Throwable) {
            $this->finish($notice, ['state' => 'uncertain', 'error_code' => 'smtp_acceptance_unknown']);

            return;
        }
        $this->finish($notice, ['state' => 'sent', 'sent_at' => now()]);
    }

    private function preparationFailure(int $attempt): array
    {
        return [
            'state' => $attempt >= 3 ? 'failed' : 'pending',
            'available_at' => now()->addMinutes(2 ** $attempt),
            'error_code' => 'preparation_failed',
        ];
    }

    private function finish(CommerceNotice $notice, array $attributes): void
    {
        CommerceNotice::query()->whereKey($notice->id)->where('state', 'sending')->update($attributes);
    }
}
