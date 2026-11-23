<?php

namespace App\Http\Controllers\Catalog;

use App\Actions\Catalog\SaveProductAction;
use App\Enums\ProductStatus;
use App\Http\Requests\Catalog\BrowseProductsRequest;
use App\Http\Requests\Catalog\SaveProductRequest;
use App\Http\Resources\Catalog\ProductResource;
use App\Models\Product;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

class ProductController
{
    private const RELATIONS = ['category', 'brand', 'images'];

    public function index(BrowseProductsRequest $request): AnonymousResourceCollection
    {
        $filters = $request->validated();
        $query = Product::query()->with(['category', 'brand', 'images' => fn (HasMany $relation) => $relation->limit(1)]);

        if (! $request->routeIs('admin.catalog.*')) {
            $query->published();
        } elseif (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (($filters['availability'] ?? null) === 'out_of_stock') {
            $query->withoutAvailableStock();
        }

        if (isset($filters['q'])) {
            // ponytail: substring search scans matching rows; move to indexed search if catalog size warrants it.
            $needle = '%'.strtr($filters['q'], ['!' => '!!', '%' => '!%', '_' => '!_']).'%';
            $query->where(fn (Builder $query) => $query
                ->whereRaw("LOWER(name) LIKE LOWER(?) ESCAPE '!'", [$needle])
                ->orWhereRaw("LOWER(sku) LIKE LOWER(?) ESCAPE '!'", [$needle]));
        }

        foreach (['category', 'brand'] as $filter) {
            if (isset($filters[$filter])) {
                $query->whereRelation($filter, 'slug', $filters[$filter]);
            }
        }

        match ($filters['sort'] ?? 'newest') {
            'name' => $query->orderBy('name')->orderBy('id'),
            'price_asc' => $query->orderBy('price_cents')->orderBy('id'),
            'price_desc' => $query->orderByDesc('price_cents')->orderBy('id'),
            'newest' => $query->latest('id'),
        };

        return ProductResource::collection($query->paginate($filters['per_page'] ?? 24)->appends($filters));
    }

    public function publicShow(string $slug): ProductResource
    {
        return new ProductResource(Product::query()->published()->with(self::RELATIONS)->where('slug', $slug)->firstOrFail());
    }

    public function show(string $product): ProductResource
    {
        // Resolve the ID after authorization; implicit model binding would run before the admin gate.
        return new ProductResource(Product::query()->with(self::RELATIONS)->findOrFail($product));
    }

    public function store(SaveProductRequest $request, SaveProductAction $save): ProductResource
    {
        return new ProductResource($save->create($request->validated())->load(self::RELATIONS));
    }

    public function update(SaveProductRequest $request, string $product, SaveProductAction $save): ProductResource
    {
        return new ProductResource($save->update($product, $request->validated(), actorId: $request->user()->id)->load(self::RELATIONS));
    }

    public function history(string $product): JsonResponse
    {
        Product::query()->findOrFail($product, ['id']);

        return response()->json(DB::table('product_adjustments')->where('product_id', $product)->orderByDesc('id')->paginate(25))
            ->header('Cache-Control', 'private, no-store');
    }

    public function publish(string $product, SaveProductAction $save): ProductResource
    {
        return new ProductResource($save->update($product, [], ProductStatus::Published)->load(self::RELATIONS));
    }

    public function archive(string $product, SaveProductAction $save): ProductResource
    {
        return new ProductResource($save->update($product, [], ProductStatus::Archived)->load(self::RELATIONS));
    }
}
