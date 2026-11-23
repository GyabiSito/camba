<?php

use App\Models\Brand;
use App\Models\BuyerReminderPreference;
use App\Models\Cart;
use App\Models\Category;
use App\Models\Order;
use App\Models\Product;
use App\Models\StoreSettings;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

$db = getenv('DB_DATABASE');
if (PHP_SAPI !== 'cli' || getenv('CAMBA_E2E_SYNTHETIC') !== 'yes' || getenv('APP_ENV') !== 'e2e'
    || getenv('DB_CONNECTION') !== 'sqlite' || basename($db) !== 'browser.sqlite'
    || ! str_starts_with(basename(dirname($db)), 'camba-browser-') || ! is_file($db)) {
    throw new RuntimeException('The browser fixture must use its disposable database.');
}

require getcwd().'/vendor/autoload.php';
$app = require getcwd().'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

$account = fn (string $name, string $email, string $role) => User::query()->forceCreate([
    'name' => $name,
    'email' => $email,
    'password' => 'Camba-test-only-2026',
    'email_verified_at' => now(),
    'role' => $role,
]);
$account('Camba Mesa', 'admin@camba.test', 'admin');
$account('Operaciones Camba', 'ops-admin@camba.test', 'admin');
$buyer = $account('Cliente Camba', 'buyer@camba.test', 'buyer');
$account('Accesibilidad Camba', 'a11y-admin@camba.test', 'admin');
$brand = Brand::create(['name' => 'Taller', 'slug' => 'taller', 'active' => true]);
$categories = collect([
    ['name' => 'Camisas', 'slug' => 'camisas'],
    ['name' => 'Remeras', 'slug' => 'remeras'],
    ['name' => 'Pantalones', 'slug' => 'pantalones'],
])->mapWithKeys(fn (array $row) => [$row['slug'] => Category::create([...$row, 'active' => true])]);

$demo = dirname(__DIR__, 2).'/projects/admin/public/demo/';
$fixtures = [
    ['CAM-001', 'camisa-de-algodon', 'Camisa de algodón', 'camisas', 219000, 24, 'published', ['image-cotton']],
    ['REM-002', 'remera-lisa', 'Remera lisa', 'remeras', 89000, 12, 'published', ['image-plain', 'detail-photo']],
    ['PAN-003', 'pantalon-recto', 'Pantalón recto', 'pantalones', 259000, 0, 'archived', ['image-straight']],
    ['CAM-004', 'camisa-clasica', 'Camisa clásica', 'camisas', 229000, 18, 'published', ['image-classic']],
    ['REM-005', 'remera-con-bolsillo', 'Remera con bolsillo', 'remeras', 99000, 7, 'published', ['image-pocket']],
    ['PAN-006', 'pantalon-de-sarga', 'Pantalón de sarga', 'pantalones', 279000, 5, 'draft', ['image-twill']],
    ['REM-007', 'remera-oversize', 'Remera oversize', 'remeras', 109000, 0, 'archived', ['image-over']],
];

foreach ($fixtures as [$sku, $slug, $name, $category, $price, $stock, $status, $photos]) {
    $product = Product::query()->forceCreate([
        'sku' => $sku, 'slug' => $slug, 'name' => $name,
        'description' => 'Producto sintético para pruebas en la instalación aislada.',
        'price_cents' => $price, 'stock' => $stock, 'status' => $status,
        'category_id' => $categories[$category]->id,
        'brand_id' => $category === 'camisas' ? $brand->id : null,
    ]);
    foreach ($photos as $index => $photo) {
        $path = "products/e2e/{$photo}.webp";
        Storage::disk('public')->put($path, file_get_contents($demo.$photo.'.webp'));
        $product->images()->create([
            'path' => $path,
            'alt' => $name.($index ? ' — detalle' : ' — portada'),
            'position' => $index,
        ]);
    }
}
DB::table('store_settings')->where('id', 1)->update(['values' => json_encode([
    'business_name' => 'Camba', 'support_email' => 'hola@camba.test',
    'pickup_address' => 'Mostrador de prueba, Montevideo', 'delivery_cents' => 18500,
], JSON_THROW_ON_ERROR)]);

$order = Order::query()->forceCreate([
    'reference' => '11111111-1111-4111-8111-111111111111',
    'user_id' => $buyer->id, 'owner_key' => "buyer:{$buyer->id}", 'idempotency_key' => Str::uuid(),
    'request_hash' => hash('sha256', 'browser-order'), 'status' => 'paid', 'currency' => 'UYU',
    'subtotal_cents' => 89000, 'shipping_cents' => 0, 'total_cents' => 89000,
    'shipping_method' => 'pickup', 'pickup_address' => 'Mostrador de prueba, Montevideo',
    'contact' => ['name' => $buyer->name, 'email' => $buyer->email, 'phone' => null],
    'reservation_expires_at' => now()->addHour(), 'paid_at' => now(),
]);
$shirt = Product::where('sku', 'REM-002')->firstOrFail();
DB::table('order_items')->insert([
    'order_id' => $order->id, 'product_id' => $shirt->id, 'sku' => $shirt->sku,
    'name' => $shirt->name, 'quantity' => 1, 'unit_price_cents' => 89000, 'line_total_cents' => 89000,
]);
DB::table('commerce_notices')->insert([
    'dedup_key' => 'browser-order-paid', 'channel' => 'panel', 'kind' => 'order_paid',
    'subject_type' => 'order', 'subject_id' => $order->id, 'state' => 'active', 'created_at' => now(), 'updated_at' => now(),
]);

$mailRun = getenv('CAMBA_E2E_MAIL_RUN');
if (is_string($mailRun) && preg_match('/^[a-f0-9]{32}$/D', $mailRun)) {
    // Represent committed payment/fulfilment and reminder eligibility without a payment provider.
    $qaBuyer = $buyer->replicate()->forceFill(['email' => "orders-$mailRun@camba.test"]);
    $qaBuyer->save();
    $qaCartBuyer = $buyer->replicate()->forceFill(['email' => "cart-$mailRun@camba.test"]);
    $qaCartBuyer->save();
    foreach (['ready_for_pickup', 'shipped', 'unstarted'] as $state) {
        $paid = $state !== 'unstarted';
        $qaOrder = $order->replicate()->forceFill([
            'reference' => Str::uuid(), 'idempotency_key' => Str::uuid(),
            'user_id' => $qaBuyer->id, 'owner_key' => "buyer:{$qaBuyer->id}",
            'status' => $paid ? 'paid' : 'pending_payment', 'paid_at' => $paid ? now() : null,
            'shipping_method' => $state === 'shipped' ? 'delivery' : 'pickup',
            'fulfilment_status' => $state, 'reservation_expires_at' => now()->addMinutes(8),
        ]);
        $qaOrder->save();
        if ($paid) {
            DB::table('order_fulfilment_events')->insert([
                'order_id' => $qaOrder->id, 'to_status' => $state, 'created_at' => now(),
            ]);
        }
    }
    BuyerReminderPreference::query()->forceCreate(['user_id' => $qaBuyer->id, 'payment_reminders' => true]);
    BuyerReminderPreference::query()->forceCreate(['user_id' => $qaCartBuyer->id, 'cart_reminders' => true]);
    $cart = Cart::query()->forceCreate(['user_id' => $qaCartBuyer->id, 'updated_at' => now()->subDays(2)]);
    $cart->items()->forceCreate(['product_id' => $shirt->id, 'quantity' => 1]);
    $settings = StoreSettings::query()->findOrFail(1);
    $settings->forceFill(['values' => ['remind_cart' => true, 'remind_payment' => true] + $settings->values])->save();
}
