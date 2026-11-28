<?php

namespace App\Http\Requests\Notices;

use Illuminate\Foundation\Http\FormRequest;

class UpdateReminderPreferenceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->role === 'buyer' && $this->user()->hasVerifiedEmail();
    }

    public function rules(): array
    {
        return [
            'payment_reminders' => ['sometimes', 'boolean:strict'],
            'cart_reminders' => ['sometimes', 'boolean:strict'],
            'user_id' => ['missing'],
            'email' => ['missing'],
        ];
    }
}
