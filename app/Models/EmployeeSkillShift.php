<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeSkillShift extends Model
{
    public const SHIFT_FULL_DAY = 'full_day';

    public const SHIFT_HALF_DAY = 'half_day';

    public const SHIFT_COUPLE_HOURS = 'couple_hours';

    public const PAY_HOURLY = 'hourly';

    public const PAY_DAILY = 'daily';

    protected $fillable = [
        'employee_id',
        'skill_id',
        'shift_type',
        'pay_basis',
        'amount',
        'is_union_member',
        'union_rate',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'union_rate' => 'decimal:2',
            'is_union_member' => 'boolean',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function skill(): BelongsTo
    {
        return $this->belongsTo(Skill::class);
    }
}
