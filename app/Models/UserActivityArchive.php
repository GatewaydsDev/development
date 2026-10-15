<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserActivityArchive extends Model
{
    protected $fillable = [
        'activity_id',
        'user_id',
        'event_type',
        'action',
        'page_name',
        'description',
        'subject_type',
        'subject_id',
        'route_name',
        'method',
        'path',
        'url',
        'ip_address',
        'user_agent',
        'metadata',
        'occurred_at',
        'archived_at',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'occurred_at' => 'datetime',
            'archived_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
