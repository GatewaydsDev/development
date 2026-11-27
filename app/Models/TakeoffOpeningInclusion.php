<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TakeoffOpeningInclusion extends Model
{
    public const PENDING = 'pending';

    public const INCLUDED = 'included';

    public const EXCLUDED = 'excluded';

    protected $fillable = [
        'takeoff_id',
        'opening_id',
        'product_id',
        'tax_state_id',
        'supplier_quote_id',
        'supplier_name',
        'unit_price',
        'inclusion',
        'confirmed_at',
        'confirmed_by',
        'notes',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'unit_price' => 'decimal:2',
            'confirmed_at' => 'datetime',
        ];
    }

    public function takeoff(): BelongsTo
    {
        return $this->belongsTo(Takeoff::class);
    }

    public function opening(): BelongsTo
    {
        return $this->belongsTo(TakeoffOpening::class, 'opening_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function taxState(): BelongsTo
    {
        return $this->belongsTo(TaxState::class);
    }

    public function supplierQuote(): BelongsTo
    {
        return $this->belongsTo(TakeoffSupplierQuote::class, 'supplier_quote_id');
    }

    public function confirmer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'confirmed_by');
    }
}
