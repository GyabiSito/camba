<?php

namespace Tests\Feature\Catalog;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ClassificationFiltersTest extends TestCase
{
    use RefreshDatabase;

    protected function beforeRefreshingDatabase(): void
    {
        $connection = config('database.default');
        $this->assertTrue(
            ($connection === 'sqlite' && config('database.connections.sqlite.database') === ':memory:')
            || ($connection === 'pgsql' && config('database.connections.pgsql.database') === 'camba_demo_test'
                && config('database.connections.pgsql.host') === 'postgres' && empty(config('database.connections.pgsql.url'))
                && $this->app->environment('testing')),
            'Only disposable classification test databases may be reset.',
        );
    }

    public function test_classification_filters_apply_before_pagination_without_changing_selectors(): void
    {
        $this->withHeader('Origin', 'http://localhost')->actingAs($this->adminIdentity(), 'admin');

        foreach (['categories', 'brands'] as $kind) {
            $path = "/api/v1/admin/$kind";
            $expected = [];
            foreach ([true, false] as $active) {
                $status = $active ? 'active' : 'inactive';
                for ($i = 1; $i <= 13; $i++) {
                    $expected[$status][] = $this->postJson($path, ['name' => "Filter $status ".sprintf('%02d', $i), 'active' => $active])
                        ->assertCreated()->json('data');
                }
                $query = http_build_query(['q' => 'fIlTeR', 'status' => $status]);
                $this->getJson("$path/page?$query")->assertOk()->assertJsonCount(12, 'data')
                    ->assertJsonPath('meta.total', 13)->assertJsonPath('meta.last_page', 2)
                    ->assertJsonPath('data', array_slice($expected[$status], 0, 12));
                $this->getJson("$path/page?$query&page=2")->assertOk()->assertJsonCount(1, 'data')
                    ->assertJsonPath('meta.current_page', 2)->assertJsonPath('meta.total', 13)
                    ->assertJsonPath('data', array_slice($expected[$status], 12));
            }
            $this->postJson($path, ['name' => 'Other', 'active' => true])->assertCreated();
            $literal = $this->postJson($path, ['name' => 'Literal 50%_!'])->assertCreated()->json('data');
            $this->postJson($path, ['name' => 'Unrelated 500X'])->assertCreated();
            foreach (['%', '_', '!'] as $term) {
                $this->getJson("$path/page?".http_build_query(['q' => $term]))->assertOk()
                    ->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $literal['id']);
            }
            $this->patchJson("$path/{$literal['id']}", ['name' => 'Renamed'])->assertOk();
            $this->getJson("$path/page?q=LITERAL-50")->assertOk()->assertJsonCount(1, 'data')
                ->assertJsonPath('data.0.id', $literal['id']);
            $this->getJson("$path/page?q=RENAMED")->assertOk()->assertJsonCount(1, 'data');
            $this->getJson("$path/page?status=")->assertOk()->assertJsonPath('meta.total', 29);
            $this->getJson("$path/page?status=other")->assertUnprocessable()->assertJsonValidationErrors('status');
            $this->getJson("$path/page?".http_build_query(['q' => str_repeat('x', 121)]))
                ->assertUnprocessable()->assertJsonValidationErrors('q');
            $this->getJson("$path?q=missing&status=inactive&page=2&per_page=1")->assertOk()
                ->assertJsonCount(29, 'data')->assertJsonMissingPath('meta');
            $this->app['auth']->forgetGuards();
            $this->getJson("/api/v1/$kind?q=missing&status=inactive")->assertOk()->assertJsonCount(16, 'data');
            $this->actingAs($this->adminIdentity(), 'admin');
        }
    }
}
