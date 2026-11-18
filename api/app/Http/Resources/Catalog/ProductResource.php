<?php

namespace App\Http\Resources\Catalog;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class ProductResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'sku' => $this->sku,
            'slug' => $this->slug,
            'name' => $this->name,
            'description' => $this->description,
            'price_cents' => $this->price_cents,
            'currency' => 'UYU',
            'stock' => $this->stock,
            'in_stock' => $this->stock > 0,
            'category' => ClassificationResource::make($this->category),
            'brand' => ClassificationResource::make($this->brand),
            'images' => $this->images->map(fn ($image) => [
                'id' => $image->id,
                'url' => Storage::disk('public')->url($image->path),
                'alt' => $image->alt ?? $this->name,
            ]),
            'status' => $this->when($request->routeIs('admin.catalog.*'), $this->status->value),
        ];
    }
}
