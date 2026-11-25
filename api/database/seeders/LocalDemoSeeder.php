<?php

namespace Database\Seeders;

use App\Actions\Cart\SetCartItem;
use App\Enums\OrderStatus;
use App\Enums\ProductStatus;
use App\Models\Address;
use App\Models\Brand;
use App\Models\CatalogImport;
use App\Models\CatalogImportRow;
use App\Models\Category;
use App\Models\Locality;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\PaymentAttempt;
use App\Models\PaymentObservation;
use App\Models\Product;
use App\Models\StoreSettings;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class LocalDemoSeeder extends Seeder
{
    private const PASSWORD = 'CambaDemo2026!';

    private const BUYER_NAME = 'Lucía Rodríguez';

    private const PRODUCTS = [
        [
            'sku' => 'CAMBA-DEMO-001', 'slug' => 'camisa-clasica-marino', 'name' => 'Camisa clásica azul marino',
            'description' => 'Camisa de manga larga con cuello clásico y botones al tono.',
            'price_cents' => 189000, 'stock' => 12, 'status' => ProductStatus::Published,
            'category' => 'camisas', 'brand' => 'senda', 'images' => [
                ['image-classic.webp', 'Camisa clásica azul marino, vista frontal'],
                ['detail-photo.webp', 'Detalle de la textura de la tela'],
            ],
        ],
        [
            'sku' => 'CAMBA-DEMO-002', 'slug' => 'remera-con-bolsillo', 'name' => 'Remera con bolsillo',
            'description' => 'Una prenda liviana de algodón con bolsillo al tono.',
            'price_cents' => 219000, 'stock' => 5, 'status' => ProductStatus::Published,
            'category' => 'remeras', 'brand' => 'senda', 'images' => [
                ['image-pocket.webp', 'Remera con bolsillo'], ['image-cotton.webp', 'Camisa clara'],
            ],
        ],
        [
            'sku' => 'CAMBA-DEMO-003', 'slug' => 'pantalon-sarga-negro', 'name' => 'Pantalón de sarga negro',
            'description' => 'Sarga de cuerpo medio y pierna recta.',
            'price_cents' => 245000, 'stock' => 4, 'status' => ProductStatus::Published,
            'category' => 'pantalones', 'brand' => 'orilla', 'images' => [
                ['image-twill.webp', 'Pantalón de sarga negro'], ['image-plain.webp', 'Remera negra'],
            ],
        ],
        [
            'sku' => 'CAMBA-DEMO-004', 'slug' => 'pantalon-pinzas-arena', 'name' => 'Pantalón con pinzas arena',
            'description' => 'Cintura con pasadores y pierna recta.',
            'price_cents' => 199000, 'stock' => 3, 'status' => ProductStatus::Published,
            'category' => 'pantalones', 'brand' => null, 'images' => [
                ['image-straight.webp', 'Pantalón con pinzas arena'], ['image-over.webp', 'Remera clara'],
            ],
        ],
        [
            'sku' => 'CAMBA-DEMO-005', 'slug' => 'remera-edicion-taller', 'name' => 'Remera edición taller',
            'description' => 'Borrador de producto para revisar la ficha antes de publicar.',
            'price_cents' => 229000, 'stock' => 7, 'status' => ProductStatus::Draft,
            'category' => 'remeras', 'brand' => 'orilla', 'images' => [['image-plain.webp', 'Muestra de remera lisa']],
        ],
        [
            'sku' => 'CAMBA-DEMO-006', 'slug' => 'pantalon-sarga-archivo', 'name' => 'Pantalón de sarga de archivo',
            'description' => 'Ficha archivada para recorrer el historial del catálogo.',
            'price_cents' => 245000, 'stock' => 0, 'status' => ProductStatus::Archived,
            'category' => 'pantalones', 'brand' => 'orilla', 'images' => [['image-twill.webp', 'Pantalón de sarga de archivo']],
        ],
        [
            'sku' => 'CAMBA-DEMO-007', 'slug' => 'camiseta-sin-stock', 'name' => 'Camiseta sin stock',
            'description' => 'Artículo publicado agotado para comprobar su estado en tienda.',
            'price_cents' => 205000, 'stock' => 0, 'status' => ProductStatus::Published,
            'category' => 'remeras', 'brand' => null, 'images' => [['image-over.webp', 'Camiseta actualmente agotada']],
        ],
        [
            'sku' => 'CAMBA-DEMO-008', 'slug' => 'camisa-puerto', 'name' => 'Camisa Puerto',
            'description' => 'Camisa oscura de uso diario con galería de muestra.',
            'price_cents' => 239000, 'stock' => 9, 'status' => ProductStatus::Published,
            'category' => 'camisas', 'brand' => 'senda', 'images' => [
                ['image-classic.webp', 'Camisa Puerto, frente'], ['image-pocket.webp', 'Remera con bolsillo'],
                ['detail-photo.webp', 'Terminación de la tela'],
            ],
        ],
    ];

    public function run(): void
    {
        $this->guardEnvironment();

        DB::transaction(function (): void {
            $this->copyDemoImages();

            $buyer = $this->user(self::BUYER_NAME, 'cliente.diseno@camba.test', 'buyer');
            $admin = $this->user('Administración de demostración', 'admin.diseno@camba.test', 'admin');
            $categories = $this->classifications(Category::class, [
                ['name' => 'Remeras', 'slug' => 'remeras'],
                ['name' => 'Camisas', 'slug' => 'camisas'],
                ['name' => 'Pantalones', 'slug' => 'pantalones'],
            ]);
            $brands = $this->classifications(Brand::class, [
                ['name' => 'Senda', 'slug' => 'senda'],
                ['name' => 'Orilla', 'slug' => 'orilla'],
            ]);
            $products = $this->products($categories, $brands);
            (new LocalEditorialCatalogSeeder)->run();

            $this->addresses($buyer);
            $this->orders($buyer, $products);
            $this->cart($buyer, $products);
            $this->import($admin, $products['CAMBA-DEMO-001']);
            $this->settings();
        });
    }

    private function guardEnvironment(): void
    {
        $connection = config('database.default');
        $database = config("database.connections.$connection.database");
        if (! app()->environment(['local', 'testing']) || $connection !== 'pgsql'
            || ! in_array($database, ['camba_v2_demo', 'camba_v2_demo_seed_test'], true)) {
            throw new RuntimeException('LocalDemoSeeder is restricted to the local PostgreSQL demo database.');
        }
    }

    private function user(string $name, string $email, string $role): User
    {
        $user = User::query()->where('email', $email)->first();
        if ($user !== null) {
            return $user;
        }

        return User::query()->forceCreate([
            'name' => $name,
            'email' => $email,
            'email_verified_at' => now(),
            'password' => self::PASSWORD,
            'role' => $role,
        ]);
    }

    /** @param class-string<Category|Brand> $model */
    private function classifications(string $model, array $rows): array
    {
        $records = [];
        foreach ($rows as $row) {
            $records[$row['slug']] = $model::query()->updateOrCreate(['slug' => $row['slug']], [...$row, 'active' => true]);
        }

        return $records;
    }

    private function products(array $categories, array $brands): array
    {
        $products = [];
        foreach (self::PRODUCTS as $fixture) {
            $product = Product::query()->where('sku', $fixture['sku'])->first();
            $isNew = $product === null;
            $product ??= new Product;
            $product->forceFill([
                'sku' => $fixture['sku'],
                'slug' => $fixture['slug'],
                'name' => $fixture['name'],
                'description' => $fixture['description'],
                'price_cents' => $fixture['price_cents'],
                'status' => $fixture['status'],
                'category_id' => $categories[$fixture['category']]->id,
                'brand_id' => $fixture['brand'] === null ? null : $brands[$fixture['brand']]->id,
                ...($isNew ? ['stock' => $fixture['stock']] : []),
            ])->save();
            $products[$fixture['sku']] = $product;

            foreach ($fixture['images'] as $position => [$file, $alt]) {
                $image = $product->images()->firstOrNew(['path' => 'demo/'.$file]);
                $image->alt = $alt;
                if (! $image->exists) {
                    $image->position = $position;
                }
                $image->save();
            }
        }

        return $products;
    }

    private function addresses(User $buyer): void
    {
        foreach ([
            ['recipient' => self::BUYER_NAME, 'department' => 'Montevideo', 'locality' => 'Cordón', 'street' => 'Colonia', 'number' => '1234', 'details' => 'Apartamento 2', 'phone' => '099 000 001', 'postal_code' => '11200'],
            ['recipient' => self::BUYER_NAME, 'department' => 'Canelones', 'locality' => 'Ciudad de la Costa', 'street' => 'Giannattasio', 'number' => 'KM 21', 'details' => null, 'phone' => '099 000 001', 'postal_code' => '15000',
                'locality_id' => Locality::query()->where(['department_id' => 2, 'source_id' => 55])->value('id')],
        ] as $address) {
            $match = ['user_id' => $buyer->id, 'street' => $address['street'], 'number' => $address['number']];
            if (! Address::query()->where($match)->exists()) {
                Address::query()->forceCreate([...$address, 'user_id' => $buyer->id]);
            }
        }
    }

    private function orders(User $buyer, array $products): void
    {
        $now = now();
        $fixtures = [
            ['reference' => '00000000-0000-4000-8000-000000000101', 'key' => '00000000-0000-4000-8000-000000000201', 'sku' => 'CAMBA-DEMO-001', 'status' => OrderStatus::Paid, 'shipping' => 'delivery', 'expires' => $now->copy()->addDay(), 'paid_id' => 'DEMO-PAY-0001'],
            ['reference' => '00000000-0000-4000-8000-000000000102', 'key' => '00000000-0000-4000-8000-000000000202', 'sku' => 'CAMBA-DEMO-002', 'status' => OrderStatus::PendingPayment, 'shipping' => 'pickup', 'expires' => $now->copy()->addDays(7), 'paid_id' => null],
            ['reference' => '00000000-0000-4000-8000-000000000103', 'key' => '00000000-0000-4000-8000-000000000203', 'sku' => 'CAMBA-DEMO-008', 'status' => OrderStatus::PaymentExpired, 'shipping' => 'delivery', 'expires' => $now->copy()->subDay(), 'paid_id' => null],
        ];

        foreach ($fixtures as $fixture) {
            $product = $products[$fixture['sku']];
            $quantity = 1;
            $shippingCents = $fixture['shipping'] === 'delivery' ? 12000 : 0;
            $total = $product->price_cents * $quantity + $shippingCents;
            $order = Order::query()->where('reference', $fixture['reference'])->first();
            if ($order === null) {
                $order = new Order;
                $order->forceFill([
                    'reference' => $fixture['reference'],
                    'user_id' => $buyer->id,
                    'owner_key' => Order::ownerKey($buyer->id, 'local-demo'),
                    'idempotency_key' => $fixture['key'],
                    'request_hash' => hash('sha256', 'camba-local-demo-'.$fixture['reference']),
                    'status' => $fixture['status'],
                    'currency' => 'UYU',
                    'subtotal_cents' => $product->price_cents,
                    'shipping_cents' => $shippingCents,
                    'total_cents' => $total,
                    'shipping_method' => $fixture['shipping'],
                    'pickup_address' => $fixture['shipping'] === 'pickup' ? 'Camba · 18 de Julio 1234, Montevideo' : null,
                    'contact' => ['name' => self::BUYER_NAME, 'email' => 'cliente.diseno@camba.test', 'phone' => '099 000 001'],
                    'address' => $fixture['shipping'] === 'delivery' ? ['recipient' => self::BUYER_NAME, 'department' => 'Montevideo', 'locality' => 'Cordón', 'street' => 'Colonia', 'number' => '1234', 'details' => null, 'postal_code' => '11200'] : null,
                    'reservation_expires_at' => $fixture['expires'],
                    'stock_released_at' => $fixture['status'] === OrderStatus::PaymentExpired ? $now : null,
                    'paid_provider_payment_id' => $fixture['paid_id'],
                    'paid_at' => $fixture['status'] === OrderStatus::Paid ? $now->copy()->subDays(2) : null,
                    'fulfilment_status' => 'unstarted',
                ])->save();
            }
            if (! OrderItem::query()->where(['order_id' => $order->id, 'product_id' => $product->id])->exists()) {
                OrderItem::query()->forceCreate([
                    'order_id' => $order->id,
                    'product_id' => $product->id,
                    'sku' => $product->sku,
                    'name' => $product->name,
                    'quantity' => $quantity,
                    'unit_price_cents' => $product->price_cents,
                    'line_total_cents' => $product->price_cents * $quantity,
                ]);
            }

            if ($fixture['status'] === OrderStatus::Paid) {
                $payment = Payment::query()->where('provider_payment_id', $fixture['paid_id'])->first();
                if ($payment === null) {
                    $payment = Payment::query()->forceCreate([
                        'order_id' => $order->id,
                        'provider_payment_id' => $fixture['paid_id'],
                        'amount_cents' => $total,
                        'status' => 'approved',
                        'provider_updated_at' => '2026-11-01T12:00:00.000Z',
                    ]);
                }
                PaymentObservation::query()->firstOrCreate([
                    'payment_id' => $payment->id,
                    'status' => 'approved',
                    'provider_updated_at' => '2026-11-01T12:00:00.000Z',
                ], ['created_at' => $now]);
            }

            if ($fixture['status'] !== OrderStatus::Paid) {
                if (! PaymentAttempt::query()->where('order_id', $order->id)->exists()) {
                    PaymentAttempt::query()->forceCreate([
                        'order_id' => $order->id,
                        'idempotency_key' => $fixture['key'],
                        'status' => 'ready',
                        'provider_preference_id' => 'demo-preference-'.$fixture['reference'],
                        'checkout_url' => null,
                        'expires_at' => $fixture['expires'],
                    ]);
                }
            }
        }
    }

    private function cart(User $buyer, array $products): void
    {
        $action = app(SetCartItem::class);
        foreach (['CAMBA-DEMO-001', 'CAMBA-DEMO-008'] as $sku) {
            $product = $products[$sku];
            $alreadyInCart = DB::table('carts')->join('cart_items', 'carts.id', '=', 'cart_items.cart_id')
                ->where('carts.user_id', $buyer->id)->where('cart_items.product_id', $product->id)->exists();
            if (! $alreadyInCart && $product->status === ProductStatus::Published && $product->stock > 0) {
                $action->execute($buyer->id, 'local-demo-cart', (string) $product->id, 1);
            }
        }
    }

    private function import(User $admin, Product $product): void
    {
        $import = CatalogImport::query()->firstOrCreate(['sha256' => hash('sha256', 'camba-local-demo-import-v1')], [
            'uploaded_by' => $admin->id,
            'confirmed_by' => $admin->id,
            'confirmed_at' => now(),
            'completed_at' => now(),
        ]);
        foreach ([
            ['line' => 2, 'sku' => 'CAMBA-DEMO-IMPORT-READY', 'status' => 'ready', 'action' => 'create', 'product_id' => null, 'values' => ['name' => 'Artículo de importación', 'price_cents' => 159000, 'stock' => 6]],
            ['line' => 3, 'sku' => $product->sku, 'status' => 'invalid', 'action' => null, 'product_id' => null, 'values' => ['sku' => $product->sku, 'price_cents' => -1]],
        ] as $row) {
            $line = $row['line'];
            unset($row['line']);
            if (! CatalogImportRow::query()->where(['catalog_import_id' => $import->id, 'line' => $line])->exists()) {
                CatalogImportRow::query()->forceCreate([
                    ...$row,
                    'catalog_import_id' => $import->id,
                    'line' => $line,
                    'expected' => [],
                    'errors' => $row['status'] === 'invalid' ? ['price_cents' => ['El precio debe ser mayor que cero.']] : [],
                    'changes' => [],
                ]);
            }
        }
    }

    private function settings(): void
    {
        $settings = StoreSettings::query()->firstOrCreate(['id' => 1], ['values' => []]);
        $settings->values = array_replace([
            'business_name' => 'Camba',
            'pickup_address' => 'Camba · 18 de Julio 1234, Montevideo',
            'delivery_cents' => 12000,
            'remind_payment' => false,
            'remind_cart' => false,
        ], $settings->values ?? []);
        $settings->save();
    }

    private function copyDemoImages(): void
    {
        $source = is_dir('/demo-assets') ? '/demo-assets' : base_path('../web/projects/admin/public/demo');
        if (! is_dir($source)) {
            throw new RuntimeException('Demo images are unavailable; mount web/projects/admin/public/demo at /demo-assets.');
        }

        $disk = Storage::disk('public');
        foreach (array_unique(array_column(array_merge(...array_column(self::PRODUCTS, 'images')), 0)) as $file) {
            $bytes = file_get_contents($source.DIRECTORY_SEPARATOR.$file);
            if ($bytes === false || ! $disk->put('demo/'.$file, $bytes)) {
                throw new RuntimeException("Could not copy local demo image: $file");
            }
        }
    }
}
