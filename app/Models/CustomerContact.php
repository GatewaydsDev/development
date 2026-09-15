<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * @deprecated Removed from the application. Kept so historical migrations can refresh the test database.
 */
class CustomerContact extends Model
{
    protected $guarded = [];

    protected static function booted(): void
    {
        static::creating(function (CustomerContact $contact): void {
            $contact->uuid ??= (string) Str::uuid();
        });
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(CustomerContactRole::class, 'customer_contact_role_id');
    }
}
