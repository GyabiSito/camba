<?php

namespace Tests\Feature\Accounts;

use App\Models\Admin;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\Feature\TestDatabase;
use Tests\TestCase;

class AdminProvisioningTest extends TestCase
{
    use RefreshDatabase;

    protected function beforeRefreshingDatabase(): void
    {
        TestDatabase::assertIsolated($this);
    }

    public function test_it_adopts_only_the_explicit_verified_legacy_identity_and_preserves_user_rows(): void
    {
        $other = User::factory()->create(['role' => 'admin']);
        $selected = User::factory()->create(['role' => 'admin']);
        $buyer = User::factory()->create();
        $before = User::query()->orderBy('id')->get()->toJson();

        $this->artisan('camba:admin', ['email' => $buyer->email, '--from-legacy' => true])->assertFailed();
        $this->artisan('camba:admin', ['email' => strtoupper($selected->email), '--from-legacy' => true])->assertSuccessful();

        $admin = Admin::query()->sole();
        $this->assertSame($selected->id, $admin->legacy_user_id);
        $this->assertSame($selected->email, $admin->email);
        $this->assertSame($selected->getRawOriginal('password'), $admin->getRawOriginal('password'));
        $this->assertSame($before, User::query()->orderBy('id')->get()->toJson());
        $this->artisan('camba:admin', ['email' => $other->email, '--from-legacy' => true])->assertFailed();
        $this->assertSame($admin->id, Admin::query()->sole()->id);
        $this->postJson('/api/v1/admin/auth/login', ['email' => $other->email, 'password' => 'password'])->assertUnprocessable();
        $this->postJson('/api/v1/admin/auth/login', ['email' => $selected->email, 'password' => 'password'])->assertNoContent();
    }

    public function test_it_provisions_and_rotates_the_single_credential_in_place(): void
    {
        $email = 'administracion@camba.test';
        $this->artisan('camba:admin', ['email' => $email, '--name' => 'Camba'])
            ->expectsQuestion('New administrator password', 'Strong-test-password-1')
            ->expectsQuestion('Repeat administrator password', 'Strong-test-password-1')
            ->assertSuccessful();

        $admin = Admin::query()->sole();
        $this->assertTrue(Hash::check('Strong-test-password-1', $admin->password));
        $this->assertDatabaseCount('users', 0);
        $this->artisan('camba:admin', ['email' => $email])
            ->expectsQuestion('New administrator password', 'Strong-test-password-2')
            ->expectsQuestion('Repeat administrator password', 'Strong-test-password-2')
            ->assertSuccessful();
        $this->assertTrue(Hash::check('Strong-test-password-2', $admin->fresh()->password));
        $this->assertDatabaseCount('admins', 1);

        $this->expectException(UniqueConstraintViolationException::class);
        Admin::query()->create(['name' => 'Second admin', 'email' => 'second@camba.test', 'password' => 'irrelevant-test-secret']);
    }
}
