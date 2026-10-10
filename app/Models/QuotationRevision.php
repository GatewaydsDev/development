<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class QuotationRevision extends Model
{
    protected $fillable = [
        'uuid',
        'quotation_id',
        'user_id',
        'responsible_user_id',
        'responsible_assigned_by_id',
        'responsible_assigned_at',
        'responsible_response',
        'responsible_responded_at',
        'status_id',
        'title_id',
        'number',
        'revision_date',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'revision_date' => 'date',
            'responsible_assigned_at' => 'datetime',
            'responsible_responded_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (QuotationRevision $revision): void {
            $revision->uuid ??= (string) Str::uuid();
            $revision->user_id ??= auth()->id();
        });
    }

    public function quotation(): BelongsTo
    {
        return $this->belongsTo(Quotation::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function status(): BelongsTo
    {
        return $this->belongsTo(QuotationRevisionStatus::class, 'status_id');
    }

    public function title(): BelongsTo
    {
        return $this->belongsTo(QuotationRevisionTitle::class, 'title_id');
    }

    public function responsibleUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsible_user_id');
    }

    public function responsibleAssignedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsible_assigned_by_id');
    }
}
