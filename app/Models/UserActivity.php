<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserActivity extends Model
{
    public const TYPE_LOGIN = 'login';

    public const TYPE_PAGE_VIEW = 'page_view';

    public const TYPE_RECORD_CREATED = 'record_created';

    public const TYPE_RECORD_UPDATED = 'record_updated';

    public const TYPE_RECORD_DELETED = 'record_deleted';

    protected $fillable = [
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
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'occurred_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
