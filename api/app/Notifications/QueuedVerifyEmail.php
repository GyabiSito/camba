<?php

namespace App\Notifications;

use App\Mail\TransactionalEmail;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;

class QueuedVerifyEmail extends VerifyEmail implements ShouldQueue
{
    use Queueable;

    protected function buildMailMessage($url): MailMessage
    {
        $title = 'Verificá tu correo';

        return (new MailMessage)->subject($title)->view([TransactionalEmail::HTML, TransactionalEmail::TEXT], [
            'title' => $title,
            'intro' => 'Verificá que esta dirección es tuya para completar el registro en Camba.',
            'actionLabel' => 'Verificar mi correo',
            'actionUrl' => $url,
            'notes' => ['Si no creaste una cuenta en Camba, podés ignorar este correo.'],
        ] + TransactionalEmail::support());
    }
}
