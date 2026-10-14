<?php

namespace App\Models;

use App\Models\Concerns\HasUuidRouteKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class TakeoffSupplierQuote extends Model
{
    use HasUuidRouteKey;

    protected $fillable = [
        'uuid',
        'takeoff_id',
        'opening_id',
        'group_id',
        'supersedes_id',
        'supplier_name',
        'quote_number',
        'revision_label',
        'quote_date',
        'expires_at',
        'storage_path',
        'original_filename',
        'included_scope',
        'exclusions',
        'pricing_notes',
        'accepted_at',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'quote_date' => 'date',
            'expires_at' => 'date',
            'accepted_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (TakeoffSupplierQuote $quote): void {
            $quote->uuid ??= (string) Str::uuid();
        });

        static::deleting(function (TakeoffSupplierQuote $quote): void {
            if ($quote->storage_path) {
                Storage::disk(config('takeoffs.disk'))->delete($quote->storage_path);
            }
        });
    }

    public function takeoff(): BelongsTo
    {
        return $this->belongsTo(Takeoff::class);
    }

    public function opening(): BelongsTo
    {
        return $this->belongsTo(TakeoffOpening::class, 'opening_id');
    }

    public function group(): BelongsTo
    {
        return $this->belongsTo(TakeoffGroup::class, 'group_id');
    }
}
