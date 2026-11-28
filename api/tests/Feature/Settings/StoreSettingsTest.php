<?php

namespace Tests\Feature\Settings;

use App\Models\StoreSettings;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Feature\TestDatabase;
use Tests\TestCase;

class StoreSettingsTest extends TestCase
{
    use RefreshDatabase;

    protected function beforeRefreshingDatabase(): void
    {
        TestDatabase::assertIsolated($this);
    }

    public function test_only_dedicated_admin_changes_settings_and_the_change_is_audited(): void
    {
        config(['checkout.delivery_cents' => 14500, 'checkout.pickup_address' => 'Pickup depot']);
        config(['store.public_contact.email' => null]);
        $admin = $this->adminIdentity();
        $url = '/api/v1/admin/settings';
        $this->withHeader('Origin', 'http://localhost')
            ->patchJson($url, ['delivery_cents' => null])->assertUnauthorized();
        $this->actingAs(User::factory()->create(), 'web')
            ->patchJson($url, ['delivery_cents' => null])->assertUnauthorized();
        $this->app['auth']->forgetGuards();
        $this->actingAs($admin, 'admin')->getJson($url)
            ->assertOk()->assertJsonPath('data.delivery_cents', 14500);
        $patch = ['delivery_cents' => null, 'support_email' => 'contact@example.test', 'remind_cart' => true];
        $this->patchJson($url, $patch + ['mailer_password' => 'invalid'])
            ->assertUnprocessable()->assertJsonValidationErrors('settings');
        $this->patchJson($url, ['delivery_cents' => -1])->assertUnprocessable();
        $this->patchJson($url, $patch)->assertOk()
            ->assertJsonPath('data.delivery_cents', null)->assertJsonPath('data.remind_cart', true);
        $this->patchJson($url, $patch)->assertOk();
        $this->getJson("$url/history")->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.actor_admin_id', $admin->id)
            ->assertJsonPath('data.0.before.delivery_cents', 14500)
            ->assertJsonPath('data.0.after.delivery_cents', null);
        $this->getJson('/api/v1/store-info')->assertOk()
            ->assertJsonPath('data.support_email', null)
            ->assertJsonPath('data.delivery_cents', null)
            ->assertJsonMissingPath('data.remind_cart');
        $this->assertDatabaseCount('store_setting_changes', 1);
    }

    public function test_free_delivery_settings_are_optional_and_require_positive_integer_cents_when_enabled(): void
    {
        config(['checkout.delivery_cents' => 18500]);
        $url = '/api/v1/admin/settings';
        $enabled = ['free_delivery_enabled' => true];
        $this->getJson('/api/v1/store-info')->assertOk()->assertJsonPath('data.free_delivery_minimum_cents', null);
        $this->withHeader('Origin', 'http://localhost')->actingAs(User::factory()->create(), 'web')
            ->patchJson($url, $enabled + ['free_delivery_minimum_cents' => 250000])->assertUnauthorized();
        $this->app['auth']->forgetGuards();
        $this->actingAs($this->adminIdentity(), 'admin')->getJson($url)->assertOk()
            ->assertJsonPath('data.free_delivery_enabled', false)->assertJsonPath('data.free_delivery_minimum_cents', null);

        $this->patchJson($url, $enabled + ['business_name' => 'Do not save'])->assertUnprocessable()
            ->assertJsonValidationErrors('free_delivery_minimum_cents');
        $this->getJson($url)->assertOk()->assertJsonPath('data.business_name', 'Camba')
            ->assertJsonPath('data.free_delivery_enabled', false);
        $this->assertDatabaseCount('store_setting_changes', 0);
        foreach ([0, -1, 250000.1, '250000'] as $invalid) {
            $this->patchJson($url, $enabled + ['free_delivery_minimum_cents' => $invalid])
                ->assertUnprocessable()->assertJsonValidationErrors('free_delivery_minimum_cents');
        }
        $this->patchJson($url, $enabled + ['free_delivery_minimum_cents' => 250000])->assertOk();
        $this->patchJson($url, ['free_delivery_minimum_cents' => null])->assertUnprocessable();
        $this->patchJson($url, ['free_delivery_minimum_cents' => 250001])->assertOk();
        $this->getJson($url)->assertOk()
            ->assertJsonPath('data.free_delivery_enabled', true)->assertJsonPath('data.free_delivery_minimum_cents', 250001);
        $this->getJson('/api/v1/store-info')->assertOk()
            ->assertJsonPath('data.free_delivery_minimum_cents', 250001)->assertJsonMissingPath('data.free_delivery_enabled');
        config(['checkout.delivery_cents' => null]);
        $this->getJson('/api/v1/store-info')->assertOk()->assertJsonPath('data.free_delivery_minimum_cents', null);
        config(['checkout.delivery_cents' => 18500]);
        $this->patchJson($url, ['free_delivery_enabled' => false])->assertOk()
            ->assertJsonPath('data.free_delivery_enabled', false)->assertJsonPath('data.free_delivery_minimum_cents', 250001);
        $this->getJson('/api/v1/store-info')->assertOk()->assertJsonPath('data.free_delivery_minimum_cents', null);
        $this->getJson("$url/history")->assertOk()->assertJsonPath('data.0.before.free_delivery_enabled', true)
            ->assertJsonPath('data.0.after.free_delivery_enabled', false);
        $this->assertDatabaseCount('store_setting_changes', 3);
    }

    public function test_public_contact_channels_come_only_from_configuration(): void
    {
        StoreSettings::query()->findOrFail(1)->forceFill(['values' => [
            'support_email' => 'internal@example.test',
            'support_phone' => '099 777 777',
        ]])->save();

        config([
            'mercadopago.access_token' => null,
            'store.fiscal_name' => null,
            'checkout.pickup_address' => null,
            'checkout.delivery_cents' => null,
            'store.public_contact.email' => ' hello@example.test ',
            'store.public_contact.phone' => ' +598 (99) 123-456 ',
        ]);
        $this->getJson('/api/v1/store-info')->assertOk()->assertExactJson(['data' => [
            'business_name' => 'Camba',
            'fiscalName' => null,
            'pickup_address' => null,
            'delivery_cents' => null,
            'free_delivery_minimum_cents' => null,
            'support_email' => 'hello@example.test',
            'support_phone' => '+598 (99) 123-456',
            'checkout_pro_available' => false,
        ]]);

        config(['store.public_contact.email' => '']);
        $this->getJson('/api/v1/store-info')->assertOk()
            ->assertJsonPath('data.support_email', null)
            ->assertJsonPath('data.support_phone', '+598 (99) 123-456');

        config(['store.public_contact.email' => 'hello@example.test', 'store.public_contact.phone' => '']);
        $this->getJson('/api/v1/store-info')->assertOk()
            ->assertJsonPath('data.support_email', 'hello@example.test')
            ->assertJsonPath('data.support_phone', null);

        config(['store.public_contact.email' => 'not-an-email', 'store.public_contact.phone' => '+598 99 123 456']);
        $this->getJson('/api/v1/store-info')->assertOk()
            ->assertJsonPath('data.support_email', null)
            ->assertJsonPath('data.support_phone', '+598 99 123 456');

        config(['store.public_contact.email' => 'hello+ventas@example.test', 'store.public_contact.phone' => '+598 interno']);
        $this->getJson('/api/v1/store-info')->assertOk()
            ->assertJsonPath('data.support_email', 'hello+ventas@example.test')
            ->assertJsonPath('data.support_phone', null);
    }

    public function test_fiscal_identity_is_validated_and_exposed_only_as_one_public_value(): void
    {
        foreach ([null, '', '  ', "Invalid\nName", ['not-a-name'], str_repeat('x', 201)] as $invalid) {
            config(['store.fiscal_name' => $invalid]);
            $this->getJson('/api/v1/store-info')->assertOk()->assertJsonPath('data.fiscalName', null);
        }
        config(['store.fiscal_name' => '  Empresa de prueba S.A.  ']);
        $this->getJson('/api/v1/store-info')->assertOk()
            ->assertJsonPath('data.fiscalName', 'Empresa de prueba S.A.')
            ->assertJsonMissingPath('data.fiscal_name')->assertJsonMissingPath('data.store');
        $this->actingAs($this->adminIdentity(), 'admin')
            ->patchJson('/api/v1/admin/settings', ['fiscalName' => 'Override'])
            ->assertUnprocessable();
        $this->getJson('/api/v1/admin/settings')->assertJsonMissingPath('data.fiscalName');
    }

    public function test_public_checkout_availability_contains_no_provider_configuration(): void
    {
        $configured = [
            'app.url' => 'https://checkout.example.test',
            'mercadopago.access_token' => 'synthetic-private-token',
            'mercadopago.collector_id' => '912345678',
            'mercadopago.webhook_secret' => 'synthetic-signing-secret',
            'mercadopago.public_key' => 'synthetic-public-key',
        ];
        config($configured);
        $this->getJson('/api/v1/store-info')->assertOk()
            ->assertJsonPath('data.checkout_pro_available', true)
            ->assertDontSee(array_values($configured));

        foreach ([
            ['mercadopago.access_token' => 'X'],
            ['mercadopago.collector_id' => null],
            ['mercadopago.webhook_secret' => 'X'],
            ['app.url' => 'http://localhost:4200'],
            ['app.url' => 'https://127.0.0.1:4200'],
        ] as $missing) {
            config($missing + $configured);
            $this->getJson('/api/v1/store-info')->assertOk()->assertJsonPath('data.checkout_pro_available', false);
        }
    }
}
