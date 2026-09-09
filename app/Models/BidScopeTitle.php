<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class BidScopeTitle extends Model
{
    protected $fillable = [
        'uuid',
        'name',
    ];

    protected static function booted(): void
    {
        static::creating(function (BidScopeTitle $title): void {
            $title->uuid ??= (string) Str::uuid();
        });
    }

    public function scopes(): HasMany
    {
        return $this->hasMany(BidScope::class);
    }
}
