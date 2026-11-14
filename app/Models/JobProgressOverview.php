<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Read-only model over the MySQL `job_progress_overview` view: one row per work schedule with
 * its crew, tasks, attendance, hours, pay and quality control reports.
 */
class JobProgressOverview extends Model
{
    protected $table = 'job_progress_overview';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'starts_on' => 'date:Y-m-d',
            'ends_on' => 'date:Y-m-d',
            'tasks' => 'array',
            'crew' => 'array',
            'attendance' => 'array',
            'quality_reports' => 'array',
            'overall_progress' => 'integer',
            'tasks_total' => 'integer',
            'tasks_done' => 'integer',
            'attendance_days_count' => 'integer',
            'quality_reports_count' => 'integer',
            'total_hours' => 'float',
            'total_pay' => 'float',
        ];
    }
}
