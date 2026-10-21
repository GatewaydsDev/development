<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InternalMessageRead extends Model
{
    protected $fillable = [
        'user_id',
        'with_user_id',
        'last_read_message_id',
    ];

    protected function casts(): array
    {
        return [
            'last_read_message_id' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
