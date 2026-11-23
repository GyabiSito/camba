<?php

namespace App\Actions\Homepage;

use App\Models\HomepageImage;
use App\Support\Catalog\NormalizeProductImage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SaveHomepageImageAction
{
    public function execute(UploadedFile $photo): HomepageImage
    {
        abort_unless(function_exists('imagewebp') && function_exists('exif_read_data'), 503, 'El procesamiento de imágenes no está disponible.');
        $image = @imagecreatefromstring($photo->getContent());
        if (! $image) {
            throw ValidationException::withMessages(['photo' => 'No se pudo leer la imagen.']);
        }
        $normalizer = app(NormalizeProductImage::class);
        $image = $normalizer->orient($image, $photo);
        $key = (string) Str::uuid();
        $base = 'homepage/'.$key;
        $disk = Storage::disk('local');
        $staged = [];
        $mayBeReferenced = false;
        try {
            foreach ([1800 => '.webp', 400 => '-thumb.webp'] as $size => $suffix) {
                $path = $staged[] = $base.$suffix;
                abort_unless($disk->put($path, $normalizer->webp($image, $size)), 503, 'No se pudo guardar la foto.');
            }
            $ratio = min(1, 1800 / max(imagesx($image), imagesy($image)));

            return DB::transaction(function () use ($image, $key, $base, $ratio, &$mayBeReferenced): HomepageImage {
                $record = HomepageImage::create(['key' => $key, 'path' => $base.'.webp',
                    'width' => max(1, (int) round(imagesx($image) * $ratio)),
                    'height' => max(1, (int) round(imagesy($image) * $ratio))]);
                // A lost commit acknowledgement must not remove already referenced media.
                $mayBeReferenced = true;

                return $record;
            });
        } finally {
            if (! $mayBeReferenced && $staged !== []) {
                $disk->delete($staged);
            }
        }
    }
}
