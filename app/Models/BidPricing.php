<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BidPricing extends Model
{
    protected $fillable = [
        'bid_id',
        'name',
        'revision_date',
        'notes',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'revision_date' => 'date',
        ];
    }

    public function bid(): BelongsTo
    {
        return $this->belongsTo(Bid::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(BidPricingItem::class)
            ->orderBy('sort_order')
            ->orderBy('id');
    }
}
