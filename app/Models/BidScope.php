<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BidScope extends Model
{
    protected $fillable = [
        'bid_id',
        'bid_scope_title_id',
        'notations',
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

    public function bid(): BelongsTo
    {
        return $this->belongsTo(Bid::class);
    }

    public function title(): BelongsTo
    {
        return $this->belongsTo(BidScopeTitle::class, 'bid_scope_title_id');
    }

    public function products(): HasMany
    {
        return $this->hasMany(BidScopeProduct::class)
            ->orderBy('sort_order')
            ->orderBy('id');
    }
}
