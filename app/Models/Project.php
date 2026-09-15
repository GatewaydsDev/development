<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Project extends Model
{
    public const PRIORITIES = [
        'low',
        'normal',
        'high',
        'urgent',
    ];

    public const SERVICE_TYPES = [
        'radio_frequency_doors',
        'sound_transmission',
        'bullet',
        'blast',
        'oversized_assemblies',
        'hurricane_and_tornado',
        'forced_entry_doors',
        'other',
    ];

    protected $fillable = [
        'uuid',
        'project_number',
        'name',
        'customer_id',
        'assigned_to',
        'created_by',
        'service_type',
        'project_status_id',
        'priority',
        'site_address_line_1',
        'site_address_line_2',
        'site_city',
        'site_state',
        'site_postal_code',
        'site_country',
        'estimated_start_date',
        'estimated_end_date',
        'completed_at',
        'budget_amount',
        'public_notes',
        'internal_notes',
    ];

    protected function casts(): array
    {
        return [
            'estimated_start_date' => 'date',
            'estimated_end_date' => 'date',
            'completed_at' => 'datetime',
            'budget_amount' => 'decimal:2',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Project $project): void {
            $project->uuid ??= (string) Str::uuid();
            $project->project_status_id ??= ProjectStatus::defaultId();
        });

        static::created(function (Project $project): void {
            if (filled($project->project_number)) {
                return;
            }

            $project->forceFill([
                'project_number' => static::nextNumber(),
            ])->saveQuietly();
        });
    }

    public static function numberPrefix(?int $year = null): string
    {
        return 'GDS-'.($year ?? (int) now()->year).'-';
    }

    public static function nextNumber(?int $year = null): string
    {
        $year ??= (int) now()->year;
        $prefix = static::numberPrefix($year);
        $latest = static::query()
            ->where('project_number', 'like', $prefix.'%')
            ->pluck('project_number')
            ->map(function (mixed $number) use ($prefix): int {
                $suffix = substr((string) $number, strlen($prefix));

                return ctype_digit($suffix) ? (int) $suffix : 0;
            })
            ->max();

        return $prefix.str_pad((string) (($latest ?: 0) + 1), 4, '0', STR_PAD_LEFT);
    }

    public static function serviceTypeLabel(string $type): string
    {
        $name = ProjectScopeType::query()->where('slug', $type)->value('name');

        if (filled($name)) {
            return (string) $name;
        }

        return collect(explode('_', $type))
            ->filter()
            ->map(fn (string $part): string => ucfirst($part))
            ->implode(' ');
    }

    public function status(): BelongsTo
    {
        return $this->belongsTo(ProjectStatus::class, 'project_status_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function contractors(): BelongsToMany
    {
        return $this->belongsToMany(Contractor::class, 'project_contractor')
            ->withTimestamps()
            ->orderBy('name');
    }

    public function scopes(): HasMany
    {
        return $this->hasMany(ProjectScope::class)->orderBy('scope_type');
    }

    public function revisions(): HasMany
    {
        return $this->hasMany(ProjectRevision::class)
            ->orderByDesc('revision_date')
            ->orderByDesc('id');
    }

    public function bids(): HasMany
    {
        return $this->hasMany(Bid::class)->latest();
    }

    public function quotations(): HasMany
    {
        return $this->hasMany(Quotation::class)->latest();
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
