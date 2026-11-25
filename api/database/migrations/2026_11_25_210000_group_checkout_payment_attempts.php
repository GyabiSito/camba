<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_payments', function (Blueprint $table): void {
            $table->id();
        });
        Schema::table('orders', function (Blueprint $table): void {
            $table->foreignId('payment_id')->nullable()->unique()->constrained('order_payments');
            $table->foreignId('checkout_cart_id')->nullable()->constrained('carts')->nullOnDelete();
            $table->boolean('checkout_managed')->default(false);
        });
        Schema::table('payment_attempts', function (Blueprint $table): void {
            $table->foreignId('payment_id')->nullable()->constrained('order_payments');
            $table->unique(['order_id', 'idempotency_key']);
            $table->dropUnique(['order_id']);
        });
        Schema::table('payments', function (Blueprint $table): void {
            $table->foreignId('payment_attempt_id')->nullable()->constrained('payment_attempts');
        });

        DB::table('orders')->select('id')->chunkById(250, function ($orders): void {
            foreach ($orders as $order) {
                $paymentId = DB::table('order_payments')->insertGetId([]);
                DB::table('orders')->where('id', $order->id)->update(['payment_id' => $paymentId]);
                $attempts = DB::table('payment_attempts')->where('order_id', $order->id);
                $attemptId = (clone $attempts)->value('id');
                $attempts->update(['payment_id' => $paymentId]);
                if ($attemptId !== null) {
                    DB::table('payments')->where('order_id', $order->id)->update(['payment_attempt_id' => $attemptId]);
                }
            }
        });
    }

    public function down(): void
    {
        if (DB::table('payment_attempts')->select('order_id')->groupBy('order_id')->havingRaw('count(*) > 1')->exists()
            || DB::table('orders')->where('checkout_managed', true)->exists()) {
            throw new RuntimeException('Cannot discard Checkout Pro attempt history or managed orders.');
        }
        Schema::table('payments', fn (Blueprint $table) => $table->dropConstrainedForeignId('payment_attempt_id'));
        Schema::table('payment_attempts', function (Blueprint $table): void {
            $table->unique('order_id');
            $table->dropUnique(['order_id', 'idempotency_key']);
            $table->dropConstrainedForeignId('payment_id');
        });
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropUnique(['payment_id']);
            $table->dropConstrainedForeignId('payment_id');
            $table->dropConstrainedForeignId('checkout_cart_id');
            $table->dropColumn('checkout_managed');
        });
        Schema::drop('order_payments');
    }
};
