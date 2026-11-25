<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CommerceNotice extends Model
{
    public const BUYER_WELCOME = 'buyer_welcome';

    public const ADMIN_ORDER_CREATED = 'admin_order_created';

    public const ORDER_DELIVERED = 'order_delivered';

    protected $guarded = ['id'];

    protected $hidden = ['dedup_key', 'source_hash'];

    protected $casts = [
        'source_at' => 'datetime',
        'available_at' => 'datetime',
        'started_at' => 'datetime',
        'sent_at' => 'datetime',
        'attempts' => 'integer',
    ];
}
