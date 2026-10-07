<?php

namespace App\Models;

use App\Models\Concerns\HasUuidRouteKey;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

class EmployeeAttendanceWeek extends Model
{
    use HasUuidRouteKey;

    /**
     * Monday through Saturday. Sunday is outside the work week.
     *
     * @var list<array{key: string, label: string, short: string}>
     */
    public const WEEKDAYS = [
        ['key' => 'monday', 'label' => 'Monday', 'short' => 'Mon'],
        ['key' => 'tuesday', 'label' => 'Tuesday', 'short' => 'Tue'],
        ['key' => 'wednesday', 'label' => 'Wednesday', 'short' => 'Wed'],
        ['key' => 'thursday', 'label' => 'Thursday', 'short' => 'Thu'],
        ['key' => 'friday', 'label' => 'Friday', 'short' => 'Fri'],
        ['key' => 'saturday', 'label' => 'Saturday', 'short' => 'Sat'],
    ];

    protected $fillable = [
        'employee_id',
        'week_start',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'week_start' => 'date',
        ];
    }

    public static function mondayOf(string $date): Carbon
    {
        $date = substr($date, 0, 10);

        return Carbon::parse($date)->startOfDay()->startOfWeek(Carbon::MONDAY);
    }

    public function saturday(): Carbon
    {
        return $this->week_start->copy()->addDays(5);
    }

    /**
     * @return array{key: string, label: string, short: string}|null
     */
    public static function weekdayFor(CarbonInterface $date): ?array
    {
        $index = $date->dayOfWeekIso - 1;

        return self::WEEKDAYS[$index] ?? null;
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function days(): HasMany
    {
        return $this->hasMany(EmployeeAttendanceDay::class)->orderBy('work_date');
    }
}
