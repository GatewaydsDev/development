<?php

namespace App\Models\ContactDirectory;

use App\Models\Concerns\HasUuidRouteKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CompanyAddress extends Model
{
    use HasUuidRouteKey;

    public const LABELS = ['office', 'branch', 'warehouse', 'billing', 'shipping', 'other'];

    public const FIELDS = ['address_line_1', 'address_line_2', 'city', 'state', 'postal_code', 'country'];

    protected $table = 'contact_company_addresses';

    protected $fillable = ['uuid', 'company_id', 'label', 'is_headquarters', ...self::FIELDS];

    protected function casts(): array
    {
        return ['is_headquarters' => 'boolean'];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(ContactCompany::class, 'company_id');
    }
}
