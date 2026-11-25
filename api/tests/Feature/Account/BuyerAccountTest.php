<?php

namespace Tests\Feature\Account;

use App\Models\Address;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class BuyerAccountTest extends TestCase
{
    use RefreshDatabase;

    private const PROFILE = '/api/v1/account/profile';

    private const ADDRESSES = '/api/v1/account/addresses';

    protected function beforeRefreshingDatabase(): void
    {
        $connection = config('database.default');
        $database = config("database.connections.$connection.database");
        $isolatedPostgres = $connection === 'pgsql' && $database === 'camba_v2_demo_test'
            && $this->app->environment('testing') && config('database.connections.pgsql.host') === 'postgres'
            && empty(config('database.connections.pgsql.url'));

        $this->assertTrue(
            ($connection === 'sqlite' && $database === ':memory:') || ($connection === 'mysql' && $database === 'camba_v2_test') || $isolatedPostgres,
            'The account suite may only reset an in-memory database or the dedicated Camba v2 test database.',
        );
    }

    public function test_account_routes_require_authentication(): void
    {
        $this->withHeader('Origin', 'http://localhost');

        $this->getJson(self::PROFILE)->assertUnauthorized();
        $this->patchJson(self::PROFILE, ['name' => 'Updated Buyer'])->assertUnauthorized();
        $this->getJson(self::ADDRESSES)->assertUnauthorized();
        $this->postJson(self::ADDRESSES, $this->address())->assertUnauthorized();
        $this->getJson(self::ADDRESSES.'/1')->assertUnauthorized();
        $this->patchJson(self::ADDRESSES.'/1', ['street' => '18 de Julio'])->assertUnauthorized();
        $this->deleteJson(self::ADDRESSES.'/1')->assertUnauthorized();
    }

    public function test_buyer_can_read_and_update_only_their_profile_name(): void
    {
        $buyer = User::factory()->create(['name' => 'Original Buyer']);
        $this->login($buyer);
        $this->getJson(self::PROFILE)->assertOk()->assertExactJson(['data' => [
            'id' => $buyer->id,
            'name' => $buyer->name,
            'email' => $buyer->email,
            'role' => 'buyer',
            'email_verified' => true,
        ]]);

        $this->patchJson(self::PROFILE, ['name' => str_repeat('x', 121)])
            ->assertUnprocessable()->assertJsonValidationErrors('name');
        $this->patchJson(self::PROFILE, [
            'name' => 'Unexpected Change',
            'email' => 'other@example.test',
            'password' => 'other-password',
            'role' => 'admin',
            'user_id' => $buyer->id + 1,
        ])->assertUnprocessable()->assertJsonValidationErrors(['email', 'password', 'role', 'user_id']);
        $this->assertSame('Original Buyer', $buyer->fresh()->name);

        $this->patchJson(self::PROFILE, ['name' => ' Updated Buyer '])
            ->assertOk()->assertJsonPath('data.name', 'Updated Buyer')->assertJsonMissingPath('data.password');
        $this->assertDatabaseHas('users', [
            'id' => $buyer->id, 'name' => 'Updated Buyer', 'email' => $buyer->email, 'role' => 'buyer',
        ]);
        $this->assertSame($buyer->password, $buyer->fresh()->password);
    }

    public function test_buyer_can_create_read_edit_and_delete_validated_addresses(): void
    {
        $buyer = User::factory()->create();
        $this->login($buyer);
        $this->getJson(self::ADDRESSES)->assertExactJson(['data' => []]);
        $this->postJson(self::ADDRESSES)->assertUnprocessable()
            ->assertJsonValidationErrors(['recipient', 'department_id', 'locality_id', 'street', 'number']);
        $this->assertDatabaseCount('addresses', 0);

        $created = $this->postJson(self::ADDRESSES, $this->address())
            ->assertCreated()->assertJsonMissingPath('data.user_id');
        $id = $created->json('data.id');
        $url = self::ADDRESSES.'/'.$id;
        $address = ['id' => $id, ...$this->address(), 'department' => 'Canelones', 'locality' => 'Ciudad De La Costa', 'phone' => null, 'postal_code' => null];

        $this->getJson($url)->assertOk()->assertExactJson(['data' => $address]);
        $this->getJson(self::ADDRESSES)->assertOk()->assertExactJson(['data' => [$address]]);
        $this->assertDatabaseHas('addresses', ['id' => $id, 'user_id' => $buyer->id, 'locality_id' => $address['locality_id']]);
        $this->patchJson($url, ['department_id' => 10])->assertUnprocessable()->assertJsonValidationErrors('locality_id');
        $this->patchJson($url, ['department_id' => 10, 'locality_id' => $address['locality_id']])
            ->assertUnprocessable()->assertJsonValidationErrors('locality_id');
        $this->patchJson($url, ['street' => null, 'postal_code' => str_repeat('1', 13)])
            ->assertUnprocessable()->assertJsonValidationErrors(['street', 'postal_code']);
        $this->assertDatabaseHas('addresses', ['id' => $id, 'street' => $address['street'], 'postal_code' => null]);

        $this->patchJson($url, ['street' => '18 de Julio', 'details' => null, 'postal_code' => '00123'])
            ->assertOk()->assertExactJson(['data' => [
                ...$address, 'street' => '18 de Julio', 'details' => null, 'postal_code' => '00123',
            ]]);
        $this->assertDatabaseHas('addresses', [
            'id' => $id, 'street' => '18 de Julio', 'details' => null, 'postal_code' => '00123',
        ]);
        $this->deleteJson($url)->assertNoContent();
        $this->getJson($url)->assertNotFound();
        $this->assertDatabaseCount('addresses', 0);
    }

    public function test_legacy_address_remains_readable_and_must_be_explicitly_linked(): void
    {
        $buyer = User::factory()->create();
        $this->login($buyer);
        $legacy = Address::query()->forceCreate([
            'user_id' => $buyer->id, 'recipient' => 'Test Buyer', 'street' => 'Old Street', 'number' => '123',
            'department' => 'monteVIDEO', 'locality' => 'Old locality not in directory',
        ]);
        $url = self::ADDRESSES.'/'.$legacy->id;
        $this->getJson($url)->assertOk()->assertJsonPath('data.department_id', null)
            ->assertJsonPath('data.locality_id', null)->assertJsonPath('data.department', 'monteVIDEO')
            ->assertJsonPath('data.locality', 'Old locality not in directory');
        $this->postJson(self::ADDRESSES, [...$this->address(), 'department_id' => 10])
            ->assertUnprocessable()->assertJsonValidationErrors('locality_id');
        $this->patchJson($url, $this->address())->assertOk()
            ->assertJsonPath('data.locality_id', $this->address()['locality_id'])
            ->assertJsonPath('data.department', 'Canelones');
    }

    public function test_address_lookups_and_writes_cannot_cross_accounts(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $this->login($owner);
        $id = $this->postJson(self::ADDRESSES, $this->address())->assertCreated()->json('data.id');
        $url = self::ADDRESSES.'/'.$id;

        $this->postJson('/api/v1/auth/logout')->assertNoContent();
        $this->app['auth']->forgetGuards();
        $this->login($other);
        $this->postJson(self::ADDRESSES, [...$this->address(), 'user_id' => $owner->id])
            ->assertUnprocessable()->assertJsonValidationErrors('user_id');
        $ownId = $this->postJson(self::ADDRESSES, $this->address())->assertCreated()->json('data.id');
        $this->getJson(self::ADDRESSES)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $ownId);
        $this->getJson($url)->assertNotFound();
        $this->patchJson($url, ['street' => 'Not Owned'])->assertNotFound();
        $this->patchJson($url, ['street' => null])->assertNotFound();
        $this->deleteJson($url)->assertNotFound();
        $this->patchJson(self::ADDRESSES.'/'.$ownId, ['user_id' => $owner->id])
            ->assertUnprocessable()->assertJsonValidationErrors('user_id');
        $this->assertDatabaseCount('addresses', 2);
        $this->assertDatabaseHas('addresses', ['id' => $id, 'user_id' => $owner->id, 'locality_id' => $this->address()['locality_id']]);
        $this->assertDatabaseHas('addresses', ['id' => $ownId, 'user_id' => $other->id, 'locality_id' => $this->address()['locality_id']]);
    }

    private function login(User $buyer): void
    {
        $this->withHeader('Origin', 'http://localhost')
            ->postJson('/api/v1/auth/login', ['email' => $buyer->email, 'password' => 'password'])
            ->assertNoContent();
    }

    /** @return array<string, string|int> */
    private function address(): array
    {
        return [
            'recipient' => 'Test Buyer',
            'department_id' => 2,
            'locality_id' => (int) DB::table('localities')->where(['department_id' => 2, 'source_id' => 55])->value('id'),
            'street' => 'Giannattasio',
            'number' => '123A',
            'details' => 'Apartment 2',
        ];
    }
}
