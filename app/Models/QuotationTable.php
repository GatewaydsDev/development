<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class QuotationTable extends Model
{
    protected $fillable = [
        'uuid',
        'quotation_id',
        'title',
        'sort_order',
    ];

    protected static function booted(): void
    {
        static::creating(function (QuotationTable $table): void {
            $table->uuid ??= (string) Str::uuid();
        });
    }

    public function quotation(): BelongsTo
    {
        return $this->belongsTo(Quotation::class);
    }

    public function fields(): HasMany
    {
        return $this->hasMany(QuotationProductField::class)
            ->orderBy('sort_order')
            ->orderBy('id');
    }
}
