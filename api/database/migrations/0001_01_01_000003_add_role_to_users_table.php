<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'role')) {
            Schema::table('users', fn (Blueprint $table) => $table->enum('role', ['buyer', 'admin'])->default('buyer'));
        }
    }

    public function down(): void
    {
        // ponytail: Forward-only; earlier dev schemas may already have roles. Rollback never drops them.
    }
};
