<?php

namespace App\Mail;

use Illuminate\Mail\Transport\ResendTransport;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mailer\SentMessage;
use Throwable;

final class RedactedResendTransport extends ResendTransport
{
    protected function doSend(SentMessage $message): void
    {
        try {
            parent::doSend($message);
        } catch (Throwable) {
            // Provider messages can contain request data. Never carry them into queue logs.
            throw new TransportException('Resend delivery failed.');
        }
    }
}
