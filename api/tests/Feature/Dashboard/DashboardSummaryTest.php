<?php

namespace Tests\Feature\Dashboard;

use App\Models\Category;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Product;
use App\Models\User;
use App\Models\Withdrawal;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Tests\TestCase;

class DashboardSummaryTest extends TestCase
{
    use RefreshDatabase;

    private const URL = '/api/v1/admin/dashboard';

    protected function beforeRefreshingDatabase(): void
    {
        $connection = config('database.default');
        $database = config("database.connections.$connection.database");
        $this->assertTrue($this->app->environment('testing') && (
            ($connection === 'sqlite' && $database === ':memory:')
            || ($connection === 'pgsql' && $database === 'camba_demo_test'
                && config('database.connections.pgsql.host') === 'postgres'
                && empty(config('database.connections.pgsql.url')))
        ), 'Dashboard tests must only reset an isolated test database.');
    }

    protected function setUp(): void
    {
        parent::setUp();
        config(['store.timezone' => 'America/Montevideo']);
        $this->travelTo(Carbon::parse('2026-03-01 02:30:00', 'UTC'));
    }

    public function test_only_verified_administrators_can_read_the_summary(): void
    {
        $this->getJson(self::URL)->assertUnauthorized()->assertJsonMissingPath('data');
        $this->actingAs(User::factory()->create(['role' => 'buyer']))
            ->getJson(self::URL)->assertForbidden();
        $this->actingAs(User::factory()->unverified()->create(['role' => 'admin']))
            ->getJson(self::URL)->assertForbidden();
        $this->actingAs(User::factory()->create(['role' => 'admin']))
            ->getJson(self::URL)->assertOk()->assertHeader('Cache-Control', 'no-store, private');
    }

    public function test_empty_summary_has_integer_zeros_and_exactly_six_local_calendar_months(): void
    {
        $this->admin();
        $this->getJson(self::URL)->assertOk()->assertExactJson(['data' => [
            'priorities' => ['pending_payment' => 0, 'needs_preparation' => 0, 'ready_for_pickup' => 0, 'out_of_stock' => 0, 'received_withdrawals' => 0],
            'recent_orders' => [],
            'sales' => [
                'timezone' => 'America/Montevideo', 'from' => '2026-01-30', 'through' => '2026-02-28',
                'order_count' => 0, 'total_cents' => 0,
                'months' => array_map(fn ($month) => ['month' => $month, 'order_count' => 0, 'total_cents' => 0],
                    ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02']),
            ],
        ]]);
    }

    public function test_priorities_keep_payment_preparation_and_published_available_stock_separate(): void
    {
        $this->admin();
        $this->order();
        $this->order(['reservation_expires_at' => now()->subDay()]);
        $this->order(['status' => 'paid', 'fulfilment_status' => 'unstarted']);
        $this->order(['status' => 'paid', 'fulfilment_status' => 'preparing']);
        $this->order(['status' => 'paid', 'fulfilment_status' => 'ready_for_pickup']);
        $this->order(['status' => 'paid', 'fulfilment_status' => 'shipped']);
        $this->order(['status' => 'paid', 'fulfilment_status' => 'completed']);
        $this->order(['status' => 'payment_expired', 'fulfilment_status' => 'preparing']);
        $category = Category::query()->forceCreate(['name' => 'Demo', 'slug' => 'demo']);
        foreach ([['published', 0], ['published', 1], ['draft', 0], ['archived', 0]] as [$status, $stock]) {
            Product::query()->forceCreate([
                'name' => 'Demo', 'slug' => (string) Str::uuid(), 'sku' => (string) Str::uuid(),
                'price_cents' => 100, 'stock' => $stock, 'status' => $status, 'category_id' => $category->id,
            ]);
        }

        $this->getJson(self::URL)->assertOk()->assertJsonPath('data.priorities', [
            'pending_payment' => 2, 'needs_preparation' => 2, 'ready_for_pickup' => 1, 'out_of_stock' => 1, 'received_withdrawals' => 0,
        ]);
    }

    public function test_received_withdrawal_priority_matches_filtered_total_and_updates_after_review(): void
    {
        $this->admin();
        $inbox = '/api/v1/admin/withdrawals';
        $received = [];
        foreach ([...array_fill(0, 26, 'received'), 'reviewing', 'closed', 'refunded'] as $status) {
            $reference = (string) Str::uuid();
            Withdrawal::query()->create([
                'reference' => $reference,
                'order_reference' => (string) Str::uuid(),
                'request_key' => hash('sha256', $reference),
                'email' => 'withdrawal@example.test',
                'status' => $status,
            ]);
            if ($status === 'received') {
                $received[] = $reference;
            }
        }

        $this->getJson(self::URL)->assertOk()->assertJsonPath('data.priorities.received_withdrawals', 26);
        $this->getJson($inbox)->assertOk()->assertJsonPath('meta.total', 29)->assertJsonPath('data.0.status', 'refunded');
        $first = $this->getJson($inbox.'?status=received')->assertOk()
            ->assertJsonPath('meta.total', 26)->assertJsonPath('meta.last_page', 2)->assertJsonCount(25, 'data')->json('data');
        $this->assertSame(['received'], array_values(array_unique(array_column($first, 'status'))));
        $reference = $received[0];
        $this->getJson($inbox.'?status=received&page=2')->assertOk()->assertJsonPath('data.0.reference', $reference);
        $this->patchJson($inbox.'/'.$reference, ['action' => 'review'])->assertOk()->assertJsonPath('data.status', 'reviewing');
        $this->getJson(self::URL)->assertOk()->assertJsonPath('data.priorities.received_withdrawals', 25);
        $this->getJson($inbox.'?status=received')->assertOk()->assertJsonPath('meta.total', 25)->assertJsonPath('meta.last_page', 1);
        $this->getJson($inbox.'?reference='.$reference)->assertOk()->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.reference', $reference)->assertJsonPath('data.0.status', 'reviewing');
        $this->getJson($inbox.'?status=unknown')->assertUnprocessable()->assertJsonValidationErrors('status');
        $this->getJson($inbox.'?reference=unknown')->assertUnprocessable()->assertJsonValidationErrors('reference');
    }

    public function test_recent_orders_are_the_five_newest_ids_without_private_details(): void
    {
        $this->admin();
        $orders = [];
        for ($i = 0; $i < 7; $i++) {
            $orders[] = $this->order(['created_at' => now()->subDays($i)]);
        }
        $rows = $this->getJson(self::URL)->assertOk()->assertJsonCount(5, 'data.recent_orders')->json('data.recent_orders');
        $this->assertSame(array_map(fn ($order) => $order->reference, array_reverse(array_slice($orders, -5))), array_column($rows, 'reference'));
        foreach ($rows as $row) {
            $this->assertEqualsCanonicalizing([
                'reference', 'status', 'currency', 'subtotal_cents', 'shipping_cents', 'total_cents',
                'shipping_method', 'fulfilment_status', 'reservation_expires_at', 'created_at',
            ], array_keys($row));
            $this->assertSame('UYU', $row['currency']);
            $this->assertSame(12345, $row['total_cents']);
        }
    }

    public function test_sales_use_unique_authoritative_confirmations_local_boundaries_and_no_future_payments(): void
    {
        $this->admin();
        $paid = fn (string $at, int $cents = 100) => $this->order([
            'status' => 'paid', 'paid_at' => $at, 'total_cents' => $cents,
        ]);
        $boundary = $paid('2026-01-30 03:00:00', 3000000000);
        $paid('2026-01-30 02:59:59', 200);
        $paid('2026-02-01 02:59:59', 300);
        $paid('2026-02-01 03:00:00', 400);
        $paid('2026-03-01 02:30:00', 500);
        $paid('2026-03-01 02:30:01', 600);
        $paid('2025-09-01 03:00:00', 700);
        $paid('2025-09-01 02:59:59', 800);
        foreach (['pending_payment', 'payment_expired', 'payment_review', 'refunded', 'charged_back'] as $status) {
            $this->order(['status' => $status, 'paid_at' => '2026-02-15 12:00:00', 'total_cents' => 900]);
        }
        $this->order(['status' => 'paid', 'paid_at' => null]);
        foreach (['101', '102'] as $providerId) {
            Payment::query()->forceCreate([
                'order_id' => $boundary->id, 'provider_payment_id' => $providerId,
                'amount_cents' => 3000000000, 'status' => 'approved', 'provider_updated_at' => '2026-01-30T03:00:00.000Z',
            ]);
        }

        $this->getJson(self::URL)->assertOk()
            ->assertJsonPath('data.sales.order_count', 4)
            ->assertJsonPath('data.sales.total_cents', 3000001200)
            ->assertJsonPath('data.sales.months', [
                ['month' => '2025-09', 'order_count' => 1, 'total_cents' => 700],
                ['month' => '2025-10', 'order_count' => 0, 'total_cents' => 0],
                ['month' => '2025-11', 'order_count' => 0, 'total_cents' => 0],
                ['month' => '2025-12', 'order_count' => 0, 'total_cents' => 0],
                ['month' => '2026-01', 'order_count' => 3, 'total_cents' => 3000000500],
                ['month' => '2026-02', 'order_count' => 2, 'total_cents' => 900],
            ]);
    }

    public function test_month_rollover_and_reporting_dates_follow_the_configured_timezone(): void
    {
        $this->admin();
        config(['store.timezone' => 'Pacific/Auckland']);
        $this->order(['status' => 'paid', 'paid_at' => '2026-02-28 10:59:59', 'total_cents' => 100]);
        $this->order(['status' => 'paid', 'paid_at' => '2026-02-28 11:00:00', 'total_cents' => 200]);
        $this->getJson(self::URL)->assertOk()
            ->assertJsonPath('data.sales.timezone', 'Pacific/Auckland')
            ->assertJsonPath('data.sales.from', '2026-01-31')
            ->assertJsonPath('data.sales.through', '2026-03-01')
            ->assertJsonPath('data.sales.months.0.month', '2025-10')
            ->assertJsonPath('data.sales.months.4', ['month' => '2026-02', 'order_count' => 1, 'total_cents' => 100])
            ->assertJsonPath('data.sales.months.5', ['month' => '2026-03', 'order_count' => 1, 'total_cents' => 200]);
    }

    public function test_november_ends_before_december_midnight_in_montevideo(): void
    {
        $this->admin();
        $this->travelTo(Carbon::parse('2026-12-01T03:00:01Z'));
        $this->order(['status' => 'paid', 'paid_at' => '2026-12-01 02:59:59', 'total_cents' => 100]);
        $this->order(['status' => 'paid', 'paid_at' => '2026-12-01 03:00:00', 'total_cents' => 200]);

        $this->getJson(self::URL)->assertOk()
            ->assertJsonPath('data.sales.through', '2026-12-01')
            ->assertJsonPath('data.sales.months.4', ['month' => '2026-11', 'order_count' => 1, 'total_cents' => 100])
            ->assertJsonPath('data.sales.months.5', ['month' => '2026-12', 'order_count' => 1, 'total_cents' => 200]);
    }

    private function admin(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']));
    }

    private function order(array $attributes = []): Order
    {
        return Order::query()->forceCreate([
            'reference' => (string) Str::uuid(), 'owner_key' => 'buyer:1',
            'idempotency_key' => (string) Str::uuid(), 'request_hash' => str_repeat('a', 64),
            'status' => 'pending_payment', 'currency' => 'UYU', 'subtotal_cents' => 12345,
            'shipping_cents' => 0, 'total_cents' => 12345, 'shipping_method' => 'pickup',
            'contact' => ['email' => 'private@example.test'], 'address' => ['street' => 'Private'],
            'reservation_expires_at' => now()->addHour(), 'fulfilment_status' => 'unstarted',
            ...$attributes,
        ]);
    }
}
