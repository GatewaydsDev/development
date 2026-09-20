<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class BidTextTemplate extends Model
{
    public const KIND_APPLICATION = 'application';

    public const KIND_SCOPE = 'scope';

    public const KIND_SHIPPING = 'shipping';

    public const KIND_QUOTATION_PROPOSAL = 'quotation_proposal';

    public const KIND_QUOTATION_PRICING = 'quotation_pricing';

    public const KIND_QUOTATION_PRICING_BASIS = 'quotation_pricing_basis';

    public const KINDS = [
        self::KIND_SCOPE,
        self::KIND_SHIPPING,
        self::KIND_QUOTATION_PROPOSAL,
        self::KIND_QUOTATION_PRICING,
        self::KIND_QUOTATION_PRICING_BASIS,
    ];

    public const DEFAULT_SCOPE_BODY = '<p>This proposal covers the scope of work for <strong>{{project_name}}</strong> at {{project_address}}.</p><p>{{scope_of_work}}</p>';

    public const DEFAULT_SHIPPING_BODY = <<<'HTML'
<p>Shipping, handling, exclusions, and adjustments for <strong>{{project_name}}</strong> are as follows:</p>
<ul>
<li>Freight and handling are as quoted unless noted otherwise.</li>
<li>Taxes, bonds, permits, and fees are excluded unless listed in this bid.</li>
</ul>
HTML;

    public const DEFAULT_QUOTATION_PROPOSAL_BODY = '<p>This quotation is based on the quote proposal for this project.</p>';

    public const DEFAULT_QUOTATION_PRICING_BODY = <<<'HTML'
<p>Pricing, conditions, and exclusions for this quotation are as follows:</p>
<ul>
<li>Prices are valid as dated on this quotation.</li>
<li>Taxes, bonds, permits, and freight are excluded unless listed.</li>
</ul>
HTML;

    public const DEFAULT_QUOTATION_PRICING_BASIS_BODY = <<<'HTML'
<p>Pricing for this quotation is based on the following information for <strong>{{project_name}}</strong>.</p>
<p>Quotation {{quotation_number}} · Base Bid total {{base_bid_total}} · Quoted on {{quoted_on}}.</p>
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
            $template->kind ??= self::KIND_SCOPE;
        });
    }
}
