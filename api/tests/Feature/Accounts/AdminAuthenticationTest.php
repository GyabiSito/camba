<?php

namespace Tests\Feature\Accounts;

use App\Models\Admin;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Feature\TestDatabase;
use Tests\TestCase;

class AdminAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    protected function beforeRefreshingDatabase(): void
    {
        TestDatabase::assertIsolated($this);
    }

    public function test_admin_login_ignores_buyers_and_legacy_admin_users(): void
    {
        $buyer = User::factory()->create();
        $legacy = User::factory()->create(['role' => 'admin']);
        foreach ([$buyer, $legacy] as $user) {
            $this->postJson('/api/v1/admin/auth/login', ['email' => $user->email, 'password' => 'password'])
                ->assertUnprocessable()->assertJsonValidationErrors('email');
            $this->getJson('/api/v1/admin/session')->assertUnauthorized();
        }
    }

    public function test_admin_can_log_in_with_the_dedicated_account_but_not_in_the_store(): void
    {
        $admin = Admin::query()->create(['name' => 'Operador', 'email' => 'admin@camba.test', 'password' => 'Admin-test-password']);
        $credentials = ['email' => $admin->email, 'password' => 'Admin-test-password'];
        $login = $this->postJson('/api/v1/admin/auth/login', $credentials)->assertNoContent();
        $login->assertCookie('camba_admin_session')->assertCookie('CAMBA-ADMIN-XSRF-TOKEN');
        $this->withCookie('camba_admin_session', $login->getCookie('camba_admin_session')->getValue());
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/admin/session')->assertOk()->assertJsonPath('data.email', $admin->email);

        $this->app['auth']->forgetGuards()->shouldUse('web');
        $this->withHeader('Origin', 'http://localhost');
        $this->postJson('/api/v1/auth/login', $credentials)->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_a_store_buyer_has_no_admin_endpoint_access_and_legacy_accounts_do_not_receive_reset_mail(): void
    {
        Notification::fake();
        $buyer = User::factory()->create();
        $legacy = User::factory()->create(['role' => 'admin']);
        $this->actingAs($buyer, 'web')->withHeader('Origin', 'http://localhost')->withCredentials();
        $this->getJson('/api/v1/admin/settings')->assertUnauthorized();
        $this->postJson('/api/v1/auth/forgot-password', ['email' => $legacy->email])->assertAccepted();
        Notification::assertNothingSent();
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $legacy->email]);
    }

    public function test_production_only_issues_host_only_secure_admin_cookies_on_the_admin_host(): void
    {
        $this->app->detectEnvironment(static fn () => 'production');
        config(['app.admin_url' => 'https://admin.camba.test', 'session.domain' => '.camba.test']);

        $this->getJson('https://store.camba.test/api/v1/admin/auth/csrf-cookie')->assertNotFound()
            ->assertCookieMissing('camba_admin_session')->assertCookieMissing('CAMBA-ADMIN-XSRF-TOKEN');
        foreach (['session', 'products', 'settings'] as $path) {
            $this->getJson('https://store.camba.test/api/v1/admin/'.$path)->assertNotFound()
                ->assertCookieMissing('camba_admin_session');
        }
        $this->postJson('https://store.camba.test/api/v1/admin/auth/login', ['email' => 'buyer@camba.test', 'password' => 'password'])
            ->assertNotFound()->assertCookieMissing('camba_admin_session');
        $response = $this->getJson('https://admin.camba.test/api/v1/admin/auth/csrf-cookie')->assertNoContent();
        $this->getJson('https://admin.camba.test/api/v1/admin/session')->assertUnauthorized();
        foreach (['camba_admin_session', 'CAMBA-ADMIN-XSRF-TOKEN'] as $name) {
            $cookie = $response->getCookie($name, decrypt: false);
            $this->assertNotNull($cookie);
            $this->assertEmpty($cookie->getDomain());
            $this->assertTrue($cookie->isSecure());
        }
    }

    public function test_all_admin_routes_except_login_and_csrf_require_the_admin_guard(): void
    {
        foreach ($this->app['router']->getRoutes() as $route) {
            if (str_starts_with($route->uri(), 'api/v1/admin/')
                && ! in_array($route->uri(), ['api/v1/admin/auth/login', 'api/v1/admin/auth/csrf-cookie'], true)) {
                $this->assertContains('auth:admin', $route->gatherMiddleware(), $route->uri());
            }
        }
    }

    public function test_recovery_invalidates_a_previous_admin_login(): void
    {
        $admin = $this->adminIdentity(['password' => 'initial-admin-test-password']);
        $response = $this->postJson('/api/v1/admin/auth/login', [
            'email' => $admin->email, 'password' => 'initial-admin-test-password',
        ])->assertNoContent();
        $this->withCookie('camba_admin_session', $response->getCookie('camba_admin_session')->getValue());
        $this->artisan('camba:admin', ['email' => $admin->email])
            ->expectsQuestion('New administrator password', 'updated-admin-test-password')
            ->expectsQuestion('Repeat administrator password', 'updated-admin-test-password')
            ->assertSuccessful();

        $this->app['auth']->forgetGuards();
        $this->getJson('/api/v1/admin/session')->assertUnauthorized();
    }
}
