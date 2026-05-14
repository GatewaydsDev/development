<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EmailDeliveryEvent extends Model
{
    protected $fillable = [
        'provider',
        'event_type',
        'recipient',
        'message_id',
        'tag',
        'metadata',
        'payload',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'payload' => 'array',
            'occurred_at' => 'datetime',
        ];
    }
}
