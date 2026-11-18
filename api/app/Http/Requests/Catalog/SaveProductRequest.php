<?php

namespace App\Http\Requests\Catalog;

use Illuminate\Foundation\Http\FormRequest;

class SaveProductRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => ['nullable', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:4000'],
            'price_cents' => ['nullable', 'integer:strict', 'min:1', 'max:2147483647'],
            'stock' => ['sometimes', 'required', 'integer:strict', 'min:0', 'max:2147483647'],
            'category_id' => ['nullable', 'integer:strict', 'exists:categories,id'],
            'brand_id' => ['nullable', 'integer:strict', 'exists:brands,id'],
            'status' => ['missing'],
            'sku' => ['missing'],
            'slug' => ['missing'],
            'images' => ['missing'],
        ];
    }
}
