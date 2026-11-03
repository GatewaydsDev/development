<?php

namespace App\Models\ContactDirectory;

use App\Models\Concerns\HasUuidRouteKey;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PriceRequestPreferredQuote extends Model
{
    use HasUuidRouteKey;

    protected $table = 'contact_directory_price_request_preferred_quotes';

    protected $fillable = [
        'uuid',
        'price_request_id',
        'supplier_quote_id',
        'selection_reason',
        'selected_by',
        'selected_at',
    ];

    protected function casts(): array
    {
        return [
            'selected_at' => 'datetime',
        ];
    }

    public function priceRequest(): BelongsTo
    {
        return $this->belongsTo(PriceRequest::class, 'price_request_id');
    }

    public function supplierQuote(): BelongsTo
    {
        return $this->belongsTo(SupplierQuote::class, 'supplier_quote_id');
    }

    public function selectedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'selected_by');
    }
}
