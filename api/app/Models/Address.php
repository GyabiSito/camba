<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['recipient', 'locality_id', 'department', 'locality', 'street', 'number', 'details', 'phone', 'postal_code'])]
class Address extends Model
{
    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Locality, $this> */
    public function geographicLocality(): BelongsTo
    {
        return $this->belongsTo(Locality::class, 'locality_id');
    }
}
