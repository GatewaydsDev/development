<?php

namespace App\Models;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Expense extends Model
{
    public const CATEGORIES = [
        'course' => 'Course',
        'supplies' => 'Supplies',
        'travel' => 'Travel',
        'software' => 'Software',
        'insurance' => 'Insurance',
        'equipment' => 'Equipment',
        'other' => 'Other',
    ];

    public const FREQUENCIES = [
        'weekly' => 'Weekly',
        'monthly' => 'Monthly',
        'quarterly' => 'Every 3 months',
        'yearly' => 'Yearly',
    ];

    protected $fillable = [
        'user_id',
        'person_name',
        'spent_on',
        'payee',
        'description',
        'category',
        'group_name',
        'amount',
        'recurring_frequency',
        'recurring_starts_on',
        'recurring_ends_on',
        'notes',
        'receipt_path',
        'receipt_name',
    ];

    protected function casts(): array
    {
        return [
            'spent_on' => 'date',
            'amount' => 'decimal:2',
            'recurring_starts_on' => 'date',
            'recurring_ends_on' => 'date',
        ];
    }

    /** The next charge date on or after today, or null when not recurring or already ended. */
    public function nextChargeOn(?CarbonInterface $from = null): ?CarbonImmutable
    {
        if (! $this->recurring_frequency || ! $this->recurring_starts_on) {
            return null;
        }

        $from = CarbonImmutable::parse($from ?? now())->startOfDay();
        $start = CarbonImmutable::parse($this->recurring_starts_on)->startOfDay();
        $step = 0;
        $next = $start;

        // Counting from the first date keeps the day of the month (clamped to short months).
        while ($next->lt($from) && $step < 5000) {
            $step++;
            $next = match ($this->recurring_frequency) {
                'weekly' => $start->addWeeks($step),
                'quarterly' => $start->addMonthsNoOverflow(3 * $step),
                'yearly' => $start->addYearsNoOverflow($step),
                default => $start->addMonthsNoOverflow($step),
            };
        }

        if ($this->recurring_ends_on && $next->gt($this->recurring_ends_on)) {
            return null;
        }

        return $next;
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(ExpensePayment::class)->orderBy('due_on')->orderBy('id');
    }
}
