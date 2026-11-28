<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CatalogImport extends Model
{
    protected $fillable = ['sha256', 'uploaded_by', 'uploaded_by_admin_id', 'confirmed_by', 'confirmed_by_admin_id', 'confirmed_at', 'completed_at'];

    protected $casts = ['confirmed_at' => 'datetime', 'completed_at' => 'datetime'];

    public function rows(): HasMany
    {
        return $this->hasMany(CatalogImportRow::class);
    }
}
