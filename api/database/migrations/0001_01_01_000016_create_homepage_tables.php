<?php

use App\Support\Homepage\DefaultHomepage;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('homepage_publications', function (Blueprint $table): void {
            $table->unsignedInteger('id')->primary();
            $table->unsignedInteger('revision')->default(1);
            $table->unsignedInteger('published_version')->default(1);
            $table->json('published');
            $table->json('draft')->nullable();
            $table->timestamps();
        });
        Schema::create('homepage_images', function (Blueprint $table): void {
            $table->id();
            $table->uuid('key')->unique();
            $table->string('path');
            $table->unsignedInteger('width');
            $table->unsignedInteger('height');
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });
        DB::table('homepage_publications')->insert([
            'id' => 1, 'revision' => 1, 'published_version' => 1,
            'published' => json_encode(DefaultHomepage::document(), JSON_THROW_ON_ERROR),
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('homepage_images');
        Schema::dropIfExists('homepage_publications');
    }
};
