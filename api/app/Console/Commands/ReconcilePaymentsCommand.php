<?php

namespace App\Console\Commands;

use App\Actions\Payments\ReconcilePayments;
use Illuminate\Console\Command;

class ReconcilePaymentsCommand extends Command
{
    protected $signature = 'camba:reconcile-payments';

    protected $description = 'Process the durable payment webhook inbox and reconcile due checkouts';

    public function handle(ReconcilePayments $reconcile): int
    {
        $reconcile->execute();

        return self::SUCCESS;
    }
}
