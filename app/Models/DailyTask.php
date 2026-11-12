<?php

namespace App\Models;

use App\Models\Concerns\HasUuidRouteKey;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DailyTask extends Model
{
    use HasUuidRouteKey;

    public const PERFORMER_ANYONE = 'anyone';

    public const PERFORMER_FOREMAN = 'foreman';

    public const PERFORMER_COMPETENT = 'competent_person';

    public const PERFORMER_QUALITY_CONTROL = 'quality_control';

    /**
     * @var array<string, string>
     */
    public const PERFORMERS = [
        self::PERFORMER_ANYONE => 'Foreman or crew',
        self::PERFORMER_FOREMAN => 'Foreman only',
        self::PERFORMER_COMPETENT => 'Competent person',
        self::PERFORMER_QUALITY_CONTROL => 'Quality control person',
    ];

    protected $fillable = [
        'performed_by',
        'title',
        'daily_task_title_id',
        'description',
        'is_active',
        'requires_photo',
        'requires_quality_control',
        'foreman_user_id',
        'sort_order',
        'created_by',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'requires_photo' => 'boolean',
            'requires_quality_control' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (DailyTask $task): void {
            if ($task->isDirty('daily_task_title_id') && $task->daily_task_title_id) {
                $task->title = DailyTaskTitle::query()->whereKey($task->daily_task_title_id)->value('name') ?? $task->title;
            } elseif ($task->isDirty('title') && trim((string) $task->title) !== '') {
                $task->daily_task_title_id = DailyTaskTitle::findOrCreateByName($task->title)->id;
            }
        });
    }

    public function taskTitle(): BelongsTo
    {
        return $this->belongsTo(DailyTaskTitle::class, 'daily_task_title_id');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('sort_order')->orderBy('id');
    }

    /**
     * Tasks without a foreman apply to every foreman.
     */
    public function scopeForForeman(Builder $query, int $userId): Builder
    {
        return $query->where(fn (Builder $query) => $query
            ->whereNull('foreman_user_id')
            ->orWhere('foreman_user_id', $userId));
    }

    public function foreman(): BelongsTo
    {
        return $this->belongsTo(User::class, 'foreman_user_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function employees(): BelongsToMany
    {
        return $this->belongsToMany(Employee::class, 'daily_task_employee')->withTimestamps();
    }

    public function completions(): HasMany
    {
        return $this->hasMany(DailyTaskCompletion::class);
    }

    /**
     * A task is a reusable template that can be attached to many work schedules.
     */
    public function schedules(): BelongsToMany
    {
        return $this->belongsToMany(EmployeeWorkSchedule::class, 'daily_task_work_schedule')->withTimestamps();
    }
}
