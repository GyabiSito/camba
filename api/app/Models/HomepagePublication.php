<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class HomepagePublication extends Model
{
    protected $guarded = [];

    protected $casts = ['published' => 'array', 'draft' => 'array', 'revision' => 'integer', 'published_version' => 'integer'];
}
