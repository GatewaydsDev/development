<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Str;

class ContractorContact extends Model
{
    protected $fillable = [
        'uuid',
        'contractor_id',
        'name',
        'title',
        'email',
        'phone_number',
        'phone_type',
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
        static::creating(function (ContractorContact $contact): void {
            $contact->uuid ??= (string) Str::uuid();
        });
    }

    public function contractor(): BelongsTo
    {
        return $this->belongsTo(Contractor::class);
    }

    public function quotations(): BelongsToMany
    {
        return $this->belongsToMany(Quotation::class, 'quotation_contact');
    }
}
