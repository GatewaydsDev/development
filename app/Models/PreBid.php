<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class PreBid extends Model
{
    protected $fillable = [
        'uuid',
        'name',
        'project_id',
        'assigned_to',
        'bid_shipping_text_template_id',
        'bid_scope_text_template_id',
        'notes',
        'scope_of_work_text',
        'scopes',
        'stages',
        'revisions',
        'pricings',
        'created_by',
    ];

    protected $casts = [
        'scopes' => 'array',
        'stages' => 'array',
        'revisions' => 'array',
        'pricings' => 'array',
    ];

    protected static function booted(): void
    {
        static::creating(function (PreBid $preBid): void {
            $preBid->uuid ??= (string) Str::uuid();
        });
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function shippingTemplate(): BelongsTo
    {
        return $this->belongsTo(BidTextTemplate::class, 'bid_shipping_text_template_id');
    }

    public function scopeTemplate(): BelongsTo
    {
        return $this->belongsTo(BidTextTemplate::class, 'bid_scope_text_template_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
