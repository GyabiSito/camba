<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use RuntimeException;
use Tests\TestCase;

class BackendReadinessTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'database.default' => 'sqlite',
            'database.connections.sqlite.database' => ':memory:',
            'database.connections.sqlite.url' => null,
            'session.driver' => 'database',
        ]);
    }

    public function test_readiness_checks_the_database_and_redis_without_starting_a_session(): void
    {
        DB::listen(fn ($query) => $this->assertSame('SELECT 1', $query->sql));
        Redis::shouldReceive('connection->ping')->once()->andReturn(true);

        $this->getJson('/ready')
            ->assertOk()
            ->assertExactJson(['status' => 'ready'])
            ->assertHeader('Cache-Control', 'no-store, private')
            ->assertHeaderMissing('Set-Cookie');
    }

    public function test_database_outage_is_not_ready_and_does_not_reveal_the_exception(): void
    {
        config([
            'app.debug' => true,
            'database.default' => 'synthetic-database-credential',
            'session.connection' => 'sqlite',
        ]);
        Redis::shouldReceive('connection')->never();

        $this->getJson('/ready')
            ->assertServiceUnavailable()
            ->assertExactJson(['status' => 'not_ready'])
            ->assertHeader('Cache-Control', 'no-store, private');
    }

    public function test_redis_outage_is_not_ready_but_process_liveness_remains_available(): void
    {
        Redis::shouldReceive('connection->ping')->once()->andThrow(new RuntimeException('synthetic-redis-credential'));

        $this->getJson('/ready')
            ->assertServiceUnavailable()
            ->assertExactJson(['status' => 'not_ready']);
        $this->get('/up')->assertOk();
    }

    public function test_unsuccessful_redis_ping_cannot_mark_the_process_ready(): void
    {
        Redis::shouldReceive('connection->ping')->once()->andReturn(false);

        $this->getJson('/ready')->assertServiceUnavailable()->assertExactJson(['status' => 'not_ready']);
    }
}
