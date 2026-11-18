<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('legacy_catalog_receipts', function (Blueprint $table): void {
            $table->string('source_unit', 48)->primary();
            $table->foreignId('product_id')->unique()->constrained();
            $table->char('candidate_hash', 64);
            $table->json('source');
            $table->string('legacy_sku', 64);
            $table->string('legacy_slug', 160);
            $table->string('redirect_to')->nullable();
            $table->boolean('photos_applied');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('legacy_catalog_receipts');
    }
};
