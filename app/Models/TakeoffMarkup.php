<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TakeoffMarkup extends Model
{
    protected $fillable = [
        'takeoff_id',
        'document_id',
        'page',
        'kind',
        'color',
        'points',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'page' => 'integer',
            'points' => 'array',
        ];
    }

    public function takeoff(): BelongsTo
    {
        return $this->belongsTo(Takeoff::class);
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(TakeoffDocument::class, 'document_id');
    }
}
