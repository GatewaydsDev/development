<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InternalMessageAttachment extends Model
{
    protected $fillable = [
        'internal_message_id',
        'path',
        'original_name',
        'mime',
        'size',
        'is_image',
    ];

    protected function casts(): array
    {
        return [
            'size' => 'integer',
            'is_image' => 'boolean',
        ];
    }

    public function message(): BelongsTo
    {
        return $this->belongsTo(InternalMessage::class, 'internal_message_id');
    }
}
