<?php

namespace Tests\Feature\Geography;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class GeographyTest extends TestCase
{
    use RefreshDatabase;

    protected function beforeRefreshingDatabase(): void
    {
        $connection = config('database.default');
        $database = config("database.connections.$connection.database");
        $isolated = match ($connection) {
            'sqlite' => $database === ':memory:',
            'mysql' => $database === 'camba_test',
            'pgsql' => $database === 'camba_demo_test' && config('database.connections.pgsql.host') === 'postgres',
            default => false,
        };

        $this->assertTrue(
            $isolated && $this->app->environment('testing') && empty(config("database.connections.$connection.url")),
            'The geography suite may only reset an in-memory or dedicated test database.',
        );
    }

    public function test_public_directory_returns_only_the_selected_departments_localities(): void
    {
        $this->getJson('/api/v1/geography/departments')
            ->assertOk()
            ->assertJsonCount(19, 'data')
            ->assertJsonPath('data.0', ['id' => 1, 'name' => 'Artigas']);

        $this->getJson('/api/v1/geography/departments/2/localities')
            ->assertOk()
            ->assertJsonCount(285, 'data')
            ->assertJsonPath('data.0', [
                'id' => DB::table('localities')->where('department_id', 2)->where('source_id', 1)->value('id'),
                'name' => 'Aeropuerto Internacional De Carrasco',
            ]);

        $this->getJson('/api/v1/geography/departments/999/localities')->assertNotFound();
        $this->getJson('/api/v1/geography/departments/999999999999999999999/localities')->assertNotFound();
    }

    public function test_seed_preserves_every_source_record_and_keeps_database_ids_across_runs(): void
    {
        $source = json_decode(file_get_contents(database_path('data/countries.json')), true, flags: JSON_THROW_ON_ERROR);
        $directory = static fn () => DB::table('localities')->orderBy('department_id')->orderBy('source_id')->get();
        $original = $directory();

        $this->assertDatabaseCount('departments', 19);
        $this->assertDatabaseCount('localities', 1884);
        $this->assertSame(array_column($source, 'name', 'id'), DB::table('departments')->orderBy('id')->pluck('name', 'id')->all());
        foreach ($source as $department) {
            $this->assertSame(
                array_column($department['towns'], 'name', 'id'),
                $original->where('department_id', $department['id'])->pluck('name', 'source_id')->all(),
            );
        }

        $collision = $original->where('source_id', 1)->whereIn('department_id', [1, 2])->values();
        $this->assertCount(2, $collision);
        $this->assertNotSame($collision[0]->id, $collision[1]->id);

        for ($run = 0; $run < 2; $run++) {
            $this->artisan('db:seed', ['--class' => 'GeographySeeder'])->assertSuccessful();
            $this->assertDatabaseCount('departments', 19);
            $this->assertEquals($original, $directory());
        }
    }

    public function test_additive_migration_backfills_only_unique_matches_and_never_changes_order_snapshots(): void
    {
        $migration = require database_path('migrations/0001_01_01_000017_normalize_address_geography.php');
        $migration->down();

        $user = DB::table('users')->insertGetId(['name' => 'Test', 'email' => 'geography@example.test', 'password' => 'unused']);
        $snapshot = ['department' => 'Río Negro', 'locality' => 'Cañitas'];
        $order = DB::table('orders')->insertGetId([
            'reference' => Str::uuid(), 'user_id' => $user, 'owner_key' => "user:$user",
            'idempotency_key' => Str::uuid(), 'request_hash' => str_repeat('a', 64),
            'status' => 'pending_payment', 'currency' => 'UYU', 'subtotal_cents' => 1000,
            'shipping_cents' => 100, 'total_cents' => 1100, 'shipping_method' => 'delivery',
            'contact' => '{}', 'address' => json_encode($snapshot), 'reservation_expires_at' => now(),
        ]);

        $matched = $this->legacyAddress($user, "  RiO\u{00A0}  NeGrO ", "  CAN\u{0303}ITAS  ");
        $unmatched = $this->legacyAddress($user, 'Río Negro', 'An Unknown Town');
        $migration->up();

        $canitas = DB::table('localities')->where('department_id', 12)->where('source_id', 5)->value('id');
        $this->assertDatabaseHas('addresses', ['id' => $matched, 'locality_id' => $canitas, 'locality' => "  CAN\u{0303}ITAS  "]);
        $this->assertDatabaseHas('addresses', ['id' => $unmatched, 'locality_id' => null, 'locality' => 'An Unknown Town']);

        DB::table('departments')->insert(['id' => 99, 'name' => 'Río  Negro']);
        DB::table('localities')->insert(['department_id' => 1, 'source_id' => 900, 'name' => 'CÁMAÑO']);
        $ambiguousDepartment = $this->legacyAddress($user, 'Rio Negro', 'Cañitas');
        $ambiguousTown = $this->legacyAddress($user, 'Artigas', 'Camaño');
        $this->artisan('db:seed', ['--class' => 'GeographySeeder'])->assertSuccessful();

        $this->assertDatabaseHas('addresses', ['id' => $matched, 'locality_id' => $canitas]);
        $this->assertDatabaseHas('addresses', ['id' => $ambiguousDepartment, 'department' => 'Rio Negro', 'locality_id' => null]);
        $this->assertDatabaseHas('addresses', ['id' => $ambiguousTown, 'locality' => 'Camaño', 'locality_id' => null]);
        $this->assertSame(json_encode($snapshot), DB::table('orders')->where('id', $order)->value('address'));
    }

    private function legacyAddress(int $user, string $department, string $locality): int
    {
        return DB::table('addresses')->insertGetId([
            'user_id' => $user, 'recipient' => 'Test', 'department' => $department,
            'locality' => $locality, 'street' => 'Test Street', 'number' => '1',
        ]);
    }
}
