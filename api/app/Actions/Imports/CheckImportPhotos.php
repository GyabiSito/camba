<?php

namespace App\Actions\Imports;

use App\Models\Product;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class CheckImportPhotos
{
    public function execute(?Product $product, array $paths): void
    {
        if ($paths === []) {
            return;
        }

        $disk = Storage::disk('public');
        $root = realpath($disk->path(''));
        $pattern = '~\Aproducts/optimized/'.($product?->id ?? 0).'/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\.webp\z~';
        if (! $product || ! $root || count($paths) > 12 || count(array_unique($paths)) !== count($paths)
            || count(array_filter($paths, fn ($path) => preg_match($pattern, $path))) !== count($paths)
            || $product->images()->whereIn('path', $paths)->count() !== count($paths)) {
            $this->invalid();
        }

        foreach ($paths as $path) {
            foreach ([$path, substr($path, 0, -5).'-thumb.webp'] as $variant) {
                $absolute = $root.DIRECTORY_SEPARATOR.str_replace('/', DIRECTORY_SEPARATOR, $variant);
                if (realpath($disk->path($variant)) !== $absolute || ! is_file($absolute)) {
                    $this->invalid();
                }
            }
        }
    }

    private function invalid(): never
    {
        throw ValidationException::withMessages(['fotos' => 'Use existing, optimized photos that belong to this SKU.']);
    }
}
