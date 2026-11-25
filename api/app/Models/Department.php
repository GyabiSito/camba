<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Department extends Model
{
    public $incrementing = false;

    public $timestamps = false;

    protected function casts(): array
    {
        return ['id' => 'integer'];
    }
}
