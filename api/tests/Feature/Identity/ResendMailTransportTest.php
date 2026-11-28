<?php

namespace Tests\Feature\Identity;

use App\Mail\RedactedResendTransport;
use Illuminate\Support\Facades\Mail;
use PHPUnit\Framework\Attributes\DataProvider;
use Resend\Client;
use Resend\Contracts\Transporter;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mime\Email;
use Tests\TestCase;

class ResendMailTransportTest extends TestCase
{
    public function test_an_empty_resend_key_prevents_mailer_initialization_without_exposing_config(): void
    {
        config(['services.resend.key' => null]);

        $this->expectException(TransportException::class);
        $this->expectExceptionMessage('Resend API key is not configured.');
        Mail::mailer('resend');
    }

    #[DataProvider('providerFailures')]
    public function test_native_resend_provider_errors_are_not_rethrown_with_sensitive_details(string $failure): void
    {
        $provider = $this->mock(Transporter::class);
        $provider->shouldReceive('request')->once()->andThrow(new $failure('provider-private-details'));
        $mailer = new RedactedResendTransport(new Client($provider));

        try {
            $mailer->send((new Email)->from('from@example.test')->to('to@example.test')->subject('Test')->text('Synthetic'));
            $this->fail('A provider refusal must not be treated as a successful delivery.');
        } catch (TransportException $error) {
            $this->assertSame('Resend delivery failed.', $error->getMessage());
            $this->assertNull($error->getPrevious());
        }
    }

    public static function providerFailures(): array
    {
        return ['exception' => [\RuntimeException::class], 'engine error' => [\Error::class]];
    }
}
