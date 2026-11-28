<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('buyer_reminder_preferences', function (Blueprint $table): void {
            $table->foreignId('user_id')->primary()->constrained()->cascadeOnDelete();
            $table->boolean('payment_reminders')->default(false);
            $table->boolean('cart_reminders')->default(false);
            $table->timestamps();
        });

        Schema::create('commerce_notices', function (Blueprint $table): void {
            $table->id();
            $table->string('dedup_key', 140)->unique();
            $table->string('channel', 8);
            $table->string('kind', 32);
            $table->string('subject_type', 12);
            $table->unsignedBigInteger('subject_id');
            $table->string('issue', 48)->nullable();
            $table->timestamp('source_at')->nullable();
            $table->char('source_hash', 64)->nullable();
            $table->string('state', 16);
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->timestamp('available_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->string('error_code', 40)->nullable();
            $table->timestamps();
            $table->index(['channel', 'state', 'available_at'], 'notice_due_index');
            $table->index(['channel', 'kind', 'subject_type', 'subject_id', 'source_at'], 'notice_source_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('commerce_notices');
        Schema::dropIfExists('buyer_reminder_preferences');
    }
};
