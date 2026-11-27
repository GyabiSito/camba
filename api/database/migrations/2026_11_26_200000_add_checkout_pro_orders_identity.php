<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payment_attempts', function (Blueprint $table): void {
            $table->string('checkout_protocol', 16)->default('preferences');
            $table->string('provider_order_id', 64)->nullable()->unique();
            $table->char('provider_order_updated_at', 24)->nullable();
            $table->uuid('provider_create_key')->nullable()->unique();
            $table->text('provider_create_payload')->nullable();
        });
        Schema::table('payments', fn (Blueprint $table) => $table->string('provider_payment_id', 64)->change());
        Schema::table('orders', fn (Blueprint $table) => $table->string('paid_provider_payment_id', 64)->nullable()->change());
        Schema::table('payment_webhook_events', function (Blueprint $table): void {
            $table->string('provider_payment_id', 20)->nullable()->change();
            $table->string('provider_order_id', 64)->nullable();
        });
    }

    public function down(): void
    {
        if (DB::table('payment_attempts')->where('checkout_protocol', 'orders')->exists()
            || DB::table('payment_webhook_events')->whereNotNull('provider_order_id')->exists()) {
            throw new RuntimeException('Refusing to discard Mercado Pago Orders history.');
        }
        Schema::table('payment_webhook_events', function (Blueprint $table): void {
            $table->dropColumn('provider_order_id');
            $table->string('provider_payment_id', 20)->change();
        });
        Schema::table('payment_attempts', function (Blueprint $table): void {
            $table->dropUnique(['provider_order_id']);
            $table->dropUnique(['provider_create_key']);
            $table->dropColumn(['checkout_protocol', 'provider_order_id', 'provider_order_updated_at', 'provider_create_key', 'provider_create_payload']);
        });
        Schema::table('payments', fn (Blueprint $table) => $table->string('provider_payment_id', 20)->change());
        Schema::table('orders', fn (Blueprint $table) => $table->string('paid_provider_payment_id', 20)->nullable()->change());
    }
};
