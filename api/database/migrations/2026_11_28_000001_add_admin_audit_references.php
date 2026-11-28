<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const REFERENCES = [
        'product_adjustments' => ['actor_admin_id'],
        'store_setting_changes' => ['actor_admin_id'],
        'order_fulfilment_events' => ['actor_admin_id'],
        'catalog_imports' => ['uploaded_by_admin_id', 'confirmed_by_admin_id'],
        'withdrawals' => ['handled_by_admin_id', 'confirmation_requested_by_admin_id'],
    ];

    public function up(): void
    {
        $this->requireSafeSqliteAlter();
        foreach (self::REFERENCES as $tableName => $columns) {
            Schema::table($tableName, function (Blueprint $table) use ($columns, $tableName): void {
                if ($tableName === 'catalog_imports') {
                    $table->unsignedBigInteger('uploaded_by')->nullable()->change();
                }
                foreach ($columns as $column) {
                    $table->foreignId($column)->nullable()->constrained('admins')->restrictOnDelete();
                }
            });
        }
    }

    public function down(): void
    {
        $this->requireSafeSqliteAlter();
        foreach (self::REFERENCES as $tableName => $columns) {
            if (DB::table($tableName)->where(fn ($query) => collect($columns)
                ->each(fn ($column) => $query->orWhereNotNull($column)))->exists()) {
                throw new RuntimeException('Cannot remove administrator audit references after they have been used.');
            }
        }

        foreach (array_reverse(self::REFERENCES, true) as $tableName => $columns) {
            Schema::table($tableName, function (Blueprint $table) use ($columns, $tableName): void {
                foreach ($columns as $column) {
                    $table->dropConstrainedForeignId($column);
                }
                if ($tableName === 'catalog_imports') {
                    $table->unsignedBigInteger('uploaded_by')->nullable(false)->change();
                }
            });
        }
    }

    private function requireSafeSqliteAlter(): void
    {
        // SQLite cannot disable foreign keys inside a transaction during a table rebuild.
        if (DB::getDriverName() === 'sqlite' && DB::transactionLevel() > 0) {
            throw new RuntimeException('Run the administrator audit migration outside a SQLite transaction.');
        }
    }
};
