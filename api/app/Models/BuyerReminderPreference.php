<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BuyerReminderPreference extends Model
{
    public $incrementing = false;

    protected $primaryKey = 'user_id';

    protected $fillable = ['user_id', 'payment_reminders', 'cart_reminders'];

    protected $casts = ['payment_reminders' => 'boolean', 'cart_reminders' => 'boolean'];
}
