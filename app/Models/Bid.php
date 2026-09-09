<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Bid extends Model
{
    protected $fillable = [
        'uuid',
        'project_id',
        'created_by',
        'notes',
    ];

    protected static function booted(): void
    {
        static::creating(function (Bid $bid): void {
            $bid->uuid ??= (string) Str::uuid();
        });
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function stages(): HasMany
    {
        return $this->hasMany(BidStage::class)
            ->orderBy('sort_order')
            ->orderBy('id');
    }

    public function scopes(): HasMany
    {
        return $this->hasMany(BidScope::class)
            ->orderBy('sort_order')
            ->orderBy('id');
    }

    public function pricings(): HasMany
    {
        return $this->hasMany(BidPricing::class)
            ->orderBy('sort_order')
            ->orderBy('id');
    }
}
