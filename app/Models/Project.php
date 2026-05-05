<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class Project extends Model
{
    public const STATUSES = [
        'lead',
        'quoted',
        'approved',
        'scheduled',
        'in_progress',
        'completed',
        'cancelled',
    ];

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
        'status',
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
        });
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
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

