<?php

namespace App\Models\ContactDirectory;

use App\Models\Concerns\HasUuidRouteKey;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SupplierQuote extends Model
{
    use HasUuidRouteKey, SoftDeletes;

    protected $table = 'contact_directory_supplier_quotes';

    public const DISCOUNT_MODES = ['amount', 'percent'];

    public const LEAD_TIME_UNITS = [
        'hours',
        'days',
        'weeks',
        'months',
        'business_days',
        'text',
    ];

    public const REVIEW_STATUSES = ['unreviewed', 'awaiting_review', 'reviewed'];

    protected $fillable = [
        'uuid',
        'inquiry_id',
        'revision_number',
        'is_current_revision',
        'supplier_reference_number',
        'received_at',
        'expires_at',
        'currency',
        'discount_amount',
        'discount_mode',
        'freight_amount',
        'tax_amount',
        'other_charges_amount',
        'grand_total',
        'lead_time_value',
        'lead_time_unit',
        'lead_time_text',
        'payment_terms',
        'availability_notes',
        'specification_compliance',
        'exclusions',
        'notes',
        'review_status',
        'reviewed_at',
        'reviewed_by',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'received_at' => 'date',
            'expires_at' => 'date',
            'discount_amount' => 'decimal:2',
            'freight_amount' => 'decimal:2',
            'tax_amount' => 'decimal:2',
            'other_charges_amount' => 'decimal:2',
            'grand_total' => 'decimal:2',
            'is_current_revision' => 'boolean',
            'reviewed_at' => 'datetime',
        ];
    }

    public function inquiry(): BelongsTo
    {
        return $this->belongsTo(ContactDirectoryInquiry::class, 'inquiry_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(SupplierQuoteItem::class, 'supplier_quote_id')->orderBy('position');
    }

    public function reviewedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
