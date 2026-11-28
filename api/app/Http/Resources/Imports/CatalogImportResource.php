<?php

namespace App\Http\Resources\Imports;

use App\Models\CatalogImportRow;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CatalogImportResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->completed_at ? 'completed' : ($this->confirmed_at ? 'queued' : 'preview'),
            'uploaded_by' => $this->uploaded_by,
            'uploaded_by_admin_id' => $this->uploaded_by_admin_id,
            'confirmed_by' => $this->confirmed_by,
            'confirmed_by_admin_id' => $this->confirmed_by_admin_id,
            'confirmed_at' => $this->confirmed_at,
            'completed_at' => $this->completed_at,
            'counts' => array_replace(array_fill_keys(['ready', 'invalid', 'applied', 'failed'], 0), $this->rows->countBy('status')->all()),
            'rows' => $this->rows->map(fn (CatalogImportRow $row) => [
                ...$row->only(['line', 'sku', 'status', 'action', 'product_id']),
                'values' => (object) $row->values,
                'errors' => (object) $row->errors,
                'changes' => (object) $row->changes,
            ]),
        ];
    }
}
