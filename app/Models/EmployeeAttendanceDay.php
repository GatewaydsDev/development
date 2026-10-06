<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeAttendanceDay extends Model
{
    protected $fillable = [
        'employee_attendance_week_id',
        'work_date',
        'skill_id',
        'profession_id',
        'employee_pay_rate_id',
        'rate_type',
        'custom_rate_type',
        'amount',
        'scheduled',
        'worked',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'work_date' => 'date',
            'amount' => 'decimal:2',
            'scheduled' => 'boolean',
            'worked' => 'boolean',
        ];
    }

    public function week(): BelongsTo
    {
        return $this->belongsTo(EmployeeAttendanceWeek::class, 'employee_attendance_week_id');
    }

    public function profession(): BelongsTo
    {
        return $this->belongsTo(Profession::class);
    }

    public function skill(): BelongsTo
    {
        return $this->belongsTo(Skill::class);
    }

    public function payRate(): BelongsTo
    {
        return $this->belongsTo(EmployeePayRate::class, 'employee_pay_rate_id');
    }
}
