<?php

namespace App\Models\ContactDirectory;

use App\Models\Concerns\HasUuidRouteKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CompanyEmailAddress extends Model
{
    use HasUuidRouteKey;

    protected $table = 'contact_company_email_addresses';

    protected $fillable = ['uuid', 'company_id', 'email_address', 'label', 'is_primary'];

    protected function casts(): array
    {
        return ['is_primary' => 'boolean'];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(ContactCompany::class, 'company_id');
    }
}
