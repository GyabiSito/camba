<?php

namespace App\Support\Catalog;

use GdImage;
use Illuminate\Http\UploadedFile;

class NormalizeProductImage
{
    public function orient(GdImage $image, UploadedFile $photo): GdImage
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

    public function webp(GdImage $image, int $limit): string
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
