<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ProductStatePrice extends Model
{
    protected $fillable = [
        'product_id',
        'tax_state_id',
        'price',
        'markup_percent',
        'min_markup_percent',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'markup_percent' => 'decimal:2',
            'min_markup_percent' => 'decimal:2',
        ];
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function taxState(): BelongsTo
    {
        return $this->belongsTo(TaxState::class);
    }
}
