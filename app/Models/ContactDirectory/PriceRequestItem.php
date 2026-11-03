<?php

namespace App\Models\ContactDirectory;

use App\Models\Concerns\HasUuidRouteKey;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PriceRequestItem extends Model
{
    use HasUuidRouteKey;

    protected $table = 'contact_directory_price_request_items';

    protected $fillable = [
        'uuid',
        'price_request_id',
        'position',
        'description',
        'quantity',
        'unit_of_measure',
        'specifications',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:4',
        ];
    }

    public function priceRequest(): BelongsTo
    {
        return $this->belongsTo(PriceRequest::class, 'price_request_id');
    }

    public function quoteItems(): HasMany
    {
        return $this->hasMany(SupplierQuoteItem::class, 'price_request_item_id');
    }
}
