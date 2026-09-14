<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Service extends Model
{
    protected $fillable = [
        'uuid',
        'name',
        'description',
    ];

    protected static function booted(): void
    {
        static::creating(function (Service $service): void {
            $service->uuid ??= (string) Str::uuid();
        });
    }

    public function bidScopeProducts(): HasMany
    {
        return $this->hasMany(BidScopeProduct::class);
    }
}
