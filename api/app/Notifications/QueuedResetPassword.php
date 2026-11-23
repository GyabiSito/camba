<?php

namespace App\Notifications;

use App\Mail\TransactionalEmail;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\Password;

class QueuedResetPassword extends ResetPassword implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;

    protected function buildMailMessage($url): MailMessage
    {
        $title = 'Restablecé tu contraseña';
        $minutes = config('auth.passwords.'.config('auth.defaults.passwords').'.expire');
        $duration = $minutes == 1 ? '1 minuto' : "$minutes minutos";

        return (new MailMessage)->subject($title)->view([TransactionalEmail::HTML, TransactionalEmail::TEXT], [
            'title' => $title,
            'intro' => 'Recibimos una solicitud para restablecer la contraseña de tu cuenta.',
            'actionLabel' => 'Restablecer contraseña',
            'actionUrl' => $url,
            'notes' => ["El enlace vence en $duration.", 'Si no pediste este cambio, podés ignorar este correo.'],
        ] + TransactionalEmail::support());
    }

    public function shouldSend(User $user, string $channel): bool
    {
        return Password::tokenExists($user, $this->token);
    }
}
