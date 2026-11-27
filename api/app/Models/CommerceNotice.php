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

    public const ADMIN_WITHDRAWAL_RECEIVED = 'admin_withdrawal_received';

    public const BUYER_TOTAL_REFUND = 'buyer_total_refund';

    public const ADMIN_TOTAL_REFUND = 'admin_total_refund';

    public const TOTAL_REFUND_LOG = 'total_refund_log';

    public const BUYER_WITHDRAWAL_RESOLVED = 'buyer_withdrawal_resolved';

    public const REFUND_MAIL_KINDS = [self::BUYER_TOTAL_REFUND, self::ADMIN_TOTAL_REFUND, self::BUYER_WITHDRAWAL_RESOLVED];

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
