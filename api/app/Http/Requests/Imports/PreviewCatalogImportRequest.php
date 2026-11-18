<?php

namespace App\Http\Requests\Imports;

use Illuminate\Foundation\Http\FormRequest;

class PreviewCatalogImportRequest extends FormRequest
{
    public function rules(): array
    {
        return ['file' => ['required', 'file', 'max:2048', 'extensions:csv,xlsx']];
    }
}
