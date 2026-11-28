<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('camba:reconcile-payments')->everyMinute()->withoutOverlapping(10);
Schedule::command('camba:notices')->everyMinute()->withoutOverlapping(10);
