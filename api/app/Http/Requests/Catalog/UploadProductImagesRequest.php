<?php

namespace App\Http\Requests\Catalog;

use Illuminate\Foundation\Http\FormRequest;

class UploadProductImagesRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'photos' => ['required', 'array', 'min:1', 'max:12'],
            'photos.*' => ['required', 'image', 'mimetypes:image/jpeg,image/png,image/webp', 'max:10240', 'dimensions:max_width=4096,max_height=4096'],
        ];
    }
}
