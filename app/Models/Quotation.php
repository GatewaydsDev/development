<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Quotation extends Model
{
    public const STATUSES = [
        'draft',
        'sent',
        'accepted',
        'expired',
        'declined',
    ];

    protected $fillable = [
        'uuid',
        'quotation_number',
        'customer_id',
        'project_id',
        'converted_bid_id',
        'title',
        'status',
        'quoted_at',
        'valid_until',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'quoted_at' => 'date',
            'valid_until' => 'date',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Quotation $quotation): void {
            $quotation->uuid ??= (string) Str::uuid();
            $quotation->status = $quotation->status ?: 'draft';
            $quotation->quoted_at ??= now()->toDateString();

            if (blank($quotation->quotation_number)) {
                $quotation->quotation_number = static::nextNumber();
            }
        });
    }

    public static function numberPrefix(?int $year = null): string
    {
        return 'GDS-Q-'.($year ?? (int) now()->year).'-';
    }

    public static function nextNumber(?int $year = null): string
    {
        $year ??= (int) now()->year;
        $prefix = static::numberPrefix($year);
        $latest = static::query()
            ->where('quotation_number', 'like', $prefix.'%')
            ->pluck('quotation_number')
            ->map(function (mixed $number) use ($prefix): int {
                $suffix = substr((string) $number, strlen($prefix));

                return ctype_digit($suffix) ? (int) $suffix : 0;
            })
            ->max();

        return $prefix.str_pad((string) (($latest ?: 0) + 1), 4, '0', STR_PAD_LEFT);
    }

    public static function statusLabel(string $status): string
    {
        return match ($status) {
            'draft' => 'Draft',
            'sent' => 'Sent',
            'accepted' => 'Accepted',
            'expired' => 'Expired',
            'declined' => 'Declined',
            default => Str::headline($status),
        };
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function convertedBid(): BelongsTo
    {
        return $this->belongsTo(Bid::class, 'converted_bid_id');
    }

    public function bids(): HasMany
    {
        return $this->hasMany(Bid::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function lineItems(): HasMany
    {
        return $this->hasMany(QuotationLineItem::class)->orderBy('sort_order')->orderBy('id');
    }

    public function total(): float
    {
        return (float) $this->lineItems->sum(function (QuotationLineItem $item): float {
            if ($item->extended !== null) {
                return (float) $item->extended;
            }

            return (float) $item->quantity * (float) $item->unit_price;
        });
    }
}
