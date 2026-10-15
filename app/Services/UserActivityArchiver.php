<?php

namespace App\Services;

use App\Models\UserActivity;
use App\Models\UserActivityArchive;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class UserActivityArchiver
{
    public const RETENTION_MONTHS = 3;

    public function archive(int $months = self::RETENTION_MONTHS): int
    {
        $cutoff = now()->subMonths($months);
        $moved = 0;

        UserActivity::query()
            ->where('occurred_at', '<', $cutoff)
            ->orderBy('id')
            ->chunkById(200, function ($activities) use (&$moved): void {
                DB::transaction(function () use ($activities, &$moved): void {
                    $now = now();
                    $rows = $activities->map(fn (UserActivity $activity): array => [
                        'activity_id' => $activity->id,
                        'user_id' => $activity->user_id,
                        'event_type' => $activity->event_type,
                        'action' => $activity->action,
                        'page_name' => $activity->page_name,
                        'description' => $activity->description,
                        'subject_type' => $activity->subject_type,
                        'subject_id' => $activity->subject_id,
                        'route_name' => $activity->route_name,
                        'method' => $activity->method,
                        'path' => $activity->path,
                        'url' => $activity->url,
                        'ip_address' => $activity->ip_address,
                        'user_agent' => $activity->user_agent,
                        'metadata' => $activity->metadata === null
                            ? null
                            : json_encode($activity->metadata),
                        'occurred_at' => $activity->occurred_at,
                        'archived_at' => $now,
                        'created_at' => $activity->created_at ?? $now,
                        'updated_at' => $now,
                    ])->all();

                    UserActivityArchive::query()->insert($rows);
                    UserActivity::query()->whereIn('id', $activities->pluck('id'))->delete();
                    $moved += $activities->count();
                });
            });

        return $moved;
    }

    public function cutoff(): Carbon
    {
        return now()->subMonths(self::RETENTION_MONTHS);
    }
}
