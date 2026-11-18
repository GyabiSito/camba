<?php

namespace App\Enums;

enum PaymentStatus: string
{
    case Approved = 'approved';
    case Authorized = 'authorized';
    case Pending = 'pending';
    case InProcess = 'in_process';
    case InMediation = 'in_mediation';
    case Rejected = 'rejected';
    case Cancelled = 'cancelled';
    case Refunded = 'refunded';
    case ChargedBack = 'charged_back';

    public function blocksExpiry(): bool
    {
        return ! in_array($this, [self::Rejected, self::Cancelled], true);
    }
}
