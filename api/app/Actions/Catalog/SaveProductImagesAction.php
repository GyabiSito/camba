<?php

namespace App\Actions\Catalog;

use App\Models\Product;
use GdImage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SaveProductImagesAction
{
    private const CLOSED = 'closed';

    public function close(int $id, string $key): Product
    {
        return DB::transaction(function () use ($id, $key): Product {
            $product = Product::query()->lockForUpdate()->findOrFail($id);
            DB::table('product_image_uploads')->upsert([
                'product_id' => $id, 'upload_key' => strtolower($key), 'payload_hash' => self::CLOSED,
            ], ['product_id', 'upload_key'], ['upload_key']);

            return $product->load(['category', 'brand', 'images']);
        });
    }

    /** @param list<UploadedFile> $photos */
    public function execute(int $id, array $photos): Product
    {
        return $this->save($id, $photos);
    }

    /** @param list<UploadedFile> $photos */
    public function executeIdempotently(int $id, array $photos, string $key): Product
    {
        return $this->save($id, $photos, $key);
    }

    private function save(int $id, array $photos, ?string $key = null): Product
    {
        $product = Product::query()->findOrFail($id);
        $receipt = $key === null ? null : [
            'product_id' => $id,
            'upload_key' => strtolower($key),
            'payload_hash' => hash('sha256', implode('', array_map(fn (UploadedFile $photo) => hash('sha256', $photo->getContent()), $photos))),
        ];
        if ($receipt !== null && $this->isReplay($receipt)) {
            return $product->load(['category', 'brand', 'images']);
        }

        abort_unless(function_exists('imagewebp') && function_exists('exif_read_data'), 503, 'El procesamiento de imágenes no está disponible.');
        $disk = Storage::disk('public');
        $staged = $photosToInsert = [];
        $mayBeReferenced = false;

        try {
            foreach ($photos as $index => $photo) {
                $image = @imagecreatefromstring($photo->getContent());
                if (! $image) {
                    throw ValidationException::withMessages(["photos.$index" => 'No se pudo leer la imagen.']);
                }
                $image = $this->orient($image, $photo);
                $base = 'products/optimized/'.$id.'/'.Str::uuid();
                foreach ([1600 => '.webp', 400 => '-thumb.webp'] as $size => $suffix) {
                    $path = $staged[] = $base.$suffix;
                    abort_unless($disk->put($path, $this->webp($image, $size)), 503, 'No se pudo guardar la foto.');
                }
                $photosToInsert[] = $base.'.webp';
                unset($image);
            }

            return DB::transaction(function () use ($id, $photosToInsert, $receipt, &$mayBeReferenced): Product {
                $product = Product::query()->lockForUpdate()->findOrFail($id);
                // Read the receipt after acquiring the product lock, before establishing a consistent snapshot.
                if ($receipt !== null && $this->isReplay($receipt)) {
                    return $product->load(['category', 'brand', 'images']);
                }

                $position = ($product->images()->reorder()->max('position') ?? -1) + 1;
                foreach ($photosToInsert as $path) {
                    $product->images()->create(['path' => $path, 'position' => $position++]);
                }
                if ($receipt !== null) {
                    DB::table('product_image_uploads')->insert($receipt);
                }
                $product->load(['category', 'brand', 'images']);
                // After this point an exception can mean the commit succeeded but its acknowledgement was lost.
                $mayBeReferenced = true;

                return $product;
            });
        } finally {
            if (! $mayBeReferenced && $staged !== []) {
                $disk->delete($staged);
            }
        }
    }

    private function isReplay(array $receipt): bool
    {
        $hash = DB::table('product_image_uploads')->where('product_id', $receipt['product_id'])
            ->where('upload_key', $receipt['upload_key'])->value('payload_hash');
        abort_if($hash === self::CLOSED, 409, 'La carga ya se cerró.');
        abort_if($hash !== null && $hash !== $receipt['payload_hash'], 409, 'Esta clave de subida ya se usó con otras fotos o en otro orden.');

        return $hash !== null;
    }

    private function orient(GdImage $image, UploadedFile $photo): GdImage
    {
        $orientation = $photo->getMimeType() === 'image/jpeg' ? (@exif_read_data($photo->getPathname())['Orientation'] ?? 1) : 1;
        if (in_array($orientation, [2, 5, 7], true)) {
            imageflip($image, IMG_FLIP_HORIZONTAL);
        } elseif ($orientation === 4) {
            imageflip($image, IMG_FLIP_VERTICAL);
        }
        $angle = match ($orientation) {
            3 => 180,
            5, 8 => 90,
            6, 7 => 270,
            default => 0,
        };

        return $angle === 0 ? $image : (imagerotate($image, $angle, 0) ?: $image);
    }

    private function webp(GdImage $image, int $limit): string
    {
        $ratio = min(1, $limit / max(imagesx($image), imagesy($image)));
        $scaled = $ratio === 1 ? $image : imagescale($image, max(1, (int) round(imagesx($image) * $ratio)), max(1, (int) round(imagesy($image) * $ratio)));
        abort_if($scaled === false, 503, 'No se pudo redimensionar la foto.');
        imagesavealpha($scaled, true);
        ob_start();
        try {
            $encoded = imagewebp($scaled, null, 82) ? ob_get_contents() : false;
        } finally {
            ob_end_clean();
        }
        abort_unless(is_string($encoded) && substr($encoded, 8, 4) === 'WEBP', 503, 'No se pudo optimizar la foto.');

        return $encoded;
    }
}
