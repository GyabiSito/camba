<?php

namespace App\Enums;

enum PaymentAttemptStatus: string
{
    case Initiating = 'initiating';
    case Ready = 'ready';
    case Uncertain = 'uncertain';
}
