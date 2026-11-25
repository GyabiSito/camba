<?php

namespace App\Http\Controllers\Settings;

use App\Http\Requests\Settings\StoreContactRequest;
use App\Models\StoreSettings;
use Illuminate\Http\Response;
use Illuminate\Mail\Message;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;

class StoreContactController
{
    public function __invoke(StoreContactRequest $request): Response
    {
        $fields = $request->validated();

        $recipient = StoreSettings::loadValues()['support_email'];
        abort_unless(is_string($recipient) && filter_var($recipient, FILTER_VALIDATE_EMAIL), 503, 'El formulario de contacto no está disponible.');

        $body = "Nombre: {$fields['name']}\nCorreo: {$fields['email']}\n";
        if (! empty($fields['phone'])) {
            $body .= "Teléfono: {$fields['phone']}\n";
        }

        // ponytail: keep submission synchronous until volume warrants a dedicated queue and delivery ledger.
        try {
            Mail::raw($body."\n".$fields['message'], static function (Message $mail) use ($recipient, $fields): void {
                $mail->to($recipient)->replyTo($fields['email'])->subject('Consulta desde Camba');
            });
        } catch (TransportExceptionInterface $exception) {
            Log::warning('Store contact mail delivery failed.', ['type' => $exception::class]);
            abort(503, 'No pudimos enviar tu consulta. Probá de nuevo más tarde.');
        }

        return response()->noContent();
    }
}
