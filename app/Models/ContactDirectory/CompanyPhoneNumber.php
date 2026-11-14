<?php

namespace App\Models\ContactDirectory;

use App\Models\Concerns\HasUuidRouteKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CompanyPhoneNumber extends Model
{
    use HasUuidRouteKey;

    protected $table = 'contact_company_phone_numbers';

    protected $fillable = ['uuid', 'company_id', 'phone_number', 'country', 'label', 'extension', 'is_primary'];

    protected function casts(): array
    {
        return ['is_primary' => 'boolean'];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(ContactCompany::class, 'company_id');
    }
}
