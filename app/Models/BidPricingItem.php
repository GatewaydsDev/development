<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BidPricingItem extends Model
{
    protected $fillable = [
        'bid_pricing_id',
        'description',
        'pricing_basis',
        'bid_pricing_status_id',
        'amount',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
        ];
    }

    public function pricing(): BelongsTo
    {
        return $this->belongsTo(BidPricing::class, 'bid_pricing_id');
    }

    public function status(): BelongsTo
    {
        return $this->belongsTo(BidPricingStatus::class, 'bid_pricing_status_id');
    }
}
