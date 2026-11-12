<?php

namespace App\Support;

use App\Events\JobProgressChanged;
use App\Models\EmployeeWorkSchedule;
use Illuminate\Support\Facades\DB;

class JobProgressRealtime
{
    public static function changed(EmployeeWorkSchedule $schedule, string $change): void
    {
        $scheduleUuid = $schedule->uuid;

        DB::afterCommit(function () use ($scheduleUuid, $change): void {
            rescue(fn () => broadcast(new JobProgressChanged(
                $scheduleUuid,
                $change,
            ))->toOthers());
        });
    }
}
