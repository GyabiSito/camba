<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Withdrawal extends Model
{
    protected $guarded = ['id'];

    protected $hidden = ['request_key', 'email'];

    protected $casts = ['email' => 'encrypted', 'refund_confirmed_at' => 'datetime'];
}
