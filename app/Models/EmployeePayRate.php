<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeePayRate extends Model
{
    public const RATE_HOURLY = 'hourly';

    public const RATE_HALF_DAY = 'half_day';

    public const RATE_DAILY = 'daily';

    public const RATE_OVERTIME = 'overtime';

    public const RATE_DAY_OFF = 'day_off';

    public const RATE_CUSTOM = 'custom';

    protected $fillable = [
        'employee_id',
        'profession_id',
        'rate_type',
        'custom_rate_type',
        'amount',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function profession(): BelongsTo
    {
        return $this->belongsTo(Profession::class);
    }
}
