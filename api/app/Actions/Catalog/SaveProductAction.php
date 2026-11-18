<?php

namespace App\Actions\Catalog;

use App\Enums\ProductStatus;
use App\Models\Brand;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SaveProductAction
{
    public function create(array $input): Product
    {
        $id = (string) Str::ulid();
        $slug = Str::slug($input['name'] ?? '');

        $product = new Product($input);
        $product->sku = 'CAM-'.strtoupper($id);
        $product->slug = (rtrim(substr($slug, 0, 120), '-') ?: 'product').'-'.strtolower($id);
        try {
            $product->save();
        } catch (UniqueConstraintViolationException) {
            abort(409, 'Could not assign a unique SKU or slug. Retry creating the draft.');
        }

        return $product;
    }

    public function update(string $productId, array $input, ?ProductStatus $transition = null): Product
    {
        return DB::transaction(function () use ($productId, $input, $transition): Product {
            $current = Product::query()->lockForUpdate()->findOrFail($productId);
            $current->fill($input);

            if ($transition !== null) {
                abort_if($transition === $current->status, 409, 'The product is already '.$transition->value.'.');
                $current->status = $transition;
            }

            if ($current->status === ProductStatus::Published) {
                $this->validatePublication($current);
            }

            $current->save();

            return $current;
        }, 3);
    }

    private function validatePublication(Product $product): void
    {
        // The taxonomy update takes the same row lock before checking for published references.
        $category = $product->category_id === null ? null : Category::query()->lockForUpdate()->find($product->category_id);
        $brand = $product->brand_id === null ? null : Brand::query()->lockForUpdate()->find($product->brand_id);
        $errors = array_filter([
            'name' => blank($product->name) ? 'Add a product name before publishing.' : null,
            'price_cents' => $product->price_cents === null ? 'Add a price before publishing.' : null,
            'category_id' => ! $category?->active ? 'Choose an active category before publishing.' : null,
            'brand_id' => $product->brand_id !== null && ! $brand?->active ? 'Choose an active brand or remove the brand before publishing.' : null,
            'images' => ! $product->images()->exists() ? 'Add at least one product image before publishing.' : null,
        ]);

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }
}
