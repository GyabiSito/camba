<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('withdrawals', function (Blueprint $table): void {
            $table->text('confirmation_token')->nullable();
            $table->char('confirmation_owner_hash', 64)->nullable();
            $table->unsignedBigInteger('confirmation_buyer_id')->nullable();
            $table->unsignedBigInteger('confirmation_requested_by')->nullable();
            $table->timestamp('confirmation_requested_at')->nullable();
            $table->timestamp('confirmation_expires_at')->nullable();
            $table->timestamp('confirmation_confirmed_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('withdrawals', fn (Blueprint $table) => $table->dropColumn([
            'confirmation_token', 'confirmation_owner_hash', 'confirmation_buyer_id', 'confirmation_requested_by',
            'confirmation_requested_at', 'confirmation_expires_at', 'confirmation_confirmed_at',
        ]));
    }
};
