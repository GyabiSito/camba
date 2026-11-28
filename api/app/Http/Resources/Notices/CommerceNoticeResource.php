<?php

namespace App\Http\Resources\Notices;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CommerceNoticeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return $this->only(['id', 'channel', 'kind', 'subject_type', 'state', 'issue', 'error_code', 'attempts', 'created_at', 'updated_at']) + [
            'subject_id' => $this->subject_type === 'cart' ? null : $this->subject_id,
            'order_reference' => $this->order_reference,
        ];
    }
}
