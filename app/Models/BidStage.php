<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BidStage extends Model
{
    protected $fillable = [
        'bid_id',
        'bid_stage_type_id',
        'stage_date',
        'notes',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'stage_date' => 'date',
        ];
    }

    public function bid(): BelongsTo
    {
        return $this->belongsTo(Bid::class);
    }

    public function type(): BelongsTo
    {
        return $this->belongsTo(BidStageType::class, 'bid_stage_type_id');
    }
}
