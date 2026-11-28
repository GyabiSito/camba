<?php

namespace App\Http\Requests\Catalog;

use Illuminate\Foundation\Http\FormRequest;

class OrderProductImagesRequest extends FormRequest
{
    public function rules(): array
    {
        return ['ids' => ['required', 'list', 'min:1'], 'ids.*' => ['required', 'integer', 'min:1', 'distinct']];
    }
}
