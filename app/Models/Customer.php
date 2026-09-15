<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Str;

class Customer extends Model
{
    protected $fillable = [
        'uuid',
        'name',
        'company_name',
        'email',
        'phone_number',
        'address_line_1',
        'address_line_2',
        'city',
        'state',
        'postal_code',
        'country',
    ];

    protected static function booted(): void
    {
        static::creating(function (Customer $customer): void {
            $customer->uuid ??= (string) Str::uuid();
        });
    }

    public function project(): HasOne
    {
        return $this->hasOne(Project::class)->latestOfMany();
    }

    public function projects(): HasMany
    {
        return $this->hasMany(Project::class);
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(CustomerContact::class);
    }

    public function contractors(): HasMany
    {
        return $this->hasMany(Contractor::class);
    }
}
