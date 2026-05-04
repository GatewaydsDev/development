<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class ContactSubmission extends Model
{
    protected $fillable = [
        'uuid',
        'name',
        'email',
        'phone_number',
        'organization',
        'project_type',
        'message',
        'source_url',
        'ip_address',
        'user_agent',
        'emailed_at',
    ];

    protected function casts(): array
    {
        return [
            'emailed_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (ContactSubmission $submission): void {
            $submission->uuid ??= (string) Str::uuid();
        });
    }
}
