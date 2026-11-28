<?php

namespace Tests\Feature\Settings;

use App\Models\StoreSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\Mailer\Exception\TransportException;
use Tests\Feature\TestDatabase;
use Tests\TestCase;

class StoreContactTest extends TestCase
{
    use RefreshDatabase;

    private const PATH = '/api/v1/contact';

    private const FORM = ['name' => 'Lucía Fernández', 'email' => 'buyer@camba.test', 'message' => '¿Me ayudan con un pedido?'];

    protected function beforeRefreshingDatabase(): void
    {
        TestDatabase::assertIsolated($this);
    }

    private function configureSupport(string $recipient = 'ayuda@camba.test'): void
    {
        StoreSettings::query()->findOrFail(1)->forceFill(['values' => ['support_email' => $recipient]])->save();
    }

    public function test_contact_delivers_only_to_the_internal_recipient(): void
    {
        config(['mail.default' => 'array', 'store.public_contact.email' => 'public@camba.test']);
        $this->configureSupport();

        $this->postJson(self::PATH, self::FORM + [
            'to' => 'other@camba.test', 'from' => 'spoofed@camba.test', 'subject' => 'Not the contact subject', 'phone' => '099 555 555',
        ])->assertNoContent();

        $messages = Mail::mailer('array')->getSymfonyTransport()->messages();
        $this->assertCount(1, $messages);
        $mail = $messages->first()->getOriginalMessage();
        $this->assertSame('ayuda@camba.test', $mail->getTo()[0]->getAddress());
        $this->assertSame(self::FORM['email'], $mail->getReplyTo()[0]->getAddress());
        $this->assertSame(config('mail.from.address'), $mail->getFrom()[0]->getAddress());
        $this->assertSame('Consulta desde Camba', $mail->getSubject());
        $this->assertSame([], $mail->getCc());
        $this->assertSame([], $mail->getBcc());
        $this->assertStringContainsString(self::FORM['name'], $mail->getTextBody());
        $this->assertStringContainsString(self::FORM['message'], $mail->getTextBody());
        $this->assertStringContainsString('Teléfono: 099 555 555', $mail->getTextBody());
        $this->assertStringContainsString('Teléfono', $mail->getHtmlBody());
        $this->assertStringContainsString('099 555 555', $mail->getHtmlBody());
    }

    public function test_contact_renders_both_parts_with_safe_visitor_data_and_no_empty_phone(): void
    {
        config(['mail.default' => 'array']);
        $this->configureSupport();
        $visitor = 'ana+qa?canal@camba.test';
        $name = 'Ana <QA> & equipo';
        $body = "Primer párrafo.\n\nSegundo párrafo: <img src=x onerror=alert(1)> & texto.";
        $this->postJson(self::PATH, ['name' => $name, 'email' => $visitor, 'message' => $body])->assertNoContent();

        $messages = Mail::mailer('array')->getSymfonyTransport()->messages();
        $this->assertCount(1, $messages);
        $mail = $messages->first()->getOriginalMessage();
        $html = $mail->getHtmlBody();
        $plain = $mail->getTextBody();
        $this->assertNotNull($html);
        $this->assertNotNull($plain);
        $this->assertSame($visitor, $mail->getReplyTo()[0]->getAddress());
        $url = 'mailto:ana%2Bqa%3Fcanal@camba.test?subject=Re%3A%20Consulta%20desde%20Camba';
        $this->assertStringContainsString('href="'.$url.'"', $html);
        $this->assertStringContainsString('src="cid:', $html);
        $this->assertStringContainsString(e($name), $html);
        $this->assertStringContainsString(nl2br(e($body), false), $html);
        $this->assertStringNotContainsString('<img src=x', $html);
        $this->assertStringContainsString('Nombre: '.$name, $plain);
        $this->assertStringContainsString('Correo: '.$visitor, $plain);
        $this->assertStringContainsString($body, $plain);
        $this->assertStringContainsString($url, $plain);
        foreach ([$html, $plain] as $part) {
            $this->assertStringContainsString('Nueva consulta desde la tienda', $part);
            $this->assertStringContainsString('Responder consulta', $part);
            $this->assertStringNotContainsString('Teléfono', $part);
        }
    }

    public function test_invalid_messages_and_unconfigured_contact_are_not_sent(): void
    {
        config(['store.public_contact.email' => 'public@camba.test']);
        Mail::shouldReceive('send')->never();
        $this->postJson(self::PATH, self::FORM)->assertServiceUnavailable();
        $this->configureSupport('not-an-email');
        $this->postJson(self::PATH, self::FORM)->assertServiceUnavailable();
        $this->configureSupport();
        $this->postJson(self::PATH, ['name' => "Nombre\nBcc: example.test", 'email' => 'invalid', 'message' => 'corto'])
            ->assertUnprocessable()->assertJsonValidationErrors(['name', 'email', 'message']);
        foreach (["buyer@camba.test\r\nBcc: other@camba.test", 'buyer@camba.test, other@camba.test'] as $email) {
            $this->postJson(self::PATH, ['email' => $email] + self::FORM)->assertUnprocessable()->assertJsonValidationErrors('email');
        }
    }

    public function test_delivery_failure_is_not_an_acknowledgement(): void
    {
        $this->configureSupport();
        Mail::shouldReceive('send')->once()->andThrow(new TransportException('SMTP unavailable'));

        $this->postJson(self::PATH, self::FORM)->assertServiceUnavailable()->assertJsonPath('message', 'No pudimos enviar tu consulta. Probá de nuevo más tarde.');
    }

    public function test_contact_limits_submissions_per_ip(): void
    {
        $this->configureSupport();
        Mail::shouldReceive('send')->times(5);

        for ($i = 0; $i < 5; $i++) {
            $this->postJson(self::PATH, self::FORM)->assertNoContent();
        }
        $this->postJson(self::PATH, self::FORM)->assertTooManyRequests();
    }
}
