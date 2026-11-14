<?php

namespace App\Http\Controllers\ContactDirectory;

use App\Http\Controllers\Controller;
use App\Http\Requests\ContactDirectory\StoreSupplierQuoteRequest;
use App\Models\ContactDirectory\ContactDirectoryInquiry;
use App\Models\ContactDirectory\PriceRequest;
use App\Models\ContactDirectory\SupplierQuote;
use App\Services\ContactDirectory\SupplierQuoteCalculator;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class SupplierQuoteController extends Controller
{
    public function compare(Request $request, PriceRequest $priceRequest, SupplierQuoteCalculator $calculator): Response
    {
        $quotes = SupplierQuote::query()
            ->whereHas('inquiry', fn ($query): mixed => $query->where('price_request_id', $priceRequest->id))
            ->where('is_current_revision', true)
            ->with([
                'items' => fn ($query): mixed => $query->orderBy('position'),
                'inquiry:id,uuid,contact_id,status',
                'inquiry.contact:id,uuid,first_name,last_name',
                'inquiry.contact.company:id,name',
                'inquiry.currentQuote:id,uuid,revision_number,grand_total,currency,supplier_reference_number',
            ])
            ->get();

        $requestedItems = $priceRequest->items()->orderBy('position')->get();

        $comparisons = [];

        foreach ($quotes as $quote) {
            $requestedItemIds = $requestedItems->pluck('id')->all();

            $linkedItems = $quote->items
                ->filter(fn ($item): bool => $item->price_request_item_id !== null)
                ->values();

            $missingItemIds = array_diff($requestedItemIds, $linkedItems->pluck('price_request_item_id')->all());

            $unlinkedItems = $quote->items
                ->filter(fn ($item): bool => $item->price_request_item_id === null)
                ->values();

            $quantityMismatches = $linkedItems->filter(function ($item) use ($requestedItems): bool {
                $requested = $requestedItems->firstWhere('id', $item->price_request_item_id);

                return $requested !== null
                    && ((float) $requested->quantity !== (float) $item->quantity
                        || $requested->unit_of_measure !== $item->unit_of_measure);
            })->count();

            $hasMissingPrices = $quote->items
                ->filter(fn ($item): bool => $item->unit_price === null || trim((string) $item->unit_price) === '')
                ->isNotEmpty();

            $comparisons[] = [
                'quote' => $quote,
                'missing_item_ids' => array_values($missingItemIds),
                'unlinked_items_count' => $unlinkedItems->count(),
                'quantity_mismatches' => $quantityMismatches,
                'has_missing_prices' => $hasMissingPrices,
                'is_comparable' => empty($missingItemIds)
                    && $unlinkedItems->count() === 0
                    && $quantityMismatches === 0
                    && ! $hasMissingPrices
                    && $quote->currency === $priceRequest->currency,
            ];
        }

        $comparable = collect($comparisons)
            ->filter(fn ($comparison): bool => $comparison['is_comparable'])
            ->values();

        $lowestTotal = $comparable
            ->map(fn ($comparison): string => $calculator->calculateGrandTotal($comparison['quote']))
            ->map(fn (string $total): float => (float) $total)
            ->min();

        $selection = $priceRequest->preferredQuoteSelection()->with(['supplierQuote', 'selectedByUser:id,name'])->first();

        $hasNewerRevisionThanSelection = false;

        if ($selection && $selection->supplierQuote) {
            $hasNewerRevisionThanSelection = SupplierQuote::query()
                ->where('inquiry_id', $selection->supplierQuote->inquiry_id)
                ->where('is_current_revision', true)
                ->whereKeyNot($selection->supplier_quote_id)
                ->exists();
        }

        return Inertia::render('ContactDirectory/PriceRequests/CompareQuotes', [
            'priceRequest' => $priceRequest,
            'comparisons' => $comparisons,
            'lowestTotal' => $lowestTotal,
            'selection' => $selection,
            'hasNewerRevisionThanSelection' => $hasNewerRevisionThanSelection,
            'requestedItems' => $requestedItems,
        ]);
    }
}
