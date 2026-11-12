<?php

namespace App\Models;

class WorkScheduleOverview extends WorkScheduleListing
{
    protected $table = 'work_schedule_overview';

    protected function casts(): array
    {
        return [
            ...parent::casts(),
            'quality_control' => 'array',
            'crew_assignments' => 'array',
            'daily_tasks' => 'array',
        ];
    }
}
