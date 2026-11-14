<?php

namespace App\Models\ContactDirectory;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AddressType extends Model
{
    public const DEFAULTS = ['Office', 'Branch office', 'Warehouse', 'Billing', 'Shipping', 'Other'];

    protected $table = 'contact_address_types';

    protected $fillable = ['name'];

    public function addresses(): HasMany
    {
        return $this->hasMany(CompanyAddress::class, 'address_type_id');
    }
}
