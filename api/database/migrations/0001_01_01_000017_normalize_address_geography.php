<?php

use Database\Seeders\GeographySeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('departments', function (Blueprint $table): void {
            $table->unsignedBigInteger('id')->primary();
            $table->string('name', 80);
        });

        Schema::create('localities', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('department_id')->constrained()->restrictOnDelete();
            $table->unsignedBigInteger('source_id');
            $table->string('name', 120);
            $table->unique(['department_id', 'source_id']);
        });

        Schema::table('addresses', function (Blueprint $table): void {
            $table->foreignId('locality_id')->nullable()->index()->constrained()->restrictOnDelete();
        });

        app(GeographySeeder::class)->run();
    }

    public function down(): void
    {
        Schema::table('addresses', function (Blueprint $table): void {
            $table->dropForeign(['locality_id']);
            $table->dropIndex(['locality_id']);
            $table->dropColumn('locality_id');
        });

        Schema::dropIfExists('localities');
        Schema::dropIfExists('departments');
    }
};
