<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DailyTaskCompletion extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_IN_PROGRESS = 'in_progress';

    public const STATUS_COMPLETED = 'completed';

    public const STATUS_BLOCKED = 'blocked';

    /**
     * @var array<string, string>
     */
    public const STATUSES = [
        self::STATUS_PENDING => 'Not started',
        self::STATUS_IN_PROGRESS => 'In progress',
        self::STATUS_COMPLETED => 'Done',
        self::STATUS_BLOCKED => 'Blocked',
    ];

    protected $fillable = [
        'daily_task_id',
        'user_id',
        'performed_by_employee_id',
        'employee_work_schedule_id',
        'work_date',
        'status',
        'progress',
        'notes',
        'latitude',
        'longitude',
        'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'work_date' => 'date',
            'completed_at' => 'datetime',
            'progress' => 'integer',
        ];
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(DailyTask::class, 'daily_task_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function performedBy(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'performed_by_employee_id');
    }

    public function performers(): BelongsToMany
    {
        return $this->belongsToMany(Employee::class, 'daily_task_completion_employees')->withTimestamps();
    }

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(EmployeeWorkSchedule::class, 'employee_work_schedule_id');
    }

    public function photos(): HasMany
    {
        return $this->hasMany(DailyTaskPhoto::class)->orderBy('id');
    }
}
