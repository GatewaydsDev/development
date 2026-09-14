<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Bid extends Model
{
    protected $fillable = [
        'uuid',
        'project_id',
        'created_by',
        'notes',
        'bid_shipping_text_template_id',
        'bid_text_template_id',
        'application_text',
        'bid_scope_text_template_id',
        'scope_of_work_text',
    ];

    protected static function booted(): void
    {
        static::creating(function (Bid $bid): void {
            $bid->uuid ??= (string) Str::uuid();
        });
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function shippingTextTemplate(): BelongsTo
    {
        return $this->belongsTo(BidTextTemplate::class, 'bid_shipping_text_template_id');
    }

    public function textTemplate(): BelongsTo
    {
        return $this->belongsTo(BidTextTemplate::class, 'bid_text_template_id');
    }

    public function scopeTextTemplate(): BelongsTo
    {
        return $this->belongsTo(BidTextTemplate::class, 'bid_scope_text_template_id');
    }

    public function stages(): HasMany
    {
        return $this->hasMany(BidStage::class)
            ->orderBy('sort_order')
            ->orderBy('id');
    }

    public function scopes(): HasMany
    {
        return $this->hasMany(BidScope::class)
            ->orderBy('sort_order')
            ->orderBy('id');
    }

    public function pricings(): HasMany
    {
        return $this->hasMany(BidPricing::class)
            ->orderBy('sort_order')
            ->orderBy('id');
    }

    public function latestTotal(): float
    {
        $this->loadMissing('scopes.products');

        return round((float) $this->scopes->sum(function (BidScope $scope): float {
            if ($scope->products->isNotEmpty()) {
                $fromLines = $scope->products->sum(
                    fn (BidScopeProduct $line): float => $line->extendedAmount(),
                );

                if ($fromLines > 0.0 || $scope->products->contains(
                    fn (BidScopeProduct $line): bool => $line->extended !== null
                        || $line->quantity !== null
                        || $line->unit_bid !== null,
                )) {
                    return $fromLines;
                }
            }

            if ($scope->extended !== null) {
                return (float) $scope->extended;
            }

            if ($scope->quantity === null || $scope->unit_bid === null) {
                return 0.0;
            }

            return (float) $scope->quantity * (float) $scope->unit_bid;
        }), 2);
    }
}
