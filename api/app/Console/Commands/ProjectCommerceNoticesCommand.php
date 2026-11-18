<?php

namespace App\Console\Commands;

use App\Actions\Notices\ProjectCommerceNotices;
use App\Jobs\SendCommerceNotice;
use App\Models\CommerceNotice;
use Illuminate\Console\Command;
use Throwable;

class ProjectCommerceNoticesCommand extends Command
{
    protected $signature = 'camba:notices';

    protected $description = 'Project committed commerce events and enqueue due notices';

    public function handle(ProjectCommerceNotices $project): int
    {
        $project->execute();
        $due = CommerceNotice::query()->where('channel', 'mail')->where('state', 'pending')
            ->where('available_at', '<=', now())->orderBy('available_at')->orderBy('id')->limit(100)->pluck('id');
        foreach ($due as $id) {
            try {
                SendCommerceNotice::dispatch($id)->afterCommit();
            } catch (Throwable) {
                $this->error('Notice scheduling is unavailable. Due records remain pending.');

                return self::FAILURE;
            }
        }

        return self::SUCCESS;
    }
}
