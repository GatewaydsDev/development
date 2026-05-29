<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class ContactSubmission extends Model
{
    public const STATUSES = ['new', 'in_progress', 'responded', 'closed'];

    protected $fillable = [
        'uuid',
        'name',
        'email',
        'phone_number',
        'organization',
        'address',
        'state',
        'country',
        'project_type',
        'message',
        'status',
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

    public function contacts(): BelongsToMany
    {
        return $this->belongsToMany(
            Contact::class,
            'contact_submission_contact',
            'contact_submission_id',
            'contact_id',
        )
            ->withPivot('emailed_at')
            ->withTimestamps();
    }

    public function emailLogs(): HasMany
    {
        return $this->hasMany(ContactEmailLog::class);
    }
}
