<?php

namespace Tests\Feature\Identity;

use App\Models\User;
use App\Notifications\QueuedResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class PasswordRecoveryTest extends TestCase
{
    use RefreshDatabase;

    protected function beforeRefreshingDatabase(): void
    {
        $connection = config('database.default');
        $database = config("database.connections.$connection.database");
        $this->assertTrue(($connection === 'sqlite' && $database === ':memory:') || ($connection === 'mysql' && $database === 'camba_v2_test'), 'Use only an isolated recovery test database.');
    }

    private function payload(User $user, string $token): array
    {
        $url = (new QueuedResetPassword($token))->toMail($user)->viewData['actionUrl'];
        parse_str(parse_url($url, PHP_URL_FRAGMENT) ?? '', $fragment);

        return ['token' => $fragment['reset'], 'password' => 'independent-new-secret', 'password_confirmation' => 'independent-new-secret'];
    }

    private function snapshot(): string
    {
        return hash('sha256', json_encode([DB::table('users')->orderBy('id')->get(), DB::table('password_reset_tokens')->orderBy('email')->get(), DB::table('sessions')->orderBy('id')->get()]));
    }

    public function test_delivered_link_resets_password_without_client_email(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $otherBefore = $other->fresh()->getRawOriginal();
        $token = Password::createToken($user);
        $this->withHeader('Origin', 'http://localhost');
        $this->postJson('/api/v1/auth/reset-password', $this->payload($user, $token))->assertNoContent();
        $this->assertTrue(Hash::check('independent-new-secret', $user->fresh()->password));
        $this->assertSame($otherBefore, $other->fresh()->getRawOriginal());
    }

    public function test_reassigning_the_original_email_does_not_transfer_reset_authority(): void
    {
        $user = User::factory()->create();
        $email = $user->email;
        $payload = $this->payload($user, Password::createToken($user));
        $user->update(['email' => 'changed@example.test']);
        User::factory()->create(['email' => $email]);

        $this->withHeader('Origin', 'http://localhost');
        $before = $this->snapshot();
        $this->postJson('/api/v1/auth/reset-password', $payload)->assertUnprocessable()->assertJsonValidationErrors(['token']);
        $this->assertSame($before, $this->snapshot());

        $user->delete();
        $before = $this->snapshot();
        $this->postJson('/api/v1/auth/reset-password', $payload)->assertUnprocessable()->assertJsonValidationErrors(['token']);
        $this->assertSame($before, $this->snapshot());
    }

    public function test_recovery_boundary_rejections_preserve_data(): void
    {
        $user = User::factory()->create();
        $token = Password::createToken($user);
        Notification::fake();
        $before = $this->snapshot();
        $this->withHeader('Origin', 'https://outside.example.test')->postJson('/api/v1/auth/forgot-password', ['email' => $user->email])->assertStatus(400);
        $this->postJson('/api/v1/auth/reset-password', $this->payload($user, $token))->assertStatus(400);
        $this->assertSame($before, $this->snapshot());
        Notification::assertNothingSent();
        $this->app->instance('env', 'local');
        $this->withHeader('Origin', 'http://localhost');
        $this->postJson('/api/v1/auth/forgot-password', ['email' => $user->email])->assertStatus(419);
        $this->postJson('/api/v1/auth/reset-password', $this->payload($user, $token))->assertStatus(419);
        $this->assertSame($before, $this->snapshot());
    }

    public function test_tampered_legacy_and_client_email_requests_preserve_credentials(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();
        $token = Password::createToken($user);
        $payload = $this->payload($user, $token);
        $altered = ($payload['token'][0] === 'A' ? 'B' : 'A').substr($payload['token'], 1);
        $before = $this->snapshot();
        $this->withHeader('Origin', 'http://localhost');
        foreach ([$token, $altered, $this->payload($other, $token)['token']] as $invalid) {
            $this->postJson('/api/v1/auth/reset-password', [...$payload, 'token' => $invalid])
                ->assertUnprocessable()->assertJsonValidationErrors(['token']);
        }
        $this->postJson('/api/v1/auth/reset-password', [...$payload, 'email' => $other->email])
            ->assertUnprocessable()->assertJsonValidationErrors(['email']);
        $this->postJson('/api/v1/auth/reset-password', [...$payload, 'password_confirmation' => 'mismatch'])
            ->assertUnprocessable()->assertJsonValidationErrors(['password']);
        $this->assertSame($before, $this->snapshot());
    }

    public function test_throttled_link_queue_failure_and_expiry_are_safe(): void
    {
        Notification::fake();
        $user = User::factory()->create();
        $this->withHeader('Origin', 'http://localhost');
        foreach ([$user->email, $user->email, 'missing@example.test'] as $email) {
            $this->postJson('/api/v1/auth/forgot-password', ['email' => $email])->assertStatus(202)->assertContent('');
        }
        $token = null;
        Notification::assertSentTo($user, QueuedResetPassword::class, function ($notification) use (&$token) {
            $token = $notification->token;

            return true;
        });
        $this->assertTrue(Password::tokenExists($user, $token));
        $this->assertNotSame($token, DB::table('password_reset_tokens')->value('token'));
        $payload = $this->payload($user, $token);
        $this->travel(config('auth.passwords.users.expire') * 60 + 1)->seconds();
        $before = $this->snapshot();
        $this->postJson('/api/v1/auth/reset-password', $payload)->assertUnprocessable()->assertJsonValidationErrors(['token']);
        $this->assertSame($before, $this->snapshot());
        $this->assertFalse((new QueuedResetPassword($token))->shouldSend($user, 'mail'));
    }

    public function test_reset_revokes_database_sessions_and_remember_cookie_without_login(): void
    {
        config(['session.driver' => 'database']);
        $user = User::factory()->create(['remember_token' => 'old-remember']);
        $other = User::factory()->create();
        foreach ([$user, $other] as $account) {
            DB::table('sessions')->insert(['id' => 'probe-'.$account->id, 'user_id' => $account->id, 'payload' => '', 'last_activity' => now()->timestamp]);
        }
        $token = Password::createToken($user);
        $payload = $this->payload($user, $token);
        $this->withHeader('Origin', 'http://localhost');
        $this->postJson('/api/v1/auth/reset-password', $payload)->assertStatus(204);
        $this->assertTrue(Hash::check('independent-new-secret', $user->fresh()->password));
        $this->assertNotSame('old-remember', $user->fresh()->remember_token);
        $this->assertDatabaseMissing('sessions', ['id' => 'probe-'.$user->id]);
        $this->assertDatabaseHas('sessions', ['id' => 'probe-'.$other->id]);
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/auth/me')->assertStatus(401);
        $before = $this->snapshot();
        $this->postJson('/api/v1/auth/reset-password', $payload)->assertUnprocessable()->assertJsonValidationErrors(['token']);
        $this->assertSame($before, $this->snapshot());
        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'password'])->assertStatus(422);
        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'independent-new-secret'])->assertStatus(204);
    }

    public function test_queue_failure_has_same_public_status_as_unknown_account(): void
    {
        $user = User::factory()->create();
        Queue::shouldReceive('connection')->once()->andThrow(new \RuntimeException('isolated queue failure'));
        $this->withHeader('Origin', 'http://localhost');
        $this->postJson('/api/v1/auth/forgot-password', ['email' => $user->email])->assertStatus(202)->assertContent('');
        $this->postJson('/api/v1/auth/forgot-password', ['email' => 'unknown@example.test'])->assertStatus(202)->assertContent('');
    }

    public function test_current_logged_in_session_cannot_survive_reset(): void
    {
        config(['session.driver' => 'database']);
        $user = User::factory()->create();
        $this->withHeader('Origin', 'http://localhost');
        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'password'])->assertStatus(204);
        $this->getJson('/api/v1/auth/me')->assertStatus(200);
        $token = Password::createToken($user);
        $this->postJson('/api/v1/auth/reset-password', $this->payload($user, $token))->assertStatus(204);
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/auth/me')->assertStatus(401);
    }
}
