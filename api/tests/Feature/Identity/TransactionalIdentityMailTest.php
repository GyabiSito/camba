<?php

namespace Tests\Feature\Identity;

use App\Models\User;
use App\Notifications\QueuedResetPassword;
use App\Notifications\QueuedVerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\URL;
use Tests\Feature\TestDatabase;
use Tests\TestCase;

class TransactionalIdentityMailTest extends TestCase
{
    use RefreshDatabase;

    protected function beforeRefreshingDatabase(): void
    {
        TestDatabase::assertIsolated($this);
    }

    public function test_rendered_identity_mail_keeps_original_links_and_expiry_in_both_parts(): void
    {
        $this->freezeTime();
        config(['mail.default' => 'array', 'auth.passwords.users.expire' => 37]);
        $user = User::factory()->unverified()->create();
        $token = Password::createToken($user);
        $verify = URL::temporarySignedRoute('verification.verify', now()->addMinutes(config('auth.verification.expire', 60)), [
            'id' => $user->getKey(),
            'hash' => sha1($user->getEmailForVerification()),
        ]);

        Notification::sendNow($user, new QueuedResetPassword($token));
        Notification::sendNow($user, new QueuedVerifyEmail);

        $messages = Mail::mailer('array')->getSymfonyTransport()->messages();
        $this->assertCount(2, $messages);
        $resetPrefix = rtrim(config('app.url'), '/').'/cuenta/restablecer#reset=';
        $this->assertSame(1, preg_match('~'.preg_quote($resetPrefix, '~').'[^\s<>]+~', $messages[0]->getOriginalMessage()->getTextBody(), $links));
        $reset = $links[0];
        $this->assertStringNotContainsString($token, $reset);
        $this->assertStringNotContainsString($user->email, $reset);
        foreach ([
            ['Restablecé tu contraseña', 'Restablecer contraseña', $reset],
            ['Verificá tu correo', 'Verificar mi correo', $verify],
        ] as $i => [$subject, $action, $url]) {
            $mail = $messages[$i]->getOriginalMessage();
            $this->assertSame($subject, $mail->getSubject());
            $this->assertStringContainsString('href="'.e($url).'"', $mail->getHtmlBody());
            $this->assertStringContainsString($url, $mail->getTextBody());
            $this->assertStringContainsString($action, $mail->getHtmlBody());
            $this->assertStringContainsString($action, $mail->getTextBody());
            $this->assertStringNotContainsString('Laravel', $mail->getHtmlBody());
        }
        $this->assertStringContainsString('37 minutos', $messages[0]->getOriginalMessage()->getTextBody());
    }
}
