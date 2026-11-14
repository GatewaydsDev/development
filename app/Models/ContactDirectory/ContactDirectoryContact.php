<?php

namespace App\Models\ContactDirectory;

use App\Models\Concerns\HasUuidRouteKey;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class ContactDirectoryContact extends Model
{
    use HasUuidRouteKey, SoftDeletes;

    protected $table = 'contact_directory_contacts';

    public const CONTACT_TYPES = [
        'supplier',
        'customer',
        'subcontractor',
        'other',
    ];

    protected $fillable = [
        'uuid',
        'company_id',
        'first_name',
        'last_name',
        'job_title',
        'contact_type',
        'owner_id',
        'notes',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(ContactCompany::class, 'company_id');
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function phoneNumbers(): HasMany
    {
        return $this->hasMany(ContactPhoneNumber::class, 'contact_id')->orderBy('id');
    }

    public function emailAddresses(): HasMany
    {
        return $this->hasMany(ContactEmailAddress::class, 'contact_id')->orderBy('id');
    }

    public function primaryPhone(): HasOne
    {
        return $this->hasOne(ContactPhoneNumber::class, 'contact_id')->where('is_primary', true);
    }

    public function primaryEmail(): HasOne
    {
        return $this->hasOne(ContactEmailAddress::class, 'contact_id')->where('is_primary', true);
    }

    public function inquiries(): HasMany
    {
        return $this->hasMany(ContactDirectoryInquiry::class, 'contact_id');
    }

    public function activities(): HasMany
    {
        return $this->hasMany(ContactActivity::class, 'contact_id');
    }

    public function followUps(): HasMany
    {
        return $this->hasMany(ContactFollowUp::class, 'contact_id');
    }

    public function fullName(): string
    {
        return trim("{$this->first_name} {$this->last_name}");
    }

    public function scopeWithPrimaryDetails(Builder $query): Builder
    {
        return $query->with(['primaryPhone', 'primaryEmail', 'company']);
    }
}
