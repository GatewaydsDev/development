<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeAttendanceListing extends Model
{
    protected $table = 'employee_attendance_listings';

    public $timestamps = false;

    public function week(): BelongsTo
    {
        return $this->belongsTo(EmployeeAttendanceWeek::class, 'id');
    }

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
