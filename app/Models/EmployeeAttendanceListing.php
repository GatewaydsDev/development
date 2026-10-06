<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmployeeAttendanceListing extends Model
{
    protected $table = 'employee_attendance_listings';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'week_start' => 'date',
            'week_end' => 'date',
            'employee' => 'array',
            'days' => 'array',
            'work_dates' => 'array',
            'scheduled_count' => 'integer',
            'worked_count' => 'integer',
            'created_at' => 'datetime',
            'updated_at' => 'datetime',
        ];
    }
}
