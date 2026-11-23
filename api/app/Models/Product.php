<?php

namespace App\Models;

use App\Enums\ProductStatus;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Product extends Model
{
    protected $fillable = ['name', 'description', 'price_cents', 'stock', 'category_id', 'brand_id'];

    protected $attributes = ['status' => 'draft', 'stock' => 0];

    protected $casts = ['status' => ProductStatus::class, 'price_cents' => 'integer', 'stock' => 'integer'];

    #[Scope]
    protected function published(Builder $query): void
    {
        $query->where('status', ProductStatus::Published->value);
    }

    #[Scope]
    protected function withoutAvailableStock(Builder $query): void
    {
        $query->where('stock', '<=', 0);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(Category::class);
    }

    public function brand(): BelongsTo
    {
        return $this->belongsTo(Brand::class);
    }

    public function images(): HasMany
    {
        return $this->hasMany(ProductImage::class)->orderBy('position')->orderBy('id');
    }
}
