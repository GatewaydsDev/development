<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TakeoffQuotationLine extends Model
{
    protected $fillable = [
        'quotation_id',
        'quotation_line_item_id',
        'takeoff_id',
        'takeoff_revision',
        'source_key',
        'snapshot',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'snapshot' => 'array',
            'takeoff_revision' => 'integer',
        ];
    }

    public function quotation(): BelongsTo
    {
        return $this->belongsTo(Quotation::class);
    }

    public function lineItem(): BelongsTo
    {
        return $this->belongsTo(QuotationLineItem::class, 'quotation_line_item_id');
    }

    public function takeoff(): BelongsTo
    {
        return $this->belongsTo(Takeoff::class);
    }
}
