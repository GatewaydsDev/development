<?php

namespace App\Models;

use App\Models\Concerns\HasUuidRouteKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProjectControl extends Model
{
    use HasUuidRouteKey;

    public const STATUSES = [
        'active' => 'Active',
        'on_hold' => 'On hold',
        'lost' => 'Lost',
    ];

    protected $fillable = [
        'uuid',
        'project_id',
        'job_code',
        'name',
        'customer',
        'location',
        'bid_date',
        'current_value',
        'pipeline_status',
        'status_note',
        'award_status',
        'award_status_id',
        'probability',
        'probability_id',
        'scope_summary',
        'assembly_count',
        'pricing_class',
        'pricing_class_id',
        'material_cost',
        'freight_cost',
        'labor_cost',
        'other_cost',
        'deposit_percent',
        'bid_due_date',
        'next_follow_up_date',
        'material_payment_date',
        'customer_payment_date',
        'lead_time',
        'lead_time_id',
        'bonding_required',
        'bonding_option_id',
        'payment_plan',
        'cash_flag',
        'cash_flag_id',
        'next_step',
        'bid_document',
        'counts_in_demonstrated',
    ];

    protected function casts(): array
    {
        return [
            'bid_date' => 'date',
            'bid_due_date' => 'date',
            'next_follow_up_date' => 'date',
            'material_payment_date' => 'date',
            'customer_payment_date' => 'date',
            'current_value' => 'decimal:2',
            'material_cost' => 'decimal:2',
            'freight_cost' => 'decimal:2',
            'labor_cost' => 'decimal:2',
            'other_cost' => 'decimal:2',
            'deposit_percent' => 'decimal:2',
            'assembly_count' => 'integer',
            'counts_in_demonstrated' => 'boolean',
        ];
    }

    public static function nextJobCode(): string
    {
        $latest = static::query()
            ->pluck('job_code')
            ->map(function (mixed $code): int {
                return preg_match('/^J-(\d+)$/i', (string) $code, $matches) === 1
                    ? (int) $matches[1]
                    : 0;
            })
            ->max();

        return 'J-'.str_pad((string) (((int) $latest) + 1), 3, '0', STR_PAD_LEFT);
    }

    public static function pipelineStatusFromNote(string $note): string
    {
        $text = strtoupper($note);

        if (str_contains($text, 'LOST') || str_contains($text, 'CLOSED')) {
            return 'lost';
        }

        if (str_contains($text, 'HOLD') || str_contains($text, 'INACTIVE')) {
            return 'on_hold';
        }

        return 'active';
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function awardStatus(): BelongsTo
    {
        return $this->belongsTo(ProjectControlTerm::class, 'award_status_id');
    }

    public function pricingClass(): BelongsTo
    {
        return $this->belongsTo(ProjectControlTerm::class, 'pricing_class_id');
    }

    public function bondingOption(): BelongsTo
    {
        return $this->belongsTo(ProjectControlTerm::class, 'bonding_option_id');
    }

    public function probabilityTerm(): BelongsTo
    {
        return $this->belongsTo(ProjectControlTerm::class, 'probability_id');
    }

    public function cashFlag(): BelongsTo
    {
        return $this->belongsTo(ProjectControlTerm::class, 'cash_flag_id');
    }

    public function leadTimeTerm(): BelongsTo
    {
        return $this->belongsTo(ProjectControlTerm::class, 'lead_time_id');
    }

    public function bids(): HasMany
    {
        return $this->hasMany(ProjectControlBid::class)->orderBy('sort_order')->orderBy('id');
    }

    public function openings(): HasMany
    {
        return $this->hasMany(ProjectControlOpening::class)->orderBy('sort_order')->orderBy('id');
    }

    public function procurements(): HasMany
    {
        return $this->hasMany(ProjectControlProcurement::class)->orderBy('sort_order')->orderBy('id');
    }

    public function reminders(): HasMany
    {
        return $this->hasMany(ProjectControlReminder::class)->orderBy('remind_at')->orderBy('id');
    }

    public function currentValue(): float
    {
        return round((float) ($this->current_value ?? 0), 2);
    }

    public function directCost(): ?float
    {
        $known = false;
        $sum = 0.0;

        foreach ([$this->material_cost, $this->freight_cost, $this->labor_cost, $this->other_cost] as $part) {
            if ($part === null || $part === '') {
                continue;
            }

            $known = true;
            $sum += (float) $part;
        }

        return $known ? round($sum, 2) : null;
    }

    public function grossProfit(): ?float
    {
        $cost = $this->directCost();

        if ($cost === null) {
            return null;
        }

        return round($this->currentValue() - $cost, 2);
    }

    public function marginPercent(): ?float
    {
        $profit = $this->grossProfit();
        $value = $this->currentValue();

        if ($profit === null || $value <= 0) {
            return null;
        }

        return round($profit / $value * 100, 2);
    }

    public function depositDue(): ?float
    {
        if ($this->deposit_percent === null || (float) $this->deposit_percent <= 0) {
            return null;
        }

        return round($this->currentValue() * (float) $this->deposit_percent / 100, 2);
    }

    public function isActive(): bool
    {
        return $this->pipeline_status === 'active';
    }
}
