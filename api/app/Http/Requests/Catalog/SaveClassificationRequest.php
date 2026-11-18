<?php

namespace App\Http\Requests\Catalog;

use Illuminate\Foundation\Http\FormRequest;

class SaveClassificationRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => [...($this->isMethod('PATCH') ? ['sometimes'] : []), 'required', 'string', 'max:120'],
            'active' => ['sometimes', 'required', 'boolean:strict'],
            'slug' => ['missing'],
            'parent_id' => ['missing'],
        ];
    }
}
