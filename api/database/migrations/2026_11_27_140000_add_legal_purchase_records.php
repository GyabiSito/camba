<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->string('terms_version', 24)->nullable();
            $table->json('terms_snapshot')->nullable();
        });
        Schema::create('withdrawals', function (Blueprint $table): void {
            $table->id();
            $table->uuid('reference')->unique();
            $table->string('request_key', 64)->unique();
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->uuid('order_reference');
            $table->text('email');
            $table->string('status', 16)->default('received');
            $table->foreignId('handled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('refund_payment_id')->nullable()->constrained('payments')->nullOnDelete();
            $table->string('refund_provider_reference', 64)->nullable();
            $table->timestamp('refund_confirmed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('withdrawals');
        Schema::table('orders', fn (Blueprint $table) => $table->dropColumn(['terms_version', 'terms_snapshot']));
    }
};
