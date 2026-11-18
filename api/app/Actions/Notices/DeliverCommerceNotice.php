<?php

namespace App\Actions\Notices;

use App\Mail\CommerceNoticeMail;
use App\Models\CommerceNotice;
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
                $message = new CommerceNoticeMail($notice->id, $notice->kind, $recipient[1]);
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
