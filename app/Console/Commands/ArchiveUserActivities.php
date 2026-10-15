<?php

namespace App\Console\Commands;

use App\Services\UserActivityArchiver;
use Illuminate\Console\Command;

class ArchiveUserActivities extends Command
{
    protected $signature = 'user-activities:archive {--months=3 : Archive activity older than this many months}';

    protected $description = 'Move user activity older than three months into the archive so the current log stays current';

    public function handle(UserActivityArchiver $archiver): int
    {
        $months = max(1, (int) $this->option('months'));
        $moved = $archiver->archive($months);

        $this->info($moved === 0
            ? 'No activity was old enough to archive.'
            : "Archived {$moved} activity ".($moved === 1 ? 'record' : 'records').'.');

        return self::SUCCESS;
    }
}
