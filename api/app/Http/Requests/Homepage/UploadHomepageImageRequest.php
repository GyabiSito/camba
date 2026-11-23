<?php

namespace App\Http\Requests\Homepage;

use Illuminate\Foundation\Http\FormRequest;

class UploadHomepageImageRequest extends FormRequest
{
    public function rules(): array
    {
        return ['photo' => ['required', 'image', 'mimetypes:image/jpeg,image/png,image/webp', 'max:10240', 'dimensions:max_width=4096,max_height=4096']];
    }
}
