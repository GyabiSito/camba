<?php

namespace App\Http\Controllers\Settings;

use App\Http\Requests\Settings\StoreContactRequest;
use App\Mail\TransactionalEmail;
use App\Models\StoreSettings;
use Illuminate\Http\Response;
use Illuminate\Mail\Message;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;

class StoreContactController
{
    private const SUBJECT = 'Consulta desde Camba';

    public function __invoke(StoreContactRequest $request): Response
    {
        $fields = $request->validated();

        $recipient = StoreSettings::loadValues()['support_email'];
        abort_unless(is_string($recipient) && filter_var($recipient, FILTER_VALIDATE_EMAIL), 503, 'El formulario de contacto no está disponible.');

        $details = ['Nombre' => $fields['name'], 'Correo' => $fields['email']];
        if (filled($fields['phone'] ?? null)) {
            $details['Teléfono'] = $fields['phone'];
        }
        $at = strrpos($fields['email'], '@');
        $replyUrl = 'mailto:'.rawurlencode(substr($fields['email'], 0, $at)).'@'.rawurlencode(substr($fields['email'], $at + 1))
            .'?subject='.rawurlencode('Re: '.self::SUBJECT);

        // ponytail: keep submission synchronous until volume warrants a dedicated queue and delivery ledger.
        try {
            Mail::send([TransactionalEmail::HTML, TransactionalEmail::TEXT], [
                'title' => 'Nueva consulta desde la tienda',
                'intro' => 'Recibiste un mensaje del formulario de contacto.',
                'details' => $details,
                'contactMessage' => $fields['message'],
                'actionLabel' => 'Responder consulta',
                'actionUrl' => $replyUrl,
            ], static function (Message $mail) use ($recipient, $fields): void {
                $mail->to($recipient)->replyTo($fields['email'])->subject(self::SUBJECT);
            });
        } catch (TransportExceptionInterface $exception) {
            Log::warning('Store contact mail delivery failed.', ['type' => $exception::class]);
            abort(503, 'No pudimos enviar tu consulta. Probá de nuevo más tarde.');
        }

        return response()->noContent();
    }
}
