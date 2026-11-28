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
        if ($this->routeIs('admin.catalog.products.images.close')) {
            return ['idempotency_key' => ['required', 'uuid']];
        }

        $replacement = $this->routeIs('admin.catalog.products.images.replace');
        $recoverable = $replacement || $this->routeIs('admin.catalog.products.images.uploads');

        return [
            'idempotency_key' => $recoverable
                ? ['required', 'uuid']
                : ['sometimes', 'required', 'uuid'],
            'replace_image_id' => $replacement ? ['required', 'integer', 'min:1'] : ['prohibited'],
            // Keep the old batch envelope readable so already-completed keys can still be replayed.
            'photos' => ['required', 'array', 'min:1', $replacement ? 'size:1' : 'max:12'],
            'photos.*' => ['required', 'image', 'mimetypes:image/jpeg,image/png,image/webp', 'max:10240', 'dimensions:max_width=4096,max_height=4096'],
        ];
    }
}
