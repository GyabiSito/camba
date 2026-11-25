<?php

namespace App\Enums;

enum PaymentAttemptStatus: string
{
    case Initiating = 'initiating';
    case Ready = 'ready';
    case Uncertain = 'uncertain';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Cancelled = 'cancelled';
    case Failed = 'failed';
    case Expired = 'expired';

    public function closed(): bool
    {
        return ! in_array($this, [self::Initiating, self::Ready, self::Uncertain], true);
    }
}
