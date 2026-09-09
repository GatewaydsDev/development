<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class BidStageType extends Model
{
    protected $fillable = [
        'uuid',
        'name',
    ];

    protected static function booted(): void
    {
        static::creating(function (BidStageType $stageType): void {
            $stageType->uuid ??= (string) Str::uuid();
        });
    }

    public function stages(): HasMany
    {
        return $this->hasMany(BidStage::class);
    }
}
