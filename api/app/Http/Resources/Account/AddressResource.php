<?php

namespace App\Http\Resources\Account;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AddressResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'recipient' => $this->recipient,
            'department' => $this->department,
            'locality' => $this->locality,
            'street' => $this->street,
            'number' => $this->number,
            'details' => $this->details,
            'phone' => $this->phone,
            'postal_code' => $this->postal_code,
        ];
    }
}
