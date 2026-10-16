<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MailMessageState extends Model
{
    protected $fillable = [
        'user_id',
        'mailbox',
        'message_key',
        'message_id',
        'is_read',
        'is_archived',
        'counts_in_graph_unread',
        'subject',
        'sender',
        'preview',
        'received_at',
    ];

    protected function casts(): array
    {
        return [
            'is_read' => 'boolean',
            'is_archived' => 'boolean',
            'received_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
