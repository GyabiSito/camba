<?php

namespace Tests\Feature\Demo;

use App\Enums\OrderStatus;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\StoreSettings;
use App\Models\User;
use Database\Seeders\LocalDemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class LocalDemoSeederTest extends TestCase
{
    use RefreshDatabase;

    protected function beforeRefreshingDatabase(): void
    {
        $this->assertSame('pgsql', config('database.default'));
        $this->assertSame('camba_v2_demo_seed_test', config('database.connections.pgsql.database'));
    }

    public function test_local_demo_seed_is_repeatable_and_keeps_existing_orders(): void
    {
        $seeder = new LocalDemoSeeder;
        $seeder->run();

        $this->assertSame(9, Product::query()->count());
        $this->assertSame(3, $this->rowCount('categories'));
        $this->assertSame(3, Product::query()->where('status', 'published')->distinct()->count('category_id'));
        $this->assertSame(2, $this->rowCount('brands'));
        $this->assertSame(3, Order::query()->count());
        $this->assertSame(1, Payment::query()->count());
        $this->assertSame('Camba', StoreSettings::loadValues()['business_name']);
        $this->assertSame('Camba · 18 de Julio 1234, Montevideo', StoreSettings::loadValues()['pickup_address']);
        $this->assertDatabaseHas('addresses', ['recipient' => 'Lucía Rodríguez']);
        $this->assertDatabaseMissing('product_images', ['alt' => 'Detalle de textura de la colección de prueba']);
        $this->assertDatabaseCount('addresses', 2);
        $this->assertDatabaseCount('order_items', 3);
        $this->assertDatabaseCount('payment_attempts', 2);
        $this->assertDatabaseCount('catalog_imports', 1);
        $this->assertDatabaseCount('catalog_import_rows', 2);
        $this->assertDatabaseHas('products', ['sku' => 'CAMBA-DEMO-001', 'status' => 'published', 'stock' => 12]);
        $this->assertDatabaseHas('products', ['sku' => 'CAMBA-DEMO-005', 'status' => 'draft']);
        $this->assertDatabaseHas('products', ['sku' => 'CAMBA-DEMO-006', 'status' => 'archived']);
        $this->assertDatabaseHas('products', ['sku' => 'CAMBA-DEMO-007', 'status' => 'published', 'stock' => 0]);
        $this->assertDatabaseHas('product_images', ['path' => 'demo/image-classic.webp']);
        $this->assertDatabaseHas('products', [
            'sku' => 'CAMBA-DEMO-009',
            'slug' => 'camisa-liviana-blanca',
            'name' => 'Camisa liviana blanca',
            'status' => 'published',
            'category_id' => DB::table('categories')->where('slug', 'camisas')->value('id'),
            'brand_id' => null,
        ]);
        $whiteBlouse = Product::query()->where('sku', 'CAMBA-DEMO-009')->firstOrFail();
        $this->assertSame(5, $whiteBlouse->stock);
        $this->assertDatabaseHas('product_images', [
            'product_id' => $whiteBlouse->id,
            'path' => 'demo/image-cotton.webp',
            'position' => 0,
        ]);
        $this->assertDatabaseHas('payments', ['provider_payment_id' => 'DEMO-PAY-0001', 'status' => 'approved']);
        $this->assertDatabaseHas('orders', ['shipping_method' => 'delivery', 'status' => OrderStatus::Paid->value]);
        $this->assertDatabaseHas('orders', ['shipping_method' => 'pickup', 'status' => OrderStatus::PendingPayment->value]);
        $this->assertDatabaseHas('orders', ['status' => OrderStatus::PendingPayment->value]);
        $this->assertDatabaseHas('orders', ['status' => OrderStatus::PaymentExpired->value]);

        $paid = Order::query()->where('status', OrderStatus::Paid)->firstOrFail();
        $paid->status = OrderStatus::PaymentReview;
        $paid->save();
        $cartId = DB::table('carts')->where('user_id', $paid->user_id)->value('id');
        DB::table('cart_items')->where('cart_id', $cartId)->where('product_id', Product::query()->where('sku', 'CAMBA-DEMO-008')->value('id'))->delete();
        Product::query()->where('sku', 'CAMBA-DEMO-009')->update(['stock' => 2]);

        $counts = [
            'users' => User::query()->count(),
            'categories' => $this->rowCount('categories'),
            'brands' => $this->rowCount('brands'),
            'products' => Product::query()->count(),
            'orders' => Order::query()->count(),
            'payments' => Payment::query()->count(),
            'images' => $this->rowCount('product_images'),
            'imports' => $this->rowCount('catalog_imports'),
            'import_rows' => $this->rowCount('catalog_import_rows'),
        ];

        $seeder->run();

        $this->assertSame($counts, [
            'users' => User::query()->count(),
            'categories' => $this->rowCount('categories'),
            'brands' => $this->rowCount('brands'),
            'products' => Product::query()->count(),
            'orders' => Order::query()->count(),
            'payments' => Payment::query()->count(),
            'images' => $this->rowCount('product_images'),
            'imports' => $this->rowCount('catalog_imports'),
            'import_rows' => $this->rowCount('catalog_import_rows'),
        ]);
        $this->assertDatabaseHas('orders', ['reference' => $paid->reference, 'status' => OrderStatus::PaymentReview->value]);
        $this->assertDatabaseHas('products', ['sku' => 'CAMBA-DEMO-009', 'stock' => 2]);
        $this->assertSame(2, DB::table('cart_items')->where('cart_id', $cartId)->count());

        $buyer = User::query()->where('email', 'cliente.diseno@camba.test')->firstOrFail();
        $admin = User::query()->where('email', 'admin.diseno@camba.test')->firstOrFail();
        $this->assertSame('Lucía Rodríguez', $buyer->name);
        $this->assertSame('buyer', $buyer->role);
        $this->assertSame('admin', $admin->role);
        $this->assertTrue(Hash::check('CambaDemo2026!', $buyer->password));
        $this->assertTrue(Hash::check('CambaDemo2026!', $admin->password));
        $this->assertSame(2, DB::table('addresses')->where('user_id', $buyer->id)->count());
        $this->assertSame(2, DB::table('cart_items')->whereIn('cart_id', DB::table('carts')->where('user_id', $buyer->id)->select('id'))->count());
    }

    private function rowCount(string $table): int
    {
        return $this->app['db']->table($table)->count();
    }
}
