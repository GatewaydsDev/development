<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TakeoffSection extends Model
{
    protected $fillable = [
        'takeoff_id',
        'document_id',
        'page',
        'title',
        'body',
        'opening_ids',
        'x',
        'y',
        'x2',
        'y2',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'page' => 'integer',
            'opening_ids' => 'array',
            'x' => 'float',
            'y' => 'float',
            'x2' => 'float',
            'y2' => 'float',
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
