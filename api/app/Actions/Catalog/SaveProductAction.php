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
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class SaveProductAction
{
    public function create(array $input): Product
    {
        return $this->createDraft($input);
    }

    public function createForImport(string $sku, array $input): Product
    {
        if (! preg_match('/\A[A-Z0-9][A-Z0-9._-]{0,63}\z/', $sku)) {
            throw ValidationException::withMessages(['codigo' => 'The SKU is invalid.']);
        }

        return $this->createDraft($input, $sku);
    }

    private function createDraft(array $input, ?string $sku = null): Product
    {
        $id = (string) Str::ulid();
        $slug = Str::slug($input['name'] ?? '');

        $product = new Product($input);
        $product->sku = $sku ?? 'CAM-'.strtoupper($id);
        $product->slug = (rtrim(substr($slug, 0, 120), '-') ?: 'product').'-'.strtolower($id);

        $persist = function () use ($product): Product {
            try {
                $product->save();
            } catch (UniqueConstraintViolationException) {
                throw new ConflictHttpException('Could not assign a unique SKU or slug. Retry creating the draft.');
            }

            return $product;
        };

        return DB::connection()->getDriverName() === 'pgsql' ? DB::transaction($persist) : $persist();
    }

    public function update(string $productId, array $input, ?ProductStatus $transition = null, ?int $actorId = null): Product
    {
        return DB::transaction(function () use ($productId, $input, $transition, $actorId): Product {
            $current = Product::query()->lockForUpdate()->findOrFail($productId);
            $current->fill($input);

            if ($transition !== null) {
                abort_if($transition === $current->status, 409, 'The product is already '.$transition->value.'.');
                $current->status = $transition;
            }

            if ($current->status === ProductStatus::Published) {
                $this->validatePublication($current);
            }

            if ($current->isDirty(['price_cents', 'stock'])) {
                DB::table('product_adjustments')->insert([
                    'product_id' => $current->id,
                    'actor_id' => $actorId,
                    'old_price_cents' => $current->getOriginal('price_cents'),
                    'price_cents' => $current->price_cents,
                    'old_stock' => $current->getOriginal('stock'),
                    'stock' => $current->stock,
                    'created_at' => now(),
                ]);
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
