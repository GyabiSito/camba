<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\TestCase;

final class TestDatabase
{
    public static function assertIsolated(TestCase $test): void
    {
        $connection = config('database.default');
        $database = config("database.connections.$connection.database");
        $isolated = match ($connection) {
            'sqlite' => $database === ':memory:' && empty(config('database.connections.sqlite.url')),
            'pgsql' => $database === 'camba_demo_test' && config('database.connections.pgsql.host') === 'postgres'
                && empty(config('database.connections.pgsql.url')),
            default => false,
        };

        $test->assertTrue($isolated && app()->environment('testing') && ! app()->configurationIsCached(),
            'Feature tests may only reset in-memory SQLite or the dedicated PostgreSQL test database.');
    }
}
