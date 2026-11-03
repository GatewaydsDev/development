<?php

namespace App\Models\ContactDirectory;

use App\Models\Concerns\HasUuidRouteKey;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContactActivity extends Model
{
    use HasUuidRouteKey;

    protected $table = 'contact_directory_activities';

    public const TYPES = ['email', 'phone_call', 'meeting', 'text_message', 'note'];
    public const DIRECTIONS = ['incoming', 'outgoing', 'internal'];

    protected $fillable = [
        'uuid',
        'contact_id',
        'inquiry_id',
        'activity_type',
        'direction',
        'subject',
        'content',
        'occurred_at',
        'created_by',
        'mail_provider_message_id',
        'mail_provider_status',
        'mail_recipients',
        'mail_sender',
        'mail_delivered',
    ];

    protected function casts(): array
    {
        return [
            'occurred_at' => 'datetime',
            'mail_recipients' => 'array',
            'mail_delivered' => 'boolean',
        ];
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(ContactDirectoryContact::class, 'contact_id');
    }

    public function inquiry(): BelongsTo
    {
        return $this->belongsTo(ContactDirectoryInquiry::class, 'inquiry_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
