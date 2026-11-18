<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table): void {
            $table->id();
            $table->uuid('reference')->unique();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('owner_key', 70);
            $table->uuid('idempotency_key');
            $table->char('request_hash', 64);
            $table->string('status', 32);
            $table->char('currency', 3);
            $table->unsignedBigInteger('subtotal_cents');
            $table->unsignedBigInteger('shipping_cents');
            $table->unsignedBigInteger('total_cents');
            $table->string('shipping_method', 12);
            $table->string('pickup_address')->nullable();
            $table->text('contact');
            $table->text('address')->nullable();
            $table->timestamp('guest_access_expires_at')->nullable();
            $table->timestamp('reservation_expires_at');
            $table->timestamp('stock_released_at')->nullable();
            $table->timestamps();
            $table->unique(['owner_key', 'idempotency_key']);
            $table->index(['owner_key', 'id']);
            $table->index(['status', 'reservation_expires_at']);
        });

        Schema::create('order_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_id')->constrained();
            $table->foreignId('product_id')->constrained();
            $table->string('sku', 64);
            $table->string('name', 120);
            $table->unsignedInteger('quantity');
            $table->unsignedBigInteger('unit_price_cents');
            $table->unsignedBigInteger('line_total_cents');
            $table->unique(['order_id', 'product_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_items');
        Schema::dropIfExists('orders');
    }
};
