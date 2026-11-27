<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CommerceNotice extends Model
{
    public const BUYER_WELCOME = 'buyer_welcome';

    public const BUYER_PASSWORD_CHANGED = 'buyer_password_changed';

    public const BUYER_ACCOUNT_MAIL_KINDS = [self::BUYER_WELCOME, self::BUYER_PASSWORD_CHANGED];

    public const ADMIN_ORDER_CREATED = 'admin_order_created';

    public const ORDER_DELIVERED = 'order_delivered';

    public const WITHDRAWAL_RECEIPT = 'withdrawal_receipt';

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
