<?php

namespace App\Models;

use App\Models\Concerns\HasUuidRouteKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QualityControlReport extends Model
{
    use HasUuidRouteKey;

    public const RESULT_PASSED = 'passed';
    public const RESULT_REWORK = 'rework';
    public const RESULT_FAILED = 'failed';

    /**
     * @var array<string, string>
     */
    public const RESULTS = [
        self::RESULT_PASSED => 'Passed',
        self::RESULT_REWORK => 'Rework required',
        self::RESULT_FAILED => 'Failed',
    ];

    public const ANSWER_PASS = 'pass';
    public const ANSWER_FAIL = 'fail';
    public const ANSWER_NA = 'na';

    public const ANSWERS = [self::ANSWER_PASS, self::ANSWER_FAIL, self::ANSWER_NA];

    /**
     * @var array<string, string>
     */
    public const CHECKLIST = [
        'workmanship' => 'Workmanship meets the specification',
        'materials' => 'Correct materials and products used',
        'measurements' => 'Measurements and tolerances verified',
        'safety' => 'Safety requirements followed',
        'cleanup' => 'Work area clean and protected',
    ];

    protected $fillable = [
        'employee_work_schedule_id',
        'daily_task_id',
        'daily_task_completion_id',
        'inspector_user_id',
        'inspected_on',
        'result',
        'checklist',
        'fail_reasons',
        'notes',
        'corrective_action',
    ];

    protected function casts(): array
    {
        return [
            'inspected_on' => 'date',
            'checklist' => 'array',
            'fail_reasons' => 'array',
        ];
    }

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(EmployeeWorkSchedule::class, 'employee_work_schedule_id');
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(DailyTask::class, 'daily_task_id');
    }

    public function completion(): BelongsTo
    {
        return $this->belongsTo(DailyTaskCompletion::class, 'daily_task_completion_id');
    }

    public function inspector(): BelongsTo
    {
        return $this->belongsTo(User::class, 'inspector_user_id');
    }
}
