<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TakeoffReference extends Model
{
    protected $fillable = [
        'opening_id',
        'document_id',
        'page',
        'section',
        'note',
    ];

    public function opening(): BelongsTo
    {
        return $this->belongsTo(TakeoffOpening::class, 'opening_id');
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(TakeoffDocument::class, 'document_id');
    }
}
