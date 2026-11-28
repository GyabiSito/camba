<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LegacyCatalogReceipt extends Model
{
    protected $primaryKey = 'source_unit';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['source_unit', 'product_id', 'candidate_hash', 'source', 'legacy_sku', 'legacy_slug', 'redirect_to', 'photos_applied'];

    protected $casts = ['source' => 'array', 'photos_applied' => 'boolean'];
}
