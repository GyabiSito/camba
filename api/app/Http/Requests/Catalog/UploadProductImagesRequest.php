<?php

namespace App\Http\Requests\Catalog;

use Illuminate\Foundation\Http\FormRequest;

class UploadProductImagesRequest extends FormRequest
{
    public function validationData(): array
    {
        $data = parent::validationData();
        unset($data['idempotency_key']);
        $keys = $this->headers->all('Idempotency-Key');
        if ($keys !== []) {
            $data['idempotency_key'] = count($keys) === 1 ? $keys[0] : $keys;
        }

        return $data;
    }

    public function rules(): array
    {
        return [
            'idempotency_key' => ['sometimes', 'required', 'uuid'],
            'photos' => ['required', 'array', 'min:1', 'max:12'],
            'photos.*' => ['required', 'image', 'mimetypes:image/jpeg,image/png,image/webp', 'max:10240', 'dimensions:max_width=4096,max_height=4096'],
        ];
    }
}
