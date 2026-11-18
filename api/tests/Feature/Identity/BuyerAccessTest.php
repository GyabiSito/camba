<?php

namespace Tests\Feature\Identity;

use App\Models\User;
use App\Notifications\QueuedVerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
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
