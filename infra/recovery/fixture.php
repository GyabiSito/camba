<?php

use App\Actions\Imports\ConfirmCatalogImport;
use App\Actions\Imports\PreviewCatalogImport;
use App\Models\Admin;
use App\Models\CatalogImport;
use App\Models\Category;
use App\Models\CommerceNotice;
use App\Models\Order;
use App\Models\Payment;
use App\Models\PaymentObservation;
use App\Models\PaymentWebhookEvent;
use App\Models\Product;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Contracts\Http\Kernel as HttpKernel;
use Illuminate\Database\Events\TransactionCommitted;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

const PUBLIC_IMAGE = 'drill/item.png';
const PRIVATE_FILE = 'drill/private.txt';
const BUYER_EMAIL = 'buyer@example.test';
const PAYMENT_ID = '159';

require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
set_exception_handler(static function (Throwable $error): never {
    fwrite(STDERR, $error->getMessage()."\n");
    exit(1);
});

$phase = $argv[1] ?? '';
$side = in_array($phase, ['seed', 'crash', 'before-expiry', 'stage-jobs'], true) ? 'source' : 'target';
if ($phase === 'snapshot') {
    $side = '(source|target)';
}
check($app->environment('local') && config('database.default') === 'pgsql'
    && config('database.connections.pgsql.host') === 'postgres'
    && empty(config('database.connections.pgsql.url'))
    && preg_match("/^camba_recovery_[a-f0-9]{8}_$side$/D", DB::getDatabaseName()), 'synthetic database guard');

switch ($phase) {
    case 'seed':
        check(Product::count() === 0 && Order::count() === 0 && User::count() === 0, 'no existing business records');
        $category = Category::create(['name' => 'Synthetic', 'slug' => 'synthetic', 'active' => true]);
        $product = Product::forceCreate([
            'sku' => 'DRILL', 'slug' => 'recovery-fixture', 'name' => 'Recovery fixture', 'price_cents' => 1200,
            'stock' => 3, 'status' => 'published', 'category_id' => $category->id,
        ]);
        $product->images()->create(['path' => PUBLIC_IMAGE, 'alt' => 'Synthetic recovery image', 'position' => 0]);
        $image = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/ua0AAAAASUVORK5CYII=', true);
        check(Storage::disk('public')->put(PUBLIC_IMAGE, $image), 'write public image');
        check(Storage::disk('local')->put(PRIVATE_FILE, "Synthetic private file\n"), 'write private file');
        $order = Order::forceCreate([
            'reference' => (string) Str::uuid(), 'owner_key' => Order::ownerKey(null, 'synthetic-recovery-session'),
            'idempotency_key' => (string) Str::uuid(), 'request_hash' => str_repeat('1', 64),
            'status' => 'payment_expired', 'currency' => 'UYU', 'subtotal_cents' => 2400, 'shipping_cents' => 0,
            'total_cents' => 2400, 'shipping_method' => 'pickup', 'contact' => ['email' => BUYER_EMAIL],
            'reservation_expires_at' => now()->subMinutes(10), 'stock_released_at' => now()->subMinutes(8),
        ]);
        $order->items()->forceCreate([
            'product_id' => $product->id, 'sku' => $product->sku, 'name' => $product->name, 'quantity' => 2,
            'unit_price_cents' => 1200, 'line_total_cents' => 2400,
        ]);
        webhook();
        check(PaymentWebhookEvent::sole()->attempts === 0 && Payment::count() === 0, 'acknowledged inbox before payment processing');
        $admin = Admin::create([
            'name' => 'Recovery Operator', 'email' => 'operator@example.test', 'password' => Str::random(32),
        ]);
        $csv = "codigo,nombre,precio_uyu,stock,categoria,marca,descripcion,fotos\nDRILL-IMPORT,Recovered draft,2.50,5,synthetic,,,\n";
        $import = app(PreviewCatalogImport::class)->execute(UploadedFile::fake()->createWithContent('drill.csv', $csv), $admin->id);
        confirmImport($import);
        break;

    case 'crash':
        Carbon::setTestNow(PaymentWebhookEvent::sole()->next_attempt_at);
        provider();
        // Stop the CLI process after PDO commits the evidence, before the inbox update.
        Event::listen(TransactionCommitted::class, function (TransactionCommitted $commit): void {
            if ($commit->connection->transactionLevel() !== 0) {
                return; // Eloquent may release an inner savepoint before the outer commit.
            }
            check(Http::recorded()->count() === 1, 'one fake provider request before interruption');
            check(Order::sole()->status->value === 'paid' && PaymentObservation::count() === 1, 'approval committed at failpoint');
            check(PaymentWebhookEvent::sole()->processed_at === null, 'inbox unacknowledged at failpoint');
            fwrite(STDOUT, "Stopped after payment commit and before inbox acknowledgement\n");
            exit(76);
        });
        command('camba:reconcile-payments');
        throw new RuntimeException('Payment commit failpoint was not reached.');
    case 'before-expiry':
    case 'resume':
        $event = PaymentWebhookEvent::sole();
        check($event->attempts === 1 && $event->processed_at === null && $event->lease_token !== null, 'interrupted lease persisted');
        $early = $phase === 'before-expiry';
        Carbon::setTestNow($early ? $event->next_attempt_at->copy()->subSecond() : $event->next_attempt_at);
        provider();
        $paidAt = Order::sole()->getRawOriginal('paid_at');
        command('camba:reconcile-payments');
        check(Http::recorded()->count() === ($early ? 0 : 1), 'provider reads at lease boundary');
        if (! $early) {
            webhook();
            command('camba:reconcile-payments');
            check(Http::recorded()->count() === 1, 'duplicate did not hit provider');
        }
        $event->refresh();
        check($event->attempts === ($early ? 1 : 2), 'inbox attempts at lease boundary');
        check($early ? $event->processed_at === null && $event->lease_token !== null
            : $event->processed_at !== null && $event->result === 'verified' && $event->lease_token === null, 'inbox settlement');
        $order = Order::sole();
        check($order->status->value === 'paid' && $order->getRawOriginal('paid_at') === $paidAt
            && $order->stock_reacquired_at !== null && Product::where('sku', 'DRILL')->sole()->stock === 1
            && Payment::sole()->provider_payment_id === PAYMENT_ID && PaymentObservation::count() === 1, 'one paid outcome and stock reacquisition');
        break;

    case 'stage-jobs':
        command('camba:notices');
        notice('order_created')->forceFill(['state' => 'sending', 'started_at' => now()->subMinutes(16), 'attempts' => 1])->save();
        check(notice('order_paid')->state === 'pending' && Queue::connection('redis')->size() === 3, 'source Redis holds import and notice jobs');
        break;

    case 'snapshot':
        $tables = collect(Schema::getTables())->pluck('name')->sort()->mapWithKeys(fn ($table) => [$table => DB::table($table)->count()]);
        $product = Product::where('sku', 'DRILL')->sole();
        $order = Order::sole();
        check($order->contact['email'] === BUYER_EMAIL && $product->images()->sole()->path === PUBLIC_IMAGE, 'decrypt order and follow media reference');
        echo json_encode([
            'tables' => $tables, 'migrations' => DB::table('migrations')->orderBy('id')->pluck('migration'),
            'order' => $order->only(['reference', 'status', 'paid_at', 'stock_reacquired_at', 'contact']), 'stock' => $product->stock,
            'inbox' => PaymentWebhookEvent::sole()->only(['attempts', 'lease_token', 'next_attempt_at', 'processed_at']),
            'notices' => CommerceNotice::orderBy('id')->get(['kind', 'channel', 'state', 'attempts']),
            'import' => CatalogImport::sole()->only(['id', 'confirmed_at', 'completed_at']),
            'public_hash' => digest('public', PUBLIC_IMAGE), 'private_hash' => digest('local', PRIVATE_FILE),
        ], JSON_THROW_ON_ERROR)."\n";
        exit;

    case 'recover-jobs':
        $import = CatalogImport::sole();
        check(Queue::connection('redis')->size() === 0 && $import->confirmed_at !== null && $import->completed_at === null
            && notice('order_created')->state === 'sending' && notice('order_paid')->state === 'pending', 'fresh Redis and recovered durable ledger states');
        confirmImport($import);
        command('camba:notices');
        check(Queue::connection('redis')->size() === 2 && notice('order_created')->state === 'uncertain', 'only safe jobs queued');
        break;

    case 'verify-jobs':
        $import = CatalogImport::sole();
        check($import->completed_at !== null && $import->rows()->sole()->status === 'applied'
            && Product::where('sku', 'DRILL-IMPORT')->sole()->stock === 5, 'original confirmed import completed exactly once');
        check(notice('order_created')->state === 'uncertain' && notice('order_created')->error_code === 'worker_interrupted'
            && notice('order_created')->attempts === 1 && notice('order_paid')->state === 'sent' && notice('order_paid')->attempts === 1, 'one safe send; ambiguous acknowledgement quarantined');
        confirmImport($import);
        command('camba:notices');
        check(Queue::connection('redis')->size() === 0 && DB::table('failed_jobs')->count() === 0, 'no redispatch after recovery or failed jobs');
        break;

    default:
        throw new RuntimeException('Unknown recovery rehearsal phase.');
}
echo "OK: $phase\n";

function check(bool $condition, string $expectation): void
{
    if (! $condition) {
        throw new RuntimeException("Recovery rehearsal failed: $expectation.");
    }
}

function command(string $name): void
{
    check(Artisan::call($name) === 0, "$name succeeded");
}

function confirmImport(CatalogImport $import): void
{
    app(ConfirmCatalogImport::class)->execute((string) $import->id, $import->confirmed_by_admin_id ?? Admin::sole()->id);
}

function digest(string $disk, string $path): string
{
    $bytes = Storage::disk($disk)->get($path);
    check(is_string($bytes) && $bytes !== '', "restore $disk fixture");

    return hash('sha256', $bytes);
}

function notice(string $kind): CommerceNotice
{
    return CommerceNotice::where('channel', 'mail')->where('kind', $kind)->sole();
}

function provider(): void
{
    config(['mercadopago.access_token' => 'synthetic', 'mercadopago.collector_id' => '234', 'mercadopago.live' => false]);
    Http::preventStrayRequests();
    Http::fake(['https://api.mercadopago.com/v1/payments/'.PAYMENT_ID => Http::response([
        'id' => PAYMENT_ID, 'collector_id' => 234, 'external_reference' => Order::sole()->reference,
        'status' => 'approved', 'currency_id' => 'UYU', 'live_mode' => false,
        'transaction_amount' => '24.00', 'date_last_updated' => '2026-05-10T10:00:00Z',
    ])]);
}

function webhook(): void
{
    $id = PAYMENT_ID;
    $requestId = 'synthetic-recovery';
    $timestamp = now()->getTimestamp();
    $signature = hash_hmac('sha256', "id:$id;request-id:$requestId;ts:$timestamp;", config('mercadopago.webhook_secret'));
    $request = Request::create("/api/v1/webhooks/mercadopago?data.id=$id&type=payment", 'POST', server: [
        'HTTP_X_REQUEST_ID' => $requestId, 'HTTP_X_SIGNATURE' => "ts=$timestamp,v1=$signature", 'HTTP_ACCEPT' => 'application/json',
    ]);
    check(app(HttpKernel::class)->handle($request)->getStatusCode() === 200, 'signed HTTP webhook returned 200');
}
