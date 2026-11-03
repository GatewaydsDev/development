<?php

namespace App\Models\ContactDirectory;

use App\Models\Concerns\HasUuidRouteKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupplierQuoteItem extends Model
{
    use HasUuidRouteKey;

    protected $table = 'contact_directory_supplier_quote_items';

    protected $fillable = [
        'uuid',
        'supplier_quote_id',
        'price_request_item_id',
        'position',
        'description',
        'quantity',
        'unit_of_measure',
        'unit_price',
        'line_total',
        'availability_notes',
        'specification_notes',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
            'unit_price' => 'decimal:4',
            'line_total' => 'decimal:2',
        ];
    }

    public function supplierQuote(): BelongsTo
    {
        return $this->belongsTo(SupplierQuote::class, 'supplier_quote_id');
    }

    public function priceRequestItem(): BelongsTo
    {
        return $this->belongsTo(PriceRequestItem::class, 'price_request_item_id');
    }
}
