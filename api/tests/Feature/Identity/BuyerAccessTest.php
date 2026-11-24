<?php

namespace Tests\Feature\Identity;

use App\Jobs\SendCommerceNotice;
use App\Mail\CommerceNoticeMail;
use App\Models\CommerceNotice;
use App\Models\User;
use App\Notifications\QueuedVerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\URL;
use RuntimeException;
use Tests\TestCase;

class BuyerAccessTest extends TestCase
{
    public function test_api_guards_return_json_without_an_accept_header(): void
    {
        $this->get('/api/v1/auth/me')->assertUnauthorized()->assertJsonPath('message', 'Unauthenticated.');
        $this->get('/api/v1/admin/session')->assertUnauthorized()->assertJsonPath('message', 'Unauthenticated.');
    }

    use RefreshDatabase;

    protected function beforeRefreshingDatabase(): void
    {
        $connection = config('database.default');
        $database = config("database.connections.$connection.database");

        $this->assertTrue(
            ($connection === 'sqlite' && $database === ':memory:') || ($connection === 'mysql' && $database === 'camba_v2_test'),
            'The identity suite may only reset an in-memory database or the dedicated Camba v2 test database.',
        );
    }

    public function test_registration_normalizes_email_and_requests_verification(): void
    {
        Notification::fake();
        $this->withHeader('Origin', 'http://localhost');

        $this->postJson('/api/v1/auth/register', $this->registration())
            ->assertCreated()
            ->assertJsonPath('data.email', 'buyer@example.test')
            ->assertJsonMissingPath('data.password');

        $buyer = User::query()->sole();
        $this->assertSame('buyer', $buyer->role);
        $this->assertFalse($buyer->hasVerifiedEmail());
        $this->assertTrue(Hash::check('testing-only-passphrase', $buyer->password));
        Notification::assertSentTo($buyer, QueuedVerifyEmail::class);

        $this->postJson('/api/v1/auth/register', $this->registration())
            ->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->assertDatabaseCount('users', 1);
    }

    public function test_public_registration_rejects_a_role(): void
    {
        $this->withHeader('Origin', 'http://localhost')
            ->postJson('/api/v1/auth/register', [...$this->registration(), 'role' => 'admin'])
            ->assertUnprocessable()->assertJsonValidationErrors('role');

        $this->assertDatabaseCount('users', 0);
    }

    public function test_only_a_verified_account_granted_admin_locally_can_use_admin_session(): void
    {
        $unverified = User::factory()->unverified()->create();
        $owner = User::factory()->create(['email' => 'owner@example.test']);
        $this->withHeader('Origin', 'http://localhost');

        $this->getJson('/api/v1/admin/session')->assertUnauthorized();
        $this->actingAs($owner, 'web')->getJson('/api/v1/admin/session')->assertForbidden();
        $this->artisan('camba:grant-admin', ['email' => $unverified->email])->assertFailed();
        $this->assertSame('buyer', $unverified->fresh()->role);
        $unverified->forceFill(['role' => 'admin'])->save();
        $this->app['auth']->forgetGuards();
        $this->actingAs($unverified, 'web')->getJson('/api/v1/admin/session')->assertForbidden();
        $this->artisan('camba:grant-admin', ['email' => ' OWNER@Example.Test '])->assertSuccessful();
        $this->assertSame('admin', $owner->fresh()->role);
        $this->app['auth']->forgetGuards();
        $this->actingAs($owner->fresh(), 'web')->getJson('/api/v1/admin/session')->assertOk()->assertJsonPath('data.role', 'admin');
    }

    public function test_a_buyer_can_retry_verification_after_a_queue_outage(): void
    {
        Queue::shouldReceive('connection')->once()->andThrow(new RuntimeException('Test queue unavailable'));
        $this->withHeader('Origin', 'http://localhost');

        $this->postJson('/api/v1/auth/register', $this->registration())
            ->assertCreated()->assertJsonPath('meta.verification_queued', false);
        $buyer = User::query()->sole();
        $this->assertFalse($buyer->hasVerifiedEmail());

        Notification::fake();
        $this->postJson('/api/v1/auth/email/verification-notification')->assertUnauthorized();
        $this->postJson('/api/v1/auth/login', ['email' => $buyer->email, 'password' => 'testing-only-passphrase'])
            ->assertNoContent();
        $this->postJson('/api/v1/auth/email/verification-notification')->assertNoContent();
        Notification::assertSentToTimes($buyer, QueuedVerifyEmail::class, 1);
        $this->assertDatabaseCount('users', 1);
    }

    public function test_registration_cannot_create_an_account_without_a_first_party_session(): void
    {
        Notification::fake();

        $this->withHeader('Origin', 'https://unrelated.example.test')
            ->postJson('/api/v1/auth/register', $this->registration())->assertBadRequest();

        $this->assertDatabaseCount('users', 0);
        Notification::assertNothingSent();
    }

    public function test_registration_requires_csrf_on_a_first_party_request(): void
    {
        $this->app->instance('env', 'local'); // Exercise CSRF instead of Laravel's unit-test bypass.
        Notification::fake();

        $this->withHeader('Origin', 'http://localhost')
            ->postJson('/api/v1/auth/register', $this->registration())->assertStatus(419);

        $this->assertDatabaseCount('users', 0);
        Notification::assertNothingSent();
    }

    public function test_email_verification_requires_a_valid_unexpired_link(): void
    {
        $buyer = User::factory()->unverified()->create();
        $parameters = ['id' => $buyer->getKey(), 'hash' => sha1($buyer->email)];

        $this->getJson(URL::temporarySignedRoute('verification.verify', now()->subMinute(), $parameters))
            ->assertForbidden();
        $this->assertFalse($buyer->fresh()->hasVerifiedEmail());

        $this->getJson(URL::temporarySignedRoute('verification.verify', now()->addMinutes(5), $parameters))
            ->assertNoContent();
        $this->assertTrue($buyer->fresh()->hasVerifiedEmail());
    }

    public function test_first_buyer_verification_creates_one_welcome_and_existing_delivery_retries_it(): void
    {
        Notification::fake();
        Queue::fake();
        $this->freezeTime();
        $this->withHeader('Origin', 'http://localhost')
            ->postJson('/api/v1/auth/register', array_replace($this->registration(), ['name' => "Ana D'Ávila <b>"]))
            ->assertCreated();
        $buyer = User::query()->sole();
        $this->actingAs($buyer, 'web')->postJson('/api/v1/auth/email/verification-notification')->assertNoContent();
        Notification::assertSentToTimes($buyer, QueuedVerifyEmail::class, 2);
        $notices = CommerceNotice::query()->where('kind', 'buyer_welcome');
        $this->assertSame(0, $notices->count());

        $verify = URL::temporarySignedRoute('verification.verify', now()->addMinutes(5), [
            'id' => $buyer->id,
            'hash' => sha1($buyer->email),
        ]);
        $this->getJson($verify)->assertNoContent();
        $this->assertTrue($buyer->fresh()->hasVerifiedEmail());
        $this->getJson($verify)->assertNoContent();
        $notice = $notices->sole();
        $this->assertSame('pending', $notice->state);
        $this->artisan('camba:notices')->assertSuccessful();
        Queue::assertPushed(SendCommerceNotice::class, fn ($job) => $job->noticeId === $notice->id);

        config(['mail.default' => 'failover']);
        $job = new SendCommerceNotice($notice->id);
        $this->app->call([$job, 'handle']);
        $this->assertTrue($buyer->fresh()->hasVerifiedEmail());
        $this->assertDatabaseHas('commerce_notices', ['id' => $notice->id, 'state' => 'pending', 'attempts' => 1, 'error_code' => 'preparation_failed']);

        $this->travel(2)->minutes();
        config(['mail.default' => 'array']);
        $this->app->call([$job, 'handle']);
        $this->app->call([$job, 'handle']);
        $this->assertDatabaseHas('commerce_notices', ['id' => $notice->id, 'state' => 'sent', 'attempts' => 2]);
        $messages = Mail::mailer('array')->getSymfonyTransport()->messages();
        $this->assertCount(1, $messages);
        $mail = $messages->first()->getOriginalMessage();
        $this->assertSame('Te damos la bienvenida a Camba', $mail->getSubject());
        $this->assertSame($buyer->email, $mail->getTo()[0]->getAddress());
        $this->assertStringContainsString("¡Hola, Ana D'Ávila <b>!", $mail->getTextBody());
        $this->assertStringContainsString(e("¡Hola, Ana D'Ávila <b>!"), $mail->getHtmlBody());
        $this->assertStringContainsString(rtrim(config('app.url'), '/').'/tienda', $mail->getTextBody());
        $this->assertStringContainsString('Ver tienda', $mail->getHtmlBody());

        (new CommerceNoticeMail($notice->id, $notice->kind, null, buyerName: ' '))
            ->assertSeeInText('¡Hola! Tu correo ya está verificado.');
    }

    public function test_already_verified_accounts_and_admins_do_not_generate_a_welcome(): void
    {
        foreach ([User::factory()->create(), User::factory()->unverified()->create(['role' => 'admin'])] as $user) {
            $this->getJson(URL::temporarySignedRoute('verification.verify', now()->addMinutes(5), [
                'id' => $user->id,
                'hash' => sha1($user->email),
            ]))->assertNoContent();
            $this->assertTrue($user->fresh()->hasVerifiedEmail());
        }
        $this->assertDatabaseMissing('commerce_notices', ['kind' => 'buyer_welcome']);
    }

    public function test_welcome_is_atomic_and_stays_bound_to_the_confirmed_address(): void
    {
        $buyer = User::factory()->unverified()->create();
        $verify = URL::temporarySignedRoute('verification.verify', now()->addMinutes(5), [
            'id' => $buyer->id,
            'hash' => sha1($buyer->email),
        ]);
        $creating = 'eloquent.creating: '.CommerceNotice::class;
        Event::listen($creating, fn () => throw new RuntimeException('Synthetic ledger failure'));
        try {
            $this->getJson($verify)->assertServerError();
            $this->assertFalse($buyer->fresh()->hasVerifiedEmail());
            $this->assertDatabaseMissing('commerce_notices', ['kind' => CommerceNotice::BUYER_WELCOME]);
        } finally {
            Event::forget($creating);
        }

        $this->getJson($verify)->assertNoContent();
        $notice = CommerceNotice::query()->where('kind', CommerceNotice::BUYER_WELCOME)->sole();
        $buyer->update(['email' => 'changed@example.test']);
        Mail::fake();
        $this->app->call([new SendCommerceNotice($notice->id), 'handle']);
        $this->assertSame('cancelled', $notice->fresh()->state);
        $this->assertTrue($buyer->fresh()->hasVerifiedEmail());
        Mail::assertNothingSent();
    }

    public function test_first_party_buyer_can_log_in_read_session_and_log_out(): void
    {
        $buyer = User::factory()->create(['email' => 'buyer@example.test']);
        $this->withHeader('Origin', 'http://localhost');

        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
        $this->postJson('/api/v1/auth/login', ['email' => ' BUYER@example.test ', 'password' => 'wrong'])
            ->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->postJson('/api/v1/auth/login', ['email' => ' BUYER@example.test ', 'password' => 'password'])
            ->assertNoContent();
        $this->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.id', $buyer->id);
        $this->postJson('/api/v1/auth/logout')->assertNoContent();
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    /** @return array<string, string> */
    private function registration(): array
    {
        return [
            'name' => 'Test Buyer',
            'email' => ' BUYER@Example.Test ',
            'password' => 'testing-only-passphrase',
            'password_confirmation' => 'testing-only-passphrase',
        ];
    }
}
