<?php

namespace Tests\Feature\Accounts;

use App\Actions\Notices\NoticeEligibility;
use App\Models\CommerceNotice;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Feature\TestDatabase;
use Tests\TestCase;

class AdminHistoryMigrationTest extends TestCase
{
    use DatabaseMigrations;

    protected function beforeRefreshingDatabase(): void
    {
        TestDatabase::assertIsolated($this);
    }

    public function test_cutover_preserves_legacy_audit_and_import_references(): void
    {
        $migration = require database_path('migrations/2026_11_28_000001_add_admin_audit_references.php');
        $migration->down();
        $legacy = User::factory()->create(['role' => 'admin']);
        $order = Order::forceCreate([
            'reference' => (string) Str::uuid(), 'user_id' => $legacy->id, 'owner_key' => 'buyer:'.$legacy->id,
            'idempotency_key' => (string) Str::uuid(), 'request_hash' => str_repeat('b', 64),
            'status' => 'pending_payment', 'currency' => 'UYU', 'subtotal_cents' => 100,
            'shipping_cents' => 0, 'total_cents' => 100, 'shipping_method' => 'pickup',
            'contact' => ['email' => $legacy->email], 'reservation_expires_at' => now()->addHour(),
        ]);
        $import = DB::table('catalog_imports')->insertGetId([
            'sha256' => str_repeat('a', 64), 'uploaded_by' => $legacy->id, 'confirmed_by' => $legacy->id,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('catalog_import_rows')->insert([
            'catalog_import_id' => $import, 'line' => 2, 'status' => 'ready',
            'values' => '{}', 'expected' => '{}', 'errors' => '{}', 'changes' => '{}',
        ]);
        DB::table('store_setting_changes')->insert([
            'actor_id' => $legacy->id, 'before' => '{}', 'after' => '{}', 'created_at' => now(),
        ]);

        $migration->up();
        $this->artisan('camba:admin', ['email' => $legacy->email, '--from-legacy' => true])->assertSuccessful();
        $this->assertDatabaseHas('catalog_imports', [
            'id' => $import, 'uploaded_by' => $legacy->id, 'confirmed_by' => $legacy->id, 'uploaded_by_admin_id' => null,
        ]);
        $this->assertDatabaseHas('catalog_import_rows', ['catalog_import_id' => $import, 'line' => 2]);
        $this->assertDatabaseHas('store_setting_changes', ['actor_id' => $legacy->id, 'actor_admin_id' => null]);
        $this->assertDatabaseHas('orders', ['id' => $order->id, 'user_id' => $legacy->id]);

        config(['app.admin_url' => 'https://admin.camba.test']);
        $notice = new CommerceNotice([
            'kind' => CommerceNotice::ADMIN_ORDER_CREATED, 'subject_id' => $order->id,
            'source_hash' => hash('sha256', $legacy->id.'|'.$legacy->email),
        ]);
        $eligibility = app(NoticeEligibility::class);
        $this->assertSame([$legacy->email, $order->reference], $eligibility->recipient($notice));
        $notice->source_hash = hash('sha256', ($legacy->id + 1).'|'.$legacy->email);
        $this->assertNull($eligibility->recipient($notice));
    }
}
