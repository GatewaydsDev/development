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

    public function quotations(): HasMany
    {
        return $this->hasMany(Quotation::class);
    }

    public function displayCompanyName(): ?string
    {
        if (filled($this->company_name)) {
            return (string) $this->company_name;
        }

        return filled($this->name) ? (string) $this->name : null;
    }

    public function primaryPerson(): ?CustomerContact
    {
        if ($this->relationLoaded('contacts')) {
            return $this->contacts->firstWhere('is_primary', true)
                ?? $this->contacts->first();
        }

        return $this->contacts()
            ->orderByDesc('is_primary')
            ->orderBy('name')
            ->first();
    }

    public function displayContactName(): ?string
    {
        $person = $this->primaryPerson()?->name;

        if (filled($person)) {
            return (string) $person;
        }

        $company = $this->displayCompanyName();

        if (filled($this->name) && $this->name !== $company) {
            return (string) $this->name;
        }

        return null;
    }
}
