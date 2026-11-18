<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['categories', 'brands'] as $name) {
            Schema::create($name, function (Blueprint $table): void {
                $table->id();
                $table->string('name', 120)->unique();
                $table->string('slug', 160)->unique();
                $table->boolean('active')->default(true);
                $table->timestamps();
            });
        }

        // Blueprint does not expose CHECK. SQLite's dynamic affinity also needs an integer type check.
        $sqlite = DB::connection()->getDriverName() === 'sqlite';
        $id = $sqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY';
        $foreignId = $sqlite ? 'INTEGER' : 'BIGINT UNSIGNED';
        $price = $sqlite ? "typeof(price_cents) = 'integer' AND " : '';
        $stock = $sqlite ? "typeof(stock) = 'integer' AND " : '';
        $status = $sqlite ? 'status' : 'CAST(status AS BINARY)';
        DB::statement(<<<SQL
            CREATE TABLE products (
                id $id,
                sku VARCHAR(64) NOT NULL UNIQUE,
                slug VARCHAR(160) NOT NULL UNIQUE,
                name VARCHAR(120) NULL,
                description TEXT NULL,
                price_cents INTEGER NULL CHECK (price_cents IS NULL OR ({$price}price_cents BETWEEN 1 AND 2147483647)),
                stock INTEGER NOT NULL DEFAULT 0 CHECK ({$stock}stock BETWEEN 0 AND 2147483647),
                status VARCHAR(12) NOT NULL DEFAULT 'draft' CHECK ($status IN ('draft', 'published', 'archived')),
                category_id $foreignId NULL,
                brand_id $foreignId NULL,
                created_at TIMESTAMP NULL,
                updated_at TIMESTAMP NULL,
                CHECK (status <> 'published' OR (
                    name IS NOT NULL AND LENGTH(TRIM(name)) > 0 AND price_cents IS NOT NULL AND category_id IS NOT NULL
                )),
                FOREIGN KEY (category_id) REFERENCES categories (id),
                FOREIGN KEY (brand_id) REFERENCES brands (id)
            )
            SQL);

        Schema::table('products', function (Blueprint $table): void {
            $table->index(['status', 'id']);
            $table->index(['category_id', 'status']);
            $table->index(['brand_id', 'status']);
        });

        Schema::create('product_images', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('product_id')->constrained();
            $table->string('path');
            $table->string('alt', 160)->nullable();
            $table->unsignedInteger('position')->default(0);
            $table->index(['product_id', 'position']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_images');
        Schema::dropIfExists('products');
        Schema::dropIfExists('brands');
        Schema::dropIfExists('categories');
    }
};
