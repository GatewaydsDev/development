<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BidScopeProduct extends Model
{
    protected $fillable = [
        'bid_scope_id',
        'product_id',
        'description',
        'sort_order',
    ];

    public function scope(): BelongsTo
    {
        return $this->belongsTo(BidScope::class, 'bid_scope_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
