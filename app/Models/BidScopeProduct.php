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
        'combined_price',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'unit_bid' => 'decimal:2',
            'extended' => 'decimal:2',
            'allocated_handling' => 'decimal:2',
            'combined_price' => 'decimal:2',
        ];
    }

    public function extendedAmount(): float
    {
        $hasQuantity = $this->quantity !== null;
        $combined = $this->combined_price !== null
            ? (float) $this->combined_price
            : (($this->unit_bid !== null || $this->allocated_handling !== null)
                ? (float) ($this->unit_bid ?? 0) + (float) ($this->allocated_handling ?? 0)
                : null);

        if ($combined !== null) {
            return $hasQuantity
                ? round((float) $this->quantity * $combined, 2)
                : round($combined, 2);
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
