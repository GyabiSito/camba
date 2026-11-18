<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->string('fulfilment_status', 24)->default('unstarted');
            $table->string('tracking', 100)->nullable();
            $table->index(['status', 'fulfilment_status']);
        });
        Schema::create('order_fulfilment_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('order_id')->constrained()->restrictOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('to_status', 24);
            $table->text('note')->nullable();
            $table->timestamp('created_at');
            $table->index(['order_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_fulfilment_events');
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropIndex(['status', 'fulfilment_status']);
            $table->dropColumn(['fulfilment_status', 'tracking']);
        });
    }
};
