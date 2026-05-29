<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Str;

class Contact extends Model
{
    protected $fillable = [
        'uuid',
        'name',
        'email',
        'phone_number',
        'company',
        'title',
        'notes',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Contact $contact): void {
            $contact->uuid ??= (string) Str::uuid();
        });
    }

    public function submissions(): BelongsToMany
    {
        return $this->belongsToMany(
            ContactSubmission::class,
            'contact_submission_contact',
            'contact_id',
            'contact_submission_id',
        )
            ->withPivot('emailed_at')
            ->withTimestamps();
    }
}
