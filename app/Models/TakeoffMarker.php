<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TakeoffMarker extends Model
{
    protected $fillable = [
        'opening_id',
        'document_id',
        'page',
        'x',
        'y',
    ];

    protected function casts(): array
    {
        return [
            'page' => 'integer',
            'x' => 'decimal:6',
            'y' => 'decimal:6',
        ];
    }

    public function opening(): BelongsTo
    {
        return $this->belongsTo(TakeoffOpening::class, 'opening_id');
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(TakeoffDocument::class, 'document_id');
    }
}
