<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class CustomerContact extends Model
{
    protected $fillable = [
        'uuid',
        'customer_id',
        'customer_contact_role_id',
        'name',
        'title',
        'email',
        'phone_number',
        'notes',
        'is_primary',
    ];

    protected function casts(): array
    {
        return [
            'is_primary' => 'boolean',
        ];
    }

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

