<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class CustomerContactRole extends Model
{
    protected $fillable = [
        'uuid',
        'name',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

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
