<?php

namespace Tests\Feature\Account;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
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

        $this->assertTrue(
            ($connection === 'sqlite' && $database === ':memory:') || ($connection === 'mysql' && $database === 'camba_v2_test'),
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
            ->assertJsonValidationErrors(['recipient', 'department', 'locality', 'street', 'number']);
        $this->assertDatabaseCount('addresses', 0);

        $created = $this->postJson(self::ADDRESSES, $this->address())
            ->assertCreated()->assertJsonMissingPath('data.user_id');
        $id = $created->json('data.id');
        $url = self::ADDRESSES.'/'.$id;
        $address = ['id' => $id, ...$this->address(), 'phone' => null, 'postal_code' => null];

        $this->getJson($url)->assertOk()->assertExactJson(['data' => $address]);
        $this->getJson(self::ADDRESSES)->assertOk()->assertExactJson(['data' => [$address]]);
        $this->assertDatabaseHas('addresses', ['id' => $id, 'user_id' => $buyer->id]);
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
        $this->assertDatabaseHas('addresses', ['id' => $id, 'user_id' => $owner->id, ...$this->address()]);
        $this->assertDatabaseHas('addresses', ['id' => $ownId, 'user_id' => $other->id, ...$this->address()]);
    }

    private function login(User $buyer): void
    {
        $this->withHeader('Origin', 'http://localhost')
            ->postJson('/api/v1/auth/login', ['email' => $buyer->email, 'password' => 'password'])
            ->assertNoContent();
    }

    /** @return array<string, string> */
    private function address(): array
    {
        return [
            'recipient' => 'Test Buyer',
            'department' => 'Canelones',
            'locality' => 'Ciudad de la Costa',
            'street' => 'Giannattasio',
            'number' => '123A',
            'details' => 'Apartment 2',
        ];
    }
}
