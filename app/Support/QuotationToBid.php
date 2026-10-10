<?php

namespace App\Support;

use App\Models\Bid;
use App\Models\BidPricing;
use App\Models\BidPricingItem;
use App\Models\BidRevision;
use App\Models\BidScope;
use App\Models\BidScopeTitle;
use App\Models\BidStage;
use App\Models\BidStageType;
use App\Models\Quotation;
use App\Models\QuotationProductField;
use App\Models\QuotationLineItem;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class QuotationToBid
{
    public static function convert(Quotation $quotation, User $user): Bid
    {
        return DB::transaction(function () use ($quotation, $user): Bid {
            $quotation = Quotation::query()
                ->whereKey($quotation->getKey())
                ->lockForUpdate()
                ->with([
                    'lineItems',
                    'project',
                    'convertedBid',
                    'bids',
                    'revisions',
                    'contacts',
                    'tables.fields.field',
                    'tables.fields.product',
                    'productFields.field',
                    'productFields.product',
                ])
                ->firstOrFail();

            $existingBid = $quotation->convertedBid ?? $quotation->bids->first();

            if ($existingBid) {
                return $existingBid;
            }

            if (! $quotation->project_id || ! $quotation->project) {
                throw ValidationException::withMessages([
                    'project_id' => 'This quotation needs a project before it can become a bid.',
                ]);
            }

            $project = $quotation->project;

            if ($quotation->contractor_id) {
                $project->contractors()->syncWithoutDetaching([
                    $quotation->contractor_id,
                ]);
            }

            $total = $quotation->total();
            $lineItemsHtml = static::lineItemsHtml($quotation);
            $scopeHtml = static::quotationScopeHtml($quotation, $lineItemsHtml);

            $bid = Bid::query()->create([
                'project_id' => $quotation->project_id,
                'quotation_id' => $quotation->id,
                'notes' => static::proposalHtml($quotation),
                'scope_of_work_text' => $scopeHtml,
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
                'notes' => static::pricingNotes($quotation),
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

            foreach ($quotation->revisions as $revision) {
                BidRevision::query()->create([
                    'bid_id' => $bid->id,
                    'user_id' => $revision->user_id ?: $user->id,
                    'number' => $revision->number,
                    'revision_date' => $revision->revision_date?->toDateString(),
                    'notes' => $revision->notes,
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
        $quotation->loadMissing(['contractor', 'project', 'lineItems', 'revisions']);

        $contractorName = $quotation->contractor?->name
            ?: 'Contractor';

        return [
            'id' => $quotation->id,
            'uuid' => $quotation->uuid,
            'name' => trim($quotation->quotation_number.' · '.$quotation->title.' · '.$contractorName),
            'quotation_number' => $quotation->quotation_number,
            'title' => $quotation->title,
            'project_id' => $quotation->project_id,
            'notes' => $quotation->notes,
            'field_values' => BidApplicationText::quotationValues($quotation),
            'line_items' => $quotation->lineItems
                ->map(fn (QuotationLineItem $item): array => [
                    'description' => $item->description,
                    'quantity' => $item->quantity,
                    'size' => $item->size,
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
                $parts = [];

                if ($item->quantity !== null) {
                    $parts[] = 'Qty '.e(rtrim(rtrim(number_format((float) $item->quantity, 2, '.', ''), '0'), '.') ?: '0');
                }

                if (filled($item->size)) {
                    $parts[] = 'Size '.e((string) $item->size);
                }

                $parts[] = e($item->description);

                if ($item->unit_price !== null) {
                    $parts[] = e('$'.number_format((float) $item->unit_price, 2));
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

    private static function proposalHtml(Quotation $quotation): ?string
    {
        $notes = $quotation->notes;

        if (! is_string($notes) || trim($notes) === '') {
            return null;
        }

        $heading = trim((string) $quotation->proposal_title);
        $headingHtml = $heading !== ''
            ? '<h2>'.e($heading).'</h2>'
            : '';

        if (strip_tags($notes) === $notes) {
            return BidApplicationText::sanitize(
                $headingHtml.BidApplicationText::plainTextToHtml($notes),
            );
        }

        $sanitized = BidApplicationText::sanitize($headingHtml.$notes);

        return $sanitized && ! BidApplicationText::isEmpty($sanitized)
            ? $sanitized
            : null;
    }

    private static function quotationScopeHtml(Quotation $quotation, string $lineItemsHtml): string
    {
        $details = array_filter([
            'Status: '.Quotation::statusLabel($quotation->status),
            $quotation->quoted_at ? 'Quoted on: '.$quotation->quoted_at->format('F j, Y') : null,
            $quotation->valid_until ? 'Valid until: '.$quotation->valid_until->format('F j, Y') : null,
            $quotation->project_amount !== null
                ? 'Total project amount: $'.number_format((float) $quotation->project_amount, 2)
                : null,
            $quotation->contacts->isNotEmpty()
                ? 'Contacts: '.$quotation->contacts->pluck('name')->filter()->implode(', ')
                : null,
        ]);

        $parts = [
            '<p>Created from quotation '.e($quotation->quotation_number).' — '.e($quotation->title).'.</p>',
            $details !== []
                ? '<p>'.implode('<br>', array_map('e', $details)).'</p>'
                : '',
            $lineItemsHtml,
        ];

        $pricingBasis = BidApplicationText::sanitize($quotation->pricing_basis);
        $pricingConditions = BidApplicationText::sanitize($quotation->pricing_conditions);

        if ($pricingBasis) {
            $parts[] = '<h2>Pricing basis</h2>'.$pricingBasis;
        }

        if ($pricingConditions) {
            $parts[] = '<h2>Quotation details</h2>'.$pricingConditions;
        }

        $tableHtml = static::quotationTablesHtml($quotation);

        if ($tableHtml !== '') {
            $parts[] = $tableHtml;
        }

        return BidApplicationText::sanitize(implode('', array_filter($parts))) ?? '';
    }

    private static function quotationTablesHtml(Quotation $quotation): string
    {
        $tables = $quotation->tables
            ->map(function ($table): string {
                $rows = $table->fields
                    ->map(fn (QuotationProductField $field): string => static::quotationFieldRow($field))
                    ->filter()
                    ->implode('');

                if ($rows === '') {
                    return '';
                }

                $heading = filled($table->title)
                    ? '<h3>'.e($table->title).'</h3>'
                    : '';

                return $heading.'<table><tbody>'.$rows.'</tbody></table>';
            })
            ->filter()
            ->implode('');

        $unassignedRows = $quotation->productFields
            ->whereNull('quotation_table_id')
            ->map(fn (QuotationProductField $field): string => static::quotationFieldRow($field))
            ->filter()
            ->implode('');

        return $tables.($unassignedRows !== '' ? '<table><tbody>'.$unassignedRows.'</tbody></table>' : '');
    }

    private static function quotationFieldRow(QuotationProductField $field): string
    {
        $name = $field->field?->name ?: ($field->product?->name ? 'Product' : 'Field');
        $value = trim((string) $field->value) ?: (string) ($field->product?->name ?? '');

        if ($value === '') {
            return '';
        }

        return '<tr><td><strong>'.e($name).'</strong></td><td>'.e($value).'</td></tr>';
    }

    private static function pricingNotes(Quotation $quotation): string
    {
        $notes = [
            'Quotation title: '.$quotation->title,
            $quotation->project_amount !== null
                ? 'Total project amount: $'.number_format((float) $quotation->project_amount, 2)
                : null,
            $quotation->valid_until
                ? 'Valid until: '.$quotation->valid_until->format('F j, Y')
                : null,
        ];

        return implode("\n", array_filter($notes));
    }

    private static function lineAmount(QuotationLineItem $item): ?float
    {
        if ($item->unit_price !== null) {
            return round((float) $item->unit_price, 2);
        }

        return $item->extended !== null ? round((float) $item->extended, 2) : null;
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
