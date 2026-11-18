<?php

namespace Tests\Feature\Cart;

use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class CartTest extends TestCase
{
    use RefreshDatabase;

    private const CART = '/api/v1/cart';

    protected function beforeRefreshingDatabase(): void
    {
        $connection = config('database.default');
        $database = config("database.connections.$connection.database");

        $this->assertTrue(
            ($connection === 'sqlite' && $database === ':memory:') || ($connection === 'mysql' && $database === 'camba_v2_test'),
            'The cart suite may only reset an in-memory database or the dedicated Camba v2 test database.',
        );
    }

    protected function setUp(): void
    {
        parent::setUp();
        config(['session.driver' => 'database']);
        $this->withCredentials()->withHeader('Origin', 'http://localhost');
    }

    public function test_guest_cart_survives_session_reload_and_another_session_is_empty(): void
    {
        $product = $this->product();
        $this->keepSession($this->getJson(self::CART)->assertOk()->assertJsonPath('data.items', []));
        $this->putJson($this->item($product), ['quantity' => 2])->assertOk()
            ->assertJsonPath('data.items.0.quantity', 2)
            ->assertJsonPath('data.items.0.product.price_cents', 12345);
        $this->app['session']->driver()->flush();
        $this->getJson(self::CART)->assertOk()->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.items.0.product_id', $product->id);
        $this->assertDatabaseHas('cart_items', ['product_id' => $product->id, 'quantity' => 2]);

        $this->useSession('start-new-session');
        $this->getJson(self::CART)->assertOk()->assertJsonPath('data.items', []);
        $this->deleteJson($this->item($product))->assertNoContent();
        $this->assertDatabaseHas('cart_items', ['product_id' => $product->id, 'quantity' => 2]);
    }

    public function test_write_checks_quantity_publication_stock_and_server_owned_fields(): void
    {
        $product = $this->product(stock: 3);
        $draft = $this->product(status: 'draft');
        $this->keepSession($this->getJson(self::CART)->assertOk());
        $this->putJson($this->item($draft), ['quantity' => 1])->assertNotFound();
        foreach ([0, '1', 4] as $quantity) {
            $this->putJson($this->item($product), ['quantity' => $quantity])
                ->assertUnprocessable()->assertJsonValidationErrors('quantity');
        }
        $this->putJson($this->item($product), ['quantity' => 1, 'user_id' => 12])
            ->assertUnprocessable()->assertJsonValidationErrors('user_id');
        $this->assertDatabaseCount('cart_items', 0);

        $this->putJson($this->item($product), ['quantity' => 3])->assertOk();
        $this->putJson($this->item($product), ['quantity' => 3])->assertOk();
        $this->assertDatabaseCount('cart_items', 1);
        $product->stock = 2;
        $product->save();
        $this->getJson(self::CART)->assertOk()->assertJsonPath('data.items.0.available', false);

        $product->status = 'archived';
        $product->save();
        $this->getJson(self::CART)->assertOk()->assertJsonPath('data.items.0.product', null);
        $this->deleteJson($this->item($product))->assertNoContent();
        $this->assertDatabaseCount('cart_items', 0);
    }

    public function test_post_adds_one_unit_with_server_price_and_stock_while_put_sets_the_quantity(): void
    {
        $product = $this->product(stock: 3);
        $item = $this->item($product);
        $this->keepSession($this->getJson(self::CART)->assertOk());
        $this->postJson($item)->assertOk()
            ->assertJsonPath('data.items.0.quantity', 1)
            ->assertJsonPath('data.items.0.product.price_cents', 12345);
        $this->postJson($item)->assertOk()->assertJsonPath('data.items.0.quantity', 2);
        $this->postJson($item)->assertOk()->assertJsonPath('data.items.0.quantity', 3);
        $this->postJson($item)->assertUnprocessable()->assertJsonValidationErrors('quantity');
        $this->getJson(self::CART)->assertOk()->assertJsonPath('data.items.0.quantity', 3);
        $this->assertDatabaseHas('cart_items', ['product_id' => $product->id, 'quantity' => 3]);

        $this->putJson($item, ['quantity' => 1])->assertOk()->assertJsonPath('data.items.0.quantity', 1);
        $this->putJson($item, ['quantity' => 1])->assertOk()->assertJsonPath('data.items.0.quantity', 1);
        $this->assertDatabaseHas('cart_items', ['product_id' => $product->id, 'quantity' => 1]);
    }

    public function test_only_real_item_removals_reset_the_cart_inactivity_window(): void
    {
        $product = $this->product();
        $this->keepSession($this->getJson(self::CART)->assertOk());
        $this->putJson($this->item($product), ['quantity' => 1])->assertOk();
        $before = DB::table('carts')->value('updated_at');
        $this->travel(2)->hours();
        $this->deleteJson($this->item($product))->assertNoContent();
        $removedAt = DB::table('carts')->value('updated_at');
        $this->assertNotSame($before, $removedAt);
        $this->travel(2)->hours();
        $this->deleteJson($this->item($product))->assertNoContent();
        $this->assertSame($removedAt, DB::table('carts')->value('updated_at'));
    }

    public function test_login_merges_once_without_leaking_cart_on_logout_or_account_switch(): void
    {
        $product = $this->product(stock: 5);
        $archived = $this->product();
        $buyer = User::factory()->create();
        $other = User::factory()->create();
        $this->login($buyer);
        $this->putJson($this->item($product), ['quantity' => 3])->assertOk();
        $guestSession = $this->keepSession($this->postJson('/api/v1/auth/logout')->assertNoContent());
        $this->getJson(self::CART)->assertOk()->assertJsonPath('data.items', []);
        $this->putJson($this->item($product), ['quantity' => 4])->assertOk();
        $this->putJson($this->item($archived), ['quantity' => 1])->assertOk();
        $archived->status = 'archived';
        $archived->save();
        $this->postJson('/api/v1/auth/login', ['email' => $buyer->email, 'password' => 'wrong'])
            ->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->getJson(self::CART)->assertOk()->assertJsonPath('data.items.0.quantity', 4);

        $this->login($buyer);
        $this->getJson(self::CART)->assertOk()->assertJsonPath('data.items.0.quantity', 5);
        $this->assertDatabaseCount('cart_items', 1);
        $cartId = DB::table('carts')->where('user_id', $buyer->id)->value('id');
        $this->assertDatabaseHas('cart_items', ['cart_id' => $cartId, 'product_id' => $product->id, 'quantity' => 5]);

        $this->login($other);
        $this->getJson(self::CART)->assertOk()->assertJsonPath('data.items', []);
        $this->keepSession($this->postJson('/api/v1/auth/logout')->assertNoContent());
        $this->getJson(self::CART)->assertOk()->assertJsonPath('data.items', []);
        $this->login($buyer);
        $this->getJson(self::CART)->assertOk()->assertJsonPath('data.items.0.quantity', 5);

        $this->useSession($guestSession);
        $this->getJson(self::CART)->assertOk()->assertJsonPath('data.items', []);
        $this->putJson($this->item($product), ['quantity' => 1])->assertConflict();
        $this->postJson($this->item($product))->assertConflict();
        $this->assertDatabaseCount('cart_items', 1);
    }

    public function test_writes_require_a_first_party_session_and_csrf(): void
    {
        $product = $this->product();
        $this->withHeader('Origin', 'https://unrelated.example.test')
            ->putJson($this->item($product), ['quantity' => 1])->assertBadRequest();
        $this->postJson($this->item($product))->assertBadRequest();
        $this->app->instance('env', 'local');
        $this->withHeader('Origin', 'http://localhost')
            ->putJson($this->item($product), ['quantity' => 1])->assertStatus(419);
        $this->postJson($this->item($product))->assertStatus(419);
        $this->assertDatabaseCount('cart_items', 0);
    }

    private function keepSession(TestResponse $response): string
    {
        $cookie = $response->getCookie(config('session.cookie'));
        $this->assertNotNull($cookie);
        $this->useSession($cookie->getValue());

        return $cookie->getValue();
    }

    private function useSession(string $id): void
    {
        // The test kernel reuses the session store and guard between requests; a real request reloads them.
        $this->app['session']->driver()->flush();
        $this->app['auth']->forgetGuards();
        $this->withCookie(config('session.cookie'), $id);
    }

    private function login(User $user): void
    {
        $this->keepSession($this->postJson('/api/v1/auth/login', [
            'email' => $user->email, 'password' => 'password',
        ])->assertNoContent());
        $this->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.id', $user->id);
    }

    private function item(Product $product): string
    {
        return self::CART.'/items/'.$product->id;
    }

    private function product(int $stock = 10, string $status = 'published'): Product
    {
        $number = Product::query()->count() + 1;
        $category = Category::query()->firstOrCreate(['slug' => 'test'], ['name' => 'Test']);

        return Product::query()->forceCreate([
            'sku' => 'TEST-'.$number,
            'slug' => 'test-'.$number,
            'name' => 'Item '.$number,
            'price_cents' => 12345,
            'stock' => $stock,
            'status' => $status,
            'category_id' => $category->id,
        ]);
    }
}
