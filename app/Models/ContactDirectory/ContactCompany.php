<?php

namespace App\Models\ContactDirectory;

use App\Models\Concerns\HasUuidRouteKey;
use App\Models\Project;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
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

    public function projects(): BelongsToMany
    {
        return $this->belongsToMany(Project::class, 'project_contact_company')->withTimestamps()->orderBy('projects.name');
    }

    public function addresses(): HasMany
    {
        return $this->hasMany(CompanyAddress::class, 'company_id')->orderByDesc('is_headquarters')->orderBy('id');
    }

    public function headquarters(): HasOne
    {
        return $this->hasOne(CompanyAddress::class, 'company_id')->where('is_headquarters', true);
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
