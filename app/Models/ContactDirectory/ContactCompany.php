<?php

namespace App\Models\ContactDirectory;

use App\Models\Concerns\HasUuidRouteKey;
use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
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
}
