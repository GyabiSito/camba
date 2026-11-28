<?php

namespace App\Jobs;

use App\Actions\Notices\DeliverCommerceNotice;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SendCommerceNotice implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $uniqueFor = 300;

    public int $tries = 1;

    public function __construct(public int $noticeId) {}

    public function uniqueId(): string
    {
        return (string) $this->noticeId;
    }

    public function handle(DeliverCommerceNotice $delivery): void
    {
        $delivery->execute($this->noticeId);
    }
}
