<?php

namespace Tests;

use App\Models\Admin;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function adminIdentity(array $attributes = []): Admin
    {
        return Admin::query()->first() ?? Admin::query()->create($attributes + [
            'name' => 'Camba Admin',
            'email' => 'admin@camba.test',
            'password' => 'password',
        ]);
    }
}
