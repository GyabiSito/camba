<?php

namespace App\Actions\Geography;

use App\Models\Locality;
use Illuminate\Validation\ValidationException;

class ResolveAddressGeography
{
    public function execute(int $departmentId, int $localityId, string $field = 'locality_id'): Locality
    {
        $locality = Locality::query()->with('department')
            ->where('department_id', $departmentId)->find($localityId);
        if ($locality === null) {
            throw ValidationException::withMessages([$field => 'Elegí una localidad del departamento seleccionado.']);
        }

        return $locality;
    }
}
