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
        'number',
        'revision_date',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'revision_date' => 'date',
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
}
