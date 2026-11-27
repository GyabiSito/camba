<?php

declare(strict_types=1);

use App\Models\Category;
use App\Models\Product;
use App\Models\StoreSettings;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

function check(bool $ok, string $message): void
{
    if (! $ok) {
        throw new RuntimeException($message);
    }
}

check(getenv('CAMBA_PG_REHEARSAL') === '1' && $app->environment('production')
    && preg_match('~^http://127\.0\.0\.1:\d+$~D', (string) config('app.url')) === 1
    && config('mail.default') === 'array'
    && ! filled(config('mercadopago.access_token'))
    && DB::getDriverName() === 'pgsql'
    && DB::getDatabaseName() === 'camba'
    && DB::connection()->getConfig('host') === 'postgres', 'Refusing a non-isolated candidate');

$identity = DB::selectOne("select current_user as role, current_setting('server_version') as version, case when rolsuper then 1 else 0 end as privileged from pg_roles where rolname = current_user");
check($identity->role === 'camba' && (int) $identity->privileged === 0, 'Laravel must use the non-superuser application role');

if (getenv('CAMBA_PG_FIXTURE_PHASE') === 'seed') {
    $migrations = DB::table('migrations')->count();
    $departments = DB::table('departments')->count();
    $localities = DB::table('localities')->count();
    check($migrations === count(glob(database_path('migrations/*.php'))) && $departments === 19 && $localities > 19,
        'Apply every migration and load reference geography before the fixture');
    foreach (['users', 'products', 'orders'] as $table) {
        check(DB::table($table)->doesntExist(), "The reference-only candidate unexpectedly contains {$table}");
    }

    $password = getenv('CAMBA_PG_FIXTURE_PASSWORD');
    check(is_string($password) && preg_match('/^[a-f0-9]{32}$/D', $password) === 1, 'Missing synthetic password');
    DB::transaction(function () use ($password): void {
        User::query()->forceCreate([
            'name' => 'PostgreSQL QA', 'email' => 'postgres-admin@camba.test',
            'password' => $password, 'role' => 'admin', 'email_verified_at' => now(),
        ]);
        $category = Category::query()->forceCreate(['name' => 'PostgreSQL QA', 'slug' => 'postgres-qa']);
        Product::query()->forceCreate([
            'sku' => 'PG-QA-001', 'name' => 'Remera PostgreSQL QA', 'slug' => 'remera-postgres-qa',
            'price_cents' => 12345, 'category_id' => $category->id, 'stock' => 5, 'status' => 'published',
        ]);
        $settings = StoreSettings::query()->findOrFail(1);
        $settings->values = array_replace($settings->values, ['pickup_address' => 'Retiro PostgreSQL QA']);
        $settings->save();
    });
    echo json_encode([
        'postgres' => $identity->version, 'role' => $identity->role,
        'migrations' => $migrations, 'departments' => $departments, 'localities' => $localities,
        'reference_only_before_qa' => true,
    ], JSON_THROW_ON_ERROR), PHP_EOL;

    return;
}

check(getenv('CAMBA_PG_FIXTURE_PHASE') === 'verify', 'Unknown verification phase');
$order = DB::table('orders')->sole();
$item = DB::table('order_items')->sole();
$product = DB::table('products')->where('sku', 'PG-QA-001')->sole();
$category = DB::table('categories')->where('slug', 'postgres-qa')->sole();
check((int) $item->order_id === (int) $order->id && (int) $item->product_id === (int) $product->id
    && (int) $product->category_id === (int) $category->id, 'The order, product and category IDs must match');
check((int) $item->quantity === 2 && (int) $product->stock === 3
    && (int) $item->unit_price_cents === 12345 && (int) $item->line_total_cents === 24690
    && (int) $order->subtotal_cents === 24690 && (int) $order->shipping_cents === 0
    && (int) $order->total_cents === 24690 && $order->status === 'pending_payment',
    'The reservation and monetary snapshots must be exact');

foreach (['users', 'categories', 'products', 'orders', 'order_items', 'localities'] as $table) {
    $sequence = DB::scalar("select pg_get_serial_sequence(?, 'id')", [$table]);
    check(is_string($sequence), "Missing {$table} sequence");
    $last = DB::scalar('select pg_sequence_last_value(cast(? as regclass))', [$sequence]);
    check((int) $last >= (int) DB::table($table)->max('id'), "The {$table} sequence is behind its IDs");
}
echo json_encode([
    'order' => $order->reference, 'status' => $order->status, 'total_cents' => (int) $order->total_cents,
    'stock_remaining' => (int) $product->stock, 'foreign_keys_and_sequences' => 'ok',
], JSON_THROW_ON_ERROR), PHP_EOL;
