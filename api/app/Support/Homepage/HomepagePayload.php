<?php

namespace App\Support\Homepage;

use App\Http\Resources\Catalog\ClassificationResource;
use App\Http\Resources\Catalog\ProductResource;
use App\Models\Category;
use App\Models\HomepageImage;
use App\Models\HomepagePublication;
use App\Models\Product;
use Illuminate\Support\Str;

class HomepagePayload
{
    public function editor(HomepagePublication $home): array
    {
        return ['revision' => $home->revision, 'published_version' => $home->published_version,
            'published' => $home->published, 'draft' => $home->draft,
            'assets' => $this->assets(HomepageImage::query()->get(), true),
            'store_url' => config('app.url')];
    }

    public function publication(HomepagePublication $home, bool $preview = false): array
    {
        $document = $preview ? ($home->draft ?? $home->published) : $home->published;
        $categoryIds = array_column($document['categories']['cards'], 'categoryId');
        $productIds = array_merge($document['selection']['productIds'], $document['look']['productIds']);
        $collect = function (array $node) use (&$collect, &$categoryIds, &$productIds): void {
            if (($node['type'] ?? null) === 'category') {
                $categoryIds[] = $node['id'];
            } elseif (($node['type'] ?? null) === 'product') {
                $productIds[] = $node['id'];
            }
            foreach ($node as $child) {
                if (is_array($child)) {
                    $collect($child);
                }
            }
        };
        $collect($document);
        $eligible = fn () => Product::query()->published()->whereRelation('category', 'active', true);
        $selection = $document['selection'];
        $autoCategory = $selection['mode'] === 'automatic' ? $selection['categoryId'] : null;
        if ($document['look']['mode'] === 'automatic' || $document['categories']['mode'] === 'automatic'
            || ($selection['mode'] === 'automatic' && $selection['categoryId'] === null)) {
            $productIds = array_merge($productIds, $eligible()->when($autoCategory !== null, fn ($query) => $query->where('category_id', '!=', $autoCategory))
                ->latest('id')->limit(12)->pluck('id')->all());
        }
        if ($autoCategory !== null) {
            $productIds = array_merge($productIds, $eligible()->where('category_id', $autoCategory)->latest('id')->limit(8)->pluck('id')->all());
        }
        $products = $eligible()->whereIn('id', array_unique($productIds))->with(['category', 'brand', 'images'])->latest('id')->get();
        $categoryIds = array_merge($categoryIds, $products->pluck('category_id')->all());
        $categories = Category::query()->where('active', true)
            ->when($document['categories']['mode'] !== 'automatic', fn ($query) => $query->whereIn('id', array_unique($categoryIds)))
            ->orderBy('id')->get();
        $images = HomepageImage::query()->whereIn('key', self::uploadedImageKeys($document))
            ->when(! $preview, fn ($query) => $query->whereNotNull('published_at'))->get();

        return ['document' => $document, 'version' => $home->published_version,
            'assets' => $this->assets($images, $preview),
            'categories' => ClassificationResource::collection($categories)->resolve(),
            'products' => ProductResource::collection($products)->resolve()];
    }

    public function asset(HomepageImage $image, bool $private): array
    {
        $prefix = $private ? '/api/v1/admin/homepage/media/' : '/api/v1/homepage/media/';

        return ['url' => $prefix.$image->key.'/display', 'thumbnail_url' => $prefix.$image->key.'/thumbnail',
            'width' => $image->width, 'height' => $image->height,
            'small_width' => max(1, (int) round($image->width * min(1, 400 / max($image->width, $image->height))))];
    }

    private function assets($images, bool $private): array
    {
        $assets = DefaultHomepage::assets();
        foreach ($images as $image) {
            $assets[$image->key] = $this->asset($image, $private);
        }

        return $assets;
    }

    public static function uploadedImageKeys(array $node): array
    {
        $keys = Str::isUuid($node['key'] ?? null) ? [$node['key']] : [];
        foreach ($node as $child) {
            if (is_array($child)) {
                $keys = array_merge($keys, self::uploadedImageKeys($child));
            }
        }

        return array_values(array_unique($keys));
    }
}
