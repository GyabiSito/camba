<?php

namespace App\Http\Requests\Homepage;

use Illuminate\Foundation\Http\FormRequest;

class RevisionRequest extends FormRequest
{
    public function rules(): array
    {
        return ['revision' => ['required', 'integer', 'min:1']];
    }
}
