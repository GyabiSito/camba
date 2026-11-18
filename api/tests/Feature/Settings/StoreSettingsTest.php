<?php

namespace Tests\Feature\Settings;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StoreSettingsTest extends TestCase
{
    use RefreshDatabase;

    protected function beforeRefreshingDatabase(): void
    {
        $this->assertContains(config('database.connections.'.config('database.default').'.database'), [':memory:', 'camba_v2_test']);
    }

    public function test_only_verified_admin_changes_settings_and_the_change_is_audited(): void
    {
        config(['checkout.delivery_cents' => 14500, 'checkout.pickup_address' => 'Pickup depot']);
        $admin = User::factory()->create(['role' => 'admin']);
        $url = '/api/v1/admin/settings';
        $this->withHeader('Origin', 'http://localhost')
            ->patchJson($url, ['delivery_cents' => null])->assertUnauthorized();
        $this->actingAs(User::factory()->create(), 'web')
            ->patchJson($url, ['delivery_cents' => null])->assertForbidden();
        $this->app['auth']->forgetGuards();
        $this->actingAs($admin, 'web')->getJson($url)
            ->assertOk()->assertJsonPath('data.delivery_cents', 14500);
        $patch = ['delivery_cents' => null, 'support_email' => 'contact@example.test', 'remind_cart' => true];
        $this->patchJson($url, $patch + ['mailer_password' => 'invalid'])
            ->assertUnprocessable()->assertJsonValidationErrors('settings');
        $this->patchJson($url, ['delivery_cents' => -1])->assertUnprocessable();
        $this->patchJson($url, $patch)->assertOk()
            ->assertJsonPath('data.delivery_cents', null)->assertJsonPath('data.remind_cart', true);
        $this->patchJson($url, $patch)->assertOk();
        $this->getJson("$url/history")->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.actor_id', $admin->id)
            ->assertJsonPath('data.0.before.delivery_cents', 14500)
            ->assertJsonPath('data.0.after.delivery_cents', null);
        $this->getJson('/api/v1/store-info')->assertOk()
            ->assertJsonPath('data.support_email', 'contact@example.test')
            ->assertJsonPath('data.delivery_cents', null)
            ->assertJsonMissingPath('data.remind_cart');
        $this->assertDatabaseCount('store_setting_changes', 1);
    }
}
