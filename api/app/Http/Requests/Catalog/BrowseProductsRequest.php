<?php

namespace App\Http\Requests\Catalog;

use App\Enums\ProductStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class BrowseProductsRequest extends FormRequest
{
    public function rules(): array
    {
        $slug = ['nullable', 'string', 'max:160', 'regex:/\A[a-z0-9-]+\z/'];

        return [
            'q' => ['nullable', 'string', 'max:120'],
            'category' => $slug,
            'brand' => $slug,
            'sort' => ['nullable', Rule::in(['newest', 'name', 'price_asc', 'price_desc'])],
            'page' => ['sometimes', 'integer', 'min:1', 'max:2147483647'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'status' => $this->routeIs('admin.catalog.*') ? ['nullable', Rule::enum(ProductStatus::class)] : ['missing'],
            'availability' => $this->routeIs('admin.catalog.*') ? ['nullable', Rule::in(['out_of_stock'])] : ['missing'],
        ];
    }
}
