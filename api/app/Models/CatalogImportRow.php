<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CatalogImportRow extends Model
{
    public $timestamps = false;

    protected $fillable = ['line', 'sku', 'status', 'action', 'product_id', 'values', 'expected', 'errors', 'changes'];

    protected $casts = ['values' => 'array', 'expected' => 'array', 'errors' => 'array', 'changes' => 'array'];
}
