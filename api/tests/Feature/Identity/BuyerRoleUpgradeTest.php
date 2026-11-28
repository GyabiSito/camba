<?php

namespace Tests\Feature\Identity;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class BuyerRoleUpgradeTest extends TestCase
{
    public function test_migrate_adds_a_role_without_recreating_existing_users(): void
    {
        config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:']);
        $this->artisan('migrate', ['--path' => 'database/migrations/0001_01_01_000000_create_users_table.php'])
            ->assertSuccessful();

        if (Schema::hasColumn('users', 'role')) {
            Schema::table('users', fn (Blueprint $table) => $table->dropColumn('role'));
        }
        DB::table('users')->insert(['id' => 7, 'name' => 'Existing Buyer', 'email' => 'existing@example.test', 'password' => 'test-only-hash']);

        $this->artisan('migrate')->assertSuccessful();

        $this->assertTrue(Schema::hasColumn('users', 'role'));
        $this->assertDatabaseHas('users', ['id' => 7, 'email' => 'existing@example.test', 'password' => 'test-only-hash', 'role' => 'buyer']);
    }
}
