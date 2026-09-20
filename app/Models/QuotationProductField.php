<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class QuotationProductField extends Model
{
    protected $fillable = [
        'quotation_id',
        'quotation_table_id',
        'product_id',
        'quotation_field_id',
        'value',
        'sort_order',
    ];

    public function quotation(): BelongsTo
    {
        return $this->belongsTo(Quotation::class);
    }

    public function table(): BelongsTo
    {
        return $this->belongsTo(QuotationTable::class, 'quotation_table_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function field(): BelongsTo
    {
        return $this->belongsTo(QuotationField::class, 'quotation_field_id');
    }
}
