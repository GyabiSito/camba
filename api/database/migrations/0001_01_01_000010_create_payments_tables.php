<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->string('paid_provider_payment_id', 20)->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('stock_reacquired_at')->nullable();
            $table->json('payment_issues')->nullable();
            $table->timestamp('payment_reconcile_at')->nullable()->index();
            $table->timestamp('payment_reconciled_at')->nullable();
            $table->uuid('payment_reconcile_token')->nullable();
            $table->unsignedInteger('payment_reconcile_failures')->default(0);
            $table->string('payment_reconcile_result', 64)->nullable();
        });

        Schema::create('payment_attempts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_id')->unique()->constrained();
            $table->uuid('idempotency_key');
            $table->string('status', 16);
            $table->string('provider_preference_id', 128)->nullable()->unique();
            $table->text('checkout_url')->nullable();
            $table->timestamp('expires_at');
            $table->timestamps();
        });

        Schema::create('payments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_id')->constrained();
            $table->string('provider_payment_id', 20)->unique();
            $table->unsignedBigInteger('amount_cents');
            $table->string('status', 16);
            $table->char('provider_updated_at', 24);
            $table->timestamps();
        });

        Schema::create('payment_observations', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('payment_id')->constrained();
            $table->string('status', 16);
            $table->char('provider_updated_at', 24);
            $table->timestamp('created_at');
            $table->unique(['payment_id', 'provider_updated_at', 'status'], 'payment_unique_observation');
        });

        Schema::create('payment_webhook_events', function (Blueprint $table): void {
            $table->id();
            $table->char('delivery_key', 64)->unique();
            $table->string('provider_payment_id', 20);
            $table->timestamp('next_attempt_at');
            $table->timestamp('processed_at')->nullable();
            $table->uuid('lease_token')->nullable();
            $table->unsignedInteger('attempts')->default(0);
            $table->string('result', 64)->nullable();
            $table->timestamps();
            $table->index(['processed_at', 'next_attempt_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_webhook_events');
        Schema::dropIfExists('payment_observations');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('payment_attempts');
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropIndex(['payment_reconcile_at']);
            $table->dropColumn([
                'paid_provider_payment_id', 'paid_at', 'stock_reacquired_at', 'payment_issues',
                'payment_reconcile_at', 'payment_reconciled_at', 'payment_reconcile_token', 'payment_reconcile_failures', 'payment_reconcile_result',
            ]);
        });
    }
};
