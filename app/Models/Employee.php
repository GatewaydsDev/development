<?php

namespace App\Models;

use App\Models\Concerns\HasUuidRouteKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Str;

class Employee extends Model
{
    use HasUuidRouteKey;

    public const STATUS_ACTIVE = 'active';

    public const STATUS_INACTIVE = 'inactive';

    public const STATUS_ON_LEAVE = 'on_leave';

    public const STATUS_TERMINATED = 'terminated';

    protected $fillable = [
        'uuid',
        'first_name',
        'last_name',
        'email',
        'phone_number',
        'job_title',
        'job_title_id',
        'is_quality_control',
        'department',
        'foreman_user_id',
        'user_id',
        'employment_status',
        'hire_date',
        'date_of_birth',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'hire_date' => 'date',
            'date_of_birth' => 'date',
            'is_quality_control' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Employee $employee): void {
            $employee->uuid ??= (string) Str::uuid();
        });

        // `job_title` stays as a plain-text copy of the related title for existing views and exports.
        static::saving(function (Employee $employee): void {
            if ($employee->isDirty('job_title_id')) {
                $employee->job_title = $employee->job_title_id
                    ? JobTitle::query()->whereKey($employee->job_title_id)->value('name')
                    : null;
            } elseif ($employee->isDirty('job_title')) {
                $name = trim((string) $employee->job_title);

                $employee->job_title = $name === '' ? null : $name;
                $employee->job_title_id = $name === ''
                    ? null
                    : JobTitle::query()->firstOrCreate(['name' => $name])->id;
            }
        });
    }

    public function fullName(): string
    {
        return trim("{$this->first_name} {$this->last_name}");
    }

    public function jobTitle(): BelongsTo
    {
        return $this->belongsTo(JobTitle::class);
    }

    public function payRates(): HasMany
    {
        return $this->hasMany(EmployeePayRate::class);
    }

    public function languagePreference(): HasOne
    {
        return $this->hasOne(EmployeeLanguagePreference::class);
    }

    public function professions(): BelongsToMany
    {
        return $this->belongsToMany(Profession::class);
    }

    public function skills(): BelongsToMany
    {
        return $this->belongsToMany(Skill::class);
    }

    public function certifications(): HasMany
    {
        return $this->hasMany(EmployeeCertification::class);
    }

    public function projectAssignments(): HasMany
    {
        return $this->hasMany(EmployeeProjectAssignment::class);
    }

    public function skillShifts(): HasMany
    {
        return $this->hasMany(EmployeeSkillShift::class);
    }

    public function attendanceWeeks(): HasMany
    {
        return $this->hasMany(EmployeeAttendanceWeek::class);
    }

    public function checkIns(): HasMany
    {
        return $this->hasMany(EmployeeCheckIn::class);
    }

    public function workSchedules(): BelongsToMany
    {
        return $this->belongsToMany(EmployeeWorkSchedule::class, 'work_schedule_employees')
            ->withTimestamps();
    }

    public function foreman(): BelongsTo
    {
        return $this->belongsTo(User::class, 'foreman_user_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
