<?php

namespace App\Http\Controllers\Catalog;

use App\Actions\Catalog\SaveProductImagesAction;
use App\Http\Requests\Catalog\OrderProductImagesRequest;
use App\Http\Requests\Catalog\UploadProductImagesRequest;
use App\Http\Resources\Catalog\ProductResource;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ProductImagesController
{
    public function store(UploadProductImagesRequest $request, int $product, SaveProductImagesAction $save): JsonResponse
    {
        $key = $request->validated('idempotency_key');
        $photos = $request->file('photos');
        $updated = $key === null ? $save->execute($product, $photos) : $save->executeIdempotently($product, $photos, $key);

        return ProductResource::make($updated)->response()->setStatusCode(201);
    }

    public function order(OrderProductImagesRequest $request, int $product): ProductResource
    {
        $ids = array_map('intval', $request->validated('ids'));
        $updated = DB::transaction(function () use ($product, $ids): Product {
            $row = Product::query()->lockForUpdate()->findOrFail($product);
            $owned = $row->images()->pluck('id')->map(fn ($id) => (int) $id)->all();
            if (count($ids) !== count($owned) || array_diff($ids, $owned) !== []) {
                throw ValidationException::withMessages(['ids' => 'Incluye todas las fotos de este producto en el nuevo orden.']);
            }
            foreach ($ids as $position => $id) {
                $row->images()->whereKey($id)->update(['position' => $position]);
            }

            return $row->load(['category', 'brand', 'images']);
        });

        return ProductResource::make($updated);
    }
}
