<?php

namespace App\Actions\Catalog;

use App\Models\Product;
use App\Support\Catalog\NormalizeProductImage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SaveProductImagesAction
{
    private const CLOSED = 'closed';

    private const MAX_PHOTOS = 5;

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
    public function executeIdempotently(int $id, array $photos, string $key, ?int $replaceImageId = null): Product
    {
        return $this->save($id, $photos, $key, $replaceImageId);
    }

    /** @param list<UploadedFile> $photos */
    public function preserveHistoricalGallery(int $id, array $photos): Product
    {
        return $this->save($id, $photos, historical: true);
    }

    private function save(int $id, array $photos, ?string $key = null, ?int $replaceImageId = null, bool $historical = false): Product
    {
        $product = Product::query()->findOrFail($id);
        $receipt = $key === null ? null : [
            'product_id' => $id,
            'upload_key' => strtolower($key),
            'payload_hash' => hash('sha256', ($replaceImageId === null ? '' : "replace:$replaceImageId:")
                .implode('', array_map(fn (UploadedFile $photo) => hash('sha256', $photo->getContent()), $photos))),
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
                $image = app(NormalizeProductImage::class)->orient($image, $photo);
                $base = 'products/optimized/'.$id.'/'.Str::uuid();
                foreach ([1600 => '.webp', 400 => '-thumb.webp'] as $size => $suffix) {
                    $path = $staged[] = $base.$suffix;
                    abort_unless($disk->put($path, app(NormalizeProductImage::class)->webp($image, $size)), 503, 'No se pudo guardar la foto.');
                }
                $photosToInsert[] = $base.'.webp';
                unset($image);
            }

            return DB::transaction(function () use ($id, $photosToInsert, $receipt, $replaceImageId, $historical, &$mayBeReferenced): Product {
                $product = Product::query()->lockForUpdate()->findOrFail($id);
                // Read the receipt after acquiring the product lock, before establishing a consistent snapshot.
                if ($receipt !== null && $this->isReplay($receipt)) {
                    return $product->load(['category', 'brand', 'images']);
                }

                if ($replaceImageId !== null) {
                    $image = $product->images()->whereKey($replaceImageId)->first();
                    if ($image === null) {
                        throw ValidationException::withMessages(['replace_image_id' => 'La foto a reemplazar no pertenece a este producto.']);
                    }
                    // Retain the old immutable media path for any historical links.
                    $image->update(['path' => $photosToInsert[0]]);
                } else {
                    if (! $historical && $product->images()->count() + count($photosToInsert) > self::MAX_PHOTOS) {
                        throw ValidationException::withMessages(['photos' => 'Podés guardar hasta 5 fotos por producto, incluida la portada.']);
                    }
                    $position = ($product->images()->reorder()->max('position') ?? -1) + 1;
                    foreach ($photosToInsert as $path) {
                        $product->images()->create(['path' => $path, 'position' => $position++]);
                    }
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
}
