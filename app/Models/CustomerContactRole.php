<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * @deprecated Removed from the application. Kept so historical migrations can refresh the test database.
 */
class CustomerContactRole extends Model
{
    protected $guarded = [];

    protected static function booted(): void
    {
        static::creating(function (CustomerContactRole $role): void {
            $role->uuid ??= (string) Str::uuid();
        });
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(CustomerContact::class);
    }
}
