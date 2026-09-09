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
        'sort_order',
    ];

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
