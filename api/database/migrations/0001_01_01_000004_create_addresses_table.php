<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('addresses', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('recipient', 120);
            $table->string('department', 80);
            $table->string('locality', 120);
            $table->string('street', 160);
            $table->string('number', 20);
            $table->string('details')->nullable();
            $table->string('phone', 30)->nullable();
            $table->string('postal_code', 12)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('addresses');
    }
};
