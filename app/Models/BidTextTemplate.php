<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class BidTextTemplate extends Model
{
    public const KIND_APPLICATION = 'application';

    public const KIND_SCOPE = 'scope';

    public const KIND_SHIPPING = 'shipping';

    public const KINDS = [
        self::KIND_APPLICATION,
        self::KIND_SCOPE,
        self::KIND_SHIPPING,
    ];

    public const DEFAULT_APPLICATION_BODY = '<p>Dear {{customer_name}},</p><p>Thank you for the opportunity to bid on <strong>{{project_name}}</strong>. {{company_name}} is pleased to submit this proposal.</p><p>Sincerely,<br>{{company_name}}</p>';

    public const DEFAULT_SCOPE_BODY = '<p>This proposal covers the scope of work for <strong>{{project_name}}</strong> at {{project_address}}.</p><p>{{scope_of_work}}</p>';

    public const DEFAULT_SHIPPING_BODY = <<<'HTML'
<p>Shipping, handling, exclusions, and adjustments for <strong>{{project_name}}</strong> are as follows:</p>
<ul>
<li>Freight and handling are as quoted unless noted otherwise.</li>
<li>Taxes, bonds, permits, and fees are excluded unless listed in this bid.</li>
</ul>
HTML;

    protected $fillable = [
        'uuid',
        'kind',
        'name',
        'body',
    ];

    protected static function booted(): void
    {
        static::creating(function (BidTextTemplate $template): void {
            $template->uuid ??= (string) Str::uuid();
            $template->kind ??= self::KIND_APPLICATION;
        });
    }

    public function bids(): HasMany
    {
        return $this->hasMany(Bid::class);
    }
}
