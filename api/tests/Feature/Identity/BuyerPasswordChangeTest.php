<?php

namespace Tests\Feature\Identity;

use App\Actions\Notices\DeliverCommerceNotice;
use App\Mail\CommerceNoticeMail;
use App\Models\CommerceNotice;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class BuyerPasswordChangeTest extends TestCase
{
    use RefreshDatabase;

    private const PATH = '/api/v1/account/password';

    private const OLD = 'old-synthetic-password';

    private const NEW = 'new-synthetic-password';

    protected function beforeRefreshingDatabase(): void
    {
        $connection = config('database.default');
        $database = config("database.connections.$connection.database");
        $this->assertTrue(
            ($connection === 'sqlite' && $database === ':memory:')
                || ($connection === 'mysql' && $database === 'camba_v2_test')
                || ($connection === 'pgsql' && $database === 'camba_v2_demo_test'
                    && config('database.connections.pgsql.host') === 'postgres' && ! config('database.connections.pgsql.url')),
            'Password change tests require an isolated database.',
        );
    }

    protected function setUp(): void
    {
        parent::setUp();
        config(['session.driver' => 'database']);
        $this->withCredentials()->withHeader('Origin', 'http://localhost');
    }

    public function test_only_a_buyer_with_csrf_can_change_password(): void
    {
        $csrf = $this->get('/sanctum/csrf-cookie')->assertNoContent();
        $this->keepSession($csrf);
        $this->app->instance('env', 'local');
        $this->patchJson(self::PATH, $this->payload())->assertStatus(419);
        $this->withHeader('X-XSRF-TOKEN', $csrf->getCookie('XSRF-TOKEN', decrypt: false)->getValue());
        $this->patchJson(self::PATH, $this->payload())->assertUnauthorized();

        $this->app->instance('env', 'testing');
        $admin = User::factory()->create(['role' => 'admin', 'password' => self::OLD]);
        $this->keepSession($this->login($admin, self::OLD)->assertNoContent());
        $this->patchJson(self::PATH, $this->payload())->assertForbidden();
        $this->assertTrue(Hash::check(self::OLD, $admin->fresh()->password));
        $this->assertDatabaseMissing('commerce_notices', ['kind' => 'buyer_password_changed']);
    }

    public function test_invalid_passwords_and_an_explicit_target_do_not_change_the_hash(): void
    {
        $buyer = User::factory()->create(['role' => 'buyer', 'password' => self::OLD]);
        $other = User::factory()->create(['role' => 'buyer', 'password' => self::OLD]);
        $this->keepSession($this->login($buyer, self::OLD)->assertNoContent());

        foreach ([
            ['current_password', ['current_password' => 'invalid-current-password']],
            ['password_confirmation', ['password_confirmation' => 'different-password']],
            ['password', ['password' => 'too-short', 'password_confirmation' => 'too-short']],
            ['password', ['password' => str_repeat('á', 37), 'password_confirmation' => str_repeat('á', 37)]],
            ['password', ['password' => self::NEW."\0", 'password_confirmation' => self::NEW."\0"]],
            ['user_id', ['user_id' => $other->id]],
        ] as [$field, $override]) {
            $this->patchJson(self::PATH, array_replace($this->payload(), $override))
                ->assertUnprocessable()->assertJsonValidationErrors($field);
            $this->assertSame($buyer->password, $buyer->fresh()->password);
            $this->assertSame($other->password, $other->fresh()->password);
        }
        $this->assertDatabaseMissing('commerce_notices', ['kind' => 'buyer_password_changed']);
    }

    public function test_change_updates_the_hash_but_keeps_the_current_session_and_requires_the_new_password(): void
    {
        $buyer = User::factory()->create(['role' => 'buyer', 'password' => self::OLD]);
        $session = $this->keepSession($this->login($buyer, self::OLD)->assertNoContent());
        $this->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.id', $buyer->id);

        $changed = $this->patchJson(self::PATH, $this->payload())->assertNoContent();
        $this->assertSame($session, $this->keepSession($changed));
        $this->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.id', $buyer->id);
        $this->assertFalse(Hash::check(self::OLD, $buyer->fresh()->password));
        $this->assertTrue(Hash::check(self::NEW, $buyer->fresh()->password));

        $this->keepSession($this->postJson('/api/v1/auth/logout')->assertNoContent());
        $this->login($buyer, self::OLD)->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->keepSession($this->login($buyer, self::NEW)->assertNoContent());
        $this->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.id', $buyer->id);
    }

    public function test_only_a_saved_change_generates_one_password_notice_without_credentials(): void
    {
        Mail::fake();
        $buyer = User::factory()->create(['role' => 'buyer', 'password' => self::OLD]);
        $this->keepSession($this->login($buyer, self::OLD)->assertNoContent());
        $this->patchJson(self::PATH, $this->payload())->assertNoContent();
        $this->patchJson(self::PATH, $this->payload())->assertUnprocessable()->assertJsonValidationErrors('current_password');
        $this->patchJson(self::PATH, array_replace($this->payload(), ['current_password' => self::NEW]))->assertNoContent();
        $notice = CommerceNotice::query()->where('kind', 'buyer_password_changed')->sole();
        $this->assertEquals($buyer->id, $notice->subject_id);
        Mail::assertNothingSent();

        $deliver = app(DeliverCommerceNotice::class);
        $deliver->execute($notice->id);
        $deliver->execute($notice->id);

        $this->assertSame('sent', $notice->fresh()->state);
        $mail = Mail::sent(CommerceNoticeMail::class)->sole();
        $intro = 'Actualizaste la contraseña de tu cuenta de Camba. Si no hiciste este cambio, restablecé tu contraseña desde la tienda y contactanos';
        $mail->assertTo($buyer->email)->assertHasSubject('Tu contraseña de Camba se actualizó')
            ->assertSeeInHtml($intro)->assertSeeInText($intro)
            ->assertDontSeeInHtml(self::OLD)->assertDontSeeInText(self::OLD)
            ->assertDontSeeInHtml(self::NEW)->assertDontSeeInText(self::NEW);
    }

    private function login(User $buyer, string $password): TestResponse
    {
        return $this->postJson('/api/v1/auth/login', ['email' => $buyer->email, 'password' => $password]);
    }

    private function payload(): array
    {
        return ['current_password' => self::OLD, 'password' => self::NEW, 'password_confirmation' => self::NEW];
    }

    private function keepSession(TestResponse $response): string
    {
        $cookie = $response->getCookie(config('session.cookie'));
        $this->assertNotNull($cookie);
        $this->app['session']->driver()->flush();
        $this->app['auth']->forgetGuards();
        $this->withCookie(config('session.cookie'), $cookie->getValue());

        return $cookie->getValue();
    }
}
