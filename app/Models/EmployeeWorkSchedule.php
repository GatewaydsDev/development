<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Str;

class EmployeeWorkSchedule extends Model
{
    public const STATUS_ACTIVE = 'active';

    public const STATUS_INACTIVE = 'inactive';

    public const STATUS_ON_HOLD = 'on_hold';

    public const STATUS_COMPLETED = 'completed';

    /**
     * @var array<string, string>
     */
    public const STATUSES = [
        self::STATUS_ACTIVE => 'Active',
        self::STATUS_INACTIVE => 'Inactive',
        self::STATUS_ON_HOLD => 'On hold',
        self::STATUS_COMPLETED => 'Completed',
    ];

    protected $fillable = [
        'project_id',
        'starts_on',
        'ends_on',
        'status',
        'foreman_user_id',
        'requires_competent_person',
        'competent_person_employee_id',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'starts_on' => 'date',
            'ends_on' => 'date',
            'requires_competent_person' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (EmployeeWorkSchedule $schedule): void {
            $schedule->uuid ??= (string) Str::uuid();
        });
    }

    public function getRouteKeyName(): string
    {
        return 'uuid';
    }

    public function scopeCovering($query, string $date)
    {
        return $query
            ->whereDate('starts_on', '<=', $date)
            ->whereDate('ends_on', '>=', $date);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function foreman(): BelongsTo
    {
        return $this->belongsTo(User::class, 'foreman_user_id');
    }

    public function competentPerson(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'competent_person_employee_id');
    }

    public function employees(): BelongsToMany
    {
        return $this->belongsToMany(Employee::class, 'work_schedule_employees')
            ->withTimestamps();
    }
}
