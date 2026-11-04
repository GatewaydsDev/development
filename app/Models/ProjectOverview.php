<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Read-only model over the MySQL `project_overview` view.
 */
class ProjectOverview extends Model
{
    protected $table = 'project_overview';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'contractors' => 'array',
            'scopes' => 'array',
            'revisions' => 'array',
            'prices' => 'array',
            'quotations' => 'array',
            'bids' => 'array',
            'takeoffs' => 'array',
            'work_schedules' => 'array',
            'attendance' => 'array',
            'check_ins' => 'array',
            'employee_assignments' => 'array',
            'attendance_days_count' => 'integer',
            'has_attendance' => 'boolean',
            'has_work_schedule' => 'boolean',
            'bids_count' => 'integer',
        ];
    }
}
