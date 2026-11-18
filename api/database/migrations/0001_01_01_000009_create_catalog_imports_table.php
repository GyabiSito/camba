<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('catalog_imports', function (Blueprint $table): void {
            $table->id();
            $table->char('sha256', 64)->unique();
            $table->foreignId('uploaded_by')->constrained('users');
            $table->foreignId('confirmed_by')->nullable()->constrained('users');
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('catalog_import_rows', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('catalog_import_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('line');
            $table->string('sku', 64)->nullable();
            $table->enum('status', ['ready', 'invalid', 'applied', 'failed']);
            $table->enum('action', ['create', 'update'])->nullable();
            $table->foreignId('product_id')->nullable()->constrained();
            $table->json('values');
            $table->json('expected');
            $table->json('errors');
            $table->json('changes');
            $table->unique(['catalog_import_id', 'line']);
            $table->unique(['catalog_import_id', 'sku']);
            $table->index(['catalog_import_id', 'status', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('catalog_import_rows');
        Schema::dropIfExists('catalog_imports');
    }
};
