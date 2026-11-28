<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_image_uploads', function (Blueprint $table): void {
            $table->foreignId('product_id')->constrained()->cascadeOnDelete();
            $table->uuid('upload_key');
            $table->char('payload_hash', 64);
            $table->primary(['product_id', 'upload_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_image_uploads');
    }
};
