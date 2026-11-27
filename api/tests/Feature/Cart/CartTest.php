<?php

namespace Tests\Feature\Cart;

use App\Models\Cart;
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
        $isolatedPostgres = $connection === 'pgsql'
            && $database === 'camba_demo_test'
            && $this->app->environment('testing')
            && config('database.connections.pgsql.host') === 'postgres'
            && empty(config('database.connections.pgsql.url'));

        $this->assertTrue(
            ($connection === 'sqlite' && $database === ':memory:') || ($connection === 'mysql' && $database === 'camba_test') || $isolatedPostgres,
            'The cart suite may only reset an in-memory database or a dedicated Camba v2 test database.',
        );
    }

    protected function setUp(): void
    {
        parent::setUp();
        config(['session.driver' => 'database']);
        $this->withCredentials()->withHeader('Origin', 'http://localhost');
    }

    public function test_every_cart_endpoint_rejects_guests_even_with_valid_csrf_without_creating_records(): void
    {
        $product = $this->product();
        $csrf = $this->get('/sanctum/csrf-cookie')->assertNoContent();
        $this->keepSession($csrf);
        $this->app->instance('env', 'local');
        $this->withHeader('X-XSRF-TOKEN', $csrf->getCookie('XSRF-TOKEN', decrypt: false)->getValue());

        $this->getJson(self::CART)->assertUnauthorized();
        $this->postJson($this->item($product))->assertUnauthorized();
        $this->putJson($this->item($product), ['quantity' => 2])->assertUnauthorized();
        $this->deleteJson($this->item($product))->assertUnauthorized();
        $this->postJson(self::CART.'/checkout/fdb31e70-d885-4d5f-93b6-6e7d0bf7bcc3/resume')->assertUnauthorized();
        $this->assertDatabaseCount('carts', 0);
        $this->assertDatabaseCount('cart_items', 0);
    }

    public function test_cart_requires_the_buyer_role(): void
    {
        $product = $this->product();
        $this->login(User::factory()->create(['role' => 'admin']));
        $this->getJson(self::CART)->assertForbidden();
        $this->postJson($this->item($product))->assertForbidden();
        $this->assertDatabaseCount('carts', 0);
        $this->assertDatabaseCount('cart_items', 0);
    }

    public function test_write_checks_quantity_publication_stock_and_server_owned_fields(): void
    {
        $product = $this->product(stock: 3);
        $draft = $this->product(status: 'draft');
        $this->login(User::factory()->create());
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
        $this->login(User::factory()->create());
        $this->assertDatabaseCount('carts', 0);
        $this->postJson($item)->assertOk()
            ->assertJsonPath('data.items.0.quantity', 1)
            ->assertJsonPath('data.items.0.product.price_cents', 12345);
        $this->postJson($item)->assertOk()->assertJsonPath('data.items.0.quantity', 2);
        $this->postJson($item)->assertOk()->assertJsonPath('data.items.0.quantity', 3);
        $this->postJson($item)->assertUnprocessable()->assertJsonValidationErrors('quantity');
        $this->getJson(self::CART)->assertOk()->assertHeader('Cache-Control', 'no-store, private')
            ->assertJsonPath('data.items.0.quantity', 3);
        $this->assertDatabaseHas('cart_items', ['product_id' => $product->id, 'quantity' => 3]);

        $this->putJson($item, ['quantity' => 1])->assertOk()->assertJsonPath('data.items.0.quantity', 1);
        $this->putJson($item, ['quantity' => 1])->assertOk()->assertJsonPath('data.items.0.quantity', 1);
        $this->assertDatabaseHas('cart_items', ['product_id' => $product->id, 'quantity' => 1]);
    }

    public function test_only_real_item_removals_reset_the_cart_inactivity_window(): void
    {
        $product = $this->product();
        $this->login(User::factory()->create());
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
        $this->getJson(self::CART)->assertUnauthorized();
        $legacy = Cart::query()->forceCreate(Cart::ownerKey(null, $guestSession));
        $legacy->setQuantity($product->id, 4);
        $legacy->setQuantity($archived->id, 1);
        $archived->status = 'archived';
        $archived->save();
        $this->postJson('/api/v1/auth/login', ['email' => $buyer->email, 'password' => 'wrong'])
            ->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->assertDatabaseHas('cart_items', ['cart_id' => $legacy->id, 'product_id' => $product->id, 'quantity' => 4]);

        $this->login($buyer);
        $this->getJson(self::CART)->assertOk()->assertJsonPath('data.items.0.quantity', 5);
        $this->assertDatabaseCount('cart_items', 1);
        $this->assertNotNull($legacy->fresh()->claimed_at);
        $cartId = DB::table('carts')->where('user_id', $buyer->id)->value('id');
        $this->assertDatabaseHas('cart_items', ['cart_id' => $cartId, 'product_id' => $product->id, 'quantity' => 5]);

        $this->login($other);
        $this->getJson(self::CART)->assertOk()->assertJsonPath('data.items', []);
        $this->keepSession($this->postJson('/api/v1/auth/logout')->assertNoContent());
        $this->getJson(self::CART)->assertUnauthorized();
        $this->login($buyer);
        $this->getJson(self::CART)->assertOk()->assertJsonPath('data.items.0.quantity', 5);

        $this->useSession($guestSession);
        $this->getJson(self::CART)->assertUnauthorized();
        $this->putJson($this->item($product), ['quantity' => 1])->assertUnauthorized();
        $this->postJson($this->item($product))->assertUnauthorized();
        $this->assertDatabaseCount('cart_items', 1);
    }

    public function test_writes_require_a_first_party_session_and_csrf(): void
    {
        $product = $this->product();
        $this->withHeader('Origin', 'https://unrelated.example.test')
            ->putJson($this->item($product), ['quantity' => 1])->assertUnauthorized();
        $this->postJson($this->item($product))->assertUnauthorized();
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
