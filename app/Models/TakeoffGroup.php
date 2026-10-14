<?php

namespace App\Models;

use App\Models\Concerns\HasUuidRouteKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class TakeoffGroup extends Model
{
    use HasUuidRouteKey;

    protected $fillable = [
        'uuid',
        'takeoff_id',
        'origin_group_id',
        'name',
        'manual',
        'mismatch',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'manual' => 'boolean',
            'mismatch' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (TakeoffGroup $group): void {
            $group->uuid ??= (string) Str::uuid();
        });
    }

    public function takeoff(): BelongsTo
    {
        return $this->belongsTo(Takeoff::class);
    }

    public function openings(): HasMany
    {
        return $this->hasMany(TakeoffOpening::class, 'group_id')->orderBy('sort_order')->orderBy('id');
    }

    public function costs(): HasMany
    {
        return $this->hasMany(TakeoffCost::class, 'group_id')->orderBy('sort_order')->orderBy('id');
    }
}
