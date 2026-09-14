<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BidScopeProduct extends Model
{
    protected $fillable = [
        'bid_scope_id',
        'product_id',
        'service_id',
        'description',
        'quantity',
        'unit_bid',
        'extended',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'unit_bid' => 'decimal:2',
            'extended' => 'decimal:2',
        ];
    }

    public function extendedAmount(): float
    {
        if ($this->extended !== null) {
            return (float) $this->extended;
        }

        if ($this->quantity === null || $this->unit_bid === null) {
            return 0.0;
        }

        return (float) $this->quantity * (float) $this->unit_bid;
    }

    public function scope(): BelongsTo
    {
        return $this->belongsTo(BidScope::class, 'bid_scope_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }
}
