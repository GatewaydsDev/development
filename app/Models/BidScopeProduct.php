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
        'location',
        'description',
        'quantity',
        'unit_bid',
        'extended',
        'allocated_handling',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'unit_bid' => 'decimal:2',
            'extended' => 'decimal:2',
            'allocated_handling' => 'decimal:2',
        ];
    }

    public function extendedAmount(): float
    {
        $hasQuantity = $this->quantity !== null;
        $hasUnit = $this->unit_bid !== null;
        $allocated = (float) ($this->allocated_handling ?? 0);

        if ($hasQuantity && $hasUnit) {
            return round((float) $this->quantity * (float) $this->unit_bid + $allocated, 2);
        }

        if ($this->allocated_handling !== null) {
            return round($allocated, 2);
        }

        if ($this->extended !== null) {
            return (float) $this->extended;
        }

        return 0.0;
    }

    public function allocatedHandlingAmount(): float
    {
        return (float) ($this->allocated_handling ?? 0);
    }

    public function lineTotal(): float
    {
        return $this->extendedAmount();
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
