<?php

namespace App\Support;

use App\Models\Bid;
use App\Models\BidPricing;
use App\Models\BidPricingItem;
use App\Models\BidScope;
use App\Models\BidScopeTitle;
use App\Models\BidStage;
use App\Models\BidStageType;
use App\Models\Quotation;
use App\Models\QuotationLineItem;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class QuotationToBid
{
    public static function convert(Quotation $quotation, User $user): Bid
    {
        $quotation->loadMissing(['lineItems', 'project', 'convertedBid']);

        if ($quotation->convertedBid) {
            return $quotation->convertedBid;
        }

        if (! $quotation->project_id || ! $quotation->project) {
            throw ValidationException::withMessages([
                'project_id' => 'Link this quotation to a project before converting it to a bid.',
            ]);
        }

        return DB::transaction(function () use ($quotation, $user): Bid {
            $project = $quotation->project;

            if ($quotation->contractor_id) {
                $project->contractors()->syncWithoutDetaching([
                    $quotation->contractor_id,
                ]);
            }

            $total = $quotation->total();
            $lineItemsHtml = static::lineItemsHtml($quotation);
            $intro = '<p>Created from quotation '.e($quotation->quotation_number).' — '.e($quotation->title).'.</p>';

            $bid = Bid::query()->create([
                'project_id' => $quotation->project_id,
                'quotation_id' => $quotation->id,
                'notes' => $quotation->notes
                    ? BidApplicationText::plainTextToHtml($quotation->notes)
                    : null,
                'application_text' => $intro,
                'scope_of_work_text' => $intro.$lineItemsHtml,
                'created_by' => $user->id,
            ]);

            $stageType = BidStageType::query()
                ->whereRaw('LOWER(name) = ?', ['preliminary bid'])
                ->first()
                ?? BidStageType::query()->orderBy('name')->first()
                ?? BidStageType::query()->create(['name' => 'Preliminary Bid']);

            BidStage::query()->create([
                'bid_id' => $bid->id,
                'bid_stage_type_id' => $stageType->id,
                'stage_date' => now()->toDateString(),
                'notes' => 'Converted from quotation '.$quotation->quotation_number,
                'sort_order' => 0,
            ]);

            BidScope::query()->create([
                'bid_id' => $bid->id,
                'bid_scope_title_id' => static::scopeTitleId('Quotation'),
                'notations' => BidApplicationText::sanitize($lineItemsHtml),
                'quantity' => 1,
                'unit_bid' => $total,
                'extended' => $total,
                'sort_order' => 0,
            ]);

            $pricing = BidPricing::query()->create([
                'bid_id' => $bid->id,
                'name' => 'Imported from '.$quotation->quotation_number,
                'revision_date' => $quotation->quoted_at?->toDateString() ?: now()->toDateString(),
                'notes' => $quotation->title,
                'sort_order' => 0,
            ]);

            foreach ($quotation->lineItems->values() as $index => $item) {
                BidPricingItem::query()->create([
                    'bid_pricing_id' => $pricing->id,
                    'description' => $item->description,
                    'pricing_basis' => static::pricingBasis($item),
                    'amount' => static::lineAmount($item),
                    'sort_order' => $index,
                ]);
            }

            $quotation->forceFill([
                'converted_bid_id' => $bid->id,
            ])->save();

            return $bid->fresh(['project', 'stages.type', 'scopes', 'pricings.items']) ?? $bid;
        });
    }

    /**
     * @return array<string, mixed>
     */
    public static function optionPayload(Quotation $quotation): array
    {
        $quotation->loadMissing(['contractor', 'project', 'lineItems']);

        $contractorName = $quotation->contractor?->name
            ?: 'Contractor';

        return [
            'id' => $quotation->id,
            'name' => trim($quotation->quotation_number.' · '.$quotation->title.' · '.$contractorName),
            'quotation_number' => $quotation->quotation_number,
            'title' => $quotation->title,
            'project_id' => $quotation->project_id,
            'notes' => $quotation->notes,
            'line_items' => $quotation->lineItems
                ->map(fn (QuotationLineItem $item): array => [
                    'description' => $item->description,
                    'quantity' => $item->quantity,
                    'unit_price' => $item->unit_price,
                    'extended' => $item->extended,
                ])
                ->values()
                ->all(),
        ];
    }

    public static function lineItemsHtml(Quotation $quotation): string
    {
        $quotation->loadMissing('lineItems');

        $rows = $quotation->lineItems
            ->map(function (QuotationLineItem $item): string {
                $parts = [e($item->description)];

                if ($item->quantity !== null) {
                    $parts[] = 'Qty '.e(rtrim(rtrim(number_format((float) $item->quantity, 2, '.', ''), '0'), '.') ?: '0');
                }

                if ($item->unit_price !== null) {
                    $parts[] = e('$'.number_format((float) $item->unit_price, 2));
                }

                $amount = static::lineAmount($item);

                if ($amount !== null) {
                    $parts[] = e('$'.number_format((float) $amount, 2));
                }

                return '<li>'.implode(' — ', $parts).'</li>';
            })
            ->implode('');

        if ($rows === '') {
            return '';
        }

        return '<ul>'.$rows.'</ul>';
    }

    private static function scopeTitleId(string $name): int
    {
        $existing = BidScopeTitle::query()
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();

        if ($existing) {
            return $existing->id;
        }

        return BidScopeTitle::query()->create(['name' => $name])->id;
    }

    private static function lineAmount(QuotationLineItem $item): ?float
    {
        if ($item->extended !== null) {
            return round((float) $item->extended, 2);
        }

        if ($item->quantity === null || $item->unit_price === null) {
            return null;
        }

        return round((float) $item->quantity * (float) $item->unit_price, 2);
    }

    private static function pricingBasis(QuotationLineItem $item): ?string
    {
        if ($item->quantity === null && $item->unit_price === null) {
            return null;
        }

        $quantity = $item->quantity !== null
            ? rtrim(rtrim(number_format((float) $item->quantity, 2, '.', ''), '0'), '.')
            : null;
        $unit = $item->unit_price !== null
            ? '$'.number_format((float) $item->unit_price, 2)
            : null;

        return collect([$quantity ? 'Qty '.$quantity : null, $unit])
            ->filter()
            ->implode(' × ') ?: null;
    }
}
