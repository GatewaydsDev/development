<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Contractor extends Model
{
    public const PHONE_TYPES = [
        'office',
        'mobile',
        'fax',
        'home',
        'other',
    ];

    protected $fillable = [
        'uuid',
        'name',
        'website',
        'address_line_1',
        'address_line_2',
        'city',
        'state',
        'postal_code',
        'country',
        'notes',
        'customer_id',
    ];

    protected static function booted(): void
    {
        static::creating(function (Contractor $contractor): void {
            $contractor->uuid ??= (string) Str::uuid();
        });
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(ContractorContact::class)
            ->orderByDesc('is_primary')
            ->orderBy('name');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function projects(): BelongsToMany
    {
        return $this->belongsToMany(Project::class, 'project_contractor')
            ->withTimestamps();
    }

    public function primaryContact(): ?ContractorContact
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

    public function getContactNameAttribute(): ?string
    {
        return $this->primaryContact()?->name;
    }

    public function getEmailAttribute(): ?string
    {
        return $this->primaryContact()?->email;
    }

    public function getPhoneNumberAttribute(): ?string
    {
        return $this->primaryContact()?->phone_number;
    }
}
