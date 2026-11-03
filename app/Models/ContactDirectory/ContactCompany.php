<?php

namespace App\Models\ContactDirectory;

use App\Models\Concerns\HasUuidRouteKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class ContactCompany extends Model
{
    use HasUuidRouteKey, SoftDeletes;

    protected $table = 'contact_companies';

    public const CONTACT_DIRECTORY_TABLE = 'contact_companies';

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
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function contacts(): HasMany
    {
        return $this->hasMany(ContactDirectoryContact::class, 'company_id');
    }

    public function phoneNumbers(): HasMany
    {
        return $this->hasMany(CompanyPhoneNumber::class, 'company_id')->orderBy('id');
    }

    public function emailAddresses(): HasMany
    {
        return $this->hasMany(CompanyEmailAddress::class, 'company_id')->orderBy('id');
    }

    public function primaryPhone(): HasOne
    {
        return $this->hasOne(CompanyPhoneNumber::class, 'company_id')->where('is_primary', true);
    }

    public function primaryEmail(): HasOne
    {
        return $this->hasOne(CompanyEmailAddress::class, 'company_id')->where('is_primary', true);
    }
}
